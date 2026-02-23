import { CommandPalette } from '@/components/search/command-palette';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="scrollbar-thin flex-1 overflow-y-auto p-4 md:p-6">
          <div className="animate-fade-up">
            {children}
          </div>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
