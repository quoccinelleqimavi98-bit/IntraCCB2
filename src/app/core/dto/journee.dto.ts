/**
 * DTO — format BRUT échangé avec l'API PHP existante.
 *
 * Ces types décrivent la réalité (parfois imparfaite) du backend actuel :
 * coordonnées client « à plat », tableaux positionnels pour le planning,
 * champs typés `number | string`. Ils sont volontairement isolés du domaine ;
 * la traduction se fait dans les mappers. Quand l'API sera réécrite
 * (voir docs/api-contract.md), seuls ces DTO et les mappers évolueront.
 */

export interface PrestaDto {
  id?: string;
  nom: string;
  en?: string;
  desc?: string;
  qte: number | string;
  prix?: number | string;
  reduc?: number | string;
  kilorly?: boolean;
  fullkm?: boolean;
  hourly?: boolean;
  bride?: boolean;
  onlyOne?: boolean;
  time?: number;
  maquillage?: boolean;
  coiffure?: boolean;
  titre?: boolean;
  /** Facture : part réalisée par un prestataire/renfort. */
  renfort?: boolean;
  /** Nombre d'unités confiées à un prestataire (figé à la sauvegarde du planning). */
  renfortqte?: number;
  /** Planning : index de l'artiste. */
  presta?: number | string;
  /** Planning : index de la ligne. */
  index?: number;
}

export interface DevisDto {
  numero?: number | string;
  annee?: string;
  creation?: string;
  echeance?: string;
  prestas?: PrestaDto[];
  /**
   * Liste complète des devis (initial + avenants) rangée DANS le dernier devis,
   * pour survivre au backend (la colonne `devis` ne stocke qu'un objet). Absent
   * sur les données anciennes → un seul devis.
   */
  versions?: DevisDto[];
  /**
   * Dates liées de l'événement, rangées dans le blob devis (aucune colonne
   * backend). Propriété de la journée, persistée ici par commodité.
   */
  linkedDates?: string[];
}

export interface FactureDto {
  numero?: number | string;
  annee?: string;
  creation?: string;
  type?: string;
  prestas?: PrestaDto[];
  solde?: number | string;
  realsold?: number | string;
  paiementprestas?: number | string;
}

export interface EssaiDto {
  date?: string;
  heure?: string;
  lieu?: string;
}

export interface MariageDto {
  domaine?: string;
  adresse?: string;
  codepostal?: string;
  ceremonie?: string;
}

export interface PlanningDto {
  date?: string;
  domaine?: string;
  adresse?: string;
  codepostal?: string;
  ceremonie?: string;
  finprestas?: string;
  /** Tableaux positionnels historiques (voir mapper pour la signification). */
  collegues?: Array<Array<string>>;
  invitees?: Array<Array<number | string>>;
  planningprestas?: PrestaDto[];
  /**
   * Liste complète des plannings rangée DANS le dernier, pour survivre au backend
   * (la colonne `planning` ne stocke qu'un objet). Absent → un seul planning.
   */
  versions?: PlanningDto[];
}

export interface JourneeDto {
  id?: number;
  date: string;
  statut: string;
  etape?: number;
  nom?: string;
  adresse?: string;
  codepostal?: string;
  tel?: string;
  mail?: string;
  mariagenet?: string;
  prestataires?: number | string;
  argentliquide?: number | string;
  avis?: string | boolean;
  devis?: DevisDto;
  factures?: FactureDto[];
  planning?: PlanningDto;
  essai?: EssaiDto;
  mariage?: MariageDto;
}
