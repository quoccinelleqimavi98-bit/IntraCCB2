/**
 * Utilitaires de dates au format métier « jj/mm/aaaa ».
 * Fonctions pures, sans dépendance Angular — facilement testables.
 */

/** Parse une date « jj/mm/aaaa » en `Date` (minuit local), ou `null` si invalide. */
export function parseFrDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const parts = value.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map((p) => parseInt(p, 10));
  if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) return null;
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Formate une `Date` en « jj/mm/aaaa ». */
export function formatFrDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

/** Date du jour au format « jj/mm/aaaa ». */
export function todayFrDate(): string {
  return formatFrDate(new Date());
}

/** Ajoute (ou retire) un nombre de jours à une date « jj/mm/aaaa ». */
export function addDaysFr(value: string, days: number): string {
  const date = parseFrDate(value);
  if (!date) return value;
  date.setDate(date.getDate() + days);
  return formatFrDate(date);
}

/** Indique si la date « jj/mm/aaaa » est strictement antérieure à aujourd'hui. */
export function isPastFr(value: string): boolean {
  const date = parseFrDate(value);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

/** Indique si la date « jj/mm/aaaa » correspond à aujourd'hui. */
export function isTodayFr(value: string): boolean {
  const date = parseFrDate(value);
  if (!date) return false;
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/** Comparateur de dates « jj/mm/aaaa » (croissant) pour `Array.sort`. */
export function compareFrDates(a: string, b: string): number {
  const da = parseFrDate(a)?.getTime() ?? 0;
  const db = parseFrDate(b)?.getTime() ?? 0;
  return da - db;
}

/** Extrait l'année d'une date « jj/mm/aaaa ». */
export function yearOfFr(value: string): number {
  return parseInt(value.split('/')[2] ?? '', 10);
}

/** Extrait le mois (1-12) d'une date « jj/mm/aaaa ». */
export function monthOfFr(value: string): number {
  return parseInt(value.split('/')[1] ?? '', 10);
}

/** Met en forme une saisie au fil de l'eau vers « jj/mm/aaaa ». */
export function maskFrDateInput(value: string): string {
  let v = value.replace(/\D/g, '');
  if (v.length > 2) v = `${v.slice(0, 2)}/${v.slice(2)}`;
  if (v.length > 5) v = `${v.slice(0, 5)}/${v.slice(5)}`;
  return v;
}

/** Formate « jj/mm/aaaa » en toutes lettres capitalisées (« Jeudi 12 Juin 2026 »). */
export function frenchLongDate(value: string | undefined | null): string {
  if (!value) return '';
  const date = parseFrDate(value);
  if (!date) return value;
  const formatted = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  return formatted.replace(/(^|\s)\p{L}/gu, (char) => char.toUpperCase());
}
