'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { BrandMark } from '@/components/brand/BrandMark';
import { Alert, Button, Field, Input } from '@/components/ui';

interface AuthFormProps {
  mode: 'login' | 'signup';
}

/**
 * Shared by the login and signup pages: the two differ only by one field and
 * their copy, so keeping them in one component avoids duplicating the submit,
 * error mapping and redirect logic.
 */
export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { login, signup, user, isLoading } = useAuth();
  const isSignup = mode === 'signup';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Someone who is already signed in has no reason to see these pages.
  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  const fieldError = (field: string) =>
    error instanceof ApiError ? error.fieldError(field) : undefined;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (isSignup) {
        await signup(email, password, displayName);
      } else {
        await login(email, password);
      }
      router.replace('/dashboard');
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error('Something went wrong.'));
      setIsSubmitting(false);
    }
  }

  // Field-level messages are rendered inline, so the banner would be redundant.
  const bannerError =
    error && !(error instanceof ApiError && error.fieldErrors.length > 0) ? error.message : null;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" className="mb-3">
            <BrandMark size={56} withName={false} />
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Calorie Tracker</h1>
          <p className="mt-1.5 text-sm text-muted">
            {isSignup ? 'Create an account to start logging meals.' : 'Sign in to your account.'}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6"
        >
          {bannerError && <Alert>{bannerError}</Alert>}

          {isSignup && (
            <Field label="Name" htmlFor="displayName" error={fieldError('displayName')}>
              <Input
                id="displayName"
                name="displayName"
                autoComplete="name"
                placeholder="Ramnath"
                value={displayName}
                hasError={Boolean(fieldError('displayName'))}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </Field>
          )}

          <Field label="Email" htmlFor="email" error={fieldError('email')}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              hasError={Boolean(fieldError('email'))}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            error={fieldError('password')}
            hint={isSignup ? 'At least 8 characters.' : undefined}
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              placeholder="••••••••"
              value={password}
              hasError={Boolean(fieldError('password'))}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>

          <Button type="submit" isLoading={isSubmitting} className="mt-1 w-full">
            {isSignup ? 'Create account' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          {isSignup ? 'Already have an account? ' : 'New here? '}
          <Link
            href={isSignup ? '/login' : '/signup'}
            className="font-medium text-accent hover:underline"
          >
            {isSignup ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </div>
    </main>
  );
}
