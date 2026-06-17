# Teacher Rank

A web app where students rate and review their teachers. Live at teacherrank.vercel.app.

## Purpose

Most universities don't publish real teaching feedback, so students end up asking around to figure out which classes are worth taking. Teacher Rank collects that informal word-of-mouth in one place, keeps reviews anonymous so people are honest, and lets a first-year see what a senior already knows.

## Key features

- Browse teachers by institute, department, or rating
- Post 5-star reviews with half-star precision
- Anonymous submission with profanity filter and rate limiting
- Institute pages that aggregate teachers and stats per school
- Personal dashboard showing reviews you've written
- Admin panel for moderation, teacher management, and approving new-teacher requests
- Feedback page so students can request teachers who aren't yet listed
- Mobile PWA with offline fallback, haptic feedback, and pull-to-refresh

## Stack

Frontend is React 18 + TypeScript on Vite, styled with Tailwind and DaisyUI. Routing uses React Router v6 with lazy-loaded routes wrapped in a retry helper, so a deploy in the middle of a session doesn't strand users on a missing chunk. Server state goes through TanStack Query. Forms run on React Hook Form with Zod schemas.

Backend is Supabase: Postgres for data, Row Level Security for authorization, Google OAuth for sign-in, and Edge Functions for rate limiting and transactional email. Two Vercel serverless functions handle image proxying and an extra rate-limit layer at the edge. Errors go to Sentry; Vercel Analytics and Web Vitals track performance.

## Performance and security

The app code-splits per route, virtualizes long teacher lists with TanStack Virtual, lazy-loads images as WebP with fallbacks, and uses a service worker for static caching plus an offline page. Builds are compressed. README reports a 95+ Lighthouse score.

Security covers OAuth with PKCE, RLS at the database, CSP headers, rate limits at both Vercel and Supabase edge, and validation on every form. Anonymous reviewers are tracked by hashed identifiers so one person can't quietly flood a single teacher's page.

## Project shape

Production-grade v1.0, not a prototype. About 30 React components, 12 routed pages, three Supabase Edge Functions, two Vercel API routes, and a Dockerfile plus docker-compose for local runs.
