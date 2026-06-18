import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Domaine, Journee, Statut } from '../../core/models';
import { maskFrDateInput } from '../../core/utils/date.utils';
import { statutClass, statutLabel } from '../../shared/statut-ui';
import { FrenchDatePipe } from '../../shared/pipes/french-date.pipe';

/**
 * Fiche d'une journée : consultation et édition des informations (client,
 * statut, essai, mariage) et actions associées.
 *
 * Le composant édite une **copie de travail** fournie par le parent (mutée via
 * `ngModel`) et délègue toutes les actions au parent via des sorties.
 * Devis / factures / planning / renseignements seront ajoutés à l'étape 3.
 */
@Component({
  selector: 'app-journee-detail',
  imports: [FormsModule, FrenchDatePipe],
  templateUrl: './journee-detail.html',
  styleUrl: './journee-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JourneeDetail {
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

  protected readonly Statut = Statut;

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

  /** Applique le domaine sélectionné aux champs « mariage ». */
  protected onDomainChange(event: Event): void {
    const index = Number((event.target as HTMLSelectElement).value);
    const domaine = this.domaines()[index];
    if (!domaine) return;
    this.data.mariage.domaine = domaine.domaine;
    this.data.mariage.adresse = domaine.adresse;
    this.data.mariage.codepostal = domaine.codepostal;
  }
}
