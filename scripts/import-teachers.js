import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Bulk-import scraped faculty into `teachers`, mirroring each local photo into the
// `teacher-avatars` Storage bucket (same bucket/URL shape as scripts/mirror-avatars.js).
//
//   node scripts/import-teachers.js --csv "<path>/bahria_e8.csv" --institute "Bahria University (E-8)" --dry-run
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-teachers.js --csv "..." --institute "..."
//
// RLS makes teachers INSERT admin-only (migration 008), so this needs the service-role
// key — put it in .env (gitignored) or pass it inline. Node 18+ (global fetch, randomUUID).
//
// Idempotent: rows whose normalized name already exists for that institute are skipped,
// and existing rows with no avatar get one backfilled. Safe to re-run after a failure.

const BUCKET = 'teacher-avatars';
const INSERT_BATCH = 50;

// --------------------------------------------------------------------------
// CLI
// --------------------------------------------------------------------------
function parseArgs(argv) {
  const out = { dryRun: false, limit: Infinity };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--csv') out.csv = argv[++i];
    else if (a === '--images-dir') out.imagesDir = argv[++i];
    else if (a === '--institute') out.institute = argv[++i];
    else if (a === '--limit') out.limit = Number(argv[++i]);
    else if (a === '--out') out.out = argv[++i];
    else {
      console.error(`Unknown argument: ${a}`);
      process.exit(1);
    }
  }
  if (!out.csv) {
    console.error('Required: --csv <path to csv>');
    process.exit(1);
  }
  if (!out.institute) {
    console.error('Required: --institute "<label shown in the institute filter>"');
    process.exit(1);
  }
  // The CSV's image_url values are relative to the CSV's own directory.
  out.imagesDir ??= path.dirname(path.resolve(out.csv));
  return out;
}

/** Minimal .env reader — the repo has no dotenv dependency. Never overrides a real env var. */
function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const value = m[2].replace(/^(['"])(.*)\1$/, '$2');
    process.env[m[1]] ??= value;
  }
}

// --------------------------------------------------------------------------
// CSV (RFC 4180: quoted fields, embedded commas/newlines, "" escapes)
// --------------------------------------------------------------------------
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (text[i + 1] === '"') (field += '"'), i++;
      else quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') (row.push(field), (field = ''));
    else if (ch === '\n') (row.push(field), rows.push(row), (row = []), (field = ''));
    else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length) (row.push(field), rows.push(row));

  const [header, ...body] = rows;
  return body
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

// --------------------------------------------------------------------------
// Field cleanup — every rule below was derived from an actual defect in the
// source data, and each one logs what it changed so the diff stays auditable.
// --------------------------------------------------------------------------
const squash = (s) => s.replace(/\s+/g, ' ').trim();

function titleCase(s) {
  return s.toLowerCase().replace(/(^|[\s.\-/(])([a-z])/g, (_, pre, c) => pre + c.toUpperCase());
}

function cleanName(raw) {
  let n = squash(raw)
    .replace(/[,;]+$/, '') // "Dr. Muhammad Haroon Malik,"
    .trim()
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof)\.(?=[A-Za-z])/g, '$1. '); // "Mr.Muhammad Rafi"
  if (n === n.toUpperCase()) n = titleCase(n); // "SARDAR KHAWAR AZIZ"
  return n;
}

/** Exact-match only, so nothing unexpected gets rewritten. */
const DESIGNATION_FIXES = new Map([
  ['Assistant professor', 'Assistant Professor'],
  ['SENIOR ASSISTANT PROFESSOR', 'Senior Assistant Professor'],
  ['Sr. Assistant Professor', 'Senior Assistant Professor'],
  ['Sr. Lecturer', 'Senior Lecturer'],
  ['Dean / Sr. Assistant Professor', 'Dean / Senior Assistant Professor'],
  ['hod', 'Head of Department'],
]);

function cleanDesignation(raw) {
  // One row lost a dash to a bad decode upstream and carries a literal U+FFFD.
  const d = squash(raw).replace(/\s*�\s*/g, ' – ');
  return DESIGNATION_FIXES.get(d) ?? d;
}

const DEPARTMENT_FIXES = new Map([['Department of International Relations', 'International Relations']]);

function cleanDepartment(raw) {
  const d = squash(raw);
  return DEPARTMENT_FIXES.get(d) || d || null;
}

const EMPTY_RESEARCH = /^(n\/?a|none|nil|-{1,2}|abc)$/i;
// A handful of entries are prose ("My research focuses on …") rather than a keyword list.
const PROSE_RESEARCH = /^(my|i|his|her|the)\b|\bfocus(es|ed)? on\b|\binterested in\b/i;

/** The teachers table has no research_area column, so it becomes the bio. */
function buildBio(researchArea) {
  const ra = squash(researchArea).replace(/[.;,]+$/, '').trim();
  if (!ra || EMPTY_RESEARCH.test(ra)) return null;
  const text = PROSE_RESEARCH.test(ra) ? ra : `Research interests: ${ra}`;
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

// --------------------------------------------------------------------------
// Images
// --------------------------------------------------------------------------
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** Magic-byte check — a stray HTML error page saved as .jpg must not reach the bucket. */
function sniff(buffer) {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8) return 'jpg';
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'png';
  if (buffer.length > 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP')
    return 'webp';
  return null;
}

// --------------------------------------------------------------------------
// Build the import plan
// --------------------------------------------------------------------------
function buildPlan(rows, opts) {
  const notes = { excluded: [], merged: [], placeholders: [], missingImages: [], renamed: [], retitled: [] };

  // The source site serves a generic clip-art avatar for faculty without a photo.
  // Any image hash claimed by more than one person is one of those — never upload it.
  const shaOwners = new Map();
  for (const r of rows) {
    const sha = r.image_sha256?.trim();
    if (sha) shaOwners.set(sha, (shaOwners.get(sha) ?? 0) + 1);
  }
  const isPlaceholder = (sha) => Boolean(sha) && shaOwners.get(sha) > 1;

  const usable = [];
  for (const r of rows) {
    const name = cleanName(r.name ?? '');
    // "waqartest" (research_area "abc") — a test record on the source site. Narrow on
    // purpose: a single word containing "test", never a real multi-word faculty name.
    if (!name || (!name.includes(' ') && /test/i.test(name))) {
      notes.excluded.push(`${r.faculty_id} ${r.name} (test record)`);
      continue;
    }
    if (name !== squash(r.name ?? '')) notes.renamed.push(`${r.name} -> ${name}`);

    const designation = cleanDesignation(r.designation ?? '');
    if (designation !== squash(r.designation ?? '')) notes.retitled.push(`${r.designation} -> ${designation}`);

    const rel = (r.image_url ?? '').trim();
    let imagePath = null;
    if (rel) {
      // image_url is CSV-relative ("images/1144.jpg"). Accept --images-dir pointing at
      // either the CSV's folder or the image folder itself.
      const abs = [path.resolve(opts.imagesDir, rel), path.resolve(opts.imagesDir, path.basename(rel))].find((p) =>
        fs.existsSync(p),
      );
      if (!abs) notes.missingImages.push(`${r.faculty_id} ${name} (${rel})`);
      else if (isPlaceholder(r.image_sha256?.trim())) notes.placeholders.push(`${r.faculty_id} ${name}`);
      else imagePath = abs;
    }

    usable.push({
      facultyId: Number(r.faculty_id) || 0,
      email: (r.email ?? '').trim().toLowerCase(),
      imagePath,
      record: {
        name,
        institute: opts.institute,
        department: cleanDepartment(r.department ?? ''),
        designation, // NOT NULL in the schema
        city: squash(r.city ?? '') || 'Islamabad',
        bio: buildBio(r.research_area ?? ''),
      },
    });
  }

  // The source lists a few people twice (stale profile + current one), always under the
  // same email. Keep the newest (highest faculty id) and backfill its photo from the older.
  const byEmail = new Map();
  const standalone = [];
  for (const t of usable) {
    if (!t.email) {
      standalone.push(t);
      continue;
    }
    if (!byEmail.has(t.email)) byEmail.set(t.email, []);
    byEmail.get(t.email).push(t);
  }

  const planned = [...standalone];
  for (const [email, group] of byEmail) {
    group.sort((a, b) => b.facultyId - a.facultyId);
    const [keep, ...dropped] = group;
    if (dropped.length) {
      keep.imagePath ??= dropped.find((d) => d.imagePath)?.imagePath ?? null;
      notes.merged.push(
        `${email}: kept #${keep.facultyId} ${keep.record.name}, dropped ${dropped.map((d) => `#${d.facultyId}`).join(', ')}`,
      );
    }
    planned.push(keep);
  }

  planned.sort((a, b) => a.record.name.localeCompare(b.record.name));
  return { planned, notes };
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------
const normalizeKey = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  loadDotEnv(path.resolve(process.cwd(), '.env'));

  const rows = parseCsv(fs.readFileSync(path.resolve(opts.csv), 'utf8'));
  const { planned, notes } = buildPlan(rows, opts);
  const batch = planned.slice(0, opts.limit);

  console.log(`CSV rows              ${rows.length}`);
  console.log(`Excluded (test)       ${notes.excluded.length}`);
  console.log(`Merged duplicates     ${notes.merged.length}`);
  console.log(`Ready to import       ${planned.length}${batch.length < planned.length ? ` (--limit ${batch.length})` : ''}`);
  console.log(`  with a photo        ${batch.filter((t) => t.imagePath).length}`);
  console.log(`  placeholder skipped ${notes.placeholders.length}`);
  console.log(`  no photo on source  ${rows.length - rows.filter((r) => r.image_url?.trim()).length}`);
  console.log(`  file not on disk    ${notes.missingImages.length}`);
  console.log(`  with a bio          ${batch.filter((t) => t.record.bio).length}`);

  for (const [label, list] of Object.entries(notes)) {
    if (!list.length) continue;
    console.log(`\n${label} (${list.length}):`);
    for (const line of list) console.log(`  ${line}`);
  }

  if (opts.out) {
    fs.writeFileSync(opts.out, JSON.stringify(batch.map((t) => ({ ...t.record, _photo: t.imagePath })), null, 2));
    console.log(`\nFull plan written to ${opts.out}`);
  }

  if (opts.dryRun) {
    console.log('\n--- sample ---');
    for (const t of batch.slice(0, 5)) {
      console.log(`  ${t.record.name} | ${t.record.designation} | ${t.record.department} | photo=${t.imagePath ? 'yes' : 'no'}`);
      if (t.record.bio) console.log(`    ${t.record.bio.slice(0, 110)}`);
    }
    console.log('\nDry run — nothing written. Re-run without --dry-run to import.');
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('\nSet VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before importing.');
    console.error('The service-role key is in Supabase → Project Settings → API (teachers INSERT is admin-only).');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: existing, error: exErr } = await supabase
    .from('teachers')
    .select('id, name, avatar_url')
    .eq('institute', opts.institute);
  if (exErr) {
    console.error(`\nCould not read existing teachers: ${exErr.message}`);
    process.exit(1);
  }
  const existingByName = new Map(existing.map((t) => [normalizeKey(t.name), t]));

  const toInsert = [];
  const toBackfill = [];
  for (const t of batch) {
    const hit = existingByName.get(normalizeKey(t.record.name));
    if (!hit) toInsert.push({ ...t, id: randomUUID() });
    else if (!hit.avatar_url && t.imagePath) toBackfill.push({ ...t, id: hit.id });
  }
  console.log(
    `\n${existing.length} already at "${opts.institute}" — inserting ${toInsert.length}, backfilling ${toBackfill.length} avatar(s).`,
  );

  for (let i = 0; i < toInsert.length; i += INSERT_BATCH) {
    const slice = toInsert.slice(i, i + INSERT_BATCH);
    const { error } = await supabase.from('teachers').insert(slice.map((t) => ({ id: t.id, ...t.record })));
    if (error) {
      console.error(`Insert failed at row ${i}: ${error.message}`);
      console.error('Nothing after this point was written. Fix and re-run — inserted rows are skipped.');
      process.exit(1);
    }
    console.log(`  inserted ${Math.min(i + slice.length, toInsert.length)}/${toInsert.length}`);
  }

  let uploaded = 0;
  let failed = 0;
  for (const t of [...toInsert, ...toBackfill].filter((t) => t.imagePath)) {
    try {
      const buffer = fs.readFileSync(t.imagePath);
      const ext = sniff(buffer);
      if (!ext) throw new Error('not a JPEG/PNG/WebP');

      const key = `${t.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(key, buffer, { contentType: MIME[ext], cacheControl: '604800', upsert: true });
      if (upErr) throw new Error(`upload: ${upErr.message}`);

      const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
      const { error: updErr } = await supabase.from('teachers').update({ avatar_url: publicUrl }).eq('id', t.id);
      if (updErr) throw new Error(`db update: ${updErr.message}`);

      uploaded++;
      if (uploaded % 25 === 0) console.log(`  uploaded ${uploaded} photos`);
    } catch (e) {
      failed++;
      console.warn(`  ✗ ${t.record.name}: ${e.message}`);
    }
  }

  console.log(`\nDone. ${toInsert.length} teachers inserted, ${uploaded} photos uploaded${failed ? `, ${failed} photo(s) failed — re-run to retry` : ''}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
