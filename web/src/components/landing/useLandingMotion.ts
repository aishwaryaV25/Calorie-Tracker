'use client';

import { useEffect, type RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export function useLandingMotion(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const ctx = gsap.context(() => {
      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
      intro
        .from('[data-land="hero-copy"] > *', { y: 16, duration: 0.65, stagger: 0.06 })
        .from('[data-land="preview"]', { y: 18, duration: 0.7 }, 0.12);

      gsap.from('[data-land="stat"]', {
        scrollTrigger: { trigger: '#at-a-glance', start: 'top 82%' },
        y: 12,
        duration: 0.45,
        stagger: 0.07,
      });

      gsap.from('[data-land="step"]', {
        scrollTrigger: { trigger: '#how-it-works', start: 'top 78%' },
        y: 18,
        duration: 0.5,
        stagger: 0.1,
      });

      gsap.from('[data-land="path"]', {
        scrollTrigger: { trigger: '#paths', start: 'top 80%' },
        y: 14,
        duration: 0.45,
        stagger: 0.07,
      });
    }, el);

    return () => ctx.revert();
  }, [root]);
}
