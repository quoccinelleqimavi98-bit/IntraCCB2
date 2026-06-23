import { Component, inject, input } from '@angular/core';

import { Client, DocumentMode, Langue, Presta } from '../../core/models';
import { PricingService } from '../../core/services/pricing.service';
import { formatAmount } from '../../core/utils/money.utils';
import { BANK, EMETTEUR } from './document.constants';
import { DocumentKind, DocumentValues } from './document.types';

/**
 * Rendu imprimable d'un devis ou d'une facture. Cet élément (`#htmlContent`) est
 * capturé tel quel par html2canvas → le format/visuel est repris à l'identique
 * de l'application d'origine. Composant purement présentationnel.
 *
 * Détection de changement par défaut (et valeurs dérivées via méthodes) afin que
 * l'aperçu reflète en direct les saisies de l'éditeur, qui mute les objets liés.
 */
@Component({
  selector: 'app-document-pdf',
  imports: [],
  templateUrl: './document-pdf.html',
  styleUrl: './document-pdf.scss',
})
export class DocumentPdf {
  private readonly pricing = inject(PricingService);

  readonly mode = input.required<DocumentKind>();
  readonly lang = input.required<Langue>();
  readonly prestas = input.required<Presta[]>();
  readonly client = input.required<Client>();
  readonly values = input.required<DocumentValues>();
  readonly modedevis = input<'Mariage' | 'Autre'>('Mariage');
  readonly acquittee = input(false);

  protected readonly emetteur = EMETTEUR;
  protected readonly bank = BANK;
  protected readonly DocumentMode = DocumentMode;

  protected fr(): boolean {
    return this.lang() === Langue.Francais;
  }

  protected visiblePrestas(): Presta[] {
    return this.prestas().filter((p) => p.qte === '?' || Number(p.qte) > 0);
  }

  /** Facture (par opposition au devis). */
  protected isFacture(): boolean {
    return this.mode() !== DocumentMode.Devis;
  }

  private isProvider(presta: Presta): boolean {
    return presta.renfort === true || (presta.nom ?? '').includes('renfort');
  }

  protected mineLines(): Presta[] {
    return this.visiblePrestas().filter((p) => !this.isProvider(p));
  }

  protected providerLines(): Presta[] {
    return this.visiblePrestas().filter((p) => this.isProvider(p));
  }

  /**
   * Lignes affichées : sur une facture, mes lignes d'abord, puis celles des
   * prestataires (réglées séparément). Ailleurs, ordre d'origine.
   */
  protected orderedLines(): Presta[] {
    if (!this.isFacture() || this.providerLines().length === 0) return this.visiblePrestas();
    return [...this.mineLines(), ...this.providerLines()];
  }

  /** Indice de la 1re ligne prestataire dans `orderedLines` (pour la séparation). */
  protected providerStart(): number {
    return this.mineLines().length;
  }

  protected lineTotal(presta: Presta): number {
    return this.pricing.lineTotal(presta);
  }

  protected total(): number {
    return this.pricing.total(this.prestas());
  }

  protected arrhes(): number {
    return this.pricing.arrhes(this.prestas(), true);
  }

  protected money(value: number | string): string {
    return formatAmount(value);
  }

  protected qteLabel(presta: Presta): string {
    if (presta.qte === '?') return this.fr() ? 'À definir' : 'To define';
    const n = presta.kilorly ? Number(presta.qte) * 2 : Number(presta.qte);
    const unit = presta.kilorly ? ' km' : presta.hourly ? ' h' : '';
    return `${n}${unit}`;
  }

  protected prixLabel(presta: Presta): string {
    const unit = presta.kilorly ? '/km' : presta.hourly ? '/h' : '';
    return `${formatAmount(presta.prix ?? 0)}${unit}€`;
  }

  protected reducLabel(presta: Presta): string {
    return presta.reduc && presta.reduc !== 0 ? `${presta.reduc}%` : '';
  }

  protected nameLabel(presta: Presta): string {
    return !this.fr() && presta.en ? presta.en : presta.nom;
  }

  /** Date formatée selon la langue (mm/dd/yyyy en anglais). */
  protected formatDate(value: string): string {
    if (!value) return '';
    if (this.fr()) return value;
    const [d, m, y] = value.split('/');
    return `${m}/${d}/${y}`;
  }

  /** Reste à payer (facture). */
  protected remaining(): number {
    const v = this.values();
    const solde = v.solde !== '' && v.solde !== undefined ? Number(v.solde) : this.total();
    return solde - Number(v.realsold || 0);
  }

  /** Numéro formaté « 012-2026 ». */
  protected numero(): string {
    const v = this.values();
    const n = Number(v.numero);
    const pad = (n < 100 ? '0' : '') + (n < 10 ? '0' : '');
    return `${pad}${v.numero}-${v.annee}`;
  }
}
