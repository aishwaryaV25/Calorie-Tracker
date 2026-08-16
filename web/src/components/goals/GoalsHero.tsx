'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { formatCalories, formatDateKey, formatGrams } from '@/lib/format';
import type { Goal } from '@/lib/types';

export function GoalsHero({
  firstName,
  goal,
  todayCalories,
}: {
  firstName: string;
  goal: Goal | null;
  todayCalories: number | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const used = goal && todayCalories != null ? Math.min(1, todayCalories / goal.dailyCalories) : null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.pause();
      return;
    }

    void video.play().catch(() => {

    });

    const drift = gsap.to(video, {
      scale: 1.08,
      duration: 18,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });

    return () => {
      drift.kill();
    };
  }, []);

  return (
    <aside
      data-goals="hero"
      className="relative min-h-[18rem] overflow-hidden rounded-2xl bg-foreground text-on-accent xl:min-h-[36rem] xl:sticky xl:top-6"
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full origin-center object-cover object-[70%_18%] opacity-[0.58] contrast-[1.12] saturate-[0.35]"
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden
      >
        <source src="/brand/goals-run.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/20" />
      <div className="absolute inset-0 bg-accent/10 mix-blend-multiply" />

      <div className="relative z-10 flex min-h-[18rem] flex-col justify-between px-5 py-6 xl:min-h-[36rem]">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Your pace</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight xl:text-[1.7rem]">
            {goal
              ? firstName
                ? `${firstName}, this is the day you aimed for.`
                : 'This is the day you aimed for.'
              : 'Set the day you want to run.'}
          </h2>
          {goal && (
            <p className="mt-2 text-xs text-white/50">
              In force since {formatDateKey(goal.effectiveFrom, 'd MMM yyyy')}
            </p>
          )}
        </div>

        <div>
          <p className="text-xs text-white/45">Daily energy</p>
          {goal ? (
            <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">
              {formatCalories(goal.dailyCalories)}
              <span className="ml-2 text-sm font-medium text-white/40">kcal</span>
            </p>
          ) : (
            <p className="mt-1 text-xl font-medium text-white/45">Not set yet</p>
          )}

          {used != null && (
            <div className="mt-4">
              <p className="text-xs text-white/45">Used today {Math.round(used * 100)}%</p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-accent" style={{ width: `${used * 100}%` }} />
              </div>
            </div>
          )}

          {goal && (
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <HeroStat label="Protein" value={`${formatGrams(goal.proteinGrams)} g`} />
              <HeroStat label="Carbs" value={`${formatGrams(goal.carbGrams)} g`} />
              <HeroStat label="Fat" value={`${formatGrams(goal.fatGrams)} g`} />
              {goal.targetWeightKg != null && (
                <HeroStat label="Weight" value={`${goal.targetWeightKg} kg`} />
              )}
            </dl>
          )}
        </div>
      </div>
    </aside>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.12em] text-white/40">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
    </div>
  );
}
