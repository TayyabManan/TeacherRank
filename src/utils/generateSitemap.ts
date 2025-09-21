import { supabase } from '../lib/supabaseClient';

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

export async function generateSitemap(domain: string): Promise<string> {
  const urls: SitemapUrl[] = [];
  
  // Static pages with high priority
  urls.push(
    { loc: `${domain}/`, changefreq: 'daily', priority: 1.0 },
    { loc: `${domain}/faq`, changefreq: 'weekly', priority: 0.7 },
    { loc: `${domain}/feedback`, changefreq: 'monthly', priority: 0.6 },
    { loc: `${domain}/privacy`, changefreq: 'monthly', priority: 0.5 },
    { loc: `${domain}/terms`, changefreq: 'monthly', priority: 0.5 }
  );
  
  try {
    // Fetch all teachers for dynamic URLs
    const { data: teachers, error: teacherError } = await supabase
      .from('teachers')
      .select('id, updated_at')
      .eq('approved', true)
      .order('average_rating', { ascending: false });
    
    if (!teacherError && teachers) {
      teachers.forEach(teacher => {
        urls.push({
          loc: `${domain}/teacher/${teacher.id}`,
          lastmod: teacher.updated_at ? new Date(teacher.updated_at).toISOString() : undefined,
          changefreq: 'weekly',
          priority: 0.8
        });
      });
    }
    
    // Fetch unique institutes
    const { data: institutes, error: instituteError } = await supabase
      .from('teachers')
      .select('institute')
      .eq('approved', true);
    
    if (!instituteError && institutes) {
      const uniqueInstitutes = [...new Set(institutes.map(i => i.institute))];
      uniqueInstitutes.forEach(institute => {
        if (institute) {
          urls.push({
            loc: `${domain}/institute/${encodeURIComponent(institute)}`,
            changefreq: 'weekly',
            priority: 0.7
          });
        }
      });
    }
  } catch (error) {
    console.error('Error generating dynamic sitemap URLs:', error);
  }
  
  // Generate XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(url => `  <url>
    <loc>${escapeXml(url.loc)}</loc>${url.lastmod ? `
    <lastmod>${url.lastmod}</lastmod>` : ''}${url.changefreq ? `
    <changefreq>${url.changefreq}</changefreq>` : ''}${url.priority !== undefined ? `
    <priority>${url.priority}</priority>` : ''}
  </url>`).join('\n')}
</urlset>`;
  
  return xml;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}