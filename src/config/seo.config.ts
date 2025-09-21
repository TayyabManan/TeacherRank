// SEO Configuration for Teacher Rank / TeacherRank
// This centralized configuration ensures brand consistency across the platform

export const SEO_CONFIG = {
  // Brand variations for search engine recognition
  brandName: {
    primary: 'Teacher Rank',
    alternate: 'TeacherRank',
    variations: [
      'Teacher Rank',
      'TeacherRank',
      'Teacher Rank App',
      'Teacher Ranking',
      'Teacher Rank Platform'
    ]
  },

  // Site URLs
  urls: {
    production: 'https://teacherrank.com',
    staging: 'https://teacherrank.vercel.app',
    current: 'https://teacherrank.vercel.app'
  },

  // Default meta descriptions with brand variations
  defaultDescriptions: {
    home: 'Teacher Rank (TeacherRank) is the premier platform for student reviews and ratings of teachers. Find the best educators at your institution.',
    search: 'Search for teachers on Teacher Rank. Browse TeacherRank reviews and ratings from real students.',
    teacher: 'View ratings and reviews on Teacher Rank (TeacherRank). Find honest student feedback about teachers and professors.'
  },

  // Keyword strategy including both brand variations
  keywords: {
    brand: [
      'teacher rank',
      'teacherrank',
      'teacher rank app',
      'teacher ranking',
      'teacher rank platform',
      'teacher rank website'
    ],
    primary: [
      'teacher reviews',
      'professor ratings',
      'teacher ratings',
      'educator feedback',
      'student reviews',
      'academic ratings'
    ],
    secondary: [
      'rate my teacher',
      'rate my professor',
      'university professors',
      'college teachers',
      'instructor reviews',
      'teacher feedback'
    ]
  },

  // Structured data defaults
  schema: {
    organization: {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Teacher Rank',
      alternateName: ['TeacherRank', 'Teacher Rank App', 'Teacher Ranking Platform'],
      url: 'https://teacherrank.vercel.app',
      logo: 'https://teacherrank.vercel.app/logo.png',
      sameAs: [
        'https://teacherrank.com',
        'https://teacherrank.vercel.app'
      ]
    },
    website: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Teacher Rank',
      alternateName: ['TeacherRank', 'Teacher Rank App'],
      url: 'https://teacherrank.vercel.app',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: 'https://teacherrank.vercel.app/?search={search_term_string}'
        },
        'query-input': 'required name=search_term_string'
      }
    }
  },

  // Open Graph defaults
  openGraph: {
    siteName: 'Teacher Rank',
    locale: 'en_US',
    type: 'website',
    image: {
      url: 'https://teacherrank.vercel.app/og-image.png',
      width: 1200,
      height: 630,
      alt: 'Teacher Rank (TeacherRank) - Platform for Teacher Reviews'
    }
  },

  // Twitter Card defaults
  twitter: {
    card: 'summary_large_image',
    site: '@teacherrank',
    creator: '@teacherrank'
  }
};

// Helper function to generate title with brand variations
export const generateSEOTitle = (pageTitle: string): string => {
  return `${pageTitle} | Teacher Rank (TeacherRank)`;
};

// Helper function to generate description with brand mentions
export const generateSEODescription = (baseDescription: string): string => {
  if (!baseDescription.includes('Teacher Rank') && !baseDescription.includes('TeacherRank')) {
    return `${baseDescription} Find more on Teacher Rank (TeacherRank).`;
  }
  return baseDescription;
};

// Helper function to combine keywords with brand terms
export const generateKeywords = (pageKeywords: string[] = []): string[] => {
  return [...SEO_CONFIG.keywords.brand, ...pageKeywords, ...SEO_CONFIG.keywords.primary];
};

export default SEO_CONFIG;