import { Etape, Statut } from '../core/models';

/** Métadonnées d'affichage d'un statut (libellé court + classe de couleur). */
export interface StatutUi {
  readonly label: string;
  readonly cssClass: string;
}

export const STATUT_UI: Record<Statut, StatutUi> = {
  [Statut.Reserve]: { label: 'Réservé', cssClass: 'statut-reserve' },
  [Statut.Demande]: { label: 'Demande', cssClass: 'statut-demande' },
  [Statut.Essai]: { label: 'Essai', cssClass: 'statut-essai' },
  [Statut.Autre]: { label: 'Autre', cssClass: 'statut-autre' },
  [Statut.Perso]: { label: 'Perso', cssClass: 'statut-perso' },
  [Statut.PersoFull]: { label: 'Perso', cssClass: 'statut-perso' },
  [Statut.Annule]: { label: 'Annulé', cssClass: 'statut-over' },
};

/** Classe de couleur d'une entrée (grise si l'événement est terminé). */
export function statutClass(statut: Statut, etape: Etape): string {
  return etape === Etape.Termine ? 'statut-over' : STATUT_UI[statut].cssClass;
}

/** Libellé court d'une entrée. */
export function statutLabel(statut: Statut, etape: Etape): string {
  return etape === Etape.Termine ? 'Terminé' : STATUT_UI[statut].label;
}

/** Statuts présentés dans la légende, dans l'ordre. */
export const LEGEND_STATUTS: ReadonlyArray<Statut> = [
  Statut.Reserve,
  Statut.Demande,
  Statut.Essai,
  Statut.Autre,
  Statut.Perso,
];
