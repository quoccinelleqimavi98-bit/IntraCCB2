import { Component, inject, input } from '@angular/core';

import { Client, DocumentMode, Langue, Presta } from '../../core/models';
import { PricingService } from '../../core/services/pricing.service';
import { SettingsService } from '../../core/services/settings.service';
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
  private readonly settings = inject(SettingsService);

  readonly mode = input.required<DocumentKind>();
  readonly lang = input.required<Langue>();
  readonly prestas = input.required<Presta[]>();
  readonly client = input.required<Client>();
  readonly values = input.required<DocumentValues>();
  readonly modedevis = input<'Mariage' | 'Autre'>('Mariage');
  readonly acquittee = input(false);
  /** Devis remplacé par un avenant (numéro formaté + date), sinon null. */
  readonly replaces = input<{ numero: string; date: string } | null>(null);
  /** Paiements déjà effectués (factures antérieures) : date + montant. */
  readonly priorPayments = input<{ date: string; montant: number }[]>([]);

  protected readonly emetteur = EMETTEUR;
  protected readonly bank = BANK;
  protected readonly DocumentMode = DocumentMode;

  protected fr(): boolean {
    return this.lang() === Langue.Francais;
  }

  /** Libellé « à définir » (quantité et total) selon la langue. */
  protected toDefine(): string {
    return this.fr() ? 'À définir' : 'To define';
  }

  /** Mention TVA (personnalisable via l'espace admin). */
  protected vatLabel(): string {
    const text = this.settings.vatText();
    return this.fr() ? text.fr : text.en;
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

  /** Prestations confiées au prestataire (affichées dans un 2e tableau distinct). */
  protected providerLines(): Presta[] {
    return this.visiblePrestas().filter((p) => this.isProvider(p));
  }

  /**
   * Lignes du tableau : sur une facture, uniquement les miennes. Sur un
   * devis/avenant, les miennes PUIS celles du prestataire, dans un seul tableau
   * séparé par la mention dédiée (voir `providerStart`).
   */
  protected orderedLines(): Presta[] {
    return this.isFacture() ? this.mineLines() : [...this.mineLines(), ...this.providerLines()];
  }

  /** Indice de la 1re ligne prestataire dans `orderedLines` (pour la séparation). */
  protected providerStart(): number {
    return this.mineLines().length;
  }

  protected lineTotal(presta: Presta): number {
    return this.pricing.lineTotal(presta);
  }

  /** Mon total = somme de MES prestations uniquement (jamais le prestataire). */
  protected total(): number {
    return this.pricing.total(this.mineLines());
  }

  /** Somme des prestations confiées au prestataire (info, hors de mon total). */
  protected providerTotal(): number {
    return this.pricing.providerTotal(this.visiblePrestas());
  }

  protected arrhes(): number {
    return this.pricing.arrhes(this.mineLines(), true);
  }

  protected money(value: number | string): string {
    return formatAmount(value);
  }

  protected qteLabel(presta: Presta): string {
    if (presta.qte === '?') return this.toDefine();
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
