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

import { Artist, CatalogItem, Journee, Langue, Planning, PlanningPresta } from '../../core/models';
import { DialogService } from '../../core/services/dialog.service';
import { PdfService } from '../../core/services/pdf.service';
import { PlanningService } from '../../core/services/planning.service';
import { PricingService } from '../../core/services/pricing.service';
import { formatAmount } from '../../core/utils/money.utils';
import { PlanningPdf } from './planning-pdf';
import { DEFAULT_ARTISTS } from './planning.constants';
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly previewHost = viewChild<ElementRef<HTMLElement>>('previewHost');

  readonly journee = input.required<Journee>();
  readonly catalog = input<CatalogItem[]>([]);

  readonly saved = output<void>();
  readonly closed = output<void>();

  protected state!: PlanningEditorState;
  protected lang = Langue.Francais;

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
      this.state = {
        artists: DEFAULT_ARTISTS.map((a) => ({ ...a })),
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

  protected async rename(presta: PlanningPresta): Promise<void> {
    const slot = this.state.slots.find((s) => s.prestaIndex === presta.slotIndex);
    if (!slot) return;
    const value = await this.dialog.prompt('Renommer cette ligne', slot.nomPerso ?? '');
    if (value === null) return;
    slot.nomPerso = value.trim() === '' ? undefined : value.trim();
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
    this.saved.emit();
  }

  protected async generatePdf(): Promise<void> {
    const element = this.host.nativeElement.querySelector<HTMLElement>('#htmlContent');
    if (element) await this.pdf.generate(element, this.filename());
  }

  private filename(): string {
    return `PLANNING_${(this.state.date || this.journee().date).replace(/\//g, '_')}`;
  }
}
