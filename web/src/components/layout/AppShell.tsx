'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { BrandMark } from '@/components/brand/BrandMark';
import { Button, cx } from '@/components/ui';
import { NavIcon } from './nav-icons';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Today', icon: 'today' as const },
  { href: '/log', label: 'Log Meal', icon: 'log' as const },
  { href: '/goals', label: 'Goals', icon: 'goals' as const },
  { href: '/entries', label: 'Entries', icon: 'entries' as const },
  { href: '/reports', label: 'Reports', icon: 'reports' as const },
  { href: '/chat', label: 'Chat Support', icon: 'chat' as const },
  { href: '/import', label: 'Bulk import', icon: 'import' as const },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Chrome for every signed-in page. Wide screens get a left sidebar matching the
 * later page mocks; smaller screens keep a compact top bar so the same links
 * stay reachable.
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

  if (isLoading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  const initial = user.displayName.trim().slice(0, 1).toUpperCase() || '?';

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="px-5 py-5">
          <Link href="/dashboard">
            <BrandMark size={28} />
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label="Main">
          {NAV_ITEMS.map((item) => {
            const isActive = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cx(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-accent-soft font-medium text-accent'
                    : 'text-muted hover:bg-surface-raised hover:text-foreground',
                )}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border px-4 py-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent"
            >
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.displayName}</p>
              <button
                type="button"
                onClick={logout}
                className="text-xs text-muted hover:text-foreground"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Link href="/dashboard">
              <BrandMark size={26} nameClassName="hidden sm:inline" />
            </Link>
            <div className="flex items-center gap-2">
              <span className="hidden text-sm text-muted sm:inline">{user.displayName}</span>
              <Button variant="ghost" onClick={logout} className="px-2 py-1">
                Sign out
              </Button>
            </div>
          </div>
          <nav
            className="flex items-center gap-1 overflow-x-auto px-3 pb-3 [scrollbar-width:none]"
            aria-label="Main"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cx(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'bg-accent-soft font-medium text-accent'
                      : 'text-muted hover:bg-surface-raised hover:text-foreground',
                  )}
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
