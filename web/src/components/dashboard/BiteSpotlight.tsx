'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Button } from '@/components/ui';
import { openBite } from '@/lib/open-bite';

export function BiteSpotlight({ firstName }: { firstName: string }) {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const orb = stage.querySelector<HTMLElement>('[data-orb]');
    const sheen = stage.querySelector<HTMLElement>('[data-sheen]');
    const shadow = stage.querySelector<HTMLElement>('[data-orb-shadow]');
    if (!orb) {
      return;
    }

    const motion = gsap.timeline({ repeat: -1 });
    motion.to(orb, { y: -10, rotateY: 16, duration: 2.4, ease: 'sine.inOut' }).to(orb, {
      y: 4,
      rotateY: -12,
      duration: 2.6,
      ease: 'sine.inOut',
    });

    if (shadow) {
      gsap.to(shadow, {
        scaleX: 0.82,
        opacity: 0.45,
        duration: 2.4,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });
    }

    if (sheen) {
      gsap.fromTo(
        sheen,
        { xPercent: -80 },
        { xPercent: 160, duration: 3.2, ease: 'power1.inOut', repeat: -1, repeatDelay: 1.4 },
      );
    }

    return () => {
      motion.kill();
      gsap.killTweensOf([orb, sheen, shadow]);
    };
  }, []);

  return (
    <section
      data-today="bite"
      className="grid overflow-hidden rounded-2xl bg-foreground text-on-accent lg:grid-cols-[minmax(0,1fr)_16rem]"
    >
      <div className="flex flex-col justify-center px-6 py-7 sm:px-8">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Your diet buddy</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {firstName ? `${firstName}, meet Bite.` : 'Meet Bite.'}
        </h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">
          Ask what to eat next, how to hit protein, or how this diary works. Bite can see today. It
          will not write a row for you.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button className="bg-accent px-5 py-2.5 hover:bg-accent-hover" onClick={openBite}>
            Ask Bite
          </Button>
          <p className="text-xs text-white/40">Same red disc on the page. Drag it anywhere.</p>
        </div>
      </div>

      <div
        ref={stageRef}
        className="relative hidden h-56 items-center justify-center [perspective:1100px] lg:flex"
        aria-hidden
      >
        <div
          data-orb
          className="relative size-40 [transform-style:preserve-3d] will-change-transform"
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'radial-gradient(circle at 32% 26%, #ff8a97 0%, #ff223f 40%, #c01028 74%, #6d0814 100%)',
              boxShadow:
                'inset -16px -20px 34px rgb(0 0 0 / 0.3), inset 12px 14px 22px rgb(255 255 255 / 0.2), 0 22px 44px rgb(255 34 63 / 0.28)',
            }}
          />
          <div className="absolute inset-[22%] rounded-full bg-white/10" />
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <div
              data-sheen
              className="absolute top-0 left-0 h-full w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            />
          </div>
          <div className="absolute inset-0 grid place-items-center text-white">
            <svg viewBox="0 0 24 24" className="size-14" fill="none">
              <path
                d="M5 11.5c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5-3.1 6.5-7 6.5c-.7 0-1.4-.1-2-.3L6 19l.8-2.6C5.7 15.4 5 13.6 5 11.5Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <circle cx="9.2" cy="11.2" r="1" fill="currentColor" />
              <circle cx="12" cy="11.2" r="1" fill="currentColor" />
              <circle cx="14.8" cy="11.2" r="1" fill="currentColor" />
            </svg>
          </div>
        </div>
        <div
          data-orb-shadow
          className="absolute bottom-7 left-1/2 h-3 w-28 -translate-x-1/2 rounded-full bg-black/55 blur-md"
        />
      </div>
    </section>
  );
}
