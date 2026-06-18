/**
 * Prestations (services proposés).
 *
 * On distingue clairement :
 *  - `CatalogItem` : une entrée du catalogue (data.json) ;
 *  - `Presta`      : une ligne concrète sur un devis / une facture (catalogue + quantité).
 */

/** Quantité d'une ligne : un nombre, ou « ? » quand elle reste à définir. */
export type Quantity = number | '?';

/** Entrée du catalogue de prestations. */
export interface CatalogItem {
  /** Identifiant stable (ex. « tulip », « kmjj »). */
  id?: string;
  /** Libellé français. */
  nom: string;
  /** Libellé anglais. */
  en?: string;
  /** Description interne (non imprimée). */
  desc?: string;
  /** Prix unitaire en euros. */
  prix?: number;
  /** Réduction en pourcentage. */
  reduc?: number;
  /** Facturé au kilomètre (10 premiers offerts, ×2 aller/retour). */
  kilorly?: boolean;
  /** Facturé à l'heure. */
  hourly?: boolean;
  /** Forfait mariée (sert au calcul des arrhes : 30 %). */
  bride?: boolean;
  /** Quantité plafonnée à 1. */
  onlyOne?: boolean;
  /** Durée en minutes (planning). */
  time?: number;
  /** Comprend du maquillage. */
  maquillage?: boolean;
  /** Comprend de la coiffure. */
  coiffure?: boolean;
  /** Ligne de titre/section (non facturable). */
  titre?: boolean;
}

/** Ligne de prestation sur un devis ou une facture. */
export interface Presta extends CatalogItem {
  qte: Quantity;
}
