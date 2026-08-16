'use client';

import { useEffect, type RefObject } from 'react';
import gsap from 'gsap';

export function useGoalsMotion(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const ctx = gsap.context(() => {
      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
      intro
        .from('[data-goals="head"]', { y: 10, duration: 0.4 })
        .from('[data-goals="hero"]', { x: -16, duration: 0.5 }, 0.06)
        .from('[data-goals="compose"]', { x: 16, duration: 0.5 }, 0.1)
        .from('[data-goals="today"]', { y: 10, duration: 0.35 }, 0.28)
        .from('[data-goals="history"]', { y: 10, duration: 0.35 }, 0.34);
    }, el);

    return () => ctx.revert();
  }, [root]);
}
