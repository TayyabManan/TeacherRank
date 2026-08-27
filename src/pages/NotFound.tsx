import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from '../components/Meta';
import { buttonClasses } from '../components/Button';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <Helmet>
        <title>Page not found</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="text-center max-w-reading">
        <p className="text-7xl font-bold text-primary mb-4" aria-hidden="true">404</p>
        <h1 className="text-2xl font-bold text-base-content mb-2">
          Page not found
        </h1>
        <p className="text-base-content/70 mb-8">
          This page doesn't exist or may have moved. Check the address, or head
          back to browsing teachers.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/" className={buttonClasses({ variant: 'primary' })}>
            Browse teachers
          </Link>
          <Link to="/institutes" className={buttonClasses({ variant: 'outline' })}>
            View institutes
          </Link>
        </div>
      </div>
    </div>
  );
}
