import { Artist } from '../../core/models';

/** Cloé — toujours l'artiste principal (index 0) d'un planning. */
export const CLOE_ARTIST: Artist = {
  prenom: 'Cloé',
  nom: 'CHAUDRON',
  tel: '+33 6 68 64 44 02',
  mail: 'cloe.chaudron@outlook.com',
  arrivee: '',
  retouches: '',
  disponibilite: '',
};

/** Renforts par défaut (hors Cloé), si l'admin n'en a pas défini. */
export const DEFAULT_RENFORTS: ReadonlyArray<Artist> = [
  {
    prenom: 'Celma',
    nom: 'SAHIDET',
    tel: '+33 6 80 84 42 52',
    mail: 'sahidetcelma@gmail.com',
    arrivee: '',
    retouches: '',
    disponibilite: '',
  },
];

/** En-têtes des 8 colonnes d'horaire du tableau (fr / en), dans l'ordre. */
export const PLANNING_HEADERS: ReadonlyArray<{ fr: string; en: string }> = [
  { fr: 'ARRIVEE', en: 'ARRIVAL' },
  { fr: 'INSTALLATION', en: 'SETUP' },
  { fr: 'MAQUILLAGE', en: 'MAKEUP' },
  { fr: 'COIFFURE', en: 'HAIRSTYLING' },
  { fr: 'FIN PRESTATION', en: 'END OF SERVICE' },
  { fr: 'RETOUCHES', en: 'TOUCH-UPS' },
  { fr: 'DISPONIBILITE', en: 'AVAILABILITY' },
  { fr: 'CEREMONIE', en: 'CEREMONY' },
];

/** Libellés du type de ligne (invitée / mariée). */
export const SLOT_LABELS: {
  invitee: { fr: string; en: string };
  mariee: { fr: string; en: string };
} = {
  invitee: { fr: 'Invitée', en: 'Guest' },
  mariee: { fr: 'Mariée', en: 'Bride' },
};

/** Index de la colonne « retouches » (préfixée « Jusqu'à » / « Until »). */
export const RETOUCHES_COL = 5;
