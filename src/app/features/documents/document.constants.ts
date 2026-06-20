/** Émetteur (coordonnées de Cloé) imprimé sur les documents. */
export const EMETTEUR = {
  nom: 'Cloé Chaudron',
  adresse: '126 Rue de la Cerisaie',
  codepostal: '84400 Gargas',
  tel: '+33 6 68 64 44 02',
  mail: 'cloe.chaudron@outlook.com',
} as const;

/** Coordonnées bancaires imprimées en pied de document. */
export const BANK = {
  nom: 'Société Générale',
  iban: 'FR76 3000 3031 8400 1500 2190 924',
  bic: 'SOGEFRPP',
  siret: '883 822 801 00014',
} as const;
