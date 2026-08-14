'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, tokenStorage } from './api-client';
import type { User } from './types';

interface AuthContextValue {
  user: User | null;
  /** True until the stored token has been checked, so guards do not flash. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // A stored token may be expired or revoked, so it is verified against the API
  // once on mount rather than trusted. The whole check runs inside an async
  // function so state is only updated from a later tick, never synchronously
  // during the effect, which would cost an extra render pass.
  useEffect(() => {
    let isCurrent = true;

    const restoreSession = async (): Promise<User | null> => {
      if (!tokenStorage.get()) {
        return null;
      }

      try {
        const { user: profile } = await api.auth.me();
        return profile;
      } catch {
        tokenStorage.clear();
        return null;
      }
    };

    void restoreSession().then((profile) => {
      if (isCurrent) {
        setUser(profile);
        setIsLoading(false);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: profile, token } = await api.auth.login({ email, password });
    tokenStorage.set(token);
    setUser(profile);
  }, []);

  const signup = useCallback(async (email: string, password: string, displayName: string) => {
    const { user: profile, token } = await api.auth.signup({ email, password, displayName });
    tokenStorage.set(token);
    setUser(profile);
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
    router.push('/login');
  }, [router]);

  const value = useMemo(
    () => ({ user, isLoading, login, signup, logout }),
    [user, isLoading, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider.');
  }

  return context;
}

/** Turns any thrown value into something safe to render. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
