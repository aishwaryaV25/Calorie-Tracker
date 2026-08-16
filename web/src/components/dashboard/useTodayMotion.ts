'use client';

import { useEffect, type RefObject } from 'react';
import gsap from 'gsap';

export function useTodayMotion(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const ctx = gsap.context(() => {
      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
      intro
        .from('[data-today="head"]', { y: 12, duration: 0.45 })
        .from('[data-today="bite"]', { y: 18, duration: 0.55 }, 0.08)
        .from('[data-today="stat"]', { y: 12, duration: 0.4, stagger: 0.05 }, 0.18)
        .from('[data-today="meal"]', { y: 14, duration: 0.4, stagger: 0.05 }, 0.28)
        .from('[data-today="week"]', { y: 12, duration: 0.4 }, 0.36);
    }, el);

    return () => ctx.revert();
  }, [root]);
}
