import {
  BarChart3,
  Brain,
  Calculator,
  CalendarDays,
  Clock,
  FolderKanban,
  GitCompareArrows,
  Home,
  Plug,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export type WorkflowPhase = 'Ingest' | 'Plan' | 'Estimate' | 'Operate';

export type DashboardNavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  description: string;
  phase: WorkflowPhase;
  order: number;
};

export const dashboardNavItems: DashboardNavItem[] = [
  {
    name: 'Control Center',
    href: '/dashboard',
    icon: Home,
    description: 'Go-live durumunu ve akisin sagligini takip et',
    phase: 'Operate',
    order: 1,
  },
  {
    name: 'Task Analyzer',
    href: '/dashboard/analyzer',
    icon: Brain,
    description: 'Dökümandan is kapsamini ve tasklari cikart',
    phase: 'Ingest',
    order: 2,
  },
  {
    name: 'Projects',
    href: '/dashboard/projects',
    icon: FolderKanban,
    description: 'Kanban proje alanlarini yonet',
    phase: 'Plan',
    order: 3,
  },
  {
    name: 'Effort Cost',
    href: '/dashboard/effort',
    icon: Calculator,
    description: 'Efor, maliyet, roadmap, compare ve export',
    phase: 'Estimate',
    order: 4,
  },
  {
    name: 'Compare AI',
    href: '/dashboard/compare',
    icon: GitCompareArrows,
    description: 'Provider/model farklarini yan yana degerlendir',
    phase: 'Estimate',
    order: 5,
  },
  {
    name: 'Sessions',
    href: '/dashboard/sessions',
    icon: Clock,
    description: 'Canli estimation oturumlarini yonet',
    phase: 'Operate',
    order: 6,
  },
  {
    name: 'Sprints',
    href: '/dashboard/sprints',
    icon: CalendarDays,
    description: 'Sprint planlama ve ilerleme takibi',
    phase: 'Operate',
    order: 7,
  },
  {
    name: 'Analytics',
    href: '/dashboard/analytics',
    icon: BarChart3,
    description: 'KPI, velocity ve raporlama',
    phase: 'Operate',
    order: 8,
  },
  {
    name: 'Integrations',
    href: '/dashboard/integrations',
    icon: Plug,
    description: 'GitHub ve diger baglantilar',
    phase: 'Operate',
    order: 9,
  },
  {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    description: 'AI provider key/model ve genel ayarlar',
    phase: 'Operate',
    order: 10,
  },
];

export const workflowPhases: Array<{
  phase: WorkflowPhase;
  title: string;
  subtitle: string;
}> = [
  {
    phase: 'Ingest',
    title: '1. Ingest',
    subtitle: 'Dokuman -> task cikarma',
  },
  {
    phase: 'Plan',
    title: '2. Plan',
    subtitle: 'Kanban proje olusturma',
  },
  {
    phase: 'Estimate',
    title: '3. Estimate',
    subtitle: 'Efor, maliyet, compare',
  },
  {
    phase: 'Operate',
    title: '4. Operate',
    subtitle: 'Takip, sprint, analytics, release',
  },
];

export function getActiveNav(pathname: string): DashboardNavItem | null {
  const match = dashboardNavItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return match ?? null;
}

export function getNextNav(pathname: string): DashboardNavItem | null {
  const active = getActiveNav(pathname);
  if (!active) {
    return dashboardNavItems[0] ?? null;
  }

  const sorted = [...dashboardNavItems].sort((a, b) => a.order - b.order);
  const activeIndex = sorted.findIndex((item) => item.href === active.href);
  if (activeIndex === -1 || activeIndex === sorted.length - 1) {
    return null;
  }
  return sorted[activeIndex + 1] ?? null;
}
