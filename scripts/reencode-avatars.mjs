import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

// One-off, re-runnable: downscales every avatar already in the `teacher-avatars`
// bucket to a ≤320 px WebP, uploads it as `<uuid>.webp`, points the teacher row at
// it and deletes the old object. Mirrors what src/lib/imageResize.ts now does
// client-side at upload time, so the bucket stays small either way.
//
//   SUPABASE_SERVICE_ROLE_KEY=... npm run reencode:avatars          # do it
//   SUPABASE_SERVICE_ROLE_KEY=... npm run reencode:avatars -- --dry # report only
//
// Idempotent: a row whose object is already a WebP within ~25% of the target size
// is skipped, so re-running only touches what still needs work.

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.argv.includes('--dry');

if (!supabaseUrl || !serviceKey) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.');
  process.exit(1);
}

const BUCKET = 'teacher-avatars';
const MAX_EDGE = 320; // keep in sync with AVATAR_MAX_EDGE in src/lib/imageResize.ts
const QUALITY = 82;
const CACHE_CONTROL = '31536000'; // keep in sync with AVATAR_CACHE_CONTROL
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const fmt = (b) => `${(b / 1024).toFixed(0)} kB`;

function objectPathFrom(url) {
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
}

async function main() {
  const { data: teachers, error } = await supabase
    .from('teachers')
    .select('id, name, avatar_url')
    .like('avatar_url', `%/${BUCKET}/%`);
  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }
  console.log(`${teachers.length} teachers have bucket-hosted avatars.${dryRun ? ' (dry run)' : ''}\n`);

  let before = 0;
  let after = 0;
  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const t of teachers) {
    const oldPath = objectPathFrom(t.avatar_url);
    if (!oldPath) {
      failed++;
      console.warn(`✗ ${t.name}: unrecognised URL ${t.avatar_url}`);
      continue;
    }
    try {
      const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(oldPath);
      if (dlErr) throw new Error(`download: ${dlErr.message}`);
      const input = Buffer.from(await blob.arrayBuffer());

      if (oldPath.endsWith('.svg')) {
        skipped++;
        before += input.length;
        after += input.length;
        continue;
      }

      const output = await sharp(input, { animated: false })
        .rotate() // apply EXIF orientation, then strip metadata
        .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toBuffer();

      before += input.length;
      // Re-encoding a WebP always shaves a few percent (lossy round-trip); only
      // treat it as work worth doing when the saving is real.
      const alreadyGood = oldPath.endsWith('.webp') && output.length > input.length * 0.75;
      if (alreadyGood) {
        skipped++;
        after += input.length;
        continue;
      }
      after += output.length;

      const base = oldPath.replace(/\.[^.]+$/, '');
      const newPath = `${base}.webp`;
      console.log(`${dryRun ? '·' : '✓'} ${t.name}: ${fmt(input.length)} -> ${fmt(output.length)}  ${oldPath} -> ${newPath}`);
      if (dryRun) {
        done++;
        continue;
      }

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(newPath, output, { contentType: 'image/webp', cacheControl: CACHE_CONTROL, upsert: true });
      if (upErr) throw new Error(`upload: ${upErr.message}`);

      if (newPath !== oldPath) {
        const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(newPath).data.publicUrl;
        const { error: updErr } = await supabase
          .from('teachers')
          .update({ avatar_url: publicUrl })
          .eq('id', t.id);
        if (updErr) throw new Error(`db update: ${updErr.message}`);

        // Old object is unreferenced now. A failure here only leaves an orphan.
        const { error: rmErr } = await supabase.storage.from(BUCKET).remove([oldPath]);
        if (rmErr) console.warn(`  (could not delete ${oldPath}: ${rmErr.message})`);
      }
      done++;
    } catch (e) {
      failed++;
      console.warn(`✗ ${t.name}: ${e.message}`);
    }
  }

  console.log(
    `\n${dryRun ? 'Would re-encode' : 'Re-encoded'} ${done}, skipped ${skipped} (already small), failed ${failed}.` +
      `\nBucket bytes: ${fmt(before)} -> ${fmt(after)} (${before ? Math.round((1 - after / before) * 100) : 0}% smaller).`,
  );
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
