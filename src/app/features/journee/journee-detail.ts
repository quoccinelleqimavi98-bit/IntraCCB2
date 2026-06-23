import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DocumentMode, Domaine, Etape, Facture, Journee, Presta, Statut } from '../../core/models';
import { PlanningStore } from '../../core/services/planning-store.service';
import { PricingService } from '../../core/services/pricing.service';
import { addDaysFr, maskFrDateInput, todayFrDate } from '../../core/utils/date.utils';
import { formatAmount } from '../../core/utils/money.utils';
import { statutClass, statutLabel } from '../../shared/statut-ui';
import { FrenchDatePipe } from '../../shared/pipes/french-date.pipe';
import { DocumentRequest } from '../documents/document.types';

/**
 * Fiche d'une journée : consultation et édition des informations (client,
 * statut, essai, mariage), accès aux documents (devis / factures) et
 * récapitulatif chiffré.
 *
 * Le composant édite une **copie de travail** fournie par le parent (mutée via
 * `ngModel`) et délègue toutes les actions au parent via des sorties.
 */
@Component({
  selector: 'app-journee-detail',
  imports: [FormsModule, FrenchDatePipe],
  templateUrl: './journee-detail.html',
  styleUrl: './journee-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JourneeDetail {
  private readonly pricing = inject(PricingService);
  private readonly store = inject(PlanningStore);

  /** Copie de travail de la journée à éditer. */
  readonly journee = input.required<Journee>();
  /** Domaines disponibles pour le pré-remplissage du lieu. */
  readonly domaines = input<Domaine[]>([]);
  /** Nombre d'événements le même jour (pour la navigation). */
  readonly sameDayCount = input(1);

  readonly saved = output<void>();
  readonly closed = output<void>();
  readonly removed = output<void>();
  readonly closedEvent = output<void>();
  readonly eventAdded = output<void>();
  readonly relanced = output<void>();
  readonly wentToWedding = output<void>();
  readonly dayChanged = output<number>();
  readonly eventChanged = output<number>();
  readonly openDocument = output<DocumentRequest>();
  readonly openPlanning = output<void>();

  protected readonly Statut = Statut;
  protected readonly Etape = Etape;

  protected readonly statutOptions: ReadonlyArray<{ value: Statut; label: string }> = [
    { value: Statut.Demande, label: 'Demande Mariage' },
    { value: Statut.Reserve, label: 'Mariage réservé' },
    { value: Statut.Autre, label: 'Autre (Shooting, Tournage, Animation..)' },
    { value: Statut.Perso, label: 'Perso' },
    { value: Statut.PersoFull, label: 'Perso (toute la journée)' },
  ];

  /** Accès direct à la copie de travail (objet muté par les formulaires). */
  protected get data(): Journee {
    return this.journee();
  }

  protected get isEssai(): boolean {
    return this.data.statut === Statut.Essai;
  }

  protected get isPerso(): boolean {
    return this.data.statut === Statut.Perso || this.data.statut === Statut.PersoFull;
  }

  protected get statutClass(): string {
    return statutClass(this.data.statut, this.data.etape);
  }

  protected get statutLabel(): string {
    return statutLabel(this.data.statut, this.data.etape);
  }

  protected maskDate(value: string | undefined): string {
    return maskFrDateInput(value ?? '');
  }

  /** Applique le domaine sélectionné aux champs « mariage » et aux frais de déplacement. */
  protected onDomainChange(event: Event): void {
    const index = Number((event.target as HTMLSelectElement).value);
    const domaine = this.domaines()[index];
    if (!domaine) return;
    this.data.mariage.domaine = domaine.domaine;
    this.data.mariage.adresse = domaine.adresse;
    this.data.mariage.codepostal = domaine.codepostal;
    this.applyTravelFee(domaine.qte);
  }

  /**
   * Crée ou met à jour la ligne « Frais de déplacement Jour-J » (km du domaine).
   * Si aucun devis n'existe encore, l'initialise (numéro, dates) comme l'app
   * d'origine, pour qu'il soit prêt à compléter.
   */
  private applyTravelFee(km: number): void {
    const travel = (): Presta => ({
      nom: 'Frais de déplacement Jour-J (Aller/Retour)',
      en: 'D-Day Travel Expenses (Round Trip)',
      kilorly: true,
      fullKm: true, // nouvelles lignes : tous les km facturés (plus d'offert)
      prix: 0.4,
      qte: km,
    });

    const devis = this.data.devis;
    if (devis?.creation && devis.prestas) {
      const existing = devis.prestas.find((p) => (p.nom ?? '').includes('déplacement Jour-J'));
      if (existing) existing.qte = km;
      else devis.prestas.push(travel());
    } else {
      const today = todayFrDate();
      this.data.devis = {
        annee: String(new Date().getFullYear()),
        creation: today,
        echeance: addDaysFr(today, 14),
        numero: this.store.nextNumbers().devis,
        prestas: [travel()],
      };
    }
  }

  // --- Documents & récapitulatif --------------------------------------------

  protected get hasDevis(): boolean {
    return !!this.data.devis?.creation;
  }

  protected get hasPlanning(): boolean {
    return !!this.data.planning?.date;
  }

  protected get devisPrestas(): Presta[] {
    return this.data.devis?.prestas ?? [];
  }

  protected lineLabel(presta: Presta): string {
    return this.pricing.lineLabel(presta);
  }

  /** Vrai si la ligne est une part prestataire (drapeau ou intitulé). */
  protected isProvider(presta: Presta): boolean {
    return presta.renfort === true || (presta.nom ?? '').includes('renfort');
  }

  /** Lignes du récap : mes prestations d'abord, puis les parts prestataires. */
  protected recapLines(): Presta[] {
    const split = this.pricing.splitProviders(this.devisPrestas);
    return [...split.filter((p) => !this.isProvider(p)), ...split.filter((p) => this.isProvider(p))];
  }

  /** Indice de la 1re ligne prestataire dans `recapLines` (−1 si aucune). */
  protected recapProviderStart(): number {
    const count = this.recapLines().filter((p) => this.isProvider(p)).length;
    return count > 0 ? this.recapLines().length - count : -1;
  }

  protected total(): number {
    return this.pricing.total(this.devisPrestas);
  }

  protected arrhes(): number {
    return this.pricing.arrhes(this.devisPrestas);
  }

  protected paid(): number {
    return this.pricing.paid(this.data);
  }

  protected providersPaid(): number {
    return this.pricing.providersPaid(this.data);
  }

  protected mine(): number {
    return this.pricing.mine(this.data);
  }

  /** Reste à payer pour le client = total du devis − déjà payé. */
  protected resteAPayer(): number {
    return this.total() - this.paid();
  }

  protected factureSold(facture: Facture): number {
    return this.pricing.factureSold(facture);
  }

  protected money(value: number | string): string {
    return formatAmount(value);
  }

  protected formatNum(value: number | string | undefined): string {
    return String(value ?? '').padStart(3, '0');
  }

  protected etapeLabel(): string {
    switch (this.data.etape) {
      case Etape.Devis:
        return 'Créer un devis';
      case Etape.Arrhes:
        return 'Facture arrhes';
      case Etape.Solde:
        return 'Facture finale';
      case Etape.Termine:
        return 'Événement terminé';
      default:
        return 'N/A';
    }
  }

  protected openDevis(): void {
    this.openDocument.emit({ mode: DocumentMode.Devis, factureIndex: -1 });
  }

  protected openFacture(index: number): void {
    this.openDocument.emit({ mode: DocumentMode.Facture, factureIndex: index });
  }

  protected clickEtape(): void {
    if (this.data.etape === Etape.Devis) this.openDevis();
    else this.openFacture(-1);
  }

  protected openPlanningDoc(): void {
    this.openPlanning.emit();
  }
}
