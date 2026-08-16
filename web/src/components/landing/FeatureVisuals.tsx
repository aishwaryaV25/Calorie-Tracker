import Image from 'next/image';

export type FeatureArt = 'plate' | 'photo' | 'gauge' | 'chart' | 'pdf' | 'chat';

export function FeatureVisual({ kind }: { kind: FeatureArt }) {
  return (
    <div
      data-feat="visual"
      className="relative h-44 overflow-hidden border-b border-border bg-surface-raised"
    >
      <div data-feat="parallax" className="absolute inset-0">
        <div
          data-feat="art"
          className="h-full w-full transition-transform duration-300 ease-out group-hover:scale-[1.03]"
        >
          {kind === 'plate' && <MealLogArt />}
          {kind === 'photo' && <PhotoArt />}
          {kind === 'gauge' && <MacroArt />}
          {kind === 'chart' && <ReportArt />}
          {kind === 'pdf' && <PdfArt />}
          {kind === 'chat' && <ChatArt />}
        </div>
      </div>
    </div>
  );
}

export function FeatureIcon({ kind }: { kind: FeatureArt }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
      <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
        {kind === 'plate' && (
          <>
            <ellipse cx="10" cy="12.2" rx="6.2" ry="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3.8 12.2c0 2.6 2.8 4 6.2 4s6.2-1.4 6.2-4" stroke="currentColor" strokeWidth="1.5" />
            <path d="M15.6 5.2v6.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M15.6 5.2c1.3 0 2.1.8 2.1 1.8s-.8 1.7-2.1 1.7" stroke="currentColor" strokeWidth="1.5" />
          </>
        )}
        {kind === 'photo' && (
          <>
            <rect x="3" y="5" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="8" cy="9.2" r="1.3" fill="currentColor" />
            <path d="M3.8 14.2 8 10.6l3 2.4 2.2-1.8 3 2.8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </>
        )}
        {kind === 'gauge' && (
          <>
            <path d="M4 13a6 6 0 1 1 12 0" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 13 13.2 9.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </>
        )}
        {kind === 'chart' && (
          <>
            <path d="M3.5 16V4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M3.5 16h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M6.5 12.5v3.5M10 8.5v7.5M13.5 10.5v5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </>
        )}
        {kind === 'pdf' && (
          <>
            <path d="M6 3.5h5l4 4V16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 3.5V8h4" stroke="currentColor" strokeWidth="1.5" />
          </>
        )}
        {kind === 'chat' && (
          <path
            d="M4 5.2h12v7.4H9.2L6 15.4v-2.8H4z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </span>
  );
}

function MealLogArt() {
  const rows = [
    { meal: 'Breakfast', name: 'Oatmeal', kcal: '420' },
    { meal: 'Lunch', name: 'Chicken salad', kcal: '610' },
    { meal: 'Dinner', name: 'Salmon bowl', kcal: '720', accent: true },
  ];

  return (
    <div className="flex h-full flex-col justify-center gap-2 px-5" aria-hidden>
      {rows.map((row) => (
        <div
          key={row.meal}
          className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2"
        >
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.12em] text-subtle">{row.meal}</p>
            <p className="truncate text-xs font-medium">{row.name}</p>
          </div>
          <p className={`text-xs tabular-nums ${row.accent ? 'font-semibold text-accent' : 'text-muted'}`}>
            {row.kcal}
          </p>
        </div>
      ))}
    </div>
  );
}

function PhotoArt() {
  return (
    <div className="relative h-full" aria-hidden>
      <Image
        src="/brand/hero-bowl.png"
        alt=""
        fill
        sizes="(min-width: 1280px) 28vw, 90vw"
        className="object-cover"
      />
      <div className="absolute inset-3">
        <span className="absolute top-0 left-0 h-4 w-4 border-t border-l border-white" />
        <span className="absolute top-0 right-0 h-4 w-4 border-t border-r border-white" />
        <span className="absolute bottom-0 left-0 h-4 w-4 border-b border-l border-white" />
        <span className="absolute right-0 bottom-0 h-4 w-4 border-b border-r border-white" />
      </div>
      <span className="absolute bottom-3 left-3 rounded-full bg-surface/95 px-2 py-0.5 text-[10px] font-medium text-foreground">
        high confidence
      </span>
    </div>
  );
}

function MacroArt() {
  const bars = [
    { label: 'Protein', value: '128', max: '140', width: '92%', tone: 'bg-foreground' },
    { label: 'Carbs', value: '186', max: '220', width: '84%', tone: 'bg-accent' },
    { label: 'Fat', value: '54', max: '70', width: '77%', tone: 'bg-subtle' },
  ];

  return (
    <div className="flex h-full flex-col justify-center gap-3 px-5" aria-hidden>
      {bars.map((bar) => (
        <div key={bar.label}>
          <div className="mb-1 flex items-baseline justify-between text-[11px]">
            <span className="text-muted">{bar.label}</span>
            <span className="tabular-nums text-subtle">
              {bar.value}
              <span className="text-subtle/70"> / {bar.max}g</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-border">
            <div className={`h-full rounded-full ${bar.tone}`} style={{ width: bar.width }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportArt() {
  const days = [
    { h: '42%', over: false },
    { h: '58%', over: false },
    { h: '71%', over: false },
    { h: '88%', over: true },
    { h: '64%', over: false },
    { h: '76%', over: false },
    { h: '51%', over: false },
  ];

  return (
    <div className="flex h-full flex-col justify-end px-5 pb-4 pt-6" aria-hidden>
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[11px] text-muted">This week</p>
        <p className="text-sm font-semibold tabular-nums">12,840 kcal</p>
      </div>
      <div className="flex h-20 items-end gap-2">
        {days.map((day, index) => (
          <div
            key={index}
            className={`flex-1 rounded-sm ${day.over ? 'bg-accent' : 'bg-foreground'}`}
            style={{ height: day.h }}
          />
        ))}
      </div>
    </div>
  );
}

function PdfArt() {
  return (
    <div className="flex h-full items-center justify-center px-6" aria-hidden>
      <div className="relative w-full max-w-[220px]">
        <div className="absolute top-2 left-3 h-full w-full rounded-lg border border-border bg-surface" />
        <div className="relative rounded-lg border border-border bg-surface px-4 py-3 shadow-[0_8px_20px_rgb(17_17_19/0.06)]">
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-accent">
              PDF
            </span>
            <span className="text-[10px] text-subtle">14 rows</span>
          </div>
          <div className="space-y-1.5">
            <div className="h-1.5 w-4/5 rounded-full bg-foreground/80" />
            <div className="h-1.5 w-full rounded-full bg-border" />
            <div className="h-1.5 w-11/12 rounded-full bg-border" />
            <div className="h-1.5 w-2/3 rounded-full bg-accent/70" />
            <div className="h-1.5 w-10/12 rounded-full bg-border" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatArt() {
  return (
    <div className="flex h-full flex-col justify-center gap-2 px-5" aria-hidden>
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface px-3 py-2 text-[11px] leading-relaxed text-muted shadow-[0_1px_0_rgb(17_17_19/0.04)]">
        How much protein am I short today?
      </div>
      <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-accent-soft px-3 py-2 text-[11px] leading-relaxed text-foreground">
        22g under the 140g target. A Greek yogurt closes it.
      </div>
    </div>
  );
}
