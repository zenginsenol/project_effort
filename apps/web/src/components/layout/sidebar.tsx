'use client';

import { FolderKanban } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { dashboardNavItems, getActiveNav, workflowPhases } from '@/components/layout/navigation-data';
import { cn } from '@/lib/utils';

export function Sidebar(): React.ReactElement {
  const pathname = usePathname();
  const activeNav = getActiveNav(pathname);
  const activePhaseIndex = workflowPhases.findIndex((phase) => phase.phase === activeNav?.phase);

  return (
    <aside className="noise-overlay hidden h-screen w-80 flex-col border-r bg-card/90 backdrop-blur lg:flex">
      <div className="border-b px-6 py-5">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <FolderKanban className="h-6 w-6" />
        </div>
        <p className="mt-3 text-lg font-bold">EstimatePro</p>
        <p className="text-xs text-muted-foreground">Kanban + cost + go-live orchestration cockpit</p>
      </div>
      <nav className="scrollbar-thin flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {workflowPhases.map((phase) => {
            const phaseItems = dashboardNavItems.filter((item) => item.phase === phase.phase);
            const isActivePhase = activeNav?.phase === phase.phase;

            return (
              <section
                key={phase.phase}
                className={cn(
                  'rounded-xl border p-3 transition-all',
                  phase.themeClass,
                  isActivePhase && 'ring-1 ring-primary/35 shadow-sm',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground/80">{phase.title}</p>
                  <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', phase.badgeClass)}>
                    Step
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{phase.subtitle}</p>
                <div className="mt-3 space-y-1">
                  {phaseItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'group block rounded-lg border px-3 py-2 transition-all',
                          isActive
                            ? 'border-primary/40 bg-background/90 text-primary shadow-sm'
                            : 'border-transparent hover:border-border/80 hover:bg-background/70',
                        )}
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <span className={cn(
                            'inline-flex h-6 w-6 items-center justify-center rounded-md border',
                            isActive
                              ? 'border-primary/30 bg-primary/10'
                              : 'border-border/80 bg-background/40 group-hover:bg-background',
                          )}
                          >
                            <item.icon className="h-3.5 w-3.5" />
                          </span>
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
        <div className="dashboard-panel soft-surface rounded-lg px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">Current Step</p>
          <p className="text-sm font-semibold">{activeNav?.name ?? 'Control Center'}</p>
          <div className="mt-2 grid grid-cols-4 gap-1">
            {workflowPhases.map((phase, index) => (
              <span
                key={phase.phase}
                className={cn(
                  'h-1.5 rounded-full',
                  index <= activePhaseIndex ? 'bg-primary' : 'bg-muted',
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
