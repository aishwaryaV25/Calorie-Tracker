/** Scale numbers stay short: 72, or 72.4 when there is a tenth. */
export function formatKg(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
