'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button, cx } from '@/components/ui';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Today' },
  { href: '/log', label: 'Log Meal' },
  { href: '/goals', label: 'Goals' },
  { href: '/entries', label: 'Entries' },
  { href: '/reports', label: 'Reports' },
  { href: '/chat', label: 'Chat Support' },
  { href: '/import', label: 'Import PDF' },
];

/**
 * Chrome for every signed-in page, and the single place the client-side auth
 * guard lives so individual pages do not each re-implement it.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  // Rendering the page before the token check finishes would flash private
  // chrome to a signed-out visitor.
  if (isLoading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur">
        {/* Three equal leftover columns so the links sit in the middle of the
            viewport, not in the leftover gap after the logo. The logo and the
            account controls are different widths; a flex row would still shove
            the nav toward whichever side is thinner. */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2 justify-self-start">
            {/* Solid red mark, echoing the square logo in the reference. */}
            <span className="grid size-6 place-items-center rounded bg-accent text-xs font-bold text-on-accent">
              C
            </span>
            <span className="hidden text-sm font-semibold tracking-tight sm:inline">
              Calorie Tracker
            </span>
          </Link>

          <nav
            className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none]"
            aria-label="Main"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cx(
                    'shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'bg-foreground text-surface'
                      : 'text-muted hover:bg-surface-raised hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center justify-end gap-3 justify-self-end">
            <span className="hidden text-sm text-muted sm:inline">{user.displayName}</span>
            <Button variant="ghost" onClick={logout} className="px-2 py-1">
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Full-bleed with padding rather than a centred column, so wide monitors
          are used for content instead of empty margins. */}
      <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
