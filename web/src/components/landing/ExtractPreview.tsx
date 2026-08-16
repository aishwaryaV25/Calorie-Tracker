'use client';

import Image from 'next/image';

/**
 * The live Log a Meal screen — photo, filled fields, AI detected list, donut.
 * Marketing only; it does not call the API.
 */
export function ExtractPreview() {
  return (
    <aside
      data-land="preview"
      className="w-full overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_18px_50px_rgb(17_17_19/0.08)]"
    >
      <Image
        src="/brand/hero-log-meal.png"
        alt="Log a Meal: a photographed plate fills the form, AI lists what it detected, and the meal summary shows 485 kcal"
        width={1024}
        height={694}
        className="h-auto w-full"
        priority
      />
    </aside>
  );
}
