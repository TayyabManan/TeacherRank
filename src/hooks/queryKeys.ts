import type { QueryClient } from '@tanstack/react-query';

/**
 * Query key vocabulary, and the invalidation set that goes with it.
 *
 * Every value here is byte-identical to the inline keys it replaced — this is a
 * naming exercise, not a re-keying. Changing a key's *shape* changes which
 * queries dedupe against each other and would break the request-count gates
 * documented in CLAUDE.md (home 4 / institute 3 / profile 2).
 *
 * Why this file exists: the facet queries below cache for 15–30 minutes, which
 * is only safe if writes invalidate them. They didn't. Adding a teacher at a new
 * institute left that institute missing from every filter dropdown, the
 * /institutes directory and every form datalist for up to half an hour. The
 * invalidation list needs one home so the next person adding a facet hook can
 * see what a write is supposed to clear.
 */
export const queryKeys = {
  /** Teacher listing (server-side RPC), keyed by the full filter set. */
  teachers: ['teachers'] as const,
  teacher: (id: string) => ['teacher', id] as const,

  /** Facet/directory reads — all cached 30 min. */
  institutes: ['institutes'] as const,
  institutesWithStats: ['institutes-optimized'] as const,
  departments: (institute: string) => ['departments', institute] as const,
  cities: (institute: string) => ['cities', institute] as const,
  designations: ['designations'] as const,
  instituteFacets: (institute: string) => ['institute-facets', institute] as const,

  /** Home-page aggregate card — cached 15 min. */
  platformStats: ['platform-stats'] as const,

  /** Ratings. */
  ratings: ['ratings'] as const,
  userRating: ['user-rating'] as const,
} as const;

/**
 * Key prefixes a teacher write invalidates.
 *
 * These are prefixes on purpose: React Query matches by prefix, so `['cities']`
 * clears every `['cities', <institute>]` entry without enumerating institutes.
 */
const TEACHER_WRITE_PREFIXES = [
  queryKeys.teachers,
  queryKeys.institutes,
  queryKeys.institutesWithStats,
  ['departments'],
  ['cities'],
  queryKeys.designations,
  ['institute-facets'],
  queryKeys.platformStats,
] as const;

/**
 * Invalidate everything a teacher create/update/delete/approve affects.
 *
 * Call this from every path that writes to `teachers` — including
 * TeacherRequestManager, which inserts rows directly through the Supabase
 * client rather than through the mutations in useTeachers.
 *
 * @param teacherId when known, also clears that teacher's own detail entry.
 */
export function invalidateTeacherData(
  queryClient: QueryClient,
  teacherId?: string
): void {
  for (const prefix of TEACHER_WRITE_PREFIXES) {
    queryClient.invalidateQueries({ queryKey: prefix });
  }
  if (teacherId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.teacher(teacherId) });
  }
}
