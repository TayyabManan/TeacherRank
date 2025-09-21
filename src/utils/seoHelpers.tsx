import React from 'react';
import { Helmet } from 'react-helmet-async';

export interface SEOProps {
  title: string;
  description?: string;
  canonical?: string;
  image?: string;
  type?: 'website' | 'article' | 'profile';
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  keywords?: string[];
  noindex?: boolean;
  jsonLd?: any;
}

export const SEO: React.FC<SEOProps> = ({
  title,
  description = 'Rate and review teachers to help students make informed decisions. Find the best educators at your institution.',
  canonical,
  image = '/og-image.png',
  type = 'website',
  publishedTime,
  modifiedTime,
  author,
  keywords = ['teacher reviews', 'professor ratings', 'educator feedback', 'student reviews', 'academic ratings'],
  noindex = false,
  jsonLd
}) => {
  const siteUrl = 'https://teacherrank.com'; // Update with your actual domain
  const fullTitle = `${title} | TeacherRank`;
  const fullImage = image.startsWith('http') ? image : `${siteUrl}${image}`;
  const fullCanonical = canonical ? (canonical.startsWith('http') ? canonical : `${siteUrl}${canonical}`) : undefined;
  
  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords.length > 0 && <meta name="keywords" content={keywords.join(', ')} />}
      {author && <meta name="author" content={author} />}
      {noindex && <meta name="robots" content="noindex,nofollow" />}
      
      {/* Canonical URL */}
      {fullCanonical && <link rel="canonical" href={fullCanonical} />}
      
      {/* Open Graph Tags */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={fullImage} />
      <meta property="og:image:alt" content={title} />
      {fullCanonical && <meta property="og:url" content={fullCanonical} />}
      <meta property="og:site_name" content="TeacherRank" />
      <meta property="og:locale" content="en_US" />
      
      {/* Article specific tags */}
      {type === 'article' && publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {type === 'article' && modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}
      {type === 'article' && author && (
        <meta property="article:author" content={author} />
      )}
      
      {/* Twitter Card Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImage} />
      <meta name="twitter:image:alt" content={title} />
      
      {/* JSON-LD Structured Data */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
};

// Helper function to generate Organization schema
export const generateOrganizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'TeacherRank',
  url: 'https://teacherrank.com',
  logo: 'https://teacherrank.com/logo.png',
  description: 'Platform for rating and reviewing teachers to help students make informed decisions',
  sameAs: [
    // Add your social media URLs here
  ]
});

// Helper function to generate Teacher/Person schema
export const generateTeacherSchema = (teacher: any) => ({
  '@context': 'https://schema.org',
  '@type': 'Person',
  '@id': `https://teacherrank.com/teacher/${teacher.id}`,
  name: teacher.name,
  jobTitle: teacher.designation || 'Teacher',
  worksFor: {
    '@type': 'EducationalOrganization',
    name: teacher.institute
  },
  address: teacher.city ? {
    '@type': 'PostalAddress',
    addressLocality: teacher.city
  } : undefined,
  aggregateRating: teacher.average_rating ? {
    '@type': 'AggregateRating',
    ratingValue: teacher.average_rating,
    bestRating: 5,
    worstRating: 1,
    ratingCount: teacher.ratings_count || 0
  } : undefined,
  url: `https://teacherrank.com/teacher/${teacher.id}`,
  sameAs: teacher.linkedin_url ? [teacher.linkedin_url] : undefined
});

// Helper function to generate Review schema
export const generateReviewSchema = (review: any, teacher: any) => ({
  '@context': 'https://schema.org',
  '@type': 'Review',
  itemReviewed: {
    '@type': 'Person',
    name: teacher.name
  },
  author: {
    '@type': 'Person',
    name: review.student?.display_name || 'Anonymous Student'
  },
  reviewRating: {
    '@type': 'Rating',
    ratingValue: review.score,
    bestRating: 5,
    worstRating: 1
  },
  reviewBody: review.comment,
  datePublished: review.created_at
});

// Helper function to generate BreadcrumbList schema
export const generateBreadcrumbSchema = (items: Array<{name: string, url: string}>) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: item.url
  }))
});

// Helper function to generate FAQ schema
export const generateFAQSchema = (faqs: Array<{question: string, answer: string}>) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(faq => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer
    }
  }))
});