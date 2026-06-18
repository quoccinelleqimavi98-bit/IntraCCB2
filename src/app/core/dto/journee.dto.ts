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
  hourly?: boolean;
  bride?: boolean;
  onlyOne?: boolean;
  time?: number;
  maquillage?: boolean;
  coiffure?: boolean;
  titre?: boolean;
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
  avis?: string | boolean;
  devis?: DevisDto;
  factures?: FactureDto[];
  planning?: PlanningDto;
  essai?: EssaiDto;
  mariage?: MariageDto;
}
