import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTeacher } from '../hooks/useTeachers';

interface BreadcrumbItem {
  icon: string;
  label: string;
  path?: string;
}

export function Breadcrumbs() {
  const location = useLocation();
  
  // Extract teacher ID from pathname if on teacher profile page
  const teacherIdMatch = location.pathname.match(/^\/teacher\/([^/]+)/);
  const teacherId = teacherIdMatch ? teacherIdMatch[1] : null;
  const { data: teacher } = useTeacher(teacherId || '');
  
  const breadcrumbs = useMemo((): BreadcrumbItem[] => {
    const path = location.pathname;
    const items: BreadcrumbItem[] = [];
    
    // Always start with home
    items.push({ icon: '🏠', label: 'Home', path: '/' });
    
    // Parse the path
    if (path === '/') {
      return items;
    }
    
    // Auth pages
    if (path === '/auth') {
      items.push({ icon: '🔐', label: 'Sign In' });
      return items;
    }
    
    // Dashboard
    if (path === '/dashboard') {
      items.push({ icon: '📊', label: 'Dashboard' });
      return items;
    }
    
    // Teacher Management
    if (path === '/manage-teachers') {
      items.push({ icon: '⚙️', label: 'Manage Teachers' });
      return items;
    }
    
    // Teachers listing
    if (path === '/teachers' || path === '/') {
      items.push({ icon: '👥', label: 'Teachers' });
      return items;
    }
    
    // FAQ
    if (path === '/faq') {
      items.push({ icon: '❓', label: 'FAQ' });
      return items;
    }
    
    // Feedback
    if (path === '/feedback') {
      items.push({ icon: '💬', label: 'Feedback' });
      return items;
    }
    
    // Admin
    if (path === '/admin') {
      items.push({ icon: '🛡️', label: 'Admin Panel' });
      return items;
    }
    
    // Privacy Policy
    if (path === '/privacy') {
      items.push({ icon: '🔒', label: 'Privacy Policy' });
      return items;
    }
    
    // Terms of Service
    if (path === '/terms') {
      items.push({ icon: '📜', label: 'Terms of Service' });
      return items;
    }
    
    // Institute page
    if (path.startsWith('/institute/')) {
      const instituteName = decodeURIComponent(path.split('/institute/')[1]);
      items.push({ 
        icon: '🏫', 
        label: instituteName
      });
      return items;
    }
    
    // Teacher Profile
    if (path.startsWith('/teacher/')) {
      if (teacher) {
        // Add institute if available
        if (teacher.institute) {
          items.push({ 
            icon: '🏫', 
            label: teacher.institute,
            path: `/institute/${encodeURIComponent(teacher.institute)}`
          });
        }
        // Add teacher name
        items.push({ 
          icon: '👨‍🏫', 
          label: teacher.name
        });
      } else {
        // Show loading state or placeholder
        items.push({ 
          icon: '🏫', 
          label: 'Loading...' 
        });
        items.push({ 
          icon: '👨‍🏫', 
          label: 'Loading...' 
        });
      }
      return items;
    }
    
    return items;
  }, [location.pathname, teacher]);
  
  return (
    <nav className="flex items-center gap-1 md:gap-2 text-xs md:text-sm relative z-[80]" aria-label="Breadcrumb">
      {breadcrumbs.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <svg
              className="w-3 h-3 md:w-4 md:h-4 text-gray-400 dark:text-gray-500 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          )}
          <div className="flex items-center gap-1 md:gap-1.5">
            <span className="text-sm md:text-base" role="img" aria-label={item.label}>
              {item.icon}
            </span>
            {item.path ? (
              <Link
                to={item.path}
                className="text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors duration-200 font-medium"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-gray-900 dark:text-white font-semibold">
                {item.label}
              </span>
            )}
          </div>
        </React.Fragment>
      ))}
    </nav>
  );
}