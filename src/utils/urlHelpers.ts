// URL Helper functions for SEO-friendly URLs

export function generateTeacherSlug(name: string, id: string): string {
  // Convert name to URL-friendly slug
  const nameSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-')  // Replace spaces with hyphens
    .replace(/^-+|-+$/g, '');  // Remove leading/trailing hyphens
  
  // Append shortened ID for uniqueness
  const shortId = id.split('-')[0]; // Take first part of UUID
  
  return `${nameSlug}-${shortId}`;
}

export function generateInstituteSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function extractIdFromSlug(slug: string): string {
  // Extract the ID from a slug (last part after final hyphen)
  const parts = slug.split('-');
  return parts[parts.length - 1];
}

// Generate SEO-friendly page titles
export function generatePageTitle(parts: string[]): string {
  return parts.filter(Boolean).join(' | ');
}

// Generate meta description
export function generateMetaDescription(text: string, maxLength: number = 160): string {
  if (text.length <= maxLength) return text;
  
  // Truncate at last complete word before maxLength
  const truncated = text.substr(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  return truncated.substr(0, lastSpace) + '...';
}

// Canonical URL generator
export function getCanonicalUrl(path: string, baseUrl: string = 'https://teacherrank.com'): string {
  // Remove trailing slashes
  const cleanPath = path.replace(/\/$/, '');
  const cleanBase = baseUrl.replace(/\/$/, '');
  
  // Remove query parameters for canonical
  const pathWithoutQuery = cleanPath.split('?')[0];
  
  return `${cleanBase}${pathWithoutQuery}`;
}

// Pagination URL helpers
export function generatePaginationUrl(basePath: string, page: number): string {
  if (page === 1) {
    return basePath; // Don't include page=1 in URL
  }
  
  const separator = basePath.includes('?') ? '&' : '?';
  return `${basePath}${separator}page=${page}`;
}

// Rich snippet helpers
export function formatRatingForSchema(rating: number | null): number {
  if (!rating) return 0;
  // Ensure rating is between 1 and 5 for schema
  return Math.max(1, Math.min(5, Number(rating.toFixed(1))));
}

// Sitemap priority calculator
export function calculateSitemapPriority(type: 'home' | 'teacher' | 'institute' | 'static', rating?: number): number {
  const basePriorities = {
    home: 1.0,
    teacher: 0.8,
    institute: 0.7,
    static: 0.5
  };
  
  let priority = basePriorities[type] || 0.5;
  
  // Boost priority for highly-rated content
  if (type === 'teacher' && rating) {
    if (rating >= 4.5) priority = Math.min(0.95, priority + 0.1);
    else if (rating >= 4.0) priority = Math.min(0.9, priority + 0.05);
  }
  
  return priority;
}