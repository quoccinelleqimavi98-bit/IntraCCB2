import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  Artist,
  CatalogItem,
  Journee,
  Langue,
  Planning,
  PlanningPresta,
  PlanningSlot,
  SlotType,
} from '../../core/models';
import { DialogService } from '../../core/services/dialog.service';
import { PdfService } from '../../core/services/pdf.service';
import { PlanningService } from '../../core/services/planning.service';
import { PricingService } from '../../core/services/pricing.service';
import { SettingsService } from '../../core/services/settings.service';
import { formatAmount } from '../../core/utils/money.utils';
import { PlanningPdf } from './planning-pdf';
import { CLOE_ARTIST, DEFAULT_RENFORTS } from './planning.constants';
import { PlanningEditorState } from './planning.types';

/**
 * Éditeur du planning du jour-J : paramètres (date, cérémonie, fin), blocs par
 * artiste (prestations ordonnées), gestion des artistes et lieu, le tout avec un
 * aperçu imprimable en direct (`PlanningPdf`). Toute la logique de calcul des
 * horaires est déléguée au `PlanningService`.
 */
@Component({
  selector: 'app-planning-editor',
  imports: [FormsModule, PlanningPdf],
  templateUrl: './planning-editor.html',
  styleUrl: './planning-editor.scss',
})
export class PlanningEditor implements OnInit, AfterViewInit {
  private readonly planning = inject(PlanningService);
  private readonly pricing = inject(PricingService);
  private readonly pdf = inject(PdfService);
  private readonly dialog = inject(DialogService);
  private readonly settings = inject(SettingsService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly previewHost = viewChild<ElementRef<HTMLElement>>('previewHost');

  readonly journee = input.required<Journee>();
  readonly catalog = input<CatalogItem[]>([]);

  readonly saved = output<void>();
  readonly closed = output<void>();

  protected state!: PlanningEditorState;
  protected lang = Langue.Francais;

  /** Empreinte de l'état au chargement (détection des modifications). */
  private snapshot = '';

  /** Vue active sur mobile : formulaire ou aperçu. */
  protected readonly viewMode = signal<'form' | 'preview'>('form');
  /** Échelle d'affichage de l'aperçu (1 sur desktop, réduit sur mobile). */
  protected readonly previewScale = signal(1);

  ngOnInit(): void {
    const j = this.journee();
    const existing = j.planning;

    if (existing?.date) {
      this.state = {
        artists: existing.artistes.map((a) => ({ ...a })),
        slots: existing.slots.map((s) => ({ ...s })),
        prestas: existing.prestas.map((p) => ({ ...p })),
        ceremonie: j.mariage.ceremonie ?? existing.ceremonie ?? '',
        finPrestas: existing.finPrestas ?? '',
        date: existing.date,
        domaine: existing.domaine ?? '',
        adresse: existing.adresse ?? '',
        codepostal: existing.codepostal ?? '',
      };
    } else {
      const renforts = this.settings.artists() ?? DEFAULT_RENFORTS;
      const baseArtists = [CLOE_ARTIST, ...renforts];
      this.state = {
        artists: baseArtists.map((a) => ({ ...a })),
        slots: [],
        prestas: [],
        ceremonie: j.mariage.ceremonie ?? '',
        finPrestas: '',
        date: j.date,
        domaine: j.mariage.domaine ?? '',
        adresse: j.mariage.adresse ?? '',
        codepostal: j.mariage.codepostal ?? '',
      };
      this.planning.build(j.devis?.prestas ?? [], this.catalog(), this.state);
    }

    this.viewMode.set('preview'); // aperçu par défaut à l'ouverture
    this.snapshot = this.fingerprint();
  }

  private fingerprint(): string {
    return JSON.stringify({ state: this.state, lang: this.lang });
  }

  /** Retour : demande confirmation si modifs en cours. Renvoie `true` si la vue se ferme. */
  async attemptClose(): Promise<boolean> {
    if (this.fingerprint() === this.snapshot) {
      this.closed.emit();
      return true;
    }
    const choice = await this.dialog.confirmSave();
    if (choice === 'cancel') return false;
    if (choice === 'save') this.save();
    else this.closed.emit();
    return true;
  }

  ngAfterViewInit(): void {
    const host = this.previewHost()?.nativeElement;
    if (!host) return;
    const observer = new ResizeObserver(() => this.computeScale());
    observer.observe(host);
    this.destroyRef.onDestroy(() => observer.disconnect());
    this.computeScale();
  }

  protected setView(mode: 'form' | 'preview'): void {
    this.viewMode.set(mode);
    queueMicrotask(() => this.computeScale());
  }

  private computeScale(): void {
    const host = this.previewHost()?.nativeElement;
    if (!host) return;
    const available = host.clientWidth - 24;
    if (available < 50) return;
    this.previewScale.set(Math.max(0.3, Math.min(1, available / 595)));
  }

  // --- Lecture pour la vue ---------------------------------------------------

  /** Index des artistes ayant au moins une prestation (blocs d'édition). */
  protected get artistsWithPrestas(): number[] {
    const result: number[] = [];
    for (let i = 0; i < this.state.artists.length; i++) {
      if (this.planning.prestasOf(this.state, i).length > 0) result.push(i);
    }
    return result;
  }

  protected prestasOf(i: number): PlanningPresta[] {
    return this.planning.prestasOf(this.state, i);
  }

  protected artistName(artist: Artist): string {
    return `${artist.prenom} ${artist.nom}`.trim();
  }

  protected money(value: number | string): string {
    return formatAmount(value);
  }

  /** Gains d'un artiste : prestations + renforts (autres) / déplacements (Cloé). */
  protected calcGains(i: number): number {
    let total = 0;
    for (const presta of this.prestasOf(i)) {
      let prix = Math.trunc(Number(presta.prix ?? 0));
      if (presta.reduc) prix = prix - (prix * presta.reduc) / 100;
      total += Math.trunc(prix);
    }
    for (const presta of this.journee().devis?.prestas ?? []) {
      if (presta.qte === '?') continue;
      const nom = presta.nom ?? '';
      if (i !== 0 && nom.includes('renfort')) {
        total += Math.trunc(this.pricing.lineTotal(presta));
      } else if (i === 0 && nom.includes('Frais de déplacement') && !nom.includes('renfort')) {
        total += Math.trunc(this.pricing.lineTotal(presta));
      }
    }
    return total;
  }

  // --- Réactions aux saisies -------------------------------------------------

  protected calculer(): void {
    this.planning.recompute(this.state);
  }

  protected onCeremonie(): void {
    this.planning.onCeremonieChange(this.state);
  }

  protected onFinPrestas(): void {
    this.planning.onFinPrestasChange(this.state);
  }

  protected onArrivee(i: number): void {
    this.planning.onArriveeChange(this.state, i);
  }

  protected onRetouche(i: number): void {
    this.planning.onRetoucheChange(this.state, i);
  }

  protected onDispo(i: number): void {
    this.planning.onDispoChange(this.state, i);
  }

  protected onTime(presta: PlanningPresta): void {
    this.planning.onTimeChange(this.state, presta);
  }

  protected onArtist(presta: PlanningPresta): void {
    this.planning.changeArtist(this.state, presta, Number(presta.artisteIndex));
  }

  protected toggleType(presta: PlanningPresta, type: 'm' | 'c'): void {
    this.planning.toggleType(this.state, presta, type);
  }

  protected moveUp(i: number, x: number): void {
    this.planning.moveUp(this.state, i, x);
  }

  protected moveDown(i: number, x: number): void {
    this.planning.moveDown(this.state, i, x);
  }

  protected deletePresta(presta: PlanningPresta): void {
    this.planning.deletePresta(this.state, presta);
  }

  protected addPresta(i: number): void {
    this.planning.addPresta(this.state, i);
  }

  /** Slot (ligne d'horaire) associé à une prestation. */
  protected slotFor(presta: PlanningPresta): PlanningSlot | undefined {
    return this.state.slots.find((s) => s.prestaIndex === presta.slotIndex);
  }

  /** Libellé automatique d'une ligne (« Invitée N » / « Mariée »), pour le placeholder. */
  protected autoLabel(presta: PlanningPresta): string {
    const slot = this.slotFor(presta);
    if (!slot) return 'Invitée';
    if (slot.type === SlotType.Mariee) return 'Mariée';
    const siblings = this.planning.slotsOf(this.state, slot.artisteIndex);
    let n = 0;
    for (const s of siblings) {
      if (s.type === SlotType.Invitee) n++;
      if (s === slot) break;
    }
    return `Invitée ${n}`;
  }

  /** Plage horaire calculée d'une prestation (« 9h00 → 10h15 »). */
  protected timeRange(presta: PlanningPresta): string {
    const slot = this.slotFor(presta);
    if (!slot) return '';
    const start = slot.maquillage || slot.coiffure;
    if (!start && !slot.fin) return '';
    return `${start || '—'} → ${slot.fin || '—'}`;
  }

  /** Heure d'arrivée de l'artiste pour cette ligne (vide si non concernée). */
  protected arrivalOf(presta: PlanningPresta): string {
    return this.slotFor(presta)?.arrivee ?? '';
  }

  protected addArtist(): void {
    this.state.artists.push({
      prenom: '',
      nom: '',
      tel: '',
      mail: '',
      arrivee: '',
      retouches: '',
      disponibilite: '',
    });
  }

  protected deleteArtist(i: number): void {
    if (this.planning.prestasOf(this.state, i).length > 0) return;
    this.state.artists.splice(i, 1);
  }

  protected toggleLang(): void {
    this.lang = this.lang === Langue.Francais ? Langue.Anglais : Langue.Francais;
  }

  // --- Actions ---------------------------------------------------------------

  protected save(): void {
    const j = this.journee();
    const planning: Planning = {
      date: this.state.date || j.date,
      domaine: this.state.domaine,
      adresse: this.state.adresse,
      codepostal: this.state.codepostal,
      ceremonie: this.state.ceremonie,
      finPrestas: this.state.finPrestas,
      artistes: this.state.artists,
      slots: this.state.slots,
      prestas: this.state.prestas,
    };
    if (!j.mariage.ceremonie) j.mariage.ceremonie = this.state.ceremonie;
    j.planning = planning;
    // Fige le paiement prestataires (prestations du planning non à moi + frais
    // de déplacement renfort). Source unique pour toutes les autres parties :
    // ensuite, la part de Cloé se calcule sur le devis − ce montant.
    j.prestataires = this.pricing.computeProviders(planning, j.devis?.prestas ?? []);
    // Fige, sur chaque ligne du devis, le nombre d'unités confiées à un
    // prestataire (d'après le planning) → sert à scinder l'affichage (récap,
    // facture). Recalcul idempotent à chaque sauvegarde du planning.
    this.storeRenfortQte(j);
    this.saved.emit();
  }

  /** Annote chaque ligne du devis avec le nombre d'unités confiées au planning. */
  private storeRenfortQte(j: Journee): void {
    const counts = new Map<string, number>();
    for (const p of this.state.prestas) {
      if (p.artisteIndex !== 0 && p.nom) counts.set(p.nom, (counts.get(p.nom) ?? 0) + 1);
    }
    for (const presta of j.devis?.prestas ?? []) {
      const nom = presta.nom ?? '';
      const done = counts.get(nom) ?? 0;
      presta.renfortQte =
        done > 0 && presta.qte !== '?' && !presta.kilorly && !nom.includes('renfort')
          ? Math.min(done, Number(presta.qte))
          : undefined;
    }
  }

  protected async generatePdf(): Promise<void> {
    const element = this.host.nativeElement.querySelector<HTMLElement>('#htmlContent');
    if (element) await this.pdf.generate(element, this.filename());
  }

  private filename(): string {
    return `PLANNING_${(this.state.date || this.journee().date).replace(/\//g, '_')}`;
  }
}
