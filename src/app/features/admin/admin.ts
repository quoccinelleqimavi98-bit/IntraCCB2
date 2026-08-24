import { Component, OnInit, computed, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Artist, Domaine } from '../../core/models';
import { PlanningStore } from '../../core/services/planning-store.service';
import {
  AdminSettings,
  DEFAULT_VAT_TEXT,
  SettingsService,
} from '../../core/services/settings.service';
import { DialogService } from '../../core/services/dialog.service';
import { DEFAULT_RENFORTS } from '../documents/planning.constants';

/**
 * Espace d'administration (sans mot de passe) : tarifs de base des prestations,
 * domaines de réception, renforts (prestataires hors Cloé), taux d'abattement
 * brut/net. Toutes ces données sont éditables (ajout / modification /
 * suppression) et persistées localement par le `SettingsService`.
 */
@Component({
  selector: 'app-admin',
  imports: [FormsModule],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin implements OnInit {
  private readonly settings = inject(SettingsService);
  private readonly store = inject(PlanningStore);
  private readonly dialog = inject(DialogService);

  readonly closed = output<void>();

  /** Prestations tarifables (hors titres de section). */
  protected readonly priced = computed(() =>
    this.store.catalog().filter((c) => !c.titre && c.prix !== undefined && c.prix !== null),
  );

  // État éditable (copie de travail, enregistrée explicitement).
  protected taxPercent = 24;
  protected priceInputs: Record<string, string> = {};
  protected domaines: Domaine[] = [];
  protected artists: Artist[] = [];
  protected vatTextFr = DEFAULT_VAT_TEXT.fr;
  protected vatTextEn = DEFAULT_VAT_TEXT.en;
  protected savedFlash = false;

  ngOnInit(): void {
    const s = this.settings.settings();
    this.taxPercent = Math.round(s.taxRate * 100);

    this.priceInputs = {};
    for (const [nom, prix] of Object.entries(s.priceOverrides)) {
      this.priceInputs[nom] = String(prix);
    }

    // Domaines : liste personnalisée si elle existe, sinon celle du backend.
    const baseDomaines = s.domaines ?? this.store.domaines();
    this.domaines = baseDomaines.map((d) => ({ ...d }));

    // Renforts : liste personnalisée si elle existe, sinon les renforts par défaut.
    const baseArtists = s.artists ?? DEFAULT_RENFORTS;
    this.artists = baseArtists.map((a) => ({ ...a }));

    const vatText = s.vatText ?? DEFAULT_VAT_TEXT;
    this.vatTextFr = vatText.fr;
    this.vatTextEn = vatText.en;
  }

  protected addDomaine(): void {
    this.domaines.push({ domaine: '', adresse: '', codepostal: '', qte: 0 });
  }

  protected deleteDomaine(index: number): void {
    this.domaines.splice(index, 1);
  }

  protected addArtist(): void {
    this.artists.push({
      prenom: '',
      nom: '',
      tel: '',
      mail: '',
      arrivee: '',
      retouches: '',
      disponibilite: '',
    });
  }

  protected deleteArtist(index: number): void {
    this.artists.splice(index, 1);
  }

  protected save(): void {
    const priceOverrides: Record<string, number> = {};
    for (const [nom, raw] of Object.entries(this.priceInputs)) {
      const value = parseFloat(String(raw).replace(',', '.'));
      if (raw !== '' && !Number.isNaN(value)) priceOverrides[nom] = value;
    }

    const vatTextFr = this.vatTextFr.trim();
    const vatTextEn = this.vatTextEn.trim();

    const settings: AdminSettings = {
      taxRate: Math.min(1, Math.max(0, this.taxPercent / 100)),
      priceOverrides,
      domaines: this.domaines.filter((d) => d.domaine.trim() !== ''),
      artists: this.artists.filter((a) => `${a.prenom}${a.nom}`.trim() !== ''),
      vatText: vatTextFr && vatTextEn ? { fr: vatTextFr, en: vatTextEn } : null,
    };
    this.settings.replace(settings);

    this.savedFlash = true;
    setTimeout(() => (this.savedFlash = false), 1800);
  }

  protected async resetAll(): Promise<void> {
    const ok = await this.dialog.confirm(
      'Réinitialiser tous les réglages admin (retour aux valeurs par défaut) ?',
    );
    if (!ok) return;
    this.settings.replace({
      taxRate: 0.24,
      priceOverrides: {},
      domaines: null,
      artists: null,
      vatText: null,
    });
    this.ngOnInit();
  }
}
