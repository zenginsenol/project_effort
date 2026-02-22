'use client';

import { useState } from 'react';
import { ArrowRight, Moon, Sparkles, Sun } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';

import { dashboardNavItems, getActiveNav, getNextNav, getPhaseMeta } from '@/components/layout/navigation-data';
import { NotificationBell } from '@/components/notification/notification-bell';
import { NotificationCenter } from '@/components/notification/notification-center';
import { cn } from '@/lib/utils';

export function Header(): React.ReactElement {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const activeNav = getActiveNav(pathname);
  const nextNav = getNextNav(pathname);
  const phaseMeta = activeNav?.phase ? getPhaseMeta(activeNav.phase) : null;
  const quickMobileItems = dashboardNavItems.filter((item) => item.order <= 5);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);

  return (
    <header className="border-b bg-card/80 backdrop-blur">
      <div className="flex h-20 items-center justify-between px-6">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{activeNav?.name ?? 'Control Center'}</p>
            {phaseMeta && (
              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', phaseMeta.badgeClass)}>
                {phaseMeta.title}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {activeNav?.description ?? 'Project orchestration and go-live readiness'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {phaseMeta && (
            <span className={cn('hidden items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium md:inline-flex', phaseMeta.badgeClass)}>
              <Sparkles className="h-3 w-3" />
              {phaseMeta.subtitle}
            </span>
          )}
          {nextNav && (
            <Link
              href={nextNav.href}
              className="inline-flex items-center gap-1 rounded-md border bg-background/80 px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Next: {nextNav.name}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
          <div className="relative">
            <NotificationBell onClick={() => setIsNotificationCenterOpen(!isNotificationCenterOpen)} />
            <NotificationCenter
              isOpen={isNotificationCenterOpen}
              onClose={() => setIsNotificationCenterOpen(false)}
            />
          </div>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="relative rounded-md border bg-background/80 p-2 hover:bg-muted"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </button>
        </div>
      </div>

      <div className="scrollbar-thin flex gap-2 overflow-x-auto border-t px-4 pb-3 pt-2 lg:hidden">
        {quickMobileItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
                isActive ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border bg-background/80 text-muted-foreground',
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.name}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
