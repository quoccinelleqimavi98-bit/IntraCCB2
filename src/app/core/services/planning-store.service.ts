import { Injectable, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { Journee } from '../models';
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
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _loaded = signal(false);

  /** Toutes les journées chargées. */
  readonly journees = this._journees.asReadonly();
  /** Un chargement réseau est en cours. */
  readonly loading = this._loading.asReadonly();
  /** Message d'erreur du dernier chargement, le cas échéant. */
  readonly error = this._error.asReadonly();
  /** Vrai après le premier chargement réussi. */
  readonly loaded = this._loaded.asReadonly();

  /** Nombre de journées (exemple de sélecteur dérivé). */
  readonly count = computed(() => this._journees().length);

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
