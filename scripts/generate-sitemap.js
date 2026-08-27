import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables. Failures here are NON-FATAL: this runs as a
// prebuild step, and a build must never fail (or clobber the committed
// sitemap.xml) just because the sitemap refresh couldn't run.
//
// This runs as a plain Node process, so it does NOT get the .env that Vite loads
// for the app bundle. Reading process.env alone meant every local `npm run build`
// took the early exit below and silently kept a stale sitemap — only Vercel, which
// injects the vars into the build shell, ever refreshed it. Go through Vite's own
// loader so .env / .env.local / .env.[mode] work here too; real shell vars still
// win, so Vercel and CI keep overriding a stale local .env.
async function loadEnvironment() {
  const root = path.join(__dirname, '..');
  try {
    const { loadEnv } = await import('vite');
    return loadEnv(process.env.NODE_ENV || 'production', root, 'VITE_');
  } catch {
    return process.env; // vite unavailable (e.g. prod-only install) — use the shell
  }
}

const env = await loadEnvironment();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Sitemap: missing Supabase env vars — keeping the committed sitemap.xml');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function generateDynamicSitemap() {
  const domain = 'https://teacherrank.vercel.app';
  const urls = [];

  // Static pages
  urls.push(
    { loc: `${domain}/`, changefreq: 'daily', priority: 1.0 },
    { loc: `${domain}/teachers`, changefreq: 'daily', priority: 0.9 },
    { loc: `${domain}/faq`, changefreq: 'weekly', priority: 0.7 },
    { loc: `${domain}/how-reviews-work`, changefreq: 'monthly', priority: 0.6 },
    { loc: `${domain}/feedback`, changefreq: 'monthly', priority: 0.6 },
    { loc: `${domain}/auth`, changefreq: 'monthly', priority: 0.6 },
    { loc: `${domain}/privacy`, changefreq: 'monthly', priority: 0.5 },
    { loc: `${domain}/terms`, changefreq: 'monthly', priority: 0.5 }
  );

  // One narrow query covers teacher pages AND institute pages. (The old
  // version filtered on a nonexistent `approved` column and ordered by a
  // nonexistent `average_rating` column, so both queries always failed and
  // the generated sitemap silently lost every teacher/institute URL.)
  const { data: teachers, error: teacherError } = await supabase
    .from('teachers')
    .select('id, institute, updated_at')
    .order('avg_rating', { ascending: false });

  if (teacherError || !teachers || teachers.length === 0) {
    console.warn('Sitemap: could not fetch teachers — keeping the committed sitemap.xml', teacherError?.message ?? '');
    return 0;
  }

  console.log(`Adding ${teachers.length} teacher pages to sitemap...`);
  teachers.forEach(teacher => {
    urls.push({
      loc: `${domain}/teacher/${teacher.id}`,
      lastmod: teacher.updated_at ? new Date(teacher.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      changefreq: 'weekly',
      priority: 0.8
    });
  });

  const uniqueInstitutes = [...new Set(teachers.filter(t => t.institute).map(t => t.institute))];
  console.log(`Adding ${uniqueInstitutes.length} institute pages to sitemap...`);
  uniqueInstitutes.forEach(institute => {
    urls.push({
      loc: `${domain}/institute/${encodeURIComponent(institute)}`,
      changefreq: 'weekly',
      priority: 0.7
    });
  });

  // Generate XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${url.lastmod || new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  // Write to file
  const outputPath = path.join(__dirname, '..', 'public', 'sitemap.xml');
  fs.writeFileSync(outputPath, xml);
  console.log(`✅ Sitemap generated successfully with ${urls.length} URLs`);
  console.log(`📁 Saved to: ${outputPath}`);
  return urls.length;
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Run the generator. Never fail the build: a stale committed sitemap beats a
// broken deploy (and beats an overwritten, teacher-less sitemap).
//
// Set exitCode instead of calling process.exit(): forcing exit here tore down the
// event loop while supabase-js's keep-alive socket was still closing, which aborts
// the process with a libuv assertion on Windows (`UV_HANDLE_CLOSING`, async.c:76).
// That was invisible while the script always early-exited before opening a socket.
generateDynamicSitemap()
  .then(count => {
    if (count > 0) {
      console.log(`Sitemap refreshed with ${count} URLs`);
    }
  })
  .catch(error => {
    console.warn('Sitemap generation failed — keeping the committed sitemap.xml:', error?.message ?? error);
  })
  .finally(() => {
    process.exitCode = 0;
  });