import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTeacher } from '../hooks/useTeachers';

interface BreadcrumbItem {
  icon: React.ReactNode;
  label: string;
  path?: string;
}

// Consistent icon components
const Icons = {
  Home: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  ),
  Auth: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
  Dashboard: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="9" rx="1" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  ),
  Manage: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Teachers: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  FAQ: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Feedback: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
    </svg>
  ),
  Admin: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  Privacy: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
  Terms: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  Institute: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 7l6 3v11H6V10l6-3z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 7V2" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2 21h20" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 21v-7h3M21 21v-7h-3" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 21v-4h4v4" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 2h4v3h-4V2z" />
      <circle cx="12" cy="13" r="1.5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  ),
  Teacher: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  ),
};

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
    items.push({ icon: Icons.Home, label: 'Home', path: '/' });

    // Parse the path
    if (path === '/') {
      return items;
    }

    // Auth pages
    if (path === '/auth') {
      items.push({ icon: Icons.Auth, label: 'Sign In' });
      return items;
    }

    // Dashboard
    if (path === '/dashboard') {
      items.push({ icon: Icons.Dashboard, label: 'Dashboard' });
      return items;
    }

    // Teacher Management
    if (path === '/manage-teachers') {
      items.push({ icon: Icons.Manage, label: 'Manage Teachers' });
      return items;
    }

    // Teachers listing
    if (path === '/teachers' || path === '/') {
      items.push({ icon: Icons.Teachers, label: 'Teachers' });
      return items;
    }

    // FAQ
    if (path === '/faq') {
      items.push({ icon: Icons.FAQ, label: 'FAQ' });
      return items;
    }

    // Feedback
    if (path === '/feedback') {
      items.push({ icon: Icons.Feedback, label: 'Feedback' });
      return items;
    }

    // Admin
    if (path === '/admin') {
      items.push({ icon: Icons.Admin, label: 'Admin Panel' });
      return items;
    }

    // Privacy Policy
    if (path === '/privacy') {
      items.push({ icon: Icons.Privacy, label: 'Privacy Policy' });
      return items;
    }

    // Terms of Service
    if (path === '/terms') {
      items.push({ icon: Icons.Terms, label: 'Terms of Service' });
      return items;
    }

    // Institute page
    if (path.startsWith('/institute/')) {
      const instituteName = decodeURIComponent(path.split('/institute/')[1]);
      items.push({
        icon: Icons.Institute,
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
            icon: Icons.Institute,
            label: teacher.institute,
            path: `/institute/${encodeURIComponent(teacher.institute)}`
          });
        }
        // Add teacher name
        items.push({
          icon: Icons.Teacher,
          label: teacher.name
        });
      } else {
        // Show loading state or placeholder
        items.push({
          icon: Icons.Institute,
          label: 'Loading...'
        });
        items.push({
          icon: Icons.Teacher,
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          )}
          <div className="flex items-center gap-1 md:gap-1.5">
            <span className="text-gray-500 dark:text-gray-400">
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