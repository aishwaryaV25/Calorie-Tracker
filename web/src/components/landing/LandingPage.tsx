'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { BrandMark } from '@/components/brand/BrandMark';
import { Button } from '@/components/ui';
import { ExtractPreview } from './ExtractPreview';
import { FeatureCards } from './FeatureCards';
import { useLandingMotion } from './useLandingMotion';

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
];

const STATS = [
  { value: '2,200', label: 'kcal on a typical day' },
  { value: '4', label: 'meals, one diary' },
  { value: 'P · C · F', label: 'macros you can actually hit' },
];

const STEPS = [
  { n: '01', title: 'Set a goal', body: 'Daily calories, macros and an optional weight target. History is kept so reports compare against the goal that was in force that day.' },
  { n: '02', title: 'Log what you ate', body: 'Type it, photograph a plate, drop a diary PDF, or tell the assistant. Every path writes the same entry.' },
  { n: '03', title: 'Read the week', body: 'Charts on screen, or a themed PDF you can keep. Nothing in the report is a second set of numbers.' },
];

const PATHS = [
  { title: 'Type it', body: 'Name the food. The form does the rest.' },
  { title: 'Photograph it', body: 'A plate or a label. Confirm the draft.' },
  { title: 'Import a PDF', body: 'A week of rows, reviewed, then committed.' },
  { title: 'Say it', body: 'Chat Support logs it the same way the form does.' },
];

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  useLandingMotion(rootRef);

  return (
    <div ref={rootRef} className="min-h-dvh bg-surface text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-surface/90 backdrop-blur">
        <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-8 lg:px-12">
          <Link href="/" className="justify-self-start" aria-label="Calorie, by Typeface">
            <BrandMark size={22} />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted md:flex" aria-label="Marketing">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="hover:text-foreground">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center justify-end gap-2 justify-self-end">
            <Link href="/login">
              <Button variant="ghost" className="px-3">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button>Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="grid items-center gap-12 px-4 py-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:px-12 lg:py-24">
          <div data-land="hero-copy" className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-raised px-3 py-1 text-xs text-muted">
              <span className="size-1.5 rounded-full bg-accent" />
              A diary for what you actually ate
            </p>
            <h1 className="mt-6 text-5xl font-semibold leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl">
              Eat smart.
              <br />
              <span className="text-accent">Live better.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted">
              Calories, protein, carbs and fat — logged from a meal, a photo or a
              sentence. One record. Insights that help you hit the day.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/signup">
                <Button className="px-5 py-2.5">Start tracking for free</Button>
              </Link>
              <a href="#features">
                <Button variant="secondary" className="px-5 py-2.5">
                  See how it works
                </Button>
              </a>
            </div>
            <p className="mt-6 text-sm text-subtle">Breakfast, lunch, dinner, snacks. Your data stays yours.</p>
          </div>

          <ExtractPreview />
        </section>

        <section id="at-a-glance" className="border-t border-border bg-foreground text-on-accent">
          <ul className="grid gap-8 px-4 py-10 sm:grid-cols-3 sm:px-8 lg:px-12">
            {STATS.map((stat) => (
              <li key={stat.label} data-land="stat" className="text-center sm:text-left">
                <p className="text-3xl font-semibold tracking-tight">{stat.value}</p>
                <p className="mt-1 text-sm text-white/60">{stat.label}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="features" className="overflow-x-clip border-t border-border px-4 py-16 sm:px-8 lg:px-12 lg:py-20">
          <p data-feat="kicker" className="text-xs uppercase tracking-[0.16em] text-subtle">
            What it does
          </p>
          <h2 className="mt-2 max-w-lg text-3xl font-semibold tracking-tight">
            <span data-feat="line" className="block">
              Everything a food diary needs.
            </span>
            <span data-feat="line" className="block">
              {' '}
              Nothing it does not.
            </span>
          </h2>
          <FeatureCards />
        </section>

        <section id="how-it-works" className="border-t border-border bg-surface-raised px-4 py-16 sm:px-8 lg:px-12 lg:py-20">
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">How it works</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Three steps, one record.</h2>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((step) => (
              <li
                key={step.n}
                data-land="step"
                className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgb(17_17_19/0.04)]"
              >
                <p className="font-serif text-2xl text-accent">{step.n}</p>
                <p className="mt-3 text-lg font-medium">{step.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="paths" className="border-t border-border px-4 py-16 sm:px-8 lg:px-12">
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">Every path</p>
          <h2 className="mt-2 max-w-md text-3xl font-semibold tracking-tight">
            Type it, shoot it, import it or say it. Same row.
          </h2>
          <ul className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {PATHS.map((path) => (
              <li key={path.title} data-land="path" className="bg-surface px-5 py-6">
                <p className="text-sm font-medium">{path.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{path.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-border bg-foreground px-4 py-16 text-on-accent sm:px-8 lg:px-12">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Sit down. Log the plate.</h2>
              <p className="mt-2 max-w-md text-sm text-white/60">
                Free to start. Goals, meals, reports and chat — one diary.
              </p>
            </div>
            <Link href="/signup">
              <Button className="bg-accent px-5 py-2.5 hover:bg-accent-hover">Start tracking for free</Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-6 sm:px-8 lg:px-12">
        <Link href="/" aria-label="Calorie, by Typeface">
          <BrandMark size={32} />
        </Link>
        <p className="text-xs text-subtle">Personal calorie tracker. Your diary stays yours.</p>
      </footer>
    </div>
  );
}

