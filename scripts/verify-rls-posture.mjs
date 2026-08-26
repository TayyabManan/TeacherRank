import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Verifies the live database's RLS/grant posture with the PUBLIC anon key —
// the checks the migration runbook (database/migrations/README.md) used to
// list only as manual devtools steps. Production RLS has silently drifted from
// the repo before (see migration 008's header); this makes the posture a
// command instead of a memory.
//
//   npm run verify:rls
//
// READ-ONLY BY CONSTRUCTION: every probe either reads, targets zero rows
// (writes filtered to a nil UUID), or calls an RPC that must not exist / is a
// documented no-op for absent data. Nothing here inserts.
//
// Exit code 0 = posture matches the fully-migrated state (008–021 applied).
// A FAIL names the migration that closes the gap.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Same loader as generate-sitemap.js: a plain Node process does not get the
// .env Vite loads for the app, so go through Vite's own loader when available;
// real shell vars still win.
async function loadEnvironment() {
  const root = path.join(__dirname, '..');
  try {
    const { loadEnv } = await import('vite');
    return loadEnv(process.env.NODE_ENV || 'production', root, 'VITE_');
  } catch {
    return process.env;
  }
}

const env = await loadEnvironment();
const URL_BASE = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY;

if (!URL_BASE || !ANON) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (set them in .env or the shell).');
  process.exit(2);
}

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

async function rest(method, pathname, body) {
  const res = await fetch(`${URL_BASE}/rest/v1/${pathname}`, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* 204 etc. */ }
  return { status: res.status, json };
}

const denied = (r) => r.status === 401 || r.status === 403;
const emptyOk = (r) => r.status === 200 && Array.isArray(r.json) && r.json.length === 0;

// Each probe returns { pass, detail } — `fix` names the migration that
// closes the gap when it fails.
const PROBES = [
  {
    name: 'ratings.metadata not readable (anon fingerprints)',
    fix: 'apply migration 019',
    run: async () => {
      const r = await rest('GET', 'ratings?select=metadata&limit=1');
      return { pass: r.status >= 400, detail: `GET select=metadata -> ${r.status}` };
    },
  },
  {
    name: 'ratings public columns still readable',
    fix: 'public read regressed — investigate before anything else',
    run: async () => {
      const r = await rest('GET', 'ratings?select=id,score,comment&limit=1');
      return { pass: r.status === 200, detail: `GET select=id,score,comment -> ${r.status}` };
    },
  },
  {
    name: 'teacher request PII hidden from anon',
    fix: 'apply migration 008',
    run: async () => {
      const r = await rest('GET', 'teacher_submission_requests?select=requester_email&limit=1');
      return { pass: denied(r) || emptyOk(r), detail: `GET requester_email -> ${r.status}` };
    },
  },
  {
    name: 'feedback PII hidden from anon',
    fix: 'apply migration 008',
    run: async () => {
      const r = await rest('GET', 'feedback?select=email&limit=1');
      return { pass: denied(r) || emptyOk(r), detail: `GET email -> ${r.status}` };
    },
  },
  {
    name: 'profiles not readable by anon',
    fix: 'REVOKE SELECT ON profiles FROM anon (see SECURITY.md, verified 2026-07-30)',
    run: async () => {
      const r = await rest('GET', 'profiles?select=id&limit=1');
      return { pass: denied(r) || emptyOk(r), detail: `GET profiles -> ${r.status}` };
    },
  },
  {
    name: 'setup_initial_admin RPC dropped (anon→admin hole)',
    fix: 'apply migration 017 IMMEDIATELY — this is an open anon→admin escalation',
    // If the function still existed this call would run it, but against an
    // .invalid address it matches zero profiles rows — a no-op that proves the
    // endpoint is live.
    run: async () => {
      const r = await rest('POST', 'rpc/setup_initial_admin', { user_email: 'rls-posture-probe@example.invalid' });
      return { pass: r.status === 404, detail: `POST rpc -> ${r.status}` };
    },
  },
  {
    name: 'anon UPDATE on ratings revoked',
    fix: 'apply migration 021',
    run: async () => {
      const r = await rest('PATCH', `ratings?id=eq.${NIL_UUID}`, { score: 5 });
      return { pass: denied(r), detail: `PATCH nil-uuid -> ${r.status}` };
    },
  },
  {
    name: 'anon DELETE on ratings revoked',
    fix: 'apply migration 021',
    run: async () => {
      const r = await rest('DELETE', `ratings?id=eq.${NIL_UUID}`);
      return { pass: denied(r), detail: `DELETE nil-uuid -> ${r.status}` };
    },
  },
  {
    name: 'get_anon_rating_id RPC deployed',
    fix: 'apply migration 019',
    run: async () => {
      const r = await rest('POST', 'rpc/get_anon_rating_id', { p_teacher_id: NIL_UUID, p_fingerprint: 'rls-probe' });
      return { pass: r.status === 200, detail: `POST rpc -> ${r.status}` };
    },
  },
  {
    name: 'update_anon_rating RPC deployed',
    fix: 'apply migration 021',
    // Nil teacher uuid matches no row: the function returns NULL before any
    // write (documented no-op — see the migration's verification section).
    run: async () => {
      const r = await rest('POST', 'rpc/update_anon_rating', {
        p_teacher_id: NIL_UUID, p_fingerprint: 'rls-probe', p_score: 5, p_comment: '',
      });
      return { pass: r.status === 200, detail: `POST rpc -> ${r.status}` };
    },
  },
];

console.log(`RLS posture check against ${URL_BASE}\n`);

let failures = 0;
for (const probe of PROBES) {
  let outcome;
  try {
    outcome = await probe.run();
  } catch (error) {
    outcome = { pass: false, detail: `request failed: ${error?.message ?? error}` };
  }
  const label = outcome.pass ? 'PASS' : 'FAIL';
  console.log(`  ${label}  ${probe.name}  (${outcome.detail})`);
  if (!outcome.pass) {
    failures += 1;
    console.log(`        -> ${probe.fix}`);
  }
}

console.log(
  failures === 0
    ? '\nAll probes passed — live posture matches the fully-migrated state.'
    : `\n${failures} probe(s) failed. Runbook: database/migrations/README.md ("Pending set").`,
);
process.exit(failures === 0 ? 0 : 1);
