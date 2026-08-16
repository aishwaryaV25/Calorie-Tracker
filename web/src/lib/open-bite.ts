export const OPEN_BITE_EVENT = 'calorie-tracker:open-bite';

export function openBite() {
  window.dispatchEvent(new Event(OPEN_BITE_EVENT));
}
