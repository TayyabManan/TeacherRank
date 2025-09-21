import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '../hooks/useAuth';
import { isAdmin } from '../lib/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { data: user, isLoading, error } = useUser();
  const [isAdminUser, setIsAdminUser] = useState<boolean | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(false);

  // Check admin status when needed
  useEffect(() => {
    if (requireAdmin && user && isAdminUser === null) {
      setCheckingAdmin(true);
      isAdmin()
        .then(result => {
          console.log('Admin check result:', result); // Debug log
          setIsAdminUser(result);
          setCheckingAdmin(false);
        })
        .catch(err => {
          console.error('Admin check error:', err);
          setIsAdminUser(false);
          setCheckingAdmin(false);
        });
    }
  }, [requireAdmin, user, isAdminUser]);

  // Show loading spinner while checking authentication
  if (isLoading || (requireAdmin && isAdminUser === null)) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[50vh] gap-4">
        <div className="loading loading-spinner loading-lg text-primary"></div>
        <div className="text-center">
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
            {requireAdmin ? 'Verifying admin access...' : 'Verifying your session...'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Please wait while we authenticate your access
          </p>
        </div>
      </div>
    );
  }

  // If there's an error or no user, redirect to auth
  if (error || !user) {
    return <Navigate to="/auth" replace />;
  }

  // Check admin role if required (using RBAC instead of hardcoded email)
  if (requireAdmin && isAdminUser === false) {
    console.log('Access denied - not an admin');
    return <Navigate to="/dashboard" replace />;
  }

  // User is authenticated, render the protected content
  return <>{children}</>;
}