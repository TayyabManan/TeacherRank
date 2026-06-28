import { createClient } from '@supabase/supabase-js';

// One-time, re-runnable backfill: copies each teacher's external avatar_url image
// into the `teacher-avatars` Supabase Storage bucket and rewrites the row to the
// public CDN URL. Run this LOCALLY (from a connection that can reach the institute
// sites — e.g. inside Pakistan), because some institute servers block datacenter IPs.
//
//   SUPABASE_SERVICE_ROLE_KEY=... npm run mirror:avatars
//
// Requires Node 18+ (global fetch). Idempotent: rows already pointing at the bucket
// are skipped, so it's safe to re-run to retry failures or pick up new teachers.

// Some institute sites ship an incomplete TLS chain that Node rejects (browsers
// repair it via AIA fetching; Node does not). This is a trusted, run-locally
// backfill of public institute photos, so relax chain verification for the run.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.');
  console.error('Get the service-role key from Supabase → Project Settings → API.');
  process.exit(1);
}

const BUCKET = 'teacher-avatars';
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const EXT_BY_TYPE = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

async function download(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*,*/*;q=0.8' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, contentType };
  } finally {
    clearTimeout(timer);
  }
}

function extFor(contentType, url) {
  if (EXT_BY_TYPE[contentType]) return EXT_BY_TYPE[contentType];
  const m = url.split('?')[0].match(/\.(jpe?g|png|webp|gif|svg)$/i);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
}

async function main() {
  const { data: teachers, error } = await supabase
    .from('teachers')
    .select('id, name, avatar_url')
    .not('avatar_url', 'is', null);

  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }

  const pending = teachers.filter((t) => t.avatar_url && !t.avatar_url.includes(`/${BUCKET}/`));
  console.log(`${pending.length} of ${teachers.length} teachers need mirroring.\n`);

  let ok = 0;
  let failed = 0;
  for (const t of pending) {
    try {
      const { buffer, contentType } = await download(t.avatar_url);
      if (!contentType.startsWith('image/')) throw new Error(`not an image (${contentType})`);

      const path = `${t.id}.${extFor(contentType, t.avatar_url)}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, buffer, { contentType, cacheControl: '604800', upsert: true });
      if (upErr) throw new Error(`upload: ${upErr.message}`);

      const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      const { error: updErr } = await supabase
        .from('teachers')
        .update({ avatar_url: publicUrl })
        .eq('id', t.id);
      if (updErr) throw new Error(`db update: ${updErr.message}`);

      ok++;
      console.log(`✓ ${t.name} -> ${path}`);
    } catch (e) {
      failed++;
      console.warn(`✗ ${t.name}: ${e.message}  [${t.avatar_url}]`);
    }
  }

  console.log(`\nDone. ${ok} mirrored, ${failed} failed.${failed ? ' Re-run to retry failures.' : ''}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
