'use client';

import { useEffect, type RefObject } from 'react';
import gsap from 'gsap';

export function useAuthMotion(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const ctx = gsap.context(() => {
      gsap.from('[data-auth="copy"] > *', {
        y: 14,
        duration: 0.7,
        stagger: 0.07,
        ease: 'power3.out',
      });
      gsap.from('[data-auth="form"] > *', {
        y: 12,
        duration: 0.55,
        stagger: 0.05,
        ease: 'power3.out',
        delay: 0.08,
      });
      gsap.to('[data-auth="still"]', {
        scale: 1.08,
        duration: 22,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });
    }, el);

    return () => ctx.revert();
  }, [root]);
}
