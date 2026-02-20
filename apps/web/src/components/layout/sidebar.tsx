'use client';

import { FolderKanban } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { dashboardNavItems, getActiveNav, workflowPhases } from '@/components/layout/navigation-data';
import { cn } from '@/lib/utils';

export function Sidebar(): React.ReactElement {
  const pathname = usePathname();
  const activeNav = getActiveNav(pathname);

  return (
    <aside className="flex h-screen w-80 flex-col border-r bg-card">
      <div className="border-b px-6 py-4">
        <FolderKanban className="h-6 w-6 text-primary" />
        <p className="mt-2 text-lg font-bold">EstimatePro</p>
        <p className="text-xs text-muted-foreground">Go-live workflow cockpit</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {workflowPhases.map((phase) => {
            const phaseItems = dashboardNavItems.filter((item) => item.phase === phase.phase);
            const isActivePhase = activeNav?.phase === phase.phase;

            return (
              <section key={phase.phase} className={cn('rounded-lg border p-3', isActivePhase && 'border-primary/40 bg-primary/5')}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{phase.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{phase.subtitle}</p>
                <div className="mt-3 space-y-1">
                  {phaseItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'block rounded-md px-3 py-2 transition-colors',
                          isActive ? 'bg-primary/15 text-primary' : 'hover:bg-muted',
                        )}
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <item.icon className="h-4 w-4" />
                          {item.name}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">{item.description}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </nav>
      <div className="border-t px-4 py-3">
        <div className="rounded-md bg-muted/50 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">Current Step</p>
          <p className="text-sm font-semibold">{activeNav?.name ?? 'Control Center'}</p>
        </div>
      </div>
    </aside>
  );
}
