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

  devis?: Devis;
  factures: Facture[];
  planning?: Planning;

  /** Identifiant de la demande sur mariages.net (relances). */
  mariagenet?: string;
  /** Montant total reversé aux renforts, saisi manuellement le cas échéant. */
  prestataires?: number;
  /** Avis client demandé / obtenu. */
  avis?: boolean;
}
