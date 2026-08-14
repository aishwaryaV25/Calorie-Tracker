'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

/** Entry point: sends signed-in users to the dashboard and everyone else to login. */
export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) {
      return;
    }
    router.replace(user ? '/dashboard' : '/login');
  }, [user, isLoading, router]);

  return (
    <main className="flex min-h-dvh items-center justify-center">
      <p className="text-sm text-muted">Loading…</p>
    </main>
  );
}
