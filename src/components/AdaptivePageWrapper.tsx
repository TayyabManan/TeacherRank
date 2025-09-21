import React, { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface AdaptivePageWrapperProps {
  children: ReactNode;
}

export const AdaptivePageWrapper = ({ children }: AdaptivePageWrapperProps) => {
  const location = useLocation();
  
  // Check if we're in the app context (with sidebar) or landing context
  const isAppContext = false; // Remove app context check since we're moving to root paths
  
  if (isAppContext) {
    // App context - clean white background for readability with sidebar
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8">
          {children}
        </div>
      </div>
    );
  }
  
  // Landing context - gradient-friendly glassmorphic design
  return (
    <div className="max-w-4xl mx-auto px-8 py-20">
      <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/20">
        {children}
      </div>
    </div>
  );
};