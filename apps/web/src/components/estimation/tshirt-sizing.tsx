'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';

const SIZES = [
  { label: 'XS', value: 1, color: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200' },
  { label: 'S', value: 2, color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900 dark:text-emerald-200' },
  { label: 'M', value: 5, color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200' },
  { label: 'L', value: 8, color: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-200' },
  { label: 'XL', value: 13, color: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900 dark:text-orange-200' },
  { label: 'XXL', value: 21, color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200' },
];

export function TShirtSizing(): React.ReactElement {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">T-Shirt Sizing</h3>
        <p className="text-sm text-muted-foreground">
          Select a size that represents the effort for this task.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {SIZES.map((size) => (
          <button
            key={size.label}
            onClick={() => setSelected(size.label === selected ? null : size.label)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg border-2 p-4 transition-all hover:scale-105',
              size.label === selected
                ? 'ring-2 ring-primary ring-offset-2 scale-105 shadow-lg'
                : '',
              size.color,
            )}
          >
            <span className="text-2xl font-bold">{size.label}</span>
            <span className="text-xs opacity-70">{size.value} pts</span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm">
            Selected: <span className="font-bold">{selected}</span>
            {' '}({SIZES.find((s) => s.label === selected)?.value} story points)
          </p>
        </div>
      )}
    </div>
  );
}
