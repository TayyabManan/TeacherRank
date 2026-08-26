import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Postbuild gate: every executable inline <script> in dist/index.html must be
// allowed by a 'sha256-...' token in vercel.json's script-src, and the built
// HTML must contain no inline event handlers (onclick="..."), which CSP blocks
// regardless of hashes.
//
// Why: script-src carries no 'unsafe-inline' (2026-08-26 audit — with it, any
// future HTML-injection sink escalates straight to script execution). The two
// static inline scripts (theme boot, offline/error overlay) are allowed by
// hash instead. Hashes are computed from the BUILT file, so this also catches
// a future Vite plugin transforming the inline scripts.
//
//   node scripts/check-csp-hashes.mjs          # verify (exit 1 on mismatch)
//   node scripts/check-csp-hashes.mjs --print  # print the tokens for vercel.json
//
// JSON-LD <script type="application/ld+json"> blocks are data, not executable
// scripts — CSP does not apply to them, so they are skipped.

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const printOnly = process.argv.includes('--print');

let html;
try {
  html = readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
} catch {
  console.error('dist/index.html not found — run `npm run build` first.');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Collect executable inline scripts from the built HTML
// ---------------------------------------------------------------------------
const EXECUTABLE_TYPES = new Set(['module', 'text/javascript', 'application/javascript']);

const inlineScripts = [];
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  const [, attrs, body] = match;
  if (/\bsrc\s*=/i.test(attrs)) continue; // external — covered by 'self'
  const typeMatch = /\btype\s*=\s*["']([^"']+)["']/i.exec(attrs);
  if (typeMatch && !EXECUTABLE_TYPES.has(typeMatch[1].toLowerCase())) continue; // data block (e.g. ld+json)
  // The hash covers the exact bytes between the tags — whitespace included.
  const hash = createHash('sha256').update(body, 'utf8').digest('base64');
  inlineScripts.push({ hash, preview: body.trim().slice(0, 60).replace(/\s+/g, ' ') });
}

if (printOnly) {
  console.log('script-src hash tokens for vercel.json:');
  for (const s of inlineScripts) console.log(`  'sha256-${s.hash}'  // ${s.preview}…`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Compare against vercel.json's script-src
// ---------------------------------------------------------------------------
const vercel = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const csp = (vercel.headers ?? [])
  .flatMap((h) => h.headers ?? [])
  .find((h) => h.key.toLowerCase() === 'content-security-policy')?.value;

if (!csp) {
  console.error('No Content-Security-Policy header found in vercel.json.');
  process.exit(2);
}

const scriptSrc = /script-src ([^;]+)/.exec(csp)?.[1] ?? '';
const allowed = new Set([...scriptSrc.matchAll(/'sha256-([^']+)'/g)].map((m) => m[1]));

let failed = false;

if (/'unsafe-inline'/.test(scriptSrc)) {
  console.error("FAIL: script-src still contains 'unsafe-inline' — remove it; inline scripts are allowed by hash.");
  failed = true;
}

for (const s of inlineScripts) {
  if (!allowed.has(s.hash)) {
    console.error(`FAIL: inline script not allowed by CSP — add 'sha256-${s.hash}' to script-src (script: "${s.preview}…")`);
    failed = true;
  }
}

for (const hash of allowed) {
  if (!inlineScripts.some((s) => s.hash === hash)) {
    console.warn(`note: stale hash 'sha256-${hash}' in script-src matches no built inline script — safe, but remove it when convenient.`);
  }
}

// ---------------------------------------------------------------------------
// No inline event handlers outside script bodies (CSP blocks them regardless
// of hashes; the boot overlays bind their Retry buttons via addEventListener)
// ---------------------------------------------------------------------------
const htmlOutsideScripts = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const handler = /<[^>]*\son[a-z]+\s*=/i.exec(htmlOutsideScripts);
if (handler) {
  console.error(`FAIL: inline event handler in built HTML (CSP blocks these): ${handler[0].slice(0, 80)}`);
  failed = true;
}

if (failed) {
  console.error('\nRun `node scripts/check-csp-hashes.mjs --print` for the full token list.');
  process.exit(1);
}
console.log(`CSP check passed: ${inlineScripts.length} inline script(s), all pinned by hash; no inline handlers.`);
