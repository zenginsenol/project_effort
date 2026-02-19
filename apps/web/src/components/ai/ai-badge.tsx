import { Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';

interface AIBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function AIBadge({ className, size = 'sm' }: AIBadgeProps): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-500/10 to-purple-500/10 font-medium text-purple-700 dark:text-purple-300',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        className,
      )}
    >
      <Sparkles className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      AI
    </span>
  );
}
