/**
 * Mise en forme et conversion des montants.
 * Le formatage reproduit fidèlement la logique d'origine afin que les documents
 * PDF restent identiques au pixel près.
 */

/**
 * Convertit une saisie (nombre ou texte) en nombre.
 * Tolère les virgules décimales et les caractères parasites (« € », espaces…).
 */
export function parseAmount(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isNaN(value) ? 0 : value;
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9.,-]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Formate un montant pour l'affichage et les PDF.
 * Règles historiques conservées :
 *  - entier < 100  → deux décimales avec virgule (ex. « 80,00 ») ;
 *  - entier ≥ 100  → entier brut (ex. « 450 ») ;
 *  - décimal       → deux décimales avec virgule (ex. « 12,50 »).
 */
export function formatAmount(value: number | string): string {
  const num = typeof value === 'string' ? parseAmount(value) : value;
  if (Number.isNaN(num)) return '';

  if (Number.isInteger(num)) {
    return num < 100 ? num.toFixed(2).replace('.', ',') : String(num);
  }
  return num.toFixed(2).replace('.', ',');
}

/** Comme `formatAmount` mais suffixé de « € ». */
export function formatEuro(value: number | string): string {
  return `${formatAmount(value)}€`;
}
