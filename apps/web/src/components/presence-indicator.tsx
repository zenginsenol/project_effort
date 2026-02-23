'use client';

import { Circle } from 'lucide-react';

import { cn } from '@/lib/utils';

export type PresenceStatus = 'online' | 'idle' | 'voting';

interface PresenceIndicatorProps {
  status: PresenceStatus;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusConfig: Record<
  PresenceStatus,
  {
    label: string;
    color: string;
    dotColor: string;
    pulseColor: string;
  }
> = {
  online: {
    label: 'Online',
    color: 'text-green-600',
    dotColor: 'fill-green-600',
    pulseColor: 'bg-green-600',
  },
  idle: {
    label: 'Idle',
    color: 'text-amber-600',
    dotColor: 'fill-amber-600',
    pulseColor: 'bg-amber-600',
  },
  voting: {
    label: 'Voting',
    color: 'text-blue-600',
    dotColor: 'fill-blue-600',
    pulseColor: 'bg-blue-600',
  },
};

const sizeConfig = {
  sm: {
    icon: 'h-2 w-2',
    text: 'text-xs',
    pulse: 'h-2 w-2',
  },
  md: {
    icon: 'h-3 w-3',
    text: 'text-sm',
    pulse: 'h-3 w-3',
  },
  lg: {
    icon: 'h-4 w-4',
    text: 'text-base',
    pulse: 'h-4 w-4',
  },
};

export function PresenceIndicator({
  status,
  showLabel = false,
  size = 'md',
  className,
}: PresenceIndicatorProps): React.ReactElement {
  const config = statusConfig[status];
  const sizes = sizeConfig[size];

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="relative inline-flex">
        <Circle className={cn(sizes.icon, config.dotColor)} />
        {status === 'voting' && (
          <span className="absolute inset-0 animate-ping">
            <Circle className={cn(sizes.pulse, config.pulseColor, 'opacity-75')} />
          </span>
        )}
      </div>
      {showLabel && <span className={cn(sizes.text, config.color, 'font-medium')}>{config.label}</span>}
    </div>
  );
}
