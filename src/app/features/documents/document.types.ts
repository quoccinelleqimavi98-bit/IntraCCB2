import { DocumentMode } from '../../core/models';

/** Documents éditables à cette étape (devis & facture). */
export type DocumentKind = DocumentMode.Devis | DocumentMode.Facture;

/** Champs d'en-tête / pied communs au devis et à la facture. */
export interface DocumentValues {
  date: string;
  numero: number | string;
  annee: string;
  echeance: string;
  datePrestation: string;
  acompte: number | string;
  modePaiement: string;
  solde: number | string;
  realsold: number | string;
  paiementPrestas: number | string;
}

/** Demande d'ouverture d'un document depuis la fiche. */
export interface DocumentRequest {
  mode: DocumentKind;
  /** Index de la facture à éditer (-1 = nouvelle). Ignoré pour le devis. */
  factureIndex: number;
}
