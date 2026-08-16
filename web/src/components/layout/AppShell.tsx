'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
  { href: '/weight', label: 'Weight Tracker', icon: 'weight' as const, isNew: true },
  { href: '/reports', label: 'Reports', icon: 'reports' as const },
];

const TOOLS = [
  { href: '/chat', label: 'Chat Support', icon: 'chat' as const },
  { href: '/import', label: 'Bulk import', icon: 'import' as const },
];

const MOBILE_TABS = [
  { href: '/dashboard', label: 'Today', icon: 'today' as const },
  { href: '/log', label: 'Log', icon: 'log' as const },
  { href: '/entries', label: 'Entries', icon: 'entries' as const },
  { href: '/weight', label: 'Weight', icon: 'weight' as const },
] as const;

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [moreOpen]);

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
        <header className="sticky top-0 z-20 border-b border-border bg-white pt-[env(safe-area-inset-top)] lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <Link href="/dashboard" className="flex items-center">
              <BrandMark size={22} />
            </Link>
            <BiteNavChip />
          </div>
        </header>

        <main className="flex-1 px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-5 lg:px-8 lg:py-6 lg:pb-6">
          {children}
        </main>

        <MobileDock
          pathname={pathname}
          moreOpen={moreOpen}
          onToggleMore={() => setMoreOpen((open) => !open)}
        />
        {moreOpen && (
          <MoreSheet
            pathname={pathname}
            displayName={user.displayName}
            onClose={() => setMoreOpen(false)}
            onLogout={logout}
          />
        )}
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
  items: {
    href: string;
    label: string;
    icon: Parameters<typeof NavIcon>[0]['name'];
    isNew?: boolean;
  }[];
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
  isNew,
}: {
  href: string;
  label: string;
  icon: Parameters<typeof NavIcon>[0]['name'];
  active: boolean;
  isNew?: boolean;
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
      <span>
        {label}
        {isNew ? <NewMark /> : null}
      </span>
    </Link>
  );
}

function MobileDock({
  pathname,
  moreOpen,
  onToggleMore,
}: {
  pathname: string;
  moreOpen: boolean;
  onToggleMore: () => void;
}) {
  const moreActive =
    moreOpen ||
    [...NUTRITION, ...TOOLS].some(
      (item) => item.href !== '/weight' && isActivePath(pathname, item.href),
    );

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Primary"
    >
      <div className="grid h-14 grid-cols-5">
        {MOBILE_TABS.map((item) => {
          const active = !moreOpen && isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'flex flex-col items-center justify-center gap-1 text-[10px] font-medium leading-none tracking-wide',
                active ? 'text-accent' : 'text-muted',
              )}
            >
              <span className="grid size-5 place-items-center">
                <NavIcon name={item.icon} className="size-5" />
              </span>
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-controls="mobile-more"
          onClick={onToggleMore}
          className={cx(
            'flex flex-col items-center justify-center gap-1 text-[10px] font-medium leading-none tracking-wide',
            moreActive ? 'text-accent' : 'text-muted',
          )}
        >
          <span className="grid size-5 place-items-center">
            <MoreIcon />
          </span>
          More
        </button>
      </div>
    </nav>
  );
}

function MoreSheet({
  pathname,
  displayName,
  onClose,
  onLogout,
}: {
  pathname: string;
  displayName: string;
  onClose: () => void;
  onLogout: () => void;
}) {
  const extras = [...NUTRITION.filter((item) => item.href !== '/weight'), ...TOOLS];

  return (
    <div className="fixed inset-0 z-[60] lg:hidden">
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        id="mobile-more"
        className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-white/70 bg-surface px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_40px_rgb(17_17_19/0.12)]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border-strong" />
        <p className="px-1 text-[11px] uppercase tracking-[0.16em] text-subtle">More</p>
        <div className="mt-2 grid gap-1">
          <button
            type="button"
            onClick={() => {
              onClose();
              openBite();
            }}
            className="flex items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-accent text-on-accent">
              <NavIcon name="bite" className="size-4" />
            </span>
            <span>
              Bite
              <NewMark />
              <span className="block text-xs font-normal text-subtle">Diet assistant</span>
            </span>
          </button>
          {extras.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActivePath(pathname, item.href) ? 'page' : undefined}
              className={cx(
                'flex items-center gap-3 rounded-2xl px-3 py-3 text-sm',
                isActivePath(pathname, item.href) ? 'bg-accent-soft font-medium text-accent' : 'text-foreground',
              )}
            >
              <span className="grid size-9 place-items-center rounded-xl bg-surface-raised">
                <NavIcon name={item.icon} />
              </span>
              <span>
                {item.label}
                {'isNew' in item && item.isNew ? <NewMark /> : null}
              </span>
            </Link>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-surface-raised px-3 py-3">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={onLogout}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </svg>
  );
}

function NewMark() {
  return (
    <span className="ml-1 text-[9px] font-semibold tracking-[0.08em] text-accent">NEW</span>
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
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-1 text-sm font-medium leading-none text-foreground"
    >
      <NavIcon name="bite" />
      Bite
      <NewMark />
    </button>
  );
}
