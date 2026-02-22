import { NotificationProvider } from '@/providers/notification-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { TRPCProvider } from '@/providers/trpc-provider';

import './globals.css';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'EstimatePro - AI-Powered Project Estimation',
  description: 'Agile project effort estimation platform with AI-powered suggestions',
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <TRPCProvider>
          <NotificationProvider>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
              {children}
            </ThemeProvider>
          </NotificationProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}
