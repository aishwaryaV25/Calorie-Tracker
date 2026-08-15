'use client';

import Image from 'next/image';
import Link from 'next/link';
import { BrandMark } from '@/components/brand/BrandMark';
import { Button } from '@/components/ui';

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
];

const FEATURES = [
  { title: 'Smart meal logging', blurb: 'Breakfast through snacks, with macros and micros.', icon: PlateIcon },
  { title: 'AI food recognition', blurb: 'A photo of a label or a plate fills the form.', icon: LensIcon },
  { title: 'Macro & micro tracking', blurb: 'Protein, carbs, fat and the vitamins you record.', icon: GaugeIcon },
  { title: 'Reports & insights', blurb: 'Daily bars, weekly totals, goal versus actual.', icon: ChartIcon },
  { title: 'PDF import', blurb: 'A diary table becomes entries, Gemini if the script misses.', icon: PdfIcon },
  { title: 'Chat assistant', blurb: 'Log, correct, set a goal or ask for the week in words.', icon: ChatIcon },
];

const STEPS = [
  { n: '01', title: 'Set a goal', body: 'Daily calories, macros and an optional weight target. History is kept so reports compare against the goal that was in force that day.' },
  { n: '02', title: 'Log what you ate', body: 'Type it, photograph a label, drop a diary PDF, or tell the assistant. Every path writes the same entry.' },
  { n: '03', title: 'Read the week', body: 'Charts on screen, or a themed PDF you can keep. Nothing in the report is a second set of numbers — it is the diary.' },
];

const FLOATS = [
  { label: 'Protein', value: '128g', of: '150g', top: '8%', right: '2%', bar: 128 / 150 },
  { label: 'Calories', value: '1,840', of: '2,200 kcal', top: '38%', right: '-2%', bar: 1840 / 2200 },
  { label: 'Carbs', value: '198g', of: '250g', top: '36%', left: '-4%', bar: 198 / 250 },
  { label: 'Fat', value: '64g', of: '70g', bottom: '10%', right: '8%', bar: 64 / 70 },
] as const;

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-surface text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-surface/90 backdrop-blur">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 sm:px-8 lg:px-12">
          <Link href="/" className="justify-self-start">
            <BrandMark size={36} nameClassName="hidden text-sm sm:inline" />
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
        <section className="grid items-center gap-12 px-4 py-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:px-12 lg:py-20">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-raised px-3 py-1 text-xs text-muted">
              <span className="size-1.5 rounded-full bg-accent" />
              AI-powered nutrition tracking
            </p>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Eat smart.
              <br />
              <span className="text-accent">Live better.</span>
            </h1>
            <p className="mt-5 max-w-md text-base text-muted">
              Track calories, macros and micros with AI. Get insights that actually help you hit
              your goals.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup">
                <Button className="px-5 py-2.5">Start tracking for free</Button>
              </Link>
              <a href="#features">
                <Button variant="secondary" className="px-5 py-2.5">
                  Explore the product
                </Button>
              </a>
            </div>
            <p className="mt-6 text-sm text-subtle">
              Goals, meals, reports, chat and PDF import — one diary, your data only.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-[560px]">
            <div
              aria-hidden
              className="absolute inset-[12%] rounded-full bg-accent/15 blur-2xl"
            />
            <div className="relative overflow-hidden rounded-full border border-border bg-surface shadow-[0_20px_60px_rgb(17_17_19/0.08)]">
              <Image
                src="/brand/hero-bowl.png"
                alt="A bowl of salmon, rice, broccoli and avocado"
                width={1024}
                height={1024}
                className="h-auto w-full"
                priority
              />
            </div>

            {FLOATS.map((card) => (
              <article
                key={card.label}
                className="absolute hidden w-[148px] rounded-xl border border-border bg-surface px-3 py-2.5 shadow-[0_8px_24px_rgb(17_17_19/0.08)] sm:block"
                style={{
                  top: 'top' in card ? card.top : undefined,
                  right: 'right' in card ? card.right : undefined,
                  left: 'left' in card ? card.left : undefined,
                  bottom: 'bottom' in card ? card.bottom : undefined,
                }}
              >
                <p className="text-[10px] uppercase tracking-wide text-subtle">{card.label}</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">
                  {card.value}{' '}
                  <span className="text-xs font-normal text-subtle">/ {card.of}</span>
                </p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-raised">
                  <div
                    className="h-full rounded-full bg-foreground"
                    style={{ width: `${Math.min(card.bar, 1) * 100}%` }}
                  />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="features" className="border-t border-border px-4 py-14 sm:px-8 lg:px-12">
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">What it does</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Everything the diary needs.</h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-6">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex flex-col gap-3">
                <span className="grid size-10 place-items-center rounded-lg border border-border text-accent">
                  <feature.icon />
                </span>
                <p className="text-sm font-medium">{feature.title}</p>
                <p className="text-xs leading-relaxed text-muted">{feature.blurb}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="how-it-works" className="border-t border-border bg-surface-raised px-4 py-14 sm:px-8 lg:px-12">
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">How it works</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Three steps, one record.</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((step) => (
              <li
                key={step.n}
                className="rounded-xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgb(17_17_19/0.04)]"
              >
                <p className="text-xs font-semibold text-accent">{step.n}</p>
                <p className="mt-2 text-base font-medium">{step.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-6 sm:px-8 lg:px-12">
        <BrandMark size={28} nameClassName="text-sm" />
        <p className="text-xs text-subtle">Personal calorie tracker. Your diary stays yours.</p>
      </footer>
    </div>
  );
}

function PlateIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="7" />
      <path d="M8 12h8" />
    </svg>
  );
}

function LensIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="4" />
      <path d="M4 12h4M16 12h4M12 4v4M12 16v4" />
    </svg>
  );
}

function GaugeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 16a8 8 0 1 1 14 0" />
      <path d="M12 16 15 10" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 19V9M10 19V5M15 19v-7M20 19V8" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 6h14v10H8l-3 3z" />
    </svg>
  );
}
