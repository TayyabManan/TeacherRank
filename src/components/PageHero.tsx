import React from 'react';

interface PageHeroProps {
  /** Icon shown in the tile beside the title (from icons.tsx). */
  icon: React.ReactNode;
  title: string;
  /** One-line summary under the title; accepts nodes for loading/empty variants. */
  description: React.ReactNode;
  /** Stat pills rendered as "{value} {label}". */
  stats?: { label: string; value: string | number }[];
  /** Right-aligned quick actions (links/buttons). */
  actions?: React.ReactNode;
}

/**
 * The saturated `bg-primary` page hero used by the institute pages. All inner
 * surfaces derive from `primary-content` alphas so both themes work (D1).
 */
export function PageHero({ icon, title, description, stats, actions }: PageHeroProps) {
  return (
    <div className="relative overflow-hidden bg-primary text-primary-content rounded-lg shadow-sm">
      <div className="relative p-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4 flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-12 h-12 shrink-0 bg-primary-content/15 rounded-lg backdrop-blur-sm">
                {icon}
              </span>
              {title}
            </h1>

            <p className="text-primary-content/90 text-lg mb-4">{description}</p>

            {stats && stats.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-primary-content/15 backdrop-blur-sm px-4 py-2 rounded-md text-sm font-medium"
                  >
                    {stat.value} {stat.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
