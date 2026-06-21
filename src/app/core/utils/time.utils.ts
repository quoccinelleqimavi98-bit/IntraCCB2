/**
 * Utilitaires d'heures au format « HhMM » (ex. « 8h30 », « 15h05 »).
 * Fonctions pures, reprises de la logique d'origine.
 */

const HM = /^[0-9]{1,2}h[0-9]{2}$/;

/** Vrai si la chaîne est une heure « HhMM » valide. */
export function isHm(value: string | undefined | null): boolean {
  return !!value && HM.test(value);
}

/** Heure « HhMM » en minutes depuis minuit. */
export function toMinutes(value: string): number {
  const [h, m] = value.split('h').map(Number);
  return h * 60 + m;
}

/** Ajoute (ou retire) des minutes à une heure « HhMM ». */
export function addMinutes(timeStr: string, minutesToAdd: number): string {
  if (!timeStr || !timeStr.includes('h')) return '';
  const [hours, minutes] = timeStr.split('h').map(Number);
  const date = new Date();
  date.setHours(hours);
  date.setMinutes(minutes + minutesToAdd);
  const nh = date.getHours();
  const nm = date.getMinutes();
  return `${nh}h${nm < 10 ? '0' + nm : nm}`;
}

/** Différence absolue en minutes entre deux heures « HhMM ». */
export function diffMinutes(a: string, b: string): number {
  return Math.abs(toMinutes(b) - toMinutes(a));
}

/** Vrai si `a` est strictement plus tôt que `b`. */
export function isEarlier(a: string, b: string): boolean {
  return toMinutes(a) < toMinutes(b);
}
