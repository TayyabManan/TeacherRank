import React from 'react';

interface PageHeroProps {
  /** Icon shown in the tile beside the title (from icons.tsx); tint with `text-primary`. */
  icon: React.ReactNode;
  title: string;
  /** One-line summary under the title; accepts nodes for loading/empty variants. */
  description: React.ReactNode;
  /** Inline stats rendered as "{value} {label}". */
  stats?: { label: string; value: string | number }[];
  /** Right-aligned quick actions (links/buttons — use Button/buttonClasses variants). */
  actions?: React.ReactNode;
}

/**
 * Quiet page hero: a standard elevated surface with the brand violet spent only
 * on the small icon tile. (Replaced the saturated `bg-primary` slab in the
 * 2026-08 premium pass — big flat brand-color panels read template-y, and
 * accent coverage, not hue, is what makes them loud.)
 */
export function PageHero({ icon, title, description, stats, actions }: PageHeroProps) {
  return (
    <header className="bg-base-100 border border-base-300 rounded-lg shadow-sm">
      <div className="p-6 md:p-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="min-w-0">
            <h1 className="text-3xl md:text-4xl font-bold text-base-content mb-3 flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-11 h-11 shrink-0 bg-primary/10 text-primary rounded-lg">
                {icon}
              </span>
              <span className="min-w-0">{title}</span>
            </h1>

            <p className="text-base-content/70 text-base md:text-lg max-w-2xl">{description}</p>

            {stats && stats.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {stats.map((stat) => (
                  <span key={stat.label} className="inline-flex items-baseline gap-1.5">
                    <span className="text-lg font-semibold text-base-content tabular-nums">{stat.value}</span>
                    <span className="text-base-content/70">{stat.label}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {actions && <div className="flex flex-wrap gap-3 shrink-0">{actions}</div>}
        </div>
      </div>
    </header>
  );
}
