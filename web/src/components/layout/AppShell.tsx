'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { openBite } from '@/lib/open-bite';
import { BrandMark } from '@/components/brand/BrandMark';
import { DietBotWidget } from '@/components/diet-bot/DietBotWidget';
import { Button, cx } from '@/components/ui';
import { NavIcon } from './nav-icons';

const DIARY = [
  { href: '/dashboard', label: 'Today', icon: 'today' as const },
  { href: '/log', label: 'Log Meal', icon: 'log' as const },
  { href: '/entries', label: 'Entries', icon: 'entries' as const },
];

const NUTRITION = [
  { href: '/goals', label: 'Goals', icon: 'goals' as const },
  { href: '/reports', label: 'Reports', icon: 'reports' as const },
];

const TOOLS = [
  { href: '/chat', label: 'Chat Support', icon: 'chat' as const },
  { href: '/import', label: 'Bulk import', icon: 'import' as const },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Chrome for every signed-in page. Wide screens get a left sidebar; smaller
 * screens keep the same links in a compact top bar.
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
    <div className="min-h-dvh bg-background lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-white/50 bg-white/70 shadow-[1px_0_0_rgb(17_17_19/0.04)] backdrop-blur-xl lg:flex">
        <div className="px-5 py-5">
          <Link href="/dashboard">
            <BrandMark size={28} />
          </Link>
          <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-subtle">Nutrition diary</p>
        </div>

        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-3" aria-label="Main">
          <NavGroup title="Diary" items={DIARY} pathname={pathname} />
          <div>
            <p className="px-3 pb-2 text-[11px] uppercase tracking-[0.14em] text-subtle">Nutrition</p>
            <BiteNavButton />
            <div className="mt-1 flex flex-col gap-0.5">
              {NUTRITION.map((item) => (
                <NavItem key={item.href} {...item} active={isActivePath(pathname, item.href)} />
              ))}
            </div>
          </div>
          <NavGroup title="Tools" items={TOOLS} pathname={pathname} />
        </nav>

        <div className="border-t border-white/60 px-4 py-4">
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
        <header className="sticky top-0 z-10 border-b border-white/50 bg-white/70 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Link href="/dashboard">
              <BrandMark size={28} />
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
            <BiteNavChip />
            {[...DIARY, ...NUTRITION, ...TOOLS].map((item) => {
              const isActive = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cx(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'bg-white/80 font-medium text-accent shadow-[0_1px_0_rgb(255_255_255/0.8)]'
                      : 'text-muted hover:bg-white/50 hover:text-foreground',
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

      <DietBotWidget />
    </div>
  );
}

function NavGroup({
  title,
  items,
  pathname,
}: {
  title: string;
  items: { href: string; label: string; icon: Parameters<typeof NavIcon>[0]['name'] }[];
  pathname: string;
}) {
  return (
    <div>
      <p className="px-3 pb-2 text-[11px] uppercase tracking-[0.14em] text-subtle">{title}</p>
      <div className="flex flex-col gap-0.5">
        {items.map((item) => (
          <NavItem key={item.href} {...item} active={isActivePath(pathname, item.href)} />
        ))}
      </div>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: Parameters<typeof NavIcon>[0]['name'];
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-white/75 font-medium text-accent shadow-[0_1px_0_rgb(255_255_255/0.85)] backdrop-blur-md'
          : 'text-muted hover:bg-white/45 hover:text-foreground',
      )}
    >
      <NavIcon name={icon} />
      {label}
    </Link>
  );
}

function NewMark() {
  return (
    <sup className="ml-1 align-super text-[9px] font-semibold tracking-[0.08em] text-accent">NEW</sup>
  );
}

function BiteNavButton() {
  return (
    <button
      type="button"
      onClick={openBite}
      className="mb-1 flex w-full items-center gap-2.5 rounded-xl border border-white/70 bg-white/55 px-3 py-2.5 text-left shadow-[0_1px_0_rgb(255_255_255/0.8)] backdrop-blur-md transition-colors hover:bg-white/80"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-on-accent">
        <NavIcon name="bite" className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">
          Bite
          <NewMark />
        </span>
        <span className="block text-[11px] text-subtle">Diet assistant</span>
      </span>
    </button>
  );
}

function BiteNavChip() {
  return (
    <button
      type="button"
      onClick={openBite}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/70 bg-white/60 px-3 py-1.5 text-sm font-medium text-foreground shadow-[0_1px_0_rgb(255_255_255/0.8)] backdrop-blur-md"
    >
      <NavIcon name="bite" />
      Bite
      <NewMark />
    </button>
  );
}
