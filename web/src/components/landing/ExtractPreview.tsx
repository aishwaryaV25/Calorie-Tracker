'use client';

import Image from 'next/image';

export function ExtractPreview() {
  return (
    <aside
      data-land="preview"
      className="w-full overflow-hidden rounded-none border-y border-border bg-surface sm:rounded-2xl sm:border sm:shadow-[0_18px_50px_rgb(17_17_19/0.08)]"
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
