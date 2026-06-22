/**
 * Énumérations du domaine.
 * Les *valeurs* sont conservées à l'identique de l'application d'origine afin de
 * rester compatibles avec les données existantes en base (sérialisation).
 */

/** Nature d'une journée du calendrier. */
export enum Statut {
  Demande = 'demande',
  Reserve = 'reserve',
  Essai = 'essai',
  Autre = 'autre',
  Perso = 'perso',
  PersoFull = 'persofull',
}

/** Avancement du dossier d'une journée. */
export enum Etape {
  /** À faire : créer un devis. */
  Devis = 0,
  /** Devis émis : facture d'arrhes à établir. */
  Arrhes = 1,
  /** Arrhes versées : facture de solde à établir. */
  Solde = 2,
  /** Événement clôturé. */
  Termine = 999,
}

/** Mode de règlement d'une facture. */
export enum PaymentType {
  // NB : l'espace final de « Chèque » est hérité des données existantes.
  Cheque = 'Chèque ',
  Virement = 'Virement',
  Aucun = '',
}

/** Langue de génération des documents PDF. */
export enum Langue {
  Francais = 'Français',
  Anglais = 'Anglais',
}

/** Type de document en cours d'édition. */
export enum DocumentMode {
  Devis = 'devis',
  Facture = 'facture',
  Planning = 'planning',
}

/** Rôle d'une ligne de planning. */
export enum SlotType {
  Invitee = 0,
  Mariee = 1,
}
