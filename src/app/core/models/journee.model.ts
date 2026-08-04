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
  planning?: Planning;

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
