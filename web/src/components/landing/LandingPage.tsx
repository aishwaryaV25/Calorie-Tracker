'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { BrandMark } from '@/components/brand/BrandMark';
import { Button } from '@/components/ui';
import { BiteFeature } from './BiteFeature';
import { ExtractPreview } from './ExtractPreview';
import { FeatureCards } from './FeatureCards';
import { useLandingMotion } from './useLandingMotion';

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#bite', label: 'Bite' },
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
  { title: 'Ask Bite', body: 'What to eat next. It can see today. It will not write a row.' },
];

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  useLandingMotion(rootRef);

  return (
    <div ref={rootRef} className="min-h-dvh bg-surface text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-8 lg:px-12">
          <Link href="/" className="flex items-center" aria-label="Calorie, by Typeface">
            <BrandMark size={22} />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted md:flex" aria-label="Marketing">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="hover:text-foreground">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link href="/login">
              <Button variant="ghost" className="h-9 px-2.5 !py-0 sm:px-3">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="h-9 whitespace-nowrap px-3 !py-0 sm:px-4">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="grid items-center gap-8 px-4 py-10 sm:gap-12 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:px-12 lg:py-24">
          <div data-land="hero-copy" className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-raised px-3 py-1 text-xs text-muted">
              <span className="size-1.5 rounded-full bg-accent" />
              A diary for what you actually ate
            </p>
            <h1 className="mt-5 text-[2.15rem] font-semibold leading-[1.06] tracking-tight sm:mt-6 sm:text-6xl lg:text-7xl">
              Eat smart.
              <br />
              <span className="text-accent">Live better.</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted sm:mt-6">
              Calories, protein, carbs and fat — logged from a meal, a photo or a
              sentence. Bite sits on the page and tells you what still fits. It will
              not write a row for you.
            </p>
            <div className="mt-7 flex w-full flex-col gap-2.5 sm:mt-9 sm:w-auto sm:flex-row sm:flex-wrap sm:gap-3">
              <Link href="/signup" className="w-full sm:w-auto">
                <Button className="h-11 w-full whitespace-nowrap px-5 sm:h-auto sm:w-auto sm:py-2.5">
                  Start tracking for free
                </Button>
              </Link>
              <a href="#features" className="w-full sm:w-auto">
                <Button variant="secondary" className="h-11 w-full whitespace-nowrap px-5 sm:h-auto sm:w-auto sm:py-2.5">
                  See how it works
                </Button>
              </a>
            </div>
            <p className="mt-5 text-sm text-subtle sm:mt-6">Breakfast, lunch, dinner, snacks. Your data stays yours.</p>
          </div>

          <div className="-mx-4 sm:mx-0">
            <ExtractPreview />
          </div>
        </section>

        <section id="at-a-glance" className="border-t border-border bg-foreground text-on-accent">
          <ul className="grid gap-6 px-4 py-8 sm:grid-cols-3 sm:gap-8 sm:px-8 sm:py-10 lg:px-12">
            {STATS.map((stat) => (
              <li key={stat.label} data-land="stat" className="text-center sm:text-left">
                <p className="text-3xl font-semibold tracking-tight">{stat.value}</p>
                <p className="mt-1 text-sm text-white/60">{stat.label}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="features" className="overflow-x-clip border-t border-border px-4 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-20">
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

        <BiteFeature />

        <section id="how-it-works" className="border-t border-border bg-surface-raised px-4 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-20">
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

        <section id="paths" className="border-t border-border px-4 py-12 sm:px-8 sm:py-16 lg:px-12">
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">Every path</p>
          <h2 className="mt-2 max-w-md text-3xl font-semibold tracking-tight">
            Type it, shoot it, import it or say it. Same row.
          </h2>
          <ul className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
            {PATHS.map((path) => (
              <li key={path.title} data-land="path" className="bg-surface px-5 py-6">
                <p className="text-sm font-medium">{path.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{path.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-border bg-foreground px-4 py-12 text-on-accent sm:px-8 sm:py-16 lg:px-12">
          <div className="flex flex-col items-stretch justify-between gap-6 md:flex-row md:items-end">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Sit down. Log the plate.</h2>
              <p className="mt-2 max-w-md text-sm text-white/60">
                Free to start. Goals, meals, reports, chat and Bite — one diary.
              </p>
            </div>
            <Link href="/signup" className="w-full md:w-auto">
              <Button className="h-11 w-full whitespace-nowrap bg-accent px-5 hover:bg-accent-hover md:h-auto md:w-auto md:py-2.5">
                Start tracking for free
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="flex flex-col items-start justify-between gap-3 border-t border-border px-4 py-6 sm:flex-row sm:items-center sm:px-8 lg:px-12">
        <Link href="/" aria-label="Calorie, by Typeface">
          <BrandMark size={32} />
        </Link>
        <p className="text-xs text-subtle">Personal calorie tracker. Your diary stays yours.</p>
      </footer>
    </div>
  );
}

