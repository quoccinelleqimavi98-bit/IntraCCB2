import { Injectable, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { CatalogItem, Domaine, Etape, Journee, Statut } from '../models';
import { compareFrDates, isPastFr, parseFrDate, yearOfFr } from '../utils/date.utils';
import { ApiService } from './api.service';

/**
 * Source de vérité de l'application : la liste des journées, exposée via signals.
 *
 * Les vues s'abonnent aux signaux (`journees`, `loading`, `error`) et aux
 * sélecteurs dérivés (`computed`) plutôt que de recalculer des tableaux à chaque
 * cycle de détection comme le faisait l'app d'origine.
 */
@Injectable({ providedIn: 'root' })
export class PlanningStore {
  private readonly api = inject(ApiService);

  private readonly _journees = signal<Journee[]>([]);
  private readonly _domaines = signal<Domaine[]>([]);
  private readonly _catalog = signal<CatalogItem[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _loaded = signal(false);

  /** Toutes les journées chargées. */
  readonly journees = this._journees.asReadonly();
  /** Domaines de réception référencés. */
  readonly domaines = this._domaines.asReadonly();
  /** Catalogue de prestations de base. */
  readonly catalog = this._catalog.asReadonly();
  /** Un chargement réseau est en cours. */
  readonly loading = this._loading.asReadonly();
  /** Message d'erreur du dernier chargement, le cas échéant. */
  readonly error = this._error.asReadonly();
  /** Vrai après le premier chargement réussi. */
  readonly loaded = this._loaded.asReadonly();

  /** Nombre de journées (exemple de sélecteur dérivé). */
  readonly count = computed(() => this._journees().length);

  /**
   * Entrées pour le BILAN : les journées (hors statut « essai ») plus une entrée
   * « essai » reconstruite à la date d'essai de chaque journée. Inclut les
   * événements annulés (leurs factures comptent toujours).
   */
  readonly statsEntries = computed<Journee[]>(() => {
    const base = this._journees().filter((j) => j.statut !== Statut.Essai);
    const essais: Journee[] = [];
    for (const j of base) {
      if (j.essai?.date) {
        essais.push({
          date: j.essai.date,
          statut: Statut.Essai,
          etape: isPastFr(j.essai.date) ? Etape.Termine : j.etape,
          client: j.client,
          essai: j.essai,
          mariage: j.mariage,
          factures: [],
        });
      }
    }
    return [...base, ...essais];
  });

  /**
   * Entrées du CALENDRIER : comme `statsEntries`, mais sans les événements
   * ANNULÉS (ils ne s'affichent ni au planning ni au clic sur le jour ; on n'y
   * accède qu'en cliquant sur leur facture dans le bilan).
   */
  readonly calendarEntries = computed<Journee[]>(() =>
    this.statsEntries().filter((j) => j.statut !== Statut.Annule),
  );

  /** Prochain événement à venir (le plus proche dans le futur), ou null. */
  readonly upcoming = computed<Journee | null>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = this.calendarEntries()
      .filter((j) => {
        const date = parseFrDate(j.date);
        return date !== null && date > today;
      })
      .sort((a, b) => compareFrDates(a.date, b.date));
    return future[0] ?? null;
  });

  /** Toutes les entrées (journées + essais) tombant un jour donné. */
  entriesOn(date: string): Journee[] {
    return this.calendarEntries().filter((j) => j.date === date);
  }

  /** Prochains numéros de devis et de facture pour l'année en cours. */
  nextNumbers(): { devis: number; facture: number } {
    const year = new Date().getFullYear();
    const journees = this._journees();

    const devisNums = journees
      .filter((j) => j.devis?.creation && yearOfFr(j.devis.creation) === year)
      .map((j) => Number(j.devis?.numero))
      .filter((n) => !Number.isNaN(n));

    const factureNums = journees
      .flatMap((j) => j.factures)
      .filter((f) => f.creation && yearOfFr(f.creation) === year)
      .map((f) => Number(f.numero))
      .filter((n) => !Number.isNaN(n));

    return {
      devis: (devisNums.length ? Math.max(...devisNums) : 0) + 1,
      facture: (factureNums.length ? Math.max(...factureNums) : 0) + 1,
    };
  }

  /** Charge (ou recharge) les journées depuis l'API. */
  load(): void {
    this._loading.set(true);
    this._error.set(null);
    this.api
      .getJournees()
      .pipe(finalize(() => this._loading.set(false)))
      .subscribe({
        next: (journees) => {
          this._journees.set(journees);
          this._loaded.set(true);
        },
        error: (err) => {
          this._error.set('Impossible de charger le planning.');
          console.error('[PlanningStore] load', err);
        },
      });
  }

  /** Charge la liste des domaines (référence statique). */
  loadDomaines(): void {
    if (this._domaines().length > 0) return;
    this.api.getDomaines().subscribe({
      next: (domaines) => this._domaines.set(domaines),
      error: (err) => console.error('[PlanningStore] domaines', err),
    });
  }

  /** Charge le catalogue de prestations. */
  loadCatalog(): void {
    if (this._catalog().length > 0) return;
    this.api.getCatalog().subscribe({
      next: (catalog) => this._catalog.set(catalog),
      error: (err) => console.error('[PlanningStore] catalogue', err),
    });
  }

  /** Crée ou met à jour une journée, puis recharge l'état. */
  save(journee: Journee): void {
    const request$ =
      journee.id === undefined ? this.api.createJournee(journee) : this.api.updateJournee(journee);

    request$.subscribe({
      next: () => this.load(),
      error: (err) => {
        this._error.set("Échec de l'enregistrement.");
        console.error('[PlanningStore] save', err);
      },
    });
  }

  /** Supprime une journée, puis recharge l'état. */
  remove(id: number): void {
    this.api.deleteJournee(id).subscribe({
      next: () => this.load(),
      error: (err) => {
        this._error.set('Échec de la suppression.');
        console.error('[PlanningStore] remove', err);
      },
    });
  }
}
