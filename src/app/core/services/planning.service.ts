import { Injectable } from '@angular/core';

import { Artist, CatalogItem, Presta, PlanningPresta, PlanningSlot, SlotType } from '../models';
import { addMinutes, diffMinutes, isEarlier, isHm } from '../utils/time.utils';

/** État de travail de l'éditeur de planning (mutable). */
export interface PlanningState {
  artists: Artist[];
  slots: PlanningSlot[];
  prestas: PlanningPresta[];
  ceremonie: string;
  finPrestas: string;
}

/**
 * Calcul des horaires du planning du jour-J. Reproduit fidèlement l'algorithme
 * de l'application d'origine, mais sur le modèle nommé (Artist / PlanningSlot /
 * PlanningPresta) au lieu des tableaux positionnels. Méthodes mutatives,
 * appelées par l'éditeur.
 */
@Injectable({ providedIn: 'root' })
export class PlanningService {
  /** Prestations d'un artiste, dans l'ordre courant. */
  prestasOf(state: PlanningState, artisteIndex: number): PlanningPresta[] {
    return state.prestas.filter((p) => p.artisteIndex === artisteIndex);
  }

  /** Lignes (slots) d'un artiste, dans l'ordre courant. */
  slotsOf(state: PlanningState, artisteIndex: number): PlanningSlot[] {
    return state.slots.filter((s) => s.artisteIndex === artisteIndex);
  }

  private prestaOfSlot(state: PlanningState, slot: PlanningSlot): PlanningPresta | undefined {
    return state.prestas.find((p) => p.slotIndex === slot.prestaIndex);
  }

  private firstSlot(state: PlanningState, artisteIndex: number): PlanningSlot | undefined {
    return state.slots.find((s) => s.artisteIndex === artisteIndex);
  }

  private nextIndex(state: PlanningState): number {
    return state.prestas.length ? Math.max(...state.prestas.map((p) => p.slotIndex)) + 1 : 0;
  }

  // --- Construction depuis un devis -----------------------------------------

  /** Construit slots + prestations à partir des lignes de devis (mariée en dernier). */
  build(devisPrestas: Presta[], catalog: CatalogItem[], state: PlanningState): void {
    state.slots = [];
    state.prestas = [];
    let mariee: PlanningPresta | undefined;

    for (const p of devisPrestas) {
      const cat = catalog.find((c) => c.nom === p.nom);
      if (!cat || !cat.time) continue;
      const qte = p.qte === '?' ? 0 : Number(p.qte);
      // Reprend la répartition du dernier avenant : une ligne confiée à un
      // prestataire (drapeau renfort) va au 1er renfort (artiste 1) ; sinon à moi.
      const provider = p.renfort === true || (p.nom ?? '').includes('renfort');
      const artisteIndex = provider && state.artists.length > 1 ? 1 : 0;
      for (let i = 0; i < qte; i++) {
        const press: PlanningPresta = {
          ...p,
          maquillage: cat.maquillage,
          coiffure: cat.coiffure,
          time: cat.time,
          bride: cat.bride,
          artisteIndex,
          slotIndex: this.nextIndex(state),
        };
        if (press.bride) {
          mariee = { ...press, artisteIndex: 0 };
        } else {
          state.prestas.push(press);
          this.addSlot(state, press, artisteIndex);
        }
      }
    }

    if (mariee) {
      mariee.slotIndex = this.nextIndex(state);
      state.prestas.push(mariee);
      this.addSlot(state, mariee, 0);
    }
  }

  // --- Recalcul des horaires ------------------------------------------------

  /** Recalcule tous les horaires (enchaînement des prestations par artiste). */
  recompute(state: PlanningState): void {
    for (let i = 0; i < state.artists.length; i++) {
      const slots = this.slotsOf(state, i);
      for (let j = 0; j < slots.length; j++) {
        const slot = slots[j];
        const presta = this.prestaOfSlot(state, slot);
        if (!presta) continue;
        if (j === 0) {
          const debut = presta.maquillage ? slot.maquillage : presta.coiffure ? slot.coiffure : '';
          slot.arrivee = addMinutes(debut, -20);
          slot.installation = addMinutes(debut, -10);
          slot.fin = addMinutes(debut, presta.time ?? 0);
        } else {
          const debut = slots[j - 1].fin;
          slot.maquillage = presta.maquillage ? debut : '';
          slot.coiffure = presta.coiffure ? debut : '';
          slot.fin = addMinutes(debut, presta.time ?? 0);
        }
      }
    }
    // Réordonne les prestations dans l'ordre des slots.
    const ordered = state.slots
      .map((s) => state.prestas.find((p) => p.slotIndex === s.prestaIndex))
      .filter((p): p is PlanningPresta => !!p);
    state.prestas = ordered;
  }

  /** Rafraîchit : back-calc depuis cérémonie/fin de prestations, sinon recalcul simple. */
  refresh(state: PlanningState): void {
    if (isHm(state.ceremonie)) {
      state.slots.forEach((s) => (s.ceremonie = state.ceremonie));
      this.changeForCeremonie(state);
    } else if (isHm(state.finPrestas)) {
      state.slots.forEach((s) => (s.ceremonie = ''));
      this.changeForCeremonie(state);
    } else {
      state.slots.forEach((s) => (s.ceremonie = ''));
      this.recompute(state);
    }
  }

  // --- Réactions aux saisies de l'éditeur -----------------------------------

  /** Saisie de l'heure de cérémonie. */
  onCeremonieChange(state: PlanningState): void {
    if (!isHm(state.ceremonie)) return;
    state.slots.forEach((s) => (s.ceremonie = state.ceremonie));
    this.changeForCeremonie(state);
  }

  /** Saisie de la fin de prestations. */
  onFinPrestasChange(state: PlanningState): void {
    if (isHm(state.finPrestas)) this.changeForCeremonie(state);
  }

  /** Saisie de l'heure d'arrivée d'un artiste. */
  onArriveeChange(state: PlanningState, i: number): void {
    const value = state.artists[i]?.arrivee ?? '';
    if (isHm(value)) {
      this.changeForCeremonie(state);
    } else if (value === '') {
      if (isHm(state.ceremonie)) this.onCeremonieChange(state);
      else if (isHm(state.finPrestas)) this.changeForCeremonie(state);
      state.slots.forEach((s) => (s.retouches = ''));
    }
  }

  /** Saisie de l'heure de retouches d'un artiste. */
  onRetoucheChange(state: PlanningState, i: number): void {
    const value = state.artists[i]?.retouches ?? '';
    if (isHm(value)) {
      this.slotsOf(state, i).forEach((s) => (s.retouches = value));
    } else if (value === '') {
      this.slotsOf(state, i).forEach((s) => (s.retouches = ''));
      if (isHm(state.ceremonie)) this.onCeremonieChange(state);
      else if (isHm(state.finPrestas)) this.changeForCeremonie(state);
    }
  }

  /** Saisie de l'heure de disponibilité d'un artiste. */
  onDispoChange(state: PlanningState, i: number): void {
    const value = state.artists[i]?.disponibilite ?? '';
    if (isHm(value)) this.slotsOf(state, i).forEach((s) => (s.disponibilite = value));
    else if (value === '') this.slotsOf(state, i).forEach((s) => (s.disponibilite = ''));
  }

  /** Saisie de la durée d'une prestation (minutes). */
  onTimeChange(state: PlanningState, presta: PlanningPresta): void {
    const raw = String(presta.time ?? '');
    if (!/^[0-9]+$/.test(raw)) return;
    presta.time = parseInt(raw, 10);
    this.refresh(state);
  }

  /** Calcule les heures de début en remontant depuis la cérémonie / fin de prestations. */
  private changeForCeremonie(state: PlanningState): void {
    const { artists, finPrestas } = state;
    for (let c = 0; c < artists.length; c++) {
      const inv = this.firstSlot(state, c);
      if (!inv) continue;
      const presta = this.prestaOfSlot(state, inv);

      if (artists[c].arrivee === '') {
        let temps = state.ceremonie;
        let total = -60;
        if (isHm(finPrestas)) {
          total = 0;
          temps = finPrestas;
        }
        const ap = this.prestasOf(state, c);
        if (ap.length > 0) {
          ap.forEach((p) => (total -= p.time ?? 0));
          temps = addMinutes(temps, total);
          inv.maquillage = presta?.maquillage ? temps : '';
          inv.coiffure = presta?.coiffure ? temps : '';
        }
      } else {
        inv.maquillage = presta?.maquillage ? addMinutes(artists[c].arrivee, 30) : '';
        inv.coiffure = presta?.coiffure ? addMinutes(artists[c].arrivee, 30) : '';
      }
    }

    if (
      artists[0]?.arrivee === '' &&
      artists[1]?.arrivee === '' &&
      this.prestasOf(state, 0).length > 0 &&
      this.prestasOf(state, 1).length > 0
    ) {
      this.adaptStart(state);
    } else {
      this.recompute(state);
    }
  }

  /** Aligne les heures de début des deux premiers artistes. */
  private adaptStart(state: PlanningState): void {
    const second = this.slotsOf(state, 1);
    if (second.length === 0) {
      this.recompute(state);
      return;
    }
    const first0 = this.firstSlot(state, 0);
    const first1 = this.firstSlot(state, 1);
    if (!first0 || !first1) {
      this.recompute(state);
      return;
    }
    const debut1 = first0.maquillage || first0.coiffure;
    const debut2 = first1.maquillage || first1.coiffure;
    if (debut1 !== debut2) {
      const ecart = diffMinutes(debut1, debut2);
      if (isEarlier(debut1, debut2)) {
        const nh = addMinutes(debut2, -ecart);
        if (first1.maquillage !== '') first1.maquillage = nh;
        if (first1.coiffure !== '') first1.coiffure = nh;
      } else {
        const nh = addMinutes(debut1, -ecart);
        if (first0.maquillage !== '') first0.maquillage = nh;
        if (first0.coiffure !== '') first0.coiffure = nh;
      }
      this.recompute(state);
      this.adaptRetouches(state);
    }
  }

  /** Place les retouches sur l'artiste qui termine le plus tôt. */
  private adaptRetouches(state: PlanningState): void {
    const a0 = this.slotsOf(state, 0);
    const a1 = this.slotsOf(state, 1);
    const last0 = a0[a0.length - 1];
    const last1 = a1[a1.length - 1];
    if (!last0 || !last1) return;
    if (isEarlier(last0.fin, last1.fin)) {
      a0.forEach((s) => (s.retouches = last1.fin));
      a1.forEach((s) => (s.retouches = ''));
    } else {
      a1.forEach((s) => (s.retouches = last0.fin));
      a0.forEach((s) => (s.retouches = ''));
    }
  }

  // --- Mutations ------------------------------------------------------------

  /** Ajoute une ligne (slot) pour une prestation et un artiste. */
  addSlot(state: PlanningState, presta: PlanningPresta, artisteIndex: number): void {
    const { artists, slots } = state;
    const existing = this.slotsOf(state, artisteIndex);
    const artist = artists[artisteIndex];

    if (existing.length === 0) {
      const arrivee = artist?.arrivee ? artist.arrivee : '8h30';
      const installation = addMinutes(arrivee, 10);
      const debut = addMinutes(arrivee, 20);
      slots.push({
        type: presta.bride ? SlotType.Mariee : SlotType.Invitee,
        arrivee,
        installation,
        maquillage: presta.maquillage ? debut : '',
        coiffure: presta.coiffure ? debut : '',
        fin: addMinutes(debut, presta.time ?? 0),
        retouches: artist?.retouches ?? '',
        disponibilite: artist?.disponibilite ?? '',
        ceremonie: state.ceremonie || '',
        artisteIndex,
        prestaIndex: presta.slotIndex,
      });
    } else {
      const last = existing[existing.length - 1];
      slots.push({
        type: presta.bride ? SlotType.Mariee : SlotType.Invitee,
        arrivee: '',
        installation: '',
        maquillage: presta.maquillage ? last.fin : '',
        coiffure: presta.coiffure ? last.fin : '',
        fin: addMinutes(last.fin, presta.time ?? 0),
        retouches: artist?.retouches ?? '',
        disponibilite: artist?.disponibilite ?? '',
        ceremonie: state.ceremonie || '',
        artisteIndex,
        prestaIndex: presta.slotIndex,
      });
    }
    this.refresh(state);
  }

  /** Ajoute une prestation vierge (45 min) pour un artiste. */
  addPresta(state: PlanningState, artisteIndex: number): void {
    const template = this.prestasOf(state, artisteIndex)[0];
    const presta: PlanningPresta = {
      ...(template ?? { nom: '', qte: 1, maquillage: true, coiffure: false }),
      nom: '',
      time: 45,
      artisteIndex,
      slotIndex: this.nextIndex(state),
    };
    state.prestas.push(presta);
    this.addSlot(state, presta, artisteIndex);
  }

  /** Supprime une prestation et sa ligne. */
  deletePresta(state: PlanningState, presta: PlanningPresta): void {
    const pi = state.prestas.indexOf(presta);
    if (pi >= 0) state.prestas.splice(pi, 1);
    const slot = state.slots.find((s) => s.prestaIndex === presta.slotIndex);
    if (slot) state.slots.splice(state.slots.indexOf(slot), 1);
    this.refresh(state);
  }

  /** Réaffecte une prestation à un autre artiste. */
  changeArtist(state: PlanningState, presta: PlanningPresta, artisteIndex: number): void {
    const slot = state.slots.find((s) => s.prestaIndex === presta.slotIndex);
    if (!slot) return;
    const sameArtist = this.slotsOf(state, slot.artisteIndex);
    if (sameArtist.length > 1 && sameArtist.indexOf(slot) === 0) {
      sameArtist[1].arrivee = slot.arrivee;
      sameArtist[1].installation = slot.installation;
    }
    state.slots.splice(state.slots.indexOf(slot), 1);
    presta.artisteIndex = artisteIndex;
    this.addSlot(state, presta, artisteIndex);
  }

  /** Active/désactive maquillage ou coiffure d'une prestation (ajuste la durée). */
  toggleType(state: PlanningState, presta: PlanningPresta, type: 'm' | 'c'): void {
    if (!presta.maquillage && !presta.coiffure) {
      if (type === 'm') presta.coiffure = true;
      else presta.maquillage = true;
    } else if (presta.maquillage && presta.coiffure) {
      presta.time = (presta.time ?? 0) * 2;
    } else {
      presta.time = (presta.time ?? 0) / 2;
    }
    const slot = state.slots.find((s) => s.prestaIndex === presta.slotIndex);
    if (slot) {
      const debut = slot.maquillage || slot.coiffure;
      slot.maquillage = presta.maquillage ? debut : '';
      slot.coiffure = presta.coiffure ? debut : '';
    }
    this.refresh(state);
  }

  /** Monte une prestation dans l'ordre de son artiste. */
  moveUp(state: PlanningState, artisteIndex: number, idx: number): void {
    const ap = this.prestasOf(state, artisteIndex);
    if (idx <= 0) return;
    this.swap(state, ap[idx - 1], ap[idx]);
  }

  /** Descend une prestation dans l'ordre de son artiste. */
  moveDown(state: PlanningState, artisteIndex: number, idx: number): void {
    const ap = this.prestasOf(state, artisteIndex);
    if (idx >= ap.length - 1) return;
    this.swap(state, ap[idx], ap[idx + 1]);
  }

  private swap(state: PlanningState, p1: PlanningPresta, p2: PlanningPresta): void {
    const { slots, prestas } = state;
    const i1 = slots.find((s) => s.prestaIndex === p1.slotIndex);
    const i2 = slots.find((s) => s.prestaIndex === p2.slotIndex);
    if (!i1 || !i2) return;

    if (i1.arrivee !== '') {
      const arrivee = i1.arrivee;
      const installation = addMinutes(arrivee, 10);
      const debut = addMinutes(arrivee, 20);
      i1.arrivee = '';
      i1.installation = '';
      i2.arrivee = arrivee;
      i2.installation = installation;
      if (i2.maquillage !== '') i2.maquillage = debut;
      if (i2.coiffure !== '') i2.coiffure = debut;
    }

    const pi1 = prestas.indexOf(p1);
    const pi2 = prestas.indexOf(p2);
    [prestas[pi1], prestas[pi2]] = [prestas[pi2], prestas[pi1]];
    const si1 = slots.indexOf(i1);
    const si2 = slots.indexOf(i2);
    [slots[si1], slots[si2]] = [slots[si2], slots[si1]];

    this.recompute(state);
  }

  // --- Aide à l'affichage du tableau PDF (fusion de cellules) ---------------

  /** Champs horaires d'un slot dans l'ordre des colonnes du tableau. */
  slotCells(slot: PlanningSlot): string[] {
    return [
      slot.arrivee,
      slot.installation,
      slot.maquillage,
      slot.coiffure,
      slot.fin,
      slot.retouches,
      slot.disponibilite,
      slot.ceremonie,
    ];
  }
}
