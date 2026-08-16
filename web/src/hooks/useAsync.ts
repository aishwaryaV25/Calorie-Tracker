'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/auth-context';

interface AsyncResult<T> {

  key: string;
  data: T | null;
  error: string | null;
}

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
}

export function useAsync<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): AsyncState<T> & { reload: () => void } {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<AsyncResult<T> | null>(null);

  const key = JSON.stringify([deps, reloadToken]);

  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    let isCurrent = true;

    fetcherRef
      .current()
      .then((data) => {

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

    data: result?.data ?? null,
    error: isCurrentResult ? result.error : null,
    isLoading: !isCurrentResult,
    reload,
  };
}
