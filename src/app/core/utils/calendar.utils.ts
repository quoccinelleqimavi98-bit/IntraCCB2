/**
 * Helpers de calendrier (purs). Semaine commençant le lundi.
 */

export const MONTHS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

export const WEEKDAYS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Liste des jours (1..n) d'un mois. */
export function daysInMonth(year: number, monthIndex: number): number[] {
  const count = new Date(year, monthIndex + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => i + 1);
}

/** Nombre de cases vides avant le 1er du mois (semaine lundi → dimanche). */
export function firstWeekdayOffset(year: number, monthIndex: number): number {
  const firstDay = new Date(year, monthIndex, 1).getDay(); // 0 = dimanche
  return firstDay === 0 ? 6 : firstDay - 1;
}

/** Construit une date « jj/mm/aaaa » à partir de ses composantes. */
export function toDateString(day: number, monthIndex: number, year: number): string {
  const dd = String(day).padStart(2, '0');
  const mm = String(monthIndex + 1).padStart(2, '0');
  return `${dd}/${mm}/${year}`;
}
