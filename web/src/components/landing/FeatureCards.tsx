'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FeatureIcon, FeatureVisual, type FeatureArt } from './FeatureVisuals';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const FEATURES: {
  title: string;
  blurb: string;
  action: string;
  href: string;
  art: FeatureArt;
}[] = [
  {
    title: 'Smart meal logging',
    blurb: 'Breakfast through snacks, with macros and micros on the same row.',
    action: 'Log a meal',
    href: '/signup',
    art: 'plate',
  },
  {
    title: 'AI food recognition',
    blurb: 'A photo of a label or a plate drafts the entry. You confirm before it saves.',
    action: 'Read a photo',
    href: '/signup',
    art: 'photo',
  },
  {
    title: 'Macro & micro tracking',
    blurb: 'Protein, carbs, fat and the vitamins you bother to record.',
    action: 'Set targets',
    href: '/signup',
    art: 'gauge',
  },
  {
    title: 'Reports & insights',
    blurb: 'Daily bars, weekly totals, goal versus actual — the diary, charted.',
    action: 'See a report',
    href: '/signup',
    art: 'chart',
  },
  {
    title: 'PDF import',
    blurb: 'A food-diary table becomes entries. Gemini only if the script misses.',
    action: 'Import a PDF',
    href: '/signup',
    art: 'pdf',
  },
  {
    title: 'Chat assistant',
    blurb: 'Log, correct, set a goal or ask for the week in ordinary words.',
    action: 'Ask the assistant',
    href: '/signup',
    art: 'chat',
  },
];

type Origin = { x: number; y: number; scale: number };

function cardOrigin(index: number, layout: 'desktop' | 'tablet' | 'mobile'): Origin {
  if (layout === 'desktop') {
    const column = index % 3;
    const row = Math.floor(index / 3);
    if (column === 0) return { x: -92, y: 10, scale: 0.96 };
    if (column === 2) return { x: 92, y: 10, scale: 0.96 };
    return { x: 0, y: row === 0 ? -52 : 52, scale: 0.96 };
  }

  if (layout === 'tablet') {
    return { x: index % 2 === 0 ? -72 : 72, y: 20, scale: 0.96 };
  }

  return { x: index % 2 === 0 ? -14 : 14, y: 44, scale: 0.97 };
}

function overshoot(origin: Origin, variance: number) {
  const x = origin.x === 0 ? 0 : origin.x > 0 ? -(7 + variance) : 7 + variance;
  const y = origin.y === 0 ? 0 : origin.y > 0 ? -(5 + variance * 0.4) : 5 + variance * 0.4;
  return { x, y };
}

/**
 * One scrubbed sequence: each card is already travelling while the
 * previous one settles. Scroll progress owns the timeline — no delays.
 */
export function FeatureCards() {
  const stageRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const section = document.getElementById('features');
    const stage = stageRef.current;
    if (!section || !stage) {
      return;
    }

    const mm = gsap.matchMedia();

    mm.add(
      {
        reduce: '(prefers-reduced-motion: reduce)',
        mobile: '(max-width: 639px)',
        tablet: '(min-width: 640px) and (max-width: 1279px)',
        desktop: '(min-width: 1280px)',
      },
      (context) => {
        const { reduce, mobile, tablet } = context.conditions ?? {};
        if (reduce) {
          return;
        }

        const layout = mobile ? 'mobile' : tablet ? 'tablet' : 'desktop';
        const cards = gsap.utils.toArray<HTMLElement>('[data-land="feature"]', stage);
        const visuals = gsap.utils.toArray<HTMLElement>('[data-feat="visual"]', stage);
        const parallax = gsap.utils.toArray<HTMLElement>('[data-feat="parallax"]', stage);
        const kicker = section.querySelector<HTMLElement>('[data-feat="kicker"]');
        const lines = gsap.utils.toArray<HTMLElement>('[data-feat="line"]', section);

        const sequence = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: section,
            start: 'top 88%',
            end: mobile ? '+=420' : '+=560',
            scrub: 0.5,
            invalidateOnRefresh: true,
          },
        });

        if (kicker) {
          gsap.set(kicker, { opacity: 0, y: 10 });
          sequence.to(kicker, { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out' }, 0);
        }
        gsap.set(lines, { opacity: 0, y: 12 });
        lines.forEach((line, index) => {
          sequence.to(line, { opacity: 1, y: 0, duration: 0.34, ease: 'power2.out' }, 0.05 + index * 0.07);
        });

        const step = 0.22;
        const first = 0.12;

        cards.forEach((card, index) => {
          const origin = cardOrigin(index, layout);
          const past = overshoot(origin, index % 3);
          const at = first + index * step;
          const visual = visuals[index];

          gsap.set(card, { ...origin, opacity: 0, force3D: true });
          if (visual) gsap.set(visual, { opacity: 0, y: 10, scale: 0.96 });

          sequence.to(
            card,
            {
              x: past.x,
              y: past.y,
              opacity: 1,
              scale: 1.012,
              duration: 0.54,
              ease: 'power3.out',
            },
            at,
          );
          sequence.to(
            card,
            { x: 0, y: 0, scale: 1, duration: 0.22, ease: 'power2.inOut' },
            at + 0.46,
          );

          if (visual) {
            sequence.to(
              visual,
              { opacity: 1, y: 0, scale: 1, duration: 0.36, ease: 'power2.out' },
              at + 0.14,
            );
          }
        });

        const travel = mobile ? 8 : 12;
        ScrollTrigger.create({
          trigger: section,
          start: 'top bottom',
          end: 'bottom top',
          onUpdate: (self) => {
            const offset = (self.progress - 0.5) * travel * 2;
            parallax.forEach((el, index) => {
              el.style.transform = `translate3d(0, ${(offset * (index % 2 === 0 ? 1 : -0.7)).toFixed(2)}px, 0)`;
            });
          },
        });
      },
    );

    return () => mm.revert();
  }, []);

  return (
    <ul ref={stageRef} className="mt-10 grid auto-rows-fr gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {FEATURES.map((feature) => (
        <FeatureCard key={feature.title} {...feature} />
      ))}
    </ul>
  );
}

function FeatureCard({
  title,
  blurb,
  action,
  href,
  art,
}: (typeof FEATURES)[number]) {
  const faceRef = useRef<HTMLElement>(null);

  function lift() {
    if (!faceRef.current || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      return;
    }
    gsap.to(faceRef.current, { y: -4, duration: 0.32, ease: 'power3.out', overwrite: 'auto' });
  }

  function rest() {
    if (!faceRef.current) {
      return;
    }
    gsap.to(faceRef.current, { y: 0, duration: 0.32, ease: 'power3.out', overwrite: 'auto' });
  }

  return (
    <li data-land="feature" className="h-full">
      <article
        ref={faceRef}
        onPointerEnter={lift}
        onPointerLeave={rest}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-[border-color,box-shadow] duration-300 ease-out hover:border-border-strong hover:shadow-[0_14px_32px_rgb(17_17_19/0.07)]"
      >
        <FeatureVisual kind={art} />
        <div className="flex flex-1 flex-col px-6 pt-5 pb-5">
          <div className="flex items-center gap-2.5">
            <FeatureIcon kind={art} />
            <p className="text-lg font-semibold tracking-tight">{title}</p>
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-muted">{blurb}</p>
          <Link
            href={href}
            className="mt-auto inline-flex w-fit items-center gap-1 pt-4 text-sm font-medium text-accent transition-transform duration-300 group-hover:translate-x-0.5"
          >
            {action}
            <span aria-hidden>→</span>
          </Link>
        </div>
      </article>
    </li>
  );
}
