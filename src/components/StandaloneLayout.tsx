import React, { ReactNode } from 'react';
import { StandaloneHeader } from './StandaloneHeader';
import { Footer } from './Footer';

interface StandaloneLayoutProps {
  children: ReactNode;
}

export const StandaloneLayout = ({ children }: StandaloneLayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900">
      <StandaloneHeader />
      <main className="flex-1 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        {children}
      </main>
      <Footer />
    </div>
  );
};