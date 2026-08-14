'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/auth-context';

interface AsyncResult<T> {
  /** The inputs this result was produced for; compared against the current key. */
  key: string;
  data: T | null;
  error: string | null;
}

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
}

/**
 * Minimal data-fetching hook: run an async function, expose loading and error
 * state, and provide a `reload` for use after a mutation. A full data library
 * would be overkill for a handful of read endpoints with no shared cache.
 *
 * `deps` behaves like the dependency array of `useEffect`.
 *
 * Loading is derived by comparing the key the current inputs produce against the
 * key the stored result was fetched for, rather than being flipped from inside
 * the effect. That keeps the effect free of synchronous state updates, which
 * cause an extra render pass, and makes "inputs changed, result is stale"
 * something the render can see directly.
 */
export function useAsync<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): AsyncState<T> & { reload: () => void } {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<AsyncResult<T> | null>(null);

  const key = JSON.stringify([deps, reloadToken]);

  // Holds the latest fetcher so callers can pass an inline arrow function
  // without it becoming a dependency and re-triggering the fetch every render.
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    let isCurrent = true;

    fetcherRef
      .current()
      .then((data) => {
        // Discarded if the inputs changed while the request was in flight, so a
        // slow earlier response cannot overwrite a newer one.
        if (isCurrent) {
          setResult({ key, data, error: null });
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setResult({ key, data: null, error: errorMessage(error) });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [key]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const isCurrentResult = result?.key === key;

  return {
    // Previous data is kept visible while a new request is in flight, which
    // avoids the whole page collapsing to skeletons on every filter change.
    data: result?.data ?? null,
    error: isCurrentResult ? result.error : null,
    isLoading: !isCurrentResult,
    reload,
  };
}
