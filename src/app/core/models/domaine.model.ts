/** Lieu de réception référencé (domaines.json), avec distance pré-calculée. */
export interface Domaine {
  domaine: string;
  adresse: string;
  /** Code postal + ville. */
  codepostal: string;
  /** Distance aller en km (sert au pré-remplissage des frais de déplacement). */
  qte: number;
}
