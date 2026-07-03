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
  Devis,
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
import { SettingsService } from '../../core/services/settings.service';
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
  private readonly settings = inject(SettingsService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly previewHost = viewChild<ElementRef<HTMLElement>>('previewHost');

  /** Empreinte de l'état éditable au chargement (pour détecter les modifications). */
  private snapshot = '';

  readonly journee = input.required<Journee>();
  readonly mode = input.required<DocumentKind>();
  readonly factureIndex = input(-1);
  /** Index du devis à éditer dans `devisList` (-1 = nouveau devis ou avenant). */
  readonly devisIndex = input(-1);
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

    this.prestas = this.catalog().map((item) => ({
      ...item,
      prix: item.titre ? item.prix : (this.settings.priceFor(item.nom) ?? item.prix),
      qte: 0,
    }));
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

    if (this.isDevis) this.initDevis();
    else this.initFacture(data);

    // Aperçu par défaut ; édition à la création d'un devis/avenant.
    const newDevis = this.isDevis && this.devisIndex() === -1;
    this.viewMode.set(newDevis ? 'form' : 'preview');

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

  protected get isDevis(): boolean {
    return this.mode() === DocumentMode.Devis;
  }

  /** Liste des devis de la journée (initial puis avenants). */
  private get devisList(): Devis[] {
    const j = this.journee();
    if (j.devisList && j.devisList.length) return j.devisList;
    return j.devis ? [j.devis] : [];
  }

  /**
   * Vrai si ce devis est un avenant (et non le devis initial) : c'est le seul
   * cas où l'on gère un prestataire (bascule Moi/Presta, duplication…). Édition :
   * avenant si index ≥ 1. Création (index −1) : avenant s'il existe déjà un devis.
   */
  protected get isAvenant(): boolean {
    if (!this.isDevis) return false;
    const idx = this.devisIndex();
    return idx >= 0 ? idx >= 1 : this.devisList.length >= 1;
  }

  protected get canAddDevisPrestas(): boolean {
    return !this.isDevis && this.journee().factures.length > 0;
  }

  // --- Construction de l'état -----------------------------------------------

  private initDevis(): void {
    const idx = this.devisIndex();
    const list = this.devisList;

    if (idx >= 0 && idx < list.length) {
      // Édition d'un devis existant : on charge ses lignes et son en-tête.
      const devis = list[idx];
      for (const presta of devis.prestas ?? []) this.mergePresta(presta);
      if (devis.creation) this.values.date = devis.creation;
      if (devis.numero !== undefined) this.values.numero = devis.numero;
      if (devis.annee) this.values.annee = devis.annee;
      if (devis.echeance) this.values.echeance = devis.echeance;
    } else if (this.isAvenant) {
      // Nouvel avenant : pré-rempli avec les prestations du DERNIER devis, mais
      // avec un nouveau numéro / une nouvelle date (déjà dans `values`).
      const source = list[list.length - 1];
      for (const presta of source?.prestas ?? []) this.mergePresta(presta);
    }
    // Sinon : tout premier devis (initial) — on part du catalogue vierge.
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
      let prior = 0;
      for (let i = 0; i < idx; i++) prior += this.factureContribution(data.factures[i]);
      this.values.acompte = prior;
    } else if (data.factures.length === 0) {
      this.prestas.push({
        qte: 1,
        nom: 'Paiement Arrhes',
        prix: this.pricing.arrhes(this.pricing.lastDevis(data)?.prestas ?? []),
        reduc: 0,
      });
    } else {
      this.addDevisToFacture(data);
      this.values.realsold = 0;
      this.refreshSolde();
    }
  }

  /** Fusionne une prestation existante dans la liste (catalogue ou ligne libre). */
  private mergePresta(presta: Presta): void {
    // Une ligne « part renfort » et la même prestation « part à moi » sont
    // distinctes : on n'agrège que si le drapeau renfort correspond aussi.
    const match = this.prestas.find(
      (p) => !p.titre && !!p.nom && presta.nom.includes(p.nom) && !!p.renfort === !!presta.renfort,
    );
    if (match) {
      match.qte = presta.qte;
      match.prix = presta.prix;
      match.reduc = presta.reduc ?? 0;
      match.nom = presta.nom;
      if (presta.fullKm) match.fullKm = true;
      match.renfort = presta.renfort;
    } else {
      const extra: Presta = {
        qte: presta.qte,
        nom: presta.nom,
        prix: presta.prix,
        reduc: presta.reduc ?? 0,
      };
      if (presta.kilorly || presta.nom.includes('Frais de déplacement')) extra.kilorly = true;
      if (presta.fullKm) extra.fullKm = true;
      if (presta.renfort) extra.renfort = true;
      this.prestas.push(extra);
    }
  }

  /**
   * Reprend UNIQUEMENT MES lignes du dernier devis dans la facture (les parts
   * prestataire en sont exclues : elles sont réglées à part) et calcule l'acompte
   * déjà versé. La facture ne concerne donc jamais le prestataire.
   */
  private addDevisToFacture(data: Journee): void {
    const arrhes = this.prestas.find((p) => p.nom === 'Paiement Arrhes');
    if (arrhes) arrhes.qte = 0;

    for (const presta of this.pricing.myPrestas(this.pricing.lastDevis(data)?.prestas ?? [])) {
      this.mergePresta({ ...presta });
    }

    // Le déjà-versé est déduit via l'acompte (la facture porte mon total complet).
    let prior = 0;
    for (const facture of data.factures) prior += this.factureContribution(facture);
    this.values.acompte = prior;
  }

  /** Vrai si la ligne est une part prestataire (drapeau renfort ou intitulé). */
  protected isRenfort(presta: Presta): boolean {
    return presta.renfort === true || (presta.nom ?? '').includes('renfort');
  }

  /** Bascule une ligne entre « ma part » et « part prestataire » et recalcule. */
  protected toggleRenfort(presta: Presta): void {
    presta.renfort = !this.isRenfort(presta);
    this.refreshSolde();
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
    this.refreshSolde();
  }

  protected removeQte(presta: Presta): void {
    if (presta.qte !== '?' && Number(presta.qte) > 0) presta.qte = Number(presta.qte) - 1;
    this.refreshSolde();
  }

  /**
   * Recalcule le solde = MON total (somme de mes prestations) − tout ce qui a
   * déjà été payé (= acompte, somme des soldes des factures antérieures).
   * Appelé à chaque modification d'une ligne (quantité, prix, réduction).
   */
  protected refreshSolde(): void {
    if (this.isDevis) return;
    const acompte = this.values.acompte !== '' ? Number(this.values.acompte) : 0;
    this.values.solde = this.pricing.myTotal(this.prestas) - acompte;
  }

  protected canDecrement(presta: Presta): boolean {
    return presta.qte !== '?' && Number(presta.qte) > 0;
  }

  protected addPresta(): void {
    this.prestas.push({ nom: '', qte: 0, prix: 50, reduc: 0 });
  }

  /**
   * Duplique une ligne (copie insérée juste en dessous).
   *
   * Sur un devis (initial OU avenant), dupliquer confie une part au prestataire :
   * la nouvelle ligne démarre à 1 et passe automatiquement en « prestataire » ; si
   * ma ligne de base est ≥ 2, on lui en retire 1 (le total reste identique).
   * Sur une facture, simple copie de la ligne.
   */
  protected duplicatePresta(presta: Presta): void {
    const index = this.prestas.indexOf(presta);
    if (this.isDevis) {
      const base = Number(presta.qte);
      if (presta.qte !== '?' && base >= 2) presta.qte = base - 1;
      const copy: Presta = { ...presta, renfortQte: undefined, renfort: true, qte: 1 };
      this.prestas.splice(index + 1, 0, copy);
    } else {
      const copy: Presta = { ...presta, renfortQte: undefined };
      this.prestas.splice(index + 1, 0, copy);
    }
    this.refreshSolde();
  }

  /** Supprime une ligne de la facture. */
  protected removePresta(presta: Presta): void {
    const index = this.prestas.indexOf(presta);
    if (index !== -1) this.prestas.splice(index, 1);
    this.refreshSolde();
  }

  protected deleteAll(): void {
    for (const presta of this.prestas) presta.qte = 0;
    this.refreshSolde();
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

  /** Mon total (avenant) = somme de mes lignes, hors prestataire. */
  protected myTotal(): number {
    return this.pricing.myTotal(this.prestas);
  }

  /** Montant informatif revenant au prestataire (avenant). */
  protected providerTotal(): number {
    return this.pricing.providerTotal(this.prestas);
  }

  protected lineLabel(presta: Presta): string {
    return this.pricing.lineLabel(presta);
  }

  /**
   * Devis remplacé par cet avenant = celui qui précède dans la liste (création
   * d'un avenant → le dernier existant). `null` pour le devis initial.
   */
  protected replacedDevis(): { numero: string; date: string } | null {
    if (!this.isDevis) return null;
    const list = this.devisList;
    const idx = this.devisIndex();
    const prevIndex = idx === -1 ? list.length - 1 : idx - 1;
    if (prevIndex < 0 || prevIndex >= list.length) return null;
    const prev = list[prevIndex];
    const numero = String(prev.numero ?? '').padStart(3, '0') + '-' + (prev.annee ?? '');
    return { numero, date: prev.creation ?? '' };
  }

  /** Paiements déjà effectués (factures antérieures à celle-ci) : date + montant. */
  protected priorPayments(): { date: string; montant: number }[] {
    if (this.isDevis) return [];
    const data = this.journee();
    const idx = this.factureIndex();
    const end = idx === -1 ? data.factures.length : idx;
    const out: { date: string; montant: number }[] = [];
    for (let i = 0; i < end; i++) {
      const f = data.factures[i];
      out.push({ date: f.creation ?? '', montant: this.factureContribution(f) });
    }
    return out;
  }

  protected money(value: number | string): string {
    return formatAmount(value);
  }

  // --- Actions ---------------------------------------------------------------

  protected save(): void {
    const data = this.journee();
    const kept = this.prestas.filter((p) => p.qte === '?' || Number(p.qte) > 0);

    if (this.isDevis) {
      const newDevis: Devis = {
        prestas: kept,
        creation: this.values.date,
        numero: Number(this.values.numero),
        annee: this.values.annee,
        echeance: this.values.echeance,
      };
      const list = this.devisList.slice();
      const idx = this.devisIndex();
      if (idx >= 0 && idx < list.length) list[idx] = newDevis; // édition d'un devis existant
      else list.push(newDevis); // nouveau (devis initial ou avenant)
      data.devisList = list;
      data.devis = list[list.length - 1]; // le dernier devis fait foi
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
