import React from 'react'
import { Routes, Route } from 'react-router-dom'
import TeacherListing from './components/TeacherListing'
import TeacherProfile from './pages/TeacherProfile'
import Auth from './components/Auth'
import Dashboard from './pages/Dashboard'
import TeacherManagement from './pages/TeacherManagement'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout } from './components/Layout'

// Debug component to test if React is rendering
function DebugApp() {
  console.log('App component rendering...');
  
  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0', minHeight: '100vh' }}>
      <h1 style={{ color: 'red' }}>Debug Mode - App is Loading</h1>
      <p>If you can see this, React is working!</p>
      <hr />
      <ErrorBoundary>
        <Layout>
          <Routes>
            <Route path="/" element={<TeacherListing />} />
            <Route path="/teacher/:id" element={<TeacherProfile />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/manage-teachers" element={<TeacherManagement />} />
          </Routes>
        </Layout>
      </ErrorBoundary>
    </div>
  )
}

export default function App() {
  // Temporarily use debug version
  return <DebugApp />
}