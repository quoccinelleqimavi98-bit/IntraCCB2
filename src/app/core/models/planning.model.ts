import type { SlotType } from './enums';
import type { Presta } from './presta.model';

/**
 * Planning du jour-J : horaires des artistes (Cloé + renforts) et de leurs invitées.
 *
 * Remplace les tableaux positionnels de l'application d'origine par des objets
 * nommés. La correspondance avec les anciens indices est indiquée pour faciliter
 * la migration / le mapping (voir les commentaires « legacy: … »).
 */

/** Artiste intervenant (Cloé ou renfort). Remplace `collegues[c][0..6]`. */
export interface Artist {
  prenom: string; // legacy: [0]
  nom: string; // legacy: [1]
  tel: string; // legacy: [2]
  mail: string; // legacy: [3]
  /** Heure d'arrivée imposée (vide = calculée). */
  arrivee: string; // legacy: [4]
  /** Heure de retouches imposée. */
  retouches: string; // legacy: [5]
  /** Heure de disponibilité imposée. */
  disponibilite: string; // legacy: [6]
}

/** Prestation planifiée, rattachée à un artiste et à une ligne (slot). */
export interface PlanningPresta extends Presta {
  /** Index de l'artiste qui la réalise. legacy: `presta`. */
  artisteIndex: number;
  /** Identifiant de la ligne d'horaire associée. legacy: `index`. */
  slotIndex: number;
}

/** Une ligne d'horaire pour une invitée. Remplace `invitee[0..11]`. */
export interface PlanningSlot {
  /** Invitée ou mariée. legacy: [0]. */
  type: SlotType;
  arrivee: string; // legacy: [1]
  installation: string; // legacy: [2]
  /** Début du maquillage (vide si pas de maquillage). */
  maquillage: string; // legacy: [3]
  /** Début de la coiffure (vide si pas de coiffure). */
  coiffure: string; // legacy: [4]
  /** Fin de la prestation. */
  fin: string; // legacy: [5]
  retouches: string; // legacy: [6]
  disponibilite: string; // legacy: [7]
  ceremonie: string; // legacy: [8]
  /** Index de l'artiste. legacy: [9]. */
  artisteIndex: number;
  /** Index de la prestation associée. legacy: [10]. */
  prestaIndex: number;
  /** Libellé personnalisé éventuel (sinon « Invitée N » / « Mariée »). legacy: [11]. */
  nomPerso?: string;
}

/** Planning complet d'une journée. */
export interface Planning {
  /** Date au format jj/mm/aaaa. Sa présence indique un planning établi. */
  date?: string;
  domaine?: string;
  adresse?: string;
  codepostal?: string;
  ceremonie?: string;
  finPrestas?: string;
  /** Artistes intervenants. legacy: `collegues`. */
  artistes: Artist[];
  /** Lignes d'horaire des invitées. legacy: `invitees`. */
  slots: PlanningSlot[];
  /** Prestations planifiées. legacy: `planningprestas`. */
  prestas: PlanningPresta[];
}
