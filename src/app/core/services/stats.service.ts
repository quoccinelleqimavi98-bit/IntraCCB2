import { inject, Injectable } from '@angular/core';

import { Journee, Presta, Statut } from '../models';
import { monthOfFr, parseFrDate, yearOfFr } from '../utils/date.utils';
import { PricingService } from './pricing.service';

/** Une facture du mois enrichie de la journée à laquelle elle appartient. */
export interface FactureLigne {
  nom: string;
  /** Date de création de la facture (jj/mm/aaaa) — sert au tri et à l'affichage. */
  creation: string;
  /** Date de la journée associée (pour rouvrir la fiche). */
  date: string;
  montant: number;
  id?: number;
}

/** Compteur d'un statut : encore à faire / déjà terminés. */
export interface StatutCount {
  still: number;
  over: number;
}

/** Série annuelle pour les graphes (revenu mensuel + cumul). */
export interface YearSeries {
  year: number;
  monthly: number[]; // 12 valeurs (index 0 = janvier)
  cumulative: number[];
}

/**
 * Indicateurs du tableau de bord (revenus, heures, estimations, factures).
 *
 * Port fidèle de la logique des services d'origine (`CalcService`,
 * `DateService`, `PrestaService`) sur le modèle de domaine propre. Pur et sans
 * état ; `mois = null` signifie « toute l'année », sinon 1–12.
 */
@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly pricing = inject(PricingService);

  // --- Helpers prestations (ex-PrestaService) -------------------------------

  /** Total d'une ligne (= moteur de prix). */
  private calc(presta: Presta): number {
    return this.pricing.lineTotal(presta);
  }

  /** Prix « à l'unité » (réduction + arrondi, frais au km inclus). */
  private calcOne(presta: Presta): number {
    if (presta.qte === '?') return 0;
    let prix = presta.prix ?? 0;
    if (presta.kilorly) {
      const qte = Number(presta.qte);
      const km = presta.prix ?? 0;
      prix = presta.fullKm ? qte * 2 * km : qte <= 10 ? 0 : (qte - 10) * 2 * km;
    }
    if (presta.reduc) prix -= (prix * presta.reduc) / 100;
    if (Number.isInteger(presta.prix ?? 0) || presta.kilorly) prix = Math.floor(prix);
    return prix;
  }

  /** Durée (min) des prestations du planning réalisées par moi (artiste 0). */
  private planningPrestasTime(prestas: Presta[] | undefined): number {
    let time = 0;
    for (const p of prestas ?? []) {
      const artiste = (p as { artisteIndex?: number }).artisteIndex ?? 0;
      if (p.time && artiste === 0) time += p.time;
    }
    return time;
  }

  /** Durée (min) des prestations du devis (durée × quantité). */
  private prestasTime(prestas: Presta[] | undefined): number {
    let time = 0;
    for (const p of prestas ?? []) {
      if (p.time && p.qte && p.qte !== '?') time += p.time * Number(p.qte);
    }
    return time;
  }

  /** Somme des prestations, en (in)cluant les renforts selon les drapeaux. */
  private prestasPrice(prestas: Presta[], noHelpers = true, onlyHelpers = false): number {
    let price = 0;
    for (const p of prestas) {
      const renfort = (p.nom ?? '').includes('renfort');
      if (onlyHelpers) {
        if (renfort) price += this.calc(p);
      } else if (noHelpers) {
        if (!renfort) price += this.calc(p);
      } else {
        price += this.calc(p);
      }
    }
    return price;
  }

  /** Somme des prestations du planning, côté moi (artiste 0) ou renforts. */
  private planningPrestasPrice(prestas: Presta[] | undefined, notMe = false): number {
    let price = 0;
    for (const p of prestas ?? []) {
      const artiste = (p as { artisteIndex?: number }).artisteIndex ?? 0;
      if (notMe ? artiste !== 0 : artiste === 0) price += this.calcOne(p);
    }
    return price;
  }

  // --- Part journalière (ex-CalcService) ------------------------------------

  /** Ce que je gagne sur une journée (planning si présent, sinon devis). */
  mineThisDay(journee: Journee): number {
    let total = 0;
    if (journee.planning?.prestas) {
      total += this.planningPrestasPrice(journee.planning.prestas, false);
      for (const p of journee.devis?.prestas ?? []) {
        if (p.kilorly && !(p.nom ?? '').includes('renfort')) total += this.calc(p);
      }
    } else if (journee.devis?.prestas) {
      total += this.prestasPrice(journee.devis.prestas);
    }
    return Math.floor(total);
  }

  /** Montant déjà encaissé sur une journée (factures, hors part prestataires). */
  alreadyPaidThisDay(journee: Journee, onlyFactures = false): number {
    let total = 0;
    for (const f of journee.factures) {
      if (f.solde) {
        total += f.realsold && f.realsold !== 0 ? Number(f.realsold) : Number(f.solde);
      } else {
        total += this.prestasPrice(f.prestas, false);
        if (f.realsold && f.realsold !== 0) total = Number(f.realsold);
      }
    }
    if (!onlyFactures) {
      let prov = 0;
      if (journee.prestataires) prov += Number(journee.prestataires);
      else
        for (const f of journee.factures) if (f.paiementPrestas) prov += Number(f.paiementPrestas);
      total -= prov;
    }
    return Math.floor(total);
  }

  // --- Filtres ---------------------------------------------------------------

  private inPeriod(dateStr: string, year: number, month: number | null): boolean {
    return yearOfFr(dateStr) === year && (month === null || monthOfFr(dateStr) === month);
  }

  // --- Agrégats sur la période ----------------------------------------------

  /** Minutes travaillées (essai 120, autre 240, mariage depuis planning/devis). */
  hoursWorked(
    journees: Journee[],
    year: number,
    month: number | null,
    fromNow: boolean,
    untilNow: boolean,
  ): number {
    const today = startOfToday();
    let data = journees.filter((j) => this.inPeriod(j.date, year, month));
    if (fromNow) data = data.filter((j) => onOrAfter(j.date, today));
    else if (untilNow) data = data.filter((j) => before(j.date, today));

    let time = 0;
    for (const day of data) {
      if (day.statut === Statut.Essai) time += 120;
      else if (day.statut === Statut.Autre) time += 240;
      else if (day.statut === Statut.Reserve) {
        if (day.planning?.prestas) time += this.planningPrestasTime(day.planning.prestas);
        else time += this.prestasTime(day.devis?.prestas);
      }
    }
    return time;
  }

  /** Tarif horaire moyen (€/h) sur la période. */
  perHour(
    journees: Journee[],
    year: number,
    month: number | null,
    fromNow: boolean,
    untilNow: boolean,
  ): number {
    const hours = Math.trunc(this.hoursWorked(journees, year, month, fromNow, untilNow) / 60);
    if (hours <= 0) return 0;
    const base = fromNow
      ? this.notPaid(journees, year, month)
      : this.alreadyPaid(journees, year, month);
    return Math.trunc(base / hours);
  }

  /** Déjà encaissé sur la période (par date de facture). */
  alreadyPaid(journees: Journee[], year: number, month: number | null): number {
    let total = 0;
    for (const j of journees) {
      for (const f of j.factures) {
        if (!f.creation || !this.inPeriod(f.creation, year, month)) continue;
        if (f.solde) {
          total += f.realsold && f.realsold !== 0 ? Number(f.realsold) : Number(f.solde);
        }
      }
    }
    return Math.trunc(total);
  }

  /** Reste à encaisser sur la période (par date de journée). */
  notPaid(journees: Journee[], year: number, month: number | null, withDemands = false): number {
    // Reproduit fidèlement l'app d'origine : événements non clôturés, avec un
    // devis ; les demandes ne comptent que pour l'estimation.
    let data = journees.filter(
      (j) => this.inPeriod(j.date, year, month) && j.etape !== 999 && j.devis?.creation,
    );
    if (!withDemands) data = data.filter((j) => j.statut !== Statut.Demande);

    let total = 0;
    for (const j of data) {
      total += this.mineThisDay(j);
      for (const f of j.factures) {
        total -= f.realsold && f.realsold !== 0 ? Number(f.realsold) : Number(f.solde);
      }
    }
    return Math.trunc(total);
  }

  /** Total reversé aux renforts sur la période. */
  helpers(journees: Journee[], year: number, month: number | null): number {
    const data = journees.filter(
      (j) => this.inPeriod(j.date, year, month) && j.statut !== Statut.Demande,
    );
    let total = 0;
    for (const j of data) {
      let tot = 0;
      if (j.prestataires) tot += Number(j.prestataires);
      else for (const f of j.factures) if (f.paiementPrestas) tot += Number(f.paiementPrestas);
      if (tot === 0 && j.planning?.prestas) {
        tot += this.planningPrestasPrice(j.planning.prestas, true);
      }
      if (j.devis?.prestas) tot += this.prestasPrice(j.devis.prestas, false, true);
      total += tot;
    }
    return Math.trunc(total);
  }

  /** Estimation (déjà payé + à venir, demandes incluses). */
  estimate(journees: Journee[], year: number, month: number | null): number {
    return this.alreadyPaid(journees, year, month) + this.notPaid(journees, year, month, true);
  }

  /** Total (déjà payé + reste à encaisser, hors demandes). */
  totalRevenue(journees: Journee[], year: number, month: number | null): number {
    return this.alreadyPaid(journees, year, month) + this.notPaid(journees, year, month);
  }

  /** Factures encaissées sur la période, triées par date de création. */
  monthFactures(journees: Journee[], year: number, month: number | null): FactureLigne[] {
    const lignes: FactureLigne[] = [];
    for (const j of journees) {
      for (const f of j.factures) {
        if (!f.creation || !this.inPeriod(f.creation, year, month)) continue;
        lignes.push({
          nom: j.client.nom ?? '',
          creation: f.creation,
          date: j.date,
          montant: this.pricing.factureSold(f),
          id: j.id,
        });
      }
    }
    return this.sortByCreation(lignes);
  }

  /** Journées avec un reste à encaisser sur la période. */
  monthFacturesMissing(journees: Journee[], year: number, month: number | null): FactureLigne[] {
    const lignes: FactureLigne[] = [];
    const data = journees.filter((j) => this.inPeriod(j.date, year, month) && j.etape !== 999);
    for (const j of data) {
      if (!j.devis?.prestas) continue;
      const reste = this.mineThisDay(j) - this.alreadyPaidThisDay(j, true);
      if (reste > 0) {
        lignes.push({
          nom: j.client.nom ?? '',
          creation: j.date,
          date: j.date,
          montant: reste,
          id: j.id,
        });
      }
    }
    return this.sortByCreation(lignes);
  }

  /** Compteur d'un statut sur la période (encore à faire / terminés). */
  statutCount(
    journees: Journee[],
    statut: Statut,
    year: number,
    month: number | null,
  ): StatutCount {
    const data = journees.filter((j) => this.inPeriod(j.date, year, month) && j.statut === statut);
    return {
      still: data.filter((j) => j.etape !== 999).length,
      over: data.filter((j) => j.etape === 999).length,
    };
  }

  /** Nombre de journées à une étape donnée (hors perso). */
  etapeCount(journees: Journee[], etape: number, year: number, month: number | null): number {
    return journees.filter(
      (j) => this.inPeriod(j.date, year, month) && j.etape === etape && j.statut !== Statut.Perso,
    ).length;
  }

  // --- Séries pour les graphes ----------------------------------------------

  /** Revenu mensuel et cumulé par année (depuis les factures). */
  yearSeries(journees: Journee[]): YearSeries[] {
    const byYear = new Map<number, number[]>();
    for (const j of journees) {
      for (const f of j.factures) {
        if (!f.creation) continue;
        const year = yearOfFr(f.creation);
        const month = monthOfFr(f.creation); // 1-12
        if (!byYear.has(year)) byYear.set(year, new Array(12).fill(0));
        byYear.get(year)![month - 1] += this.pricing.factureSold(f);
      }
    }
    return [...byYear.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, monthly]) => {
        const cumulative: number[] = [];
        let sum = 0;
        for (const value of monthly) {
          sum += value;
          cumulative.push(sum);
        }
        return { year, monthly, cumulative };
      });
  }

  private sortByCreation(lignes: FactureLigne[]): FactureLigne[] {
    return lignes.sort((a, b) => {
      const da = parseFrDate(a.creation)?.getTime() ?? 0;
      const db = parseFrDate(b.creation)?.getTime() ?? 0;
      return da - db;
    });
  }
}

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function onOrAfter(dateStr: string, today: Date): boolean {
  const date = parseFrDate(dateStr);
  return date !== null && date >= today;
}

function before(dateStr: string, today: Date): boolean {
  const date = parseFrDate(dateStr);
  return date !== null && date < today;
}
