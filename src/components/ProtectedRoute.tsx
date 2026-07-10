import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../hooks/useAuth';
import { useIsAdmin } from '../hooks/useIsAdmin';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { data: user, isLoading, error } = useUser();
  const location = useLocation();
  // Shared cached admin check (D6) — no per-route async race.
  const adminQuery = useIsAdmin();

  // Show loading spinner while checking authentication
  if (isLoading || (requireAdmin && !!user && adminQuery.isPending)) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[50dvh] gap-4">
        <div className="loading loading-spinner loading-lg text-primary"></div>
        <div className="text-center">
          <p className="text-lg font-medium text-base-content/80">
            {requireAdmin ? 'Verifying admin access...' : 'Verifying your session...'}
          </p>
          <p className="text-sm text-base-content/70 mt-1">
            This will only take a moment
          </p>
        </div>
      </div>
    );
  }

  // If there's an error or no user, redirect to auth — remembering where the
  // user was headed so we can return them there after they sign in.
  if (error || !user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  // Check admin role if required (using RBAC instead of hardcoded email)
  if (requireAdmin && (adminQuery.isError || adminQuery.data === false)) {
    return <Navigate to="/dashboard" replace />;
  }

  // User is authenticated, render the protected content
  return <>{children}</>;
}