import React, { Suspense, useEffect } from 'react'
import { Routes, Route, Outlet, useLocation } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { recoverSession } from './lib/supabaseClient'
import { useAuthStateChange } from './hooks/useAuth'
import { lazyWithRetry } from './utils/lazyWithRetry'

// Lazy load all route components with retry mechanism for deployment updates
const TeacherListing = lazyWithRetry(() => import('./components/TeacherListing'))
const TeacherProfile = lazyWithRetry(() => import('./pages/TeacherProfile'))
const InstitutePage = lazyWithRetry(() => import('./pages/InstitutePage'))
const InstitutesPage = lazyWithRetry(() => import('./pages/InstitutesPageOptimized'))
const Auth = lazyWithRetry(() => import('./components/Auth'))
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'))
const TeacherManagement = lazyWithRetry(() => import('./pages/TeacherManagement'))
const PrivacyPolicy = lazyWithRetry(() => import('./pages/PrivacyPolicy'))
const TermsOfService = lazyWithRetry(() => import('./pages/TermsOfService'))
const FAQ = lazyWithRetry(() => import('./pages/FAQ'))
const Feedback = lazyWithRetry(() => import('./pages/Feedback'))
const Admin = lazyWithRetry(() => import('./pages/Admin'))

// Loading fallback component
const PageLoader = () => (
  <div className="flex justify-center items-center min-h-[50vh]">
    <div className="loading loading-spinner loading-lg text-primary"></div>
  </div>
)

export default function App() {
  // Set up auth state change listener
  useAuthStateChange();
  const location = useLocation();
  
  // Recover session on app mount
  useEffect(() => {
    // Mark app as loaded to prevent error handler from overwriting
    const root = document.getElementById('root');
    if (root) {
      root.classList.add('app-loaded');
    }
    
    const initSession = async () => {
      try {
        console.log('Attempting session recovery...');
        const session = await recoverSession();
        if (session) {
          console.log('Session recovered successfully');
        } else {
          console.log('No existing session found');
        }
      } catch (error) {
        console.error('Session initialization error:', error);
      }
    };
    
    initSession();
  }, []);
  
  return (
    <HelmetProvider>
      <ErrorBoundary resetKey={location.pathname}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Main app routes with sidebar */}
            <Route path="/" element={
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Outlet />
                </Suspense>
              </Layout>
            }>
              <Route index element={<TeacherListing />} />
              <Route path="teachers" element={<TeacherListing />} />
              <Route path="teacher/:id" element={<TeacherProfile />} />
              <Route path="institutes" element={<InstitutesPage />} />
              <Route path="institute/:name" element={<InstitutePage />} />
              <Route path="dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="manage-teachers" element={
                <ProtectedRoute requireAdmin>
                  <TeacherManagement />
                </ProtectedRoute>
              } />
              <Route path="admin" element={
                <ProtectedRoute requireAdmin>
                  <Admin />
                </ProtectedRoute>
              } />
              <Route path="auth" element={<Auth />} />
              <Route path="faq" element={<FAQ />} />
              <Route path="feedback" element={<Feedback />} />
              <Route path="privacy" element={<PrivacyPolicy />} />
              <Route path="terms" element={<TermsOfService />} />
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </HelmetProvider>
  )
}