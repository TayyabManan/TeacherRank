import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Source guard: no query on `ratings` may select `*` (or call a bare
 * `.select()`, which means `*`).
 *
 * Migration 019 replaces anon/authenticated table-wide SELECT on ratings with
 * an explicit column list (`metadata` carries the anonymous reviewer's device
 * fingerprint; `session_id` and `flagged_by` are withheld too). Under
 * column-level grants PostgREST turns `select=*` into 42501 permission denied
 * for the WHOLE query — including `DELETE ... RETURNING`.
 *
 * This exact bug shipped twice (useUserRating's select('*'), the Admin delete
 * fallback's bare .select()) while the migration runbook claimed the app was
 * ready. The guard makes the invariant mechanical instead of tribal.
 */

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // Skip test scaffolding; the guard covers app code.
      if (entry === '__tests__' || entry === 'test') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\./.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** First `.select(...)` argument text after each `from('ratings')` call. */
function ratingsSelects(source: string): { index: number; arg: string }[] {
  const results: { index: number; arg: string }[] = [];
  const fromRe = /\.from\(\s*['"`]ratings['"`]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = fromRe.exec(source)) !== null) {
    // The select belongs to this chain if it appears before the next statement
    // boundary; 500 chars comfortably covers every chain in this codebase.
    const windowText = source.slice(m.index, m.index + 500);
    const sel = /\.select\(\s*([^)]*?)\s*\)/.exec(windowText);
    if (sel) results.push({ index: m.index, arg: sel[1] });
  }
  return results;
}

const lineOf = (source: string, index: number) =>
  source.slice(0, index).split('\n').length;

describe('ratings select guard', () => {
  const files = walk(SRC_ROOT);

  it('finds the ratings queries it is guarding (self-check)', () => {
    const total = files.reduce(
      (n, f) => n + ratingsSelects(readFileSync(f, 'utf8')).length,
      0,
    );
    // If this ever drops to 0 the walker or regex broke — the guard would be
    // passing vacuously.
    expect(total).toBeGreaterThan(0);
  });

  it('no ratings query selects * or calls a bare .select()', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const { index, arg } of ratingsSelects(source)) {
        const isBare = arg.trim() === '';
        const isStar = /^['"`]\s*\*/.test(arg.trim());
        if (isBare || isStar) {
          offenders.push(
            `${relative(SRC_ROOT, file).split(sep).join('/')}:${lineOf(source, index)} — .select(${arg || ''})`,
          );
        }
      }
    }
    expect(offenders, `use RATING_COLUMNS (see useRatings.ts) instead:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('RATING_COLUMNS matches what migration 019 grants', () => {
    const source = readFileSync(join(SRC_ROOT, 'hooks', 'useRatings.ts'), 'utf8');
    const match = /const RATING_COLUMNS = '([^']+)'/.exec(source);
    expect(match, 'RATING_COLUMNS constant not found in useRatings.ts').not.toBeNull();
    if (!match) return; // unreachable — narrows the type without an assertion

    const columns = match[1].split(',').map((c) => c.trim());
    // Withheld by 019 — selecting any of these breaks the query once it lands.
    for (const forbidden of ['metadata', 'session_id', 'flagged_by']) {
      expect(columns).not.toContain(forbidden);
    }
    // The Rating type's fields — dropping one silently narrows every read-back.
    for (const required of ['id', 'teacher_id', 'student_id', 'score', 'comment', 'created_at']) {
      expect(columns).toContain(required);
    }
  });
});
