'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';
import { openBite } from '@/lib/open-bite';

const HABITS = [
  {
    kicker: '01',
    title: 'Protein first',
    body: 'Hit the gram target, then fill the rest of the plate. Reports will show whether the week actually did.',
  },
  {
    kicker: '02',
    title: 'Log the day you ate',
    body: 'A PDF from last Tuesday still belongs on Tuesday. The table keeps the date the diary wrote.',
  },
  {
    kicker: '03',
    title: 'One diary, four meals',
    body: 'Breakfast, lunch, dinner, snacks. Import, chat, and the form all write the same row.',
  },
];

export function ImportPromo({ firstName }: { firstName: string }) {
  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-3 md:grid-cols-3">
        {HABITS.map((habit) => (
          <li
            key={habit.kicker}
            className="rounded-2xl border border-border bg-surface px-5 py-5 shadow-[0_1px_2px_rgb(17_17_19/0.04)]"
          >
            <p className="text-[11px] tabular-nums tracking-[0.14em] text-accent">{habit.kicker}</p>
            <h3 className="mt-2 text-sm font-semibold tracking-tight">{habit.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{habit.body}</p>
          </li>
        ))}
      </ul>

      <section className="grid overflow-hidden rounded-2xl bg-foreground text-on-accent lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="px-6 py-6 sm:px-7">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">After the import</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {firstName ? `${firstName}, ask Bite what the week needs.` : 'Ask Bite what the week needs.'}
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/65">
            Once these rows are in the diary, Bite can see today. It will not write a row for you —
            it will tell you what is left on protein, and what still fits.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="bg-accent px-4 py-2 hover:bg-accent-hover" onClick={openBite}>
              Ask Bite
            </Button>
            <Link href="/reports">
              <Button variant="secondary" className="border-white/20 bg-white/5 text-on-accent hover:bg-white/10">
                See reports
              </Button>
            </Link>
          </div>
        </div>
        <div className="hidden items-end px-7 pb-6 lg:flex" aria-hidden>
          <p className="max-w-[11rem] text-right text-xs leading-relaxed text-white/40">
            Same red disc on the page. Drag it anywhere.
          </p>
        </div>
      </section>
    </div>
  );
}
