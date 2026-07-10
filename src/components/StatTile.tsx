import React from 'react';

type Tone = 'primary' | 'info' | 'success' | 'warning' | 'error';

const TONE: Record<Tone, string> = {
  primary: 'text-primary',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
};

interface StatTileProps {
  value: React.ReactNode;
  label: string;
  /** Accent color for the value; defaults to plain text. */
  tone?: Tone;
}

/** Centered stat card (big value over a muted label) for stat grids. */
export function StatTile({ value, label, tone }: StatTileProps) {
  return (
    <div className="bg-base-100 rounded-lg p-6 text-center shadow-sm border border-base-300">
      <div className={`text-3xl font-bold mb-2 ${tone ? TONE[tone] : 'text-base-content'}`}>
        {value}
      </div>
      <div className="text-sm text-base-content/70">{label}</div>
    </div>
  );
}
