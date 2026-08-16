export const OPEN_BITE_EVENT = 'calorie-tracker:open-bite';

/** Opens the floating Bite panel from anywhere in the signed-in app. */
export function openBite() {
  window.dispatchEvent(new Event(OPEN_BITE_EVENT));
}
