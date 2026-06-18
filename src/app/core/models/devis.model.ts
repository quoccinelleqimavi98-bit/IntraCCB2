import type { Presta } from './presta.model';

/** Devis émis pour une journée. */
export interface Devis {
  numero?: number;
  /** Année de référence du numéro (ex. « 2026 »). */
  annee?: string;
  /** Date de création au format jj/mm/aaaa. */
  creation?: string;
  /** Date d'échéance au format jj/mm/aaaa. */
  echeance?: string;
  /** Lignes de prestation. */
  prestas: Presta[];
}
