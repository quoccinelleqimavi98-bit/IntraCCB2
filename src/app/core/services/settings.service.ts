import { Injectable, computed, signal } from '@angular/core';

import { Artist, Domaine } from '../models';

/** Réglages « admin » persistés localement (localStorage). */
export interface AdminSettings {
  /** Abattement appliqué au net (0,24 = 24 %). */
  taxRate: number;
  /** Prix de base par nom de prestation (remplace celui du catalogue). */
  priceOverrides: Record<string, number>;
  /** Domaines ajoutés par l'utilisateur (en plus de ceux du backend). */
  domaines: Domaine[];
  /** Prestataires par défaut d'un nouveau planning (remplace ceux par défaut). */
  artists: Artist[];
}

const DEFAULTS: AdminSettings = {
  taxRate: 0.24,
  priceOverrides: {},
  domaines: [],
  artists: [],
};

const STORAGE_KEY = 'ccb-admin-settings';

/**
 * Paramètres d'administration de l'app (tarifs de base, domaines et
 * prestataires par défaut, taux brut/net). Persistés dans le navigateur —
 * le backend de référence (catalogue / domaines) étant en lecture seule, ces
 * réglages surchargent localement les données chargées.
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly _settings = signal<AdminSettings>(this.load());

  readonly settings = this._settings.asReadonly();
  readonly taxRate = computed(() => this._settings().taxRate);
  readonly domaines = computed(() => this._settings().domaines);
  readonly artists = computed(() => this._settings().artists);

  /** Prix de base surchargé pour une prestation, le cas échéant. */
  priceFor(nom: string): number | undefined {
    return this._settings().priceOverrides[nom];
  }

  /** Remplace l'intégralité des réglages et persiste. */
  replace(settings: AdminSettings): void {
    const clean: AdminSettings = {
      taxRate: Number.isFinite(settings.taxRate) ? settings.taxRate : DEFAULTS.taxRate,
      priceOverrides: settings.priceOverrides ?? {},
      domaines: settings.domaines ?? [],
      artists: settings.artists ?? [],
    };
    this._settings.set(clean);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    } catch {
      /* stockage indisponible : on garde les réglages en mémoire */
    }
  }

  private load(): AdminSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AdminSettings>) };
    } catch {
      /* ignore */
    }
    return { ...DEFAULTS };
  }
}
