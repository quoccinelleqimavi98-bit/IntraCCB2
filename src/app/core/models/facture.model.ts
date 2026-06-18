import type { PaymentType } from './enums';
import type { Presta } from './presta.model';

/** Facture rattachée à une journée (arrhes, solde, ou paiement ponctuel). */
export interface Facture {
  numero?: number;
  annee?: string;
  /** Date de création au format jj/mm/aaaa. */
  creation?: string;
  type?: PaymentType;
  /** Lignes de prestation facturées. */
  prestas: Presta[];
  /** Montant facturé (solde dû calculé ou saisi). */
  solde?: number;
  /** Montant réellement encaissé, s'il diffère du solde. */
  realsold?: number;
  /** Part reversée aux prestataires/renforts pour cette facture. */
  paiementPrestas?: number;
}
