/** Coordonnées du client (mariée / donneur d'ordre). */
export interface Client {
  nom?: string;
  adresse?: string;
  /** Code postal + ville, regroupés (format historique). */
  codepostal?: string;
  tel?: string;
  mail?: string;
}

/** Rendez-vous d'essai. */
export interface Essai {
  /** Date au format jj/mm/aaaa. */
  date?: string;
  heure?: string;
  lieu?: string;
}

/** Informations sur le lieu de la prestation (mariage). */
export interface Mariage {
  domaine?: string;
  adresse?: string;
  codepostal?: string;
  /** Heure de cérémonie au format « HhMM » (ex. « 15h30 »). */
  ceremonie?: string;
}
