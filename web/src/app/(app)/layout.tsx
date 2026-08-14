import { AppShell } from '@/components/layout/AppShell';

/**
 * Route group for authenticated pages. The group has no URL segment of its own,
 * so these pages keep clean paths like /dashboard while sharing the shell.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
