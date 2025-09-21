import React, { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Outlet } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout } from './components/Layout'
import { StandaloneLayout } from './components/StandaloneLayout'
import { SharedLayout } from './components/SharedLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { recoverSession } from './lib/supabaseClient'
import { useAuthStateChange } from './hooks/useAuth'

// Lazy load all route components for code splitting
const TeacherListing = lazy(() => import('./components/TeacherListing'))
const TeacherProfile = lazy(() => import('./pages/TeacherProfile'))
const InstitutePage = lazy(() => import('./pages/InstitutePage'))
const Auth = lazy(() => import('./components/Auth'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const TeacherManagement = lazy(() => import('./pages/TeacherManagement'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const TermsOfService = lazy(() => import('./pages/TermsOfService'))
const FAQ = lazy(() => import('./pages/FAQ'))
const Feedback = lazy(() => import('./pages/Feedback'))
const Admin = lazy(() => import('./pages/Admin'))
const About = lazy(() => import('./pages/About'))
const HowItWorks = lazy(() => import('./pages/HowItWorks'))

// Loading fallback component
const PageLoader = () => (
  <div className="flex justify-center items-center min-h-[50vh]">
    <div className="loading loading-spinner loading-lg text-primary"></div>
  </div>
)

export default function App() {
  // Set up auth state change listener
  useAuthStateChange();
  
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
      <ErrorBoundary>
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

            {/* Standalone pages (with minimal layout, no sidebar) */}
            <Route path="/about" element={
              <SharedLayout>
                <About />
              </SharedLayout>
            } />
            <Route path="/how-it-works" element={
              <SharedLayout>
                <HowItWorks />
              </SharedLayout>
            } />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </HelmetProvider>
  )
}