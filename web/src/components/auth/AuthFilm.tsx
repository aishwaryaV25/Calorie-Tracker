'use client';

import Image from 'next/image';
import Link from 'next/link';
import { BrandMark } from '@/components/brand/BrandMark';

const COPY = {
  login: {
    kicker: 'Welcome back',
    title: 'The plate is waiting.',
    body: 'Pick up the day. Calories, protein, carbs and fat — the same diary you left.',
    facts: ['Today', 'Goals', 'Reports'],
  },
  signup: {
    kicker: 'A diary, not a diet',
    title: 'Eat smart. Live better.',
    body: 'Log a meal, a photo or a sentence. One record. Insights that help you hit the day.',
    facts: ['Type it', 'Photograph it', 'Import a PDF'],
  },
} as const;

/**
 * One 200KB still, sized by Next for the column. Motion is a slow Ken Burns
 * on this image — a second clip on top is what made the film look doubled.
 */
export function AuthFilm({ mode }: { mode: 'login' | 'signup' }) {
  const copy = COPY[mode];

  return (
    <aside className="relative isolate min-h-[22rem] overflow-hidden bg-foreground text-on-accent sm:min-h-[24rem] lg:min-h-dvh">
      <Image
        src="/brand/auth-table.jpg"
        alt=""
        fill
        priority
        sizes="(min-width: 1024px) 58vw, 100vw"
        data-auth="still"
        className="object-cover object-[50%_42%]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/25" />
      <div className="absolute inset-0 bg-accent/10 mix-blend-multiply" />
      <Grain />

      <div className="relative z-10 flex h-full min-h-[22rem] flex-col justify-between px-6 py-6 sm:min-h-[24rem] sm:px-8 sm:py-8 lg:min-h-dvh lg:px-10 lg:py-10">
        <Link
          href="/"
          className="self-start [&_img]:brightness-0 [&_img]:invert [&_span]:text-white/55"
          aria-label="Calorie, by Typeface"
        >
          <BrandMark size={28} />
        </Link>

        <div data-auth="copy" className="max-w-md">
          <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/50">
            <span className="size-1.5 rounded-full bg-accent" />
            {copy.kicker}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[2.65rem] lg:leading-[1.08]">
            {copy.title}
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">{copy.body}</p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {copy.facts.map((fact) => (
              <li
                key={fact}
                className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] tracking-wide text-white/80"
              >
                {fact}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}

function Grain() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18] mix-blend-overlay"
      aria-hidden
    >
      <filter id="auth-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter="url(#auth-grain)" />
    </svg>
  );
}
