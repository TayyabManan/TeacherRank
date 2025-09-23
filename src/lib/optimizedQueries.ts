/**
 * Optimized database queries with batching and caching
 */

import { supabase } from './supabaseClient';
import { cache } from './cache';

interface TeacherAggregate {
  teacher_id: string;
  avg_rating: number | null;
  ratings_count: number;
  [key: string]: any;
}

/**
 * Batch fetch teacher aggregates to reduce N+1 queries
 */
export async function batchFetchTeacherAggregates(teacherIds: string[]): Promise<TeacherAggregate[]> {
  if (teacherIds.length === 0) return [];

  // Check cache first
  const cacheKey = `aggregates-${teacherIds.join('-')}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  // Batch fetch in chunks of 100 to avoid query limits
  const chunks = [];
  const chunkSize = 100;

  for (let i = 0; i < teacherIds.length; i += chunkSize) {
    chunks.push(teacherIds.slice(i, i + chunkSize));
  }

  const results = await Promise.all(
    chunks.map(chunk =>
      supabase
        .from('teacher_aggregates')
        .select('*')
        .in('teacher_id', chunk)
    )
  );

  const aggregates = results.flatMap(r => r.data || []);

  // Cache for 5 minutes
  await cache.set(cacheKey, aggregates, 300);

  return aggregates;
}

/**
 * Optimized teacher search with full-text search
 */
export async function optimizedTeacherSearch({
  query,
  filters,
  page = 1,
  pageSize = 12
}: {
  query: string;
  filters?: {
    institute?: string;
    department?: string;
    minRating?: number;
  };
  page?: number;
  pageSize?: number;
}) {
  // Build optimized query using PostgreSQL's full-text search
  let searchQuery = supabase
    .from('teachers')
    .select('*', { count: 'exact' });

  if (query) {
    // Use PostgreSQL's to_tsquery for better search performance
    searchQuery = searchQuery.textSearch('search_vector', query, {
      type: 'websearch', // Allows Google-like search syntax
      config: 'english'
    });
  }

  // Apply filters
  if (filters?.institute && filters.institute !== 'all') {
    searchQuery = searchQuery.eq('institute', filters.institute);
  }

  if (filters?.department && filters.department !== 'all') {
    searchQuery = searchQuery.eq('department', filters.department);
  }

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  searchQuery = searchQuery.range(from, to);

  const { data, error, count } = await searchQuery;

  if (error) throw error;

  // Batch fetch aggregates
  const teacherIds = data?.map(t => t.id) || [];
  const aggregates = await batchFetchTeacherAggregates(teacherIds);

  // Merge data
  const teachersWithStats = (data || []).map(teacher => {
    const aggregate = aggregates.find(a => a.teacher_id === teacher.id);
    return {
      ...teacher,
      average_rating: aggregate?.avg_rating || null,
      ratings_count: aggregate?.ratings_count || 0
    };
  });

  // Apply rating filter if needed (client-side for now)
  let filteredData = teachersWithStats;
  if (filters?.minRating) {
    const minRating = filters.minRating;
    filteredData = teachersWithStats.filter(
      t => (t.average_rating || 0) >= minRating
    );
  }

  return {
    data: filteredData,
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize)
  };
}

/**
 * Create database indexes for better performance
 * Run these in your Supabase SQL editor
 */
export const performanceIndexes = `
-- Full-text search index
ALTER TABLE teachers ADD COLUMN search_vector tsvector;

UPDATE teachers SET search_vector =
  to_tsvector('english',
    coalesce(name, '') || ' ' ||
    coalesce(institute, '') || ' ' ||
    coalesce(department, '') || ' ' ||
    coalesce(designation, '') || ' ' ||
    coalesce(city, '') || ' ' ||
    coalesce(bio, '')
  );

CREATE INDEX idx_teachers_search ON teachers USING gin(search_vector);

-- Trigger to update search vector on insert/update
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector('english',
      coalesce(NEW.name, '') || ' ' ||
      coalesce(NEW.institute, '') || ' ' ||
      coalesce(NEW.department, '') || ' ' ||
      coalesce(NEW.designation, '') || ' ' ||
      coalesce(NEW.city, '') || ' ' ||
      coalesce(NEW.bio, '')
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_teachers_search
BEFORE INSERT OR UPDATE ON teachers
FOR EACH ROW
EXECUTE FUNCTION update_search_vector();

-- Composite indexes for common queries
CREATE INDEX idx_teachers_institute_dept ON teachers(institute, department);
CREATE INDEX idx_teachers_created_at ON teachers(created_at DESC);

-- Materialized view for teacher statistics (refresh periodically)
CREATE MATERIALIZED VIEW teacher_stats_mv AS
SELECT
  t.id,
  t.name,
  t.institute,
  t.department,
  COUNT(r.id) as total_ratings,
  AVG(r.score)::numeric(3,2) as avg_rating,
  MAX(r.created_at) as last_rated
FROM teachers t
LEFT JOIN ratings r ON t.id = r.teacher_id
GROUP BY t.id, t.name, t.institute, t.department;

CREATE INDEX idx_teacher_stats_mv_id ON teacher_stats_mv(id);
CREATE INDEX idx_teacher_stats_mv_rating ON teacher_stats_mv(avg_rating DESC NULLS LAST);

-- Refresh materialized view (run periodically, e.g., every hour)
REFRESH MATERIALIZED VIEW CONCURRENTLY teacher_stats_mv;
`;