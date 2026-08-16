import { formatCalories, formatGrams } from '@/lib/format';

const CALORIES_PER_GRAM = { protein: 4, carbs: 4, fat: 9 };

/**
 * Meal-level macro ring. Slices are sized by calories from each macro
 * (fat is 9 kcal/g, protein and carbs are 4). The centre is the logged total.
 */
export function MealSummaryDonut({
  calories,
  proteinGrams,
  carbGrams,
  fatGrams,
}: {
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
}) {
  const segments = [
    { key: 'protein', label: 'Protein', grams: proteinGrams, color: 'var(--protein)' },
    { key: 'carbs', label: 'Carbs', grams: carbGrams, color: 'var(--carbs)' },
    { key: 'fat', label: 'Fat', grams: fatGrams, color: 'var(--fat)' },
  ] as const;

  const macroCalories = {
    protein: proteinGrams * CALORIES_PER_GRAM.protein,
    carbs: carbGrams * CALORIES_PER_GRAM.carbs,
    fat: fatGrams * CALORIES_PER_GRAM.fat,
  };
  const totalMacroCalories = macroCalories.protein + macroCalories.carbs + macroCalories.fat;

  const radius = 42;
  const stroke = 14;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative size-36 shrink-0">
        <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={stroke}
          />
          {totalMacroCalories > 0 &&
            segments.map((segment) => {
              const share =
                macroCalories[segment.key as keyof typeof macroCalories] / totalMacroCalories;
              const length = circumference * share;
              const circle = (
                <circle
                  key={segment.key}
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += length;
              return circle;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xl font-semibold tabular-nums leading-none">
            {formatCalories(calories)}
          </p>
          <p className="mt-1 text-[11px] text-subtle">kcal</p>
        </div>
      </div>

      <ul className="flex flex-col gap-2 text-sm">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ background: segment.color }}
            />
            <span className="text-muted">
              {segment.label}{' '}
              <span className="font-medium text-foreground">({formatGrams(segment.grams)}g)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
