import { Injectable, computed, signal } from '@angular/core';

import { Artist, Domaine } from '../models';

/** Réglages « admin » persistés localement (localStorage). */
export interface AdminSettings {
  /** Abattement appliqué au net (0,24 = 24 %). */
  taxRate: number;
  /** Prix de base par nom de prestation (remplace celui du catalogue). */
  priceOverrides: Record<string, number>;
  /** Liste des domaines (null = non personnalisée → ceux du backend). */
  domaines: Domaine[] | null;
  /** Renforts (artistes hors Cloé) (null = non personnalisée → valeurs par défaut). */
  artists: Artist[] | null;
  /** Mention TVA (devis/factures) (null = non personnalisée → texte par défaut). */
  vatText: { fr: string; en: string } | null;
}

const DEFAULTS: AdminSettings = {
  taxRate: 0.24,
  priceOverrides: {},
  domaines: null,
  artists: null,
  vatText: null,
};

/** Mention TVA par défaut, affichée sur les devis et factures. */
export const DEFAULT_VAT_TEXT = {
  fr: 'TVA Non Applicable - article 293 B du CGI',
  en: 'VAT Not Applicable - Article 293 B of the French General Tax Code (CGI)',
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
  readonly vatText = computed(() => this._settings().vatText ?? DEFAULT_VAT_TEXT);

  /** Prix de base surchargé pour une prestation, le cas échéant. */
  priceFor(nom: string): number | undefined {
    return this._settings().priceOverrides[nom];
  }

  /** Remplace l'intégralité des réglages et persiste. */
  replace(settings: AdminSettings): void {
    const clean: AdminSettings = {
      taxRate: Number.isFinite(settings.taxRate) ? settings.taxRate : DEFAULTS.taxRate,
      priceOverrides: settings.priceOverrides ?? {},
      domaines: settings.domaines ?? null,
      artists: settings.artists ?? null,
      vatText: settings.vatText ?? null,
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
