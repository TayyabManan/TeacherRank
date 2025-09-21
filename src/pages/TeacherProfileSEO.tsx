// SEO-Enhanced Teacher Profile Component Example
import React from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTeacher } from '../hooks/useTeachers';
import { useRatings } from '../hooks/useRatings';

// This is an example of how to enhance the TeacherProfile component with proper SEO

export const TeacherProfileSEO: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: teacher } = useTeacher(id || '');
  const { data: reviews } = useRatings(id);
  
  if (!teacher) return null;
  
  // Generate structured data for the teacher
  const teacherSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `https://teacherrank.com/teacher/${teacher.id}`,
    name: teacher.name,
    jobTitle: teacher.designation || 'Teacher',
    worksFor: {
      '@type': 'EducationalOrganization',
      name: teacher.institute,
      address: teacher.city ? {
        '@type': 'PostalAddress',
        addressLocality: teacher.city
      } : undefined
    },
    aggregateRating: teacher.average_rating ? {
      '@type': 'AggregateRating',
      ratingValue: teacher.average_rating,
      bestRating: 5,
      worstRating: 1,
      ratingCount: teacher.ratings_count || 0,
      reviewCount: reviews?.length || 0
    } : undefined,
    url: `https://teacherrank.com/teacher/${teacher.id}`,
    sameAs: teacher.linkedin_url ? [teacher.linkedin_url] : undefined,
    description: teacher.bio || `${teacher.name} is a teacher at ${teacher.institute}`,
    review: reviews?.slice(0, 5).map(review => ({
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: review.student?.display_name || 'Student'
      },
      reviewRating: {
        '@type': 'Rating',
        ratingValue: review.score,
        bestRating: 5,
        worstRating: 1
      },
      reviewBody: review.comment,
      datePublished: review.created_at
    }))
  };
  
  // Breadcrumb structured data
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Teacher Rank',
        item: 'https://teacherrank.com'
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Teachers',
        item: 'https://teacherrank.com/'
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: teacher.institute,
        item: `https://teacherrank.com/institute/${encodeURIComponent(teacher.institute)}`
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: teacher.name,
        item: `https://teacherrank.com/teacher/${teacher.id}`
      }
    ]
  };
  
  const pageTitle = `${teacher.name} - ${teacher.designation || 'Teacher'} at ${teacher.institute}`;
  const pageDescription = teacher.bio ||
    `Read ${teacher.ratings_count || 0} student reviews for ${teacher.name}, ${teacher.designation || 'teacher'} at ${teacher.institute} on Teacher Rank (TeacherRank). Average rating: ${teacher.average_rating?.toFixed(1) || 'N/A'}/5.0. Find honest teacher reviews on the Teacher Rank platform.`;
  
  return (
    <>
      <Helmet>
        {/* Primary Meta Tags */}
        <title>{pageTitle} | Teacher Rank (TeacherRank)</title>
        <meta name="title" content={`${pageTitle} | TeacherRank`} />
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={`https://teacherrank.com/teacher/${teacher.id}`} />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="profile" />
        <meta property="og:url" content={`https://teacherrank.com/teacher/${teacher.id}`} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="profile:first_name" content={teacher.name.split(' ')[0]} />
        <meta property="profile:last_name" content={teacher.name.split(' ').slice(1).join(' ')} />
        
        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content={`https://teacherrank.com/teacher/${teacher.id}`} />
        <meta property="twitter:title" content={pageTitle} />
        <meta property="twitter:description" content={pageDescription} />
        
        {/* Additional SEO Tags */}
        <meta name="keywords" content={`${teacher.name}, ${teacher.institute}, teacher reviews, professor ratings, ${teacher.designation || 'teacher'}, ${teacher.city || ''}`} />
        <meta name="author" content="TeacherRank" />
        <meta name="robots" content="index, follow" />
        
        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(teacherSchema)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      </Helmet>
      
      {/* Rest of your component implementation */}
    </>
  );
};