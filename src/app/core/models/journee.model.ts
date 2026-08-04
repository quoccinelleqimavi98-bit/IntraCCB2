import type { Client, Essai, Mariage } from './client.model';
import type { Devis } from './devis.model';
import type { Etape, Statut } from './enums';
import type { Facture } from './facture.model';
import type { Planning } from './planning.model';

/**
 * Une journée du calendrier : l'agrégat central du domaine.
 *
 * Contrairement à l'app d'origine, ce modèle est « pur » : il ne porte aucun état
 * d'interface (mode d'édition, drapeaux de téléchargement, etc.). Cet état vit
 * dans les composants. Les coordonnées client sont regroupées dans `client`.
 */
export interface Journee {
  /** Identifiant base (absent tant que la journée n'est pas persistée). */
  id?: number;
  /** Date au format jj/mm/aaaa — clé métier d'une journée. */
  date: string;
  statut: Statut;
  etape: Etape;

  client: Client;
  essai: Essai;
  mariage: Mariage;

  /** Dernier devis (= base des calculs). Toujours `devisList[devisList.length - 1]`. */
  devis?: Devis;
  /**
   * Liste ordonnée des devis : le devis initial puis ses avenants. Le dernier
   * fait foi pour le récap, la facture et le planning. Sérialisé dans la colonne
   * `devis` du backend via `{ ...dernier, versions: [...] }` (aucun changement
   * serveur). Les données anciennes (un seul devis) sont lues comme liste à un.
   */
  devisList?: Devis[];
  factures: Facture[];
  /** Dernier planning (= base). Toujours `plannings[plannings.length - 1]`. */
  planning?: Planning;
  /**
   * Liste des plannings de l'événement (un par jour-J, notamment pour les
   * événements sur plusieurs journées liées). Sérialisée dans la colonne
   * `planning` du backend via `{ ...dernier, versions: [...] }` (aucun changement
   * serveur). Données anciennes (un seul planning) lues comme liste à un.
   */
  plannings?: Planning[];

  /** Identifiant de la demande sur mariages.net (relances). */
  mariagenet?: string;
  /** Montant total reversé aux renforts, saisi manuellement le cas échéant. */
  prestataires?: number;
  /** Pourboire en argent liquide (non soumis aux taxes dans le bilan). */
  argentLiquide?: number;
  /**
   * Dates supplémentaires (jj/mm/aaaa) couvertes par le MÊME événement : le
   * devis/les factures valent pour toutes ces journées réunies. L'événement
   * s'affiche sur chacune de ces dates ; l'argent compte une seule fois (un seul
   * dossier), les heures comptent par jour.
   */
  linkedDates?: string[];
  /** Avis client demandé / obtenu. */
  avis?: boolean;
}

/**
 * Liste des plannings d'une journée. Compatible avec l'ancien modèle à planning
 * unique (lu comme liste à un élément) : `plannings` fait foi dès qu'il existe.
 */
export function planningsOf(journee: Pick<Journee, 'plannings' | 'planning'>): Planning[] {
  return journee.plannings ?? (journee.planning ? [journee.planning] : []);
}

/**
 * Planning couvrant une date donnée (recherché par sa propre date). Pour un
 * événement sur plusieurs journées liées, chaque jour peut avoir son planning.
 */
export function planningFor(
  journee: Pick<Journee, 'plannings' | 'planning'>,
  date: string,
): Planning | undefined {
  return planningsOf(journee).find((p) => p.date === date);
}
