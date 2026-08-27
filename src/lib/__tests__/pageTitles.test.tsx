import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import fs from 'fs';
import path from 'path';
import { render } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { Helmet } from '../../components/Meta';

// Page titles must commit even in HIDDEN tabs: react-helmet-async's default
// defers head writes into requestAnimationFrame, which browsers never run for
// background tabs — so a profile opened via ctrl+click kept index.html's
// generic title until focused. The app-wide fix is the Meta wrapper's
// defer={false}; these tests pin both the behavior and the import discipline.

describe('Meta wrapper commits head changes with rAF dead (background tab)', () => {
  let rafSpy: MockInstance;

  beforeEach(() => {
    document.title = 'initial';
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
  });

  afterEach(() => {
    rafSpy.mockRestore();
  });

  it('applies the page title synchronously', () => {
    render(
      <HelmetProvider>
        <Helmet defaultTitle="Default" titleTemplate="%s | TeacherRank" />
        <Helmet>
          <title>Probe page</title>
        </Helmet>
      </HelmetProvider>
    );
    expect(document.title).toBe('Probe page | TeacherRank');
  });

  it('applies meta tags synchronously', () => {
    render(
      <HelmetProvider>
        <Helmet>
          <meta name="description" content="probe description" />
        </Helmet>
      </HelmetProvider>
    );
    const meta = document.querySelector('meta[name="description"]');
    expect(meta?.getAttribute('content')).toBe('probe description');
  });
});

describe('Helmet import discipline', () => {
  // defer={false} only works on the EMITTING Helmet instance (verified: setting
  // it on the always-mounted template Helmet does nothing for page Helmets), so
  // every component must import Helmet from components/Meta. Only the wrapper
  // itself and the provider import may touch react-helmet-async directly.
  it("only Meta.tsx imports Helmet from 'react-helmet-async'", () => {
    const srcDir = path.resolve(__dirname, '../..');
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
          walk(full);
        } else if (/\.(tsx|ts)$/.test(entry.name)) {
          const rel = path.relative(srcDir, full).replace(/\\/g, '/');
          if (rel === 'components/Meta.tsx') continue;
          const content = fs.readFileSync(full, 'utf-8');
          const importLine = content.match(/import\s*\{[^}]*\bHelmet\b[^}]*\}\s*from\s*['"]react-helmet-async['"]/);
          // `HelmetProvider` alone is fine (App.tsx); a bare `Helmet` is not.
          if (importLine && /(?<!Provider)\bHelmet\b(?!Provider)/.test(importLine[0].replace(/HelmetProvider/g, ''))) {
            offenders.push(rel);
          }
        }
      }
    };
    walk(srcDir);

    expect(offenders).toEqual([]);
  });
});
