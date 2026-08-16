'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Alert, Button, Field, Input } from '@/components/ui';
import { AuthFilm } from './AuthFilm';
import { useAuthMotion } from './useAuthMotion';

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
  const rootRef = useRef<HTMLDivElement>(null);
  const { login, signup, user, isLoading } = useAuth();
  const isSignup = mode === 'signup';
  useAuthMotion(rootRef);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <main
      ref={rootRef}
      className="min-h-dvh bg-background lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,34rem)]"
    >
      <AuthFilm mode={mode} />

      <section className="relative flex flex-col justify-center border-border px-5 py-10 sm:px-10 lg:border-l">
        <div data-auth="form" className="mx-auto w-full max-w-[22.5rem]">
          <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">
            {isSignup ? 'Get started' : 'Sign in'}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Calorie Tracker</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {isSignup ? 'Create an account to start logging meals.' : 'Sign in to your account.'}
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-4">
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
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  placeholder="••••••••"
                  value={password}
                  hasError={Boolean(fieldError('password'))}
                  className="pr-16"
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted hover:text-foreground"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </Field>

            <Button type="submit" isLoading={isSubmitting} className="mt-1 h-11 w-full">
              {isSignup ? 'Create account' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted">
            {isSignup ? 'Already have an account? ' : 'New here? '}
            <Link
              href={isSignup ? '/login' : '/signup'}
              className="font-medium text-accent hover:underline"
            >
              {isSignup ? 'Sign in' : 'Create an account'}
            </Link>
          </p>

          <p className="mt-8 text-xs leading-relaxed text-subtle">
            Breakfast, lunch, dinner, snacks. Your data stays yours.
          </p>
        </div>
      </section>
    </main>
  );
}
