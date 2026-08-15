'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LandingPage } from '@/components/landing/LandingPage';
import { useAuth } from '@/lib/auth-context';

/**
 * Marketing home for signed-out visitors. Anyone already in a session goes
 * straight to Today — they have already seen this page.
 */
export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-surface">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  if (user) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-surface">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  return <LandingPage />;
}
