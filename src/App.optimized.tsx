import React, { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout } from './components/Layout'
import { TeacherListSkeleton } from './components/Skeleton'

// Lazy load all route components for code splitting
const TeacherListing = lazy(() => import('./components/TeacherListing'))
const TeacherProfile = lazy(() => import('./pages/TeacherProfile'))
const Auth = lazy(() => import('./components/Auth'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const TeacherManagement = lazy(() => import('./pages/TeacherManagement'))

// Loading component for better UX during lazy loading
const PageLoader = () => (
  <div className="flex justify-center items-center min-h-[50vh]">
    <span className="loading loading-spinner loading-lg"></span>
  </div>
)

export default function App() {
  return (
    <ErrorBoundary>
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<TeacherListing />} />
            <Route path="/teacher/:id" element={<TeacherProfile />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/manage-teachers" element={<TeacherManagement />} />
          </Routes>
        </Suspense>
      </Layout>
    </ErrorBoundary>
  )
}