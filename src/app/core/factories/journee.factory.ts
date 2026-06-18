import { Etape, Journee, Statut } from '../models';

/** Crée une journée vierge pour une date donnée (nouvelle demande). */
export function blankJournee(date: string): Journee {
  return {
    date,
    statut: Statut.Demande,
    etape: Etape.Devis,
    client: {},
    essai: {},
    mariage: {},
    factures: [],
  };
}
