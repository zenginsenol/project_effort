'use client';

import { BarChart3, Brain, Calculator, CalendarDays, Clock, FolderKanban, Home, Plug, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Projects', href: '/dashboard/projects', icon: FolderKanban },
  { name: 'Task Analyzer', href: '/dashboard/analyzer', icon: Brain },
  { name: 'Effort Cost', href: '/dashboard/effort', icon: Calculator },
  { name: 'Sessions', href: '/dashboard/sessions', icon: Clock },
  { name: 'Sprints', href: '/dashboard/sprints', icon: CalendarDays },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Team', href: '/dashboard/team', icon: Users },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  { name: 'Integrations', href: '/dashboard/integrations', icon: Plug },
];

export function Sidebar(): React.ReactElement {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <FolderKanban className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">EstimatePro</span>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">DA</div>
          <span className="text-sm text-muted-foreground">Demo Admin</span>
        </div>
      </div>
    </aside>
  );
}
