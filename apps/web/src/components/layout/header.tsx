'use client';

import { ArrowRight, Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';

import { getActiveNav, getNextNav } from '@/components/layout/navigation-data';

export function Header(): React.ReactElement {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const activeNav = getActiveNav(pathname);
  const nextNav = getNextNav(pathname);

  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <div>
        <p className="text-sm font-semibold">{activeNav?.name ?? 'Control Center'}</p>
        <p className="text-xs text-muted-foreground">{activeNav?.description ?? 'Project orchestration and go-live readiness'}</p>
      </div>
      <div className="flex items-center gap-2">
        {activeNav?.phase && (
          <span className="rounded-full border px-2 py-1 text-[11px] font-medium text-muted-foreground">
            Phase: {activeNav.phase}
          </span>
        )}
        {nextNav && (
          <Link
            href={nextNav.href}
            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
          >
            Next: {nextNav.name}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="relative rounded-md p-2 hover:bg-muted"
      >
        <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </button>
      </div>
    </header>
  );
}
