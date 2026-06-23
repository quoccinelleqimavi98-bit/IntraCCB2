/**
 * Mappers DTO ⇆ domaine.
 *
 * Toute la connaissance du format « historique » du backend est concentrée ici :
 * coercition des types (`number | string`), tableaux positionnels du planning,
 * coordonnées client à plat. Le reste de l'application ne manipule que des
 * modèles de domaine propres.
 */
import { parseAmount } from '../utils/money.utils';
import {
  DevisDto,
  EssaiDto,
  FactureDto,
  JourneeDto,
  MariageDto,
  PlanningDto,
  PrestaDto,
} from '../dto/journee.dto';
import {
  Artist,
  Devis,
  Essai,
  Etape,
  Facture,
  Journee,
  Mariage,
  PaymentType,
  Planning,
  PlanningPresta,
  PlanningSlot,
  Presta,
  Quantity,
  SlotType,
  Statut,
} from '../models';

// --- Coercition ------------------------------------------------------------

function toOptionalNumber(value: number | string | undefined | null): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return parseAmount(value);
}

function toQuantity(value: number | string): Quantity {
  return value === '?' ? '?' : parseAmount(value);
}

function toBool(value: string | boolean | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  return value !== '' && value !== 'false';
}

function str(value: number | string | undefined): string {
  return value === undefined ? '' : String(value);
}

// --- Prestations -----------------------------------------------------------

function prestaToDomain(dto: PrestaDto): Presta {
  return {
    id: dto.id,
    nom: dto.nom,
    en: dto.en,
    desc: dto.desc,
    prix: toOptionalNumber(dto.prix),
    reduc: toOptionalNumber(dto.reduc),
    kilorly: dto.kilorly,
    fullKm: dto.fullkm,
    hourly: dto.hourly,
    bride: dto.bride,
    onlyOne: dto.onlyOne,
    time: dto.time,
    maquillage: dto.maquillage,
    coiffure: dto.coiffure,
    titre: dto.titre,
    renfort: toBool(dto.renfort),
    qte: toQuantity(dto.qte),
  };
}

function prestaToDto(p: Presta): PrestaDto {
  return {
    id: p.id,
    nom: p.nom,
    en: p.en,
    desc: p.desc,
    prix: p.prix,
    reduc: p.reduc,
    kilorly: p.kilorly,
    fullkm: p.fullKm,
    hourly: p.hourly,
    bride: p.bride,
    onlyOne: p.onlyOne,
    time: p.time,
    maquillage: p.maquillage,
    coiffure: p.coiffure,
    titre: p.titre,
    renfort: p.renfort,
    qte: p.qte,
  };
}

// --- Devis / Factures ------------------------------------------------------

function devisToDomain(dto: DevisDto): Devis {
  return {
    numero: toOptionalNumber(dto.numero),
    annee: dto.annee,
    creation: dto.creation,
    echeance: dto.echeance,
    prestas: (dto.prestas ?? []).map(prestaToDomain),
  };
}

function devisToDto(devis: Devis): DevisDto {
  return {
    numero: devis.numero,
    annee: devis.annee,
    creation: devis.creation,
    echeance: devis.echeance,
    prestas: devis.prestas.map(prestaToDto),
  };
}

function factureToDomain(dto: FactureDto): Facture {
  return {
    numero: toOptionalNumber(dto.numero),
    annee: dto.annee,
    creation: dto.creation,
    type: dto.type as PaymentType | undefined,
    prestas: (dto.prestas ?? []).map(prestaToDomain),
    solde: toOptionalNumber(dto.solde),
    realsold: toOptionalNumber(dto.realsold),
    paiementPrestas: toOptionalNumber(dto.paiementprestas),
  };
}

function factureToDto(f: Facture): FactureDto {
  return {
    numero: f.numero,
    annee: f.annee,
    creation: f.creation,
    type: f.type,
    prestas: f.prestas.map(prestaToDto),
    solde: f.solde,
    realsold: f.realsold,
    paiementprestas: f.paiementPrestas,
  };
}

// --- Essai / Mariage -------------------------------------------------------

function essaiToDomain(dto: EssaiDto | undefined): Essai {
  return { date: dto?.date, heure: dto?.heure, lieu: dto?.lieu };
}

function mariageToDomain(dto: MariageDto | undefined): Mariage {
  return {
    domaine: dto?.domaine,
    adresse: dto?.adresse,
    codepostal: dto?.codepostal,
    ceremonie: dto?.ceremonie,
  };
}

// --- Planning (tableaux positionnels) -------------------------------------

function artistToDomain(arr: string[]): Artist {
  return {
    prenom: arr[0] ?? '',
    nom: arr[1] ?? '',
    tel: arr[2] ?? '',
    mail: arr[3] ?? '',
    arrivee: arr[4] ?? '',
    retouches: arr[5] ?? '',
    disponibilite: arr[6] ?? '',
  };
}

function artistToDto(a: Artist): string[] {
  return [a.prenom, a.nom, a.tel, a.mail, a.arrivee, a.retouches, a.disponibilite];
}

function slotToDomain(arr: Array<number | string>): PlanningSlot {
  const nomPerso = arr[11];
  return {
    type: Number(arr[0] ?? 0) as SlotType,
    arrivee: str(arr[1]),
    installation: str(arr[2]),
    maquillage: str(arr[3]),
    coiffure: str(arr[4]),
    fin: str(arr[5]),
    retouches: str(arr[6]),
    disponibilite: str(arr[7]),
    ceremonie: str(arr[8]),
    artisteIndex: Number(arr[9] ?? 0),
    prestaIndex: Number(arr[10] ?? 0),
    nomPerso: nomPerso !== undefined && nomPerso !== '' ? String(nomPerso) : undefined,
  };
}

function slotToDto(s: PlanningSlot): Array<number | string> {
  return [
    s.type,
    s.arrivee,
    s.installation,
    s.maquillage,
    s.coiffure,
    s.fin,
    s.retouches,
    s.disponibilite,
    s.ceremonie,
    s.artisteIndex,
    s.prestaIndex,
    s.nomPerso ?? '',
  ];
}

function planningPrestaToDomain(dto: PrestaDto): PlanningPresta {
  return {
    ...prestaToDomain(dto),
    artisteIndex: Number(dto.presta ?? 0),
    slotIndex: Number(dto.index ?? 0),
  };
}

function planningPrestaToDto(p: PlanningPresta): PrestaDto {
  return { ...prestaToDto(p), presta: p.artisteIndex, index: p.slotIndex };
}

function planningToDomain(dto: PlanningDto): Planning {
  return {
    date: dto.date,
    domaine: dto.domaine,
    adresse: dto.adresse,
    codepostal: dto.codepostal,
    ceremonie: dto.ceremonie,
    finPrestas: dto.finprestas,
    artistes: (dto.collegues ?? []).map(artistToDomain),
    slots: (dto.invitees ?? []).map(slotToDomain),
    prestas: (dto.planningprestas ?? []).map(planningPrestaToDomain),
  };
}

function planningToDto(p: Planning): PlanningDto {
  return {
    date: p.date,
    domaine: p.domaine,
    adresse: p.adresse,
    codepostal: p.codepostal,
    ceremonie: p.ceremonie,
    finprestas: p.finPrestas,
    collegues: p.artistes.map(artistToDto),
    invitees: p.slots.map(slotToDto),
    planningprestas: p.prestas.map(planningPrestaToDto),
  };
}

// --- Journée ---------------------------------------------------------------

/** Convertit le DTO renvoyé par l'API en modèle de domaine. */
export function journeeToDomain(dto: JourneeDto): Journee {
  return {
    id: dto.id,
    date: dto.date,
    statut: (dto.statut as Statut) ?? Statut.Demande,
    etape: (dto.etape as Etape) ?? Etape.Devis,
    client: {
      nom: dto.nom,
      adresse: dto.adresse,
      codepostal: dto.codepostal,
      tel: dto.tel,
      mail: dto.mail,
    },
    essai: essaiToDomain(dto.essai),
    mariage: mariageToDomain(dto.mariage),
    devis: dto.devis ? devisToDomain(dto.devis) : undefined,
    factures: (dto.factures ?? []).map(factureToDomain),
    planning: dto.planning ? planningToDomain(dto.planning) : undefined,
    mariagenet: dto.mariagenet,
    prestataires: toOptionalNumber(dto.prestataires),
    avis: toBool(dto.avis),
  };
}

/** Convertit un modèle de domaine en DTO prêt à être persisté par l'API. */
export function journeeToDto(j: Journee): JourneeDto {
  const dto: JourneeDto = {
    date: j.date,
    statut: j.statut,
    etape: j.etape,
    factures: j.factures.map(factureToDto),
    devis: j.devis ? devisToDto(j.devis) : {},
    planning: j.planning ? planningToDto(j.planning) : {},
    essai: { ...j.essai },
    mariage: { ...j.mariage },
  };

  if (j.id !== undefined) dto.id = j.id;
  if (j.client.nom) dto.nom = j.client.nom;
  if (j.client.adresse) dto.adresse = j.client.adresse;
  if (j.client.codepostal) dto.codepostal = j.client.codepostal;
  if (j.client.tel) dto.tel = j.client.tel;
  if (j.client.mail) dto.mail = j.client.mail;
  if (j.mariagenet) dto.mariagenet = j.mariagenet;
  if (j.prestataires !== undefined) dto.prestataires = j.prestataires;
  if (j.avis !== undefined) dto.avis = j.avis;

  return dto;
}
