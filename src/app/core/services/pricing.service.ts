import { Injectable } from '@angular/core';

import { Facture, Journee, Planning, Presta } from '../models';

/**
 * Moteur de prix — source unique de toute la logique chiffrée (devis, factures,
 * récapitulatif). Pur et sans état : reproduit fidèlement les règles de calcul
 * de l'application d'origine (frais au km, réductions, arrondis, arrhes 30 %…).
 */
@Injectable({ providedIn: 'root' })
export class PricingService {
  /** Total d'une ligne (quantité × prix, frais au km, réduction, arrondi). */
  lineTotal(presta: Presta): number {
    if (presta.qte === '?') return 0;
    const qte = Number(presta.qte);
    const prix = presta.prix ?? 0;
    let total = prix * qte;
    if (presta.kilorly) {
      // Frais au km, aller/retour. Les anciens devis gardent les 10 km offerts ;
      // les nouvelles lignes (fullKm) facturent tous les km.
      total = presta.fullKm ? qte * 2 * prix : qte <= 10 ? 0 : (qte - 10) * 2 * prix;
    }
    if (presta.reduc) total -= (total * presta.reduc) / 100;
    if (Number.isInteger(prix) || presta.kilorly) total = Math.floor(total);
    return total;
  }

  /** Prix unitaire (réduction appliquée, sans multiplier par la quantité). */
  unitPrice(presta: Presta): number {
    if (presta.qte === '?') return 0;
    let prix = presta.prix ?? 0;
    if (presta.reduc) prix -= (prix * presta.reduc) / 100;
    if (Number.isInteger(presta.prix ?? 0) || presta.kilorly) prix = Math.floor(prix);
    return prix;
  }

  /** Libellé du total d'une ligne : '', « Offert » ou « 120€ ». */
  lineLabel(presta: Presta): string {
    if (presta.qte === '?') return '';
    const total = this.lineTotal(presta);
    if (total === 0) return 'Offert';
    return `${total}${total < 100 ? ',00' : ''}€`;
  }

  /** Total d'un ensemble de prestations (lignes à quantité positive). */
  total(prestas: Presta[]): number {
    let sum = 0;
    for (const presta of prestas) {
      if (presta.qte !== '?' && Number(presta.qte) > 0) sum += this.lineTotal(presta);
    }
    return Math.floor(sum);
  }

  /**
   * Montant des arrhes (30 % des forfaits mariée).
   * `fallbackToTotal` : à défaut de forfait mariée, 30 % du total (côté devis).
   */
  arrhes(prestas: Presta[], fallbackToTotal = false): number {
    let sum = 0;
    for (const presta of prestas) {
      if (presta.bride && presta.qte !== '?' && Number(presta.qte) > 0) {
        sum += this.lineTotal(presta);
      }
    }
    if (sum !== 0) sum = 0.3 * sum;
    else if (fallbackToTotal) sum = 0.3 * this.total(prestas);
    return Math.floor(sum);
  }

  /** Montant encaissé pour une facture (solde, réel, ou somme des lignes). */
  factureSold(facture: Facture): number {
    if (facture.realsold && facture.realsold !== 0) return facture.realsold;
    if (facture.solde) return facture.solde;
    let sum = 0;
    for (const presta of facture.prestas) sum += this.lineTotal(presta);
    return Math.floor(sum);
  }

  /** Total déjà payé sur une journée (toutes factures). */
  paid(journee: Journee): number {
    let sum = 0;
    for (const facture of journee.factures) {
      if (facture.solde) sum += this.factureSold(facture);
      else for (const presta of facture.prestas) sum += this.lineTotal(presta);
    }
    return sum;
  }

  /**
   * Calcule le paiement prestataires d'après le planning + les frais de
   * déplacement des renforts (du devis). C'est la valeur figée à la sauvegarde
   * d'un planning :
   *   frais de déplacement renfort (devis)
   * + prestations qui ne sont PAS à moi dans le planning (artiste ≠ 0).
   */
  computeProviders(planning: Planning | undefined, devisPrestas: Presta[]): number {
    let total = 0;
    for (const presta of devisPrestas) {
      const nom = presta.nom ?? '';
      if (nom.includes('renfort') && (presta.kilorly || nom.includes('éplacement'))) {
        total += this.lineTotal(presta);
      }
    }
    for (const presta of planning?.prestas ?? []) {
      if (presta.artisteIndex !== 0) total += this.unitPrice(presta);
    }
    return Math.floor(total);
  }

  /**
   * Part reversée aux prestataires/renforts sur une journée. Valeur FIGÉE à la
   * sauvegarde du planning (`journee.prestataires`) ; à défaut, recalcul.
   */
  providersPaid(journee: Journee): number {
    if (journee.prestataires != null) return Math.floor(Number(journee.prestataires));
    return this.computeProviders(journee.planning, journee.devis?.prestas ?? []);
  }

  /** Part revenant à Cloé = total du devis − paiement prestataires. */
  mine(journee: Journee): number {
    return this.total(journee.devis?.prestas ?? []) - this.providersPaid(journee);
  }
}
