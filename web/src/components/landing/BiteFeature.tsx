import Link from 'next/link';
import { Button } from '@/components/ui';

export function BiteFeature() {
  return (
    <section id="bite" className="border-t border-border bg-foreground px-4 py-12 text-on-accent sm:px-8 sm:py-16 lg:px-12 lg:py-20">
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div data-land="bite">
          <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
            <span className="size-1.5 rounded-full bg-accent" />
            New · Your diet buddy
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Meet Bite.
          </h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-white/65">
            Ask what to eat next, how to hit protein, or how the diary works. Bite can see
            today. It will not write a row for you — Chat Support and the form still do that.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {['Sees today', 'Will not write a row', 'Lives on every page'].map((item) => (
              <li
                key={item}
                className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/80"
              >
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Link href="/signup" className="block w-full sm:inline-block sm:w-auto">
              <Button className="h-11 w-full whitespace-nowrap bg-accent px-5 hover:bg-accent-hover sm:h-auto sm:w-auto sm:py-2.5">
                Get Bite with your diary
              </Button>
            </Link>
          </div>
        </div>

        <div className="relative mx-auto hidden h-48 w-48 items-center justify-center lg:flex" aria-hidden>
          <div
            className="size-40 rounded-full"
            style={{
              background:
                'radial-gradient(circle at 32% 26%, #ff8a97 0%, #ff223f 40%, #c01028 74%, #6d0814 100%)',
              boxShadow:
                'inset -16px -20px 34px rgb(0 0 0 / 0.3), inset 12px 14px 22px rgb(255 255 255 / 0.2), 0 22px 44px rgb(255 34 63 / 0.28)',
            }}
          />
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
      </div>
    </section>
  );
}
