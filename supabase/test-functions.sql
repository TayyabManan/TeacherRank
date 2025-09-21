-- TEST QUERIES FOR VERIFYING THE OPTIMIZATIONS
-- Run these after applying the main optimizations

-- Test 1: Get all teachers with default parameters
SELECT * FROM get_teachers_with_stats();

-- Test 2: Search for teachers by name
SELECT * FROM get_teachers_with_stats(
  search_query := 'John'
);

-- Test 3: Filter by institute
SELECT * FROM get_teachers_with_stats(
  institute_filter := 'MIT'  -- Replace with an actual institute from your data
);

-- Test 4: Test sorting by rating ascending (rising stars)
SELECT * FROM get_teachers_with_stats(
  sort_by := 'rating_asc'
);

-- Test 5: Test pagination - get page 2
SELECT * FROM get_teachers_with_stats(
  page_num := 2,
  page_size := 10
);

-- Test 6: Combined search and filter
SELECT * FROM get_teachers_with_stats(
  search_query := 'Math',
  sort_by := 'rating_desc',
  page_num := 1,
  page_size := 5
);

-- Test 7: Get total count
SELECT get_teachers_count();

-- Test 8: Get count with search
SELECT get_teachers_count(
  search_query := 'Science'
);

-- Verify indexes were created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename IN ('teachers', 'ratings')
ORDER BY tablename, indexname;

-- Check function permissions
SELECT 
    p.proname AS function_name,
    pg_get_userbyid(p.proowner) AS owner,
    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_can_execute
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname IN ('get_teachers_with_stats', 'get_teachers_count');