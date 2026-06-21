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
  CatalogItem,
  DocumentMode,
  Etape,
  Facture,
  Journee,
  Langue,
  PaymentType,
  Presta,
  Statut,
} from '../../core/models';
import { PdfService } from '../../core/services/pdf.service';
import { PricingService } from '../../core/services/pricing.service';
import { DialogService } from '../../core/services/dialog.service';
import { formatAmount } from '../../core/utils/money.utils';
import { addDaysFr, todayFrDate } from '../../core/utils/date.utils';
import { DocumentPdf } from './document-pdf';
import { DocumentKind, DocumentValues } from './document.types';

/**
 * Éditeur d'un devis ou d'une facture : formulaire (au nouveau design) + aperçu
 * imprimable en direct (`DocumentPdf`). La logique de construction des lignes
 * (fusion catalogue / existant, acompte, solde) est reprise de l'app d'origine
 * et délègue tous les calculs au `PricingService`.
 */
@Component({
  selector: 'app-document-editor',
  imports: [FormsModule, DocumentPdf],
  templateUrl: './document-editor.html',
  styleUrl: './document-editor.scss',
})
export class DocumentEditor implements OnInit, AfterViewInit {
  private readonly pricing = inject(PricingService);
  private readonly pdf = inject(PdfService);
  private readonly dialog = inject(DialogService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly previewHost = viewChild<ElementRef<HTMLElement>>('previewHost');

  /** Empreinte de l'état éditable au chargement (pour détecter les modifications). */
  private snapshot = '';

  readonly journee = input.required<Journee>();
  readonly mode = input.required<DocumentKind>();
  readonly factureIndex = input(-1);
  readonly catalog = input<CatalogItem[]>([]);
  readonly nextDevis = input(1);
  readonly nextFacture = input(1);

  readonly saved = output<void>();
  readonly closed = output<void>();
  readonly removed = output<void>();

  protected readonly DocumentMode = DocumentMode;

  protected prestas: Presta[] = [];
  protected values: DocumentValues = {
    date: '',
    numero: '',
    annee: '',
    echeance: '',
    datePrestation: '',
    acompte: '',
    modePaiement: 'Virement',
    solde: '',
    realsold: '',
    paiementPrestas: 0,
  };
  protected lang = Langue.Francais;
  protected modedevis: 'Mariage' | 'Autre' = 'Mariage';
  protected acquittee = false;

  /** Vue active sur mobile : formulaire ou aperçu. */
  protected readonly viewMode = signal<'form' | 'preview'>('form');
  /** Échelle d'affichage de l'aperçu (1 sur desktop, réduit sur mobile). */
  protected readonly previewScale = signal(1);

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

  /** Met l'aperçu à l'échelle de la largeur réellement disponible (595px = pleine taille). */
  private computeScale(): void {
    const host = this.previewHost()?.nativeElement;
    if (!host) return;
    const available = host.clientWidth - 24; // padding du conteneur
    if (available < 50) return; // conteneur masqué : on garde l'échelle courante
    this.previewScale.set(Math.max(0.3, Math.min(1, available / 595)));
  }

  ngOnInit(): void {
    const data = this.journee();
    const now = todayFrDate();

    this.prestas = this.catalog().map((item) => ({ ...item, qte: 0 }));
    this.values = {
      date: now,
      numero: this.isDevis ? this.nextDevis() : this.nextFacture(),
      annee: String(new Date().getFullYear()),
      echeance: addDaysFr(now, 14),
      datePrestation: data.date,
      acompte: '',
      modePaiement: 'Virement',
      solde: '',
      realsold: '',
      paiementPrestas: 0,
    };

    if (this.isDevis) this.initDevis(data);
    else this.initFacture(data);

    this.snapshot = this.fingerprint();
  }

  /** Empreinte de l'état éditable, pour détecter une modification non enregistrée. */
  private fingerprint(): string {
    return JSON.stringify({
      prestas: this.prestas,
      values: this.values,
      lang: this.lang,
      modedevis: this.modedevis,
      acquittee: this.acquittee,
    });
  }

  /** Retour : demande confirmation si des modifications sont en cours. */
  protected async close(): Promise<void> {
    if (this.fingerprint() === this.snapshot) {
      this.closed.emit();
      return;
    }
    const choice = await this.dialog.confirmSave();
    if (choice === 'cancel') return;
    if (choice === 'save') this.save();
    else this.closed.emit();
  }

  protected get isDevis(): boolean {
    return this.mode() === DocumentMode.Devis;
  }

  protected get canAddDevisPrestas(): boolean {
    return !this.isDevis && this.journee().factures.length > 0;
  }

  // --- Construction de l'état -----------------------------------------------

  private initDevis(data: Journee): void {
    const devis = data.devis;
    for (const presta of devis?.prestas ?? []) this.mergePresta(presta);
    if (devis?.creation) this.values.date = devis.creation;
    if (devis?.numero !== undefined) this.values.numero = devis.numero;
    if (devis?.annee) this.values.annee = devis.annee;
    if (devis?.echeance) this.values.echeance = devis.echeance;
  }

  private initFacture(data: Journee): void {
    const idx = this.factureIndex();

    if (idx !== -1) {
      const facture = data.factures[idx];
      for (const presta of facture.prestas ?? []) this.mergePresta(presta);
      if (facture.type) this.values.modePaiement = facture.type;
      if (facture.creation) this.values.date = facture.creation;
      if (facture.numero !== undefined) this.values.numero = facture.numero;
      if (facture.annee) this.values.annee = facture.annee;
      if (facture.solde !== undefined) this.values.solde = facture.solde;
      if (facture.realsold !== undefined) this.values.realsold = facture.realsold;
      if (facture.paiementPrestas !== undefined)
        this.values.paiementPrestas = facture.paiementPrestas;
      let prior = 0;
      for (let i = 0; i < idx; i++) prior += this.factureContribution(data.factures[i]);
      this.values.acompte = prior;
    } else if (data.factures.length === 0) {
      this.prestas.push({
        qte: 1,
        nom: 'Paiement Arrhes',
        prix: this.pricing.arrhes(data.devis?.prestas ?? []),
        reduc: 0,
      });
    } else {
      this.addDevisToFacture(data);
      if (!data.factures.some((f) => f.paiementPrestas)) {
        let providers = 0;
        for (const presta of data.planning?.prestas ?? []) {
          if (presta.artisteIndex !== 0) providers += Number(presta.prix ?? 0);
        }
        for (const presta of data.devis?.prestas ?? []) {
          if (presta.nom?.includes('renfort')) providers += this.pricing.lineTotal(presta);
        }
        this.values.paiementPrestas = providers;
        this.values.solde = this.total() - Number(this.values.acompte || 0) - providers;
        this.values.realsold = 0;
      }
    }
  }

  /** Fusionne une prestation existante dans la liste (catalogue ou ligne libre). */
  private mergePresta(presta: Presta): void {
    const match = this.prestas.find((p) => !p.titre && !!p.nom && presta.nom.includes(p.nom));
    if (match) {
      match.qte = presta.qte;
      match.prix = presta.prix;
      match.reduc = presta.reduc ?? 0;
      match.nom = presta.nom;
    } else {
      const extra: Presta = {
        qte: presta.qte,
        nom: presta.nom,
        prix: presta.prix,
        reduc: presta.reduc ?? 0,
      };
      if (presta.kilorly || presta.nom.includes('Frais de déplacement')) extra.kilorly = true;
      this.prestas.push(extra);
    }
  }

  /** Reprend les lignes du devis dans la facture et calcule l'acompte déjà versé. */
  private addDevisToFacture(data: Journee): void {
    const arrhes = this.prestas.find((p) => p.nom === 'Paiement Arrhes');
    if (arrhes) arrhes.qte = 0;
    for (const presta of data.devis?.prestas ?? []) this.mergePresta(presta);

    let prior = 0;
    for (const facture of data.factures) {
      prior += this.factureContribution(facture);
      for (const presta of facture.prestas) {
        const match = this.prestas.find(
          (p) =>
            p.nom === presta.nom && p.prix === presta.prix && Number(p.qte) === Number(presta.qte),
        );
        if (match) match.qte = 0;
      }
    }
    this.values.acompte = prior;
  }

  private factureContribution(facture: Facture): number {
    if (facture.solde) return this.pricing.factureSold(facture);
    let sum = 0;
    for (const presta of facture.prestas) sum += this.pricing.lineTotal(presta);
    return sum;
  }

  // --- Édition de la liste ---------------------------------------------------

  protected addQte(presta: Presta): void {
    if (presta.qte !== '?') presta.qte = Number(presta.qte) + 1;
  }

  protected removeQte(presta: Presta): void {
    if (presta.qte !== '?' && Number(presta.qte) > 0) presta.qte = Number(presta.qte) - 1;
  }

  protected canDecrement(presta: Presta): boolean {
    return presta.qte !== '?' && Number(presta.qte) > 0;
  }

  protected addPresta(): void {
    this.prestas.push({ nom: '', qte: 0, prix: 50, reduc: 0 });
  }

  protected deleteAll(): void {
    for (const presta of this.prestas) presta.qte = 0;
  }

  protected addDevisPrestas(): void {
    this.addDevisToFacture(this.journee());
  }

  protected toggleLang(): void {
    this.lang = this.lang === Langue.Francais ? Langue.Anglais : Langue.Francais;
  }

  protected toggleModedevis(): void {
    this.modedevis = this.modedevis === 'Mariage' ? 'Autre' : 'Mariage';
  }

  // --- Calculs d'affichage ---------------------------------------------------

  protected total(): number {
    return this.pricing.total(this.prestas);
  }

  protected lineLabel(presta: Presta): string {
    return this.pricing.lineLabel(presta);
  }

  protected money(value: number | string): string {
    return formatAmount(value);
  }

  // --- Actions ---------------------------------------------------------------

  protected save(): void {
    const data = this.journee();
    const kept = this.prestas.filter((p) => p.qte === '?' || Number(p.qte) > 0);

    if (this.isDevis) {
      data.devis = {
        prestas: kept,
        creation: this.values.date,
        numero: Number(this.values.numero),
        annee: this.values.annee,
        echeance: this.values.echeance,
      };
      if (data.etape === Etape.Devis) data.etape = Etape.Arrhes;
    } else {
      const acompte = this.values.acompte !== '' ? Number(this.values.acompte) : 0;
      let solde = this.total() - acompte;
      if (this.values.solde !== '') solde = Number(this.values.solde);

      const facture: Facture = {
        prestas: kept,
        creation: this.values.date,
        numero: Number(this.values.numero),
        annee: this.values.annee,
        solde,
      };
      if (this.values.modePaiement) facture.type = this.values.modePaiement as PaymentType;
      const providers = Number(this.values.paiementPrestas);
      if (providers) facture.paiementPrestas = providers;
      if (this.values.realsold !== '' && Number(this.values.realsold) !== 0) {
        facture.realsold = Number(this.values.realsold);
      }

      if (data.factures.length === 0) {
        data.etape = Etape.Solde;
        if (data.statut === Statut.Demande) data.statut = Statut.Reserve;
      }
      if (this.factureIndex() === -1) data.factures.push(facture);
      else data.factures[this.factureIndex()] = facture;
    }

    this.saved.emit();
  }

  protected async generatePdf(): Promise<void> {
    const element = this.host.nativeElement.querySelector<HTMLElement>('#htmlContent');
    if (element) await this.pdf.generate(element, this.filename());
  }

  private filename(): string {
    const num = String(Number(this.values.numero)).padStart(3, '0');
    return `${this.isDevis ? 'DEVIS' : 'FACTURE'}_${num}_${this.values.annee}`;
  }
}
