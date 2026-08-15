'use client';

import { useEffect, useState } from 'react';
import type { ChatAction } from './types';

const EVENT = 'calorie-data-changed';

/**
 * Chat mutations land in the same database the other pages read. Those pages
 * do not share a cache, so a window event is enough to make them refetch.
 */
export function notifyDataChanged(actions: ChatAction[]) {
  if (typeof window === 'undefined' || actions.length === 0) {
    return;
  }

  window.dispatchEvent(new CustomEvent(EVENT, { detail: actions }));
}

export function useDataRevision() {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const onChange = () => setRevision((value) => value + 1);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  return revision;
}
