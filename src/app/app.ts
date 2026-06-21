import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Etape, Journee, Statut } from './core/models';
import { blankJournee } from './core/factories/journee.factory';
import { AuthService } from './core/services/auth.service';
import { DialogService } from './core/services/dialog.service';
import { PlanningStore } from './core/services/planning-store.service';
import { frenchLongDate, parseFrDate } from './core/utils/date.utils';
import { deepClone } from './core/utils/object.utils';
import { mariagesNetUrl, relanceBody, relanceSubject } from './core/utils/relance.utils';
import { Calendar } from './features/calendar/calendar';
import { Dashboard } from './features/dashboard/dashboard';
import { DocumentEditor } from './features/documents/document-editor';
import { DocumentRequest } from './features/documents/document.types';
import { PlanningEditor } from './features/documents/planning-editor';
import { JourneeDetail } from './features/journee/journee-detail';
import { FrenchDatePipe } from './shared/pipes/french-date.pipe';
import { LEGEND_STATUTS, STATUT_UI } from './shared/statut-ui';

/**
 * Composant racine — orchestre la navigation calendrier ⇆ fiche journée.
 * Détient la sélection courante (copie de travail) et délègue les calculs au
 * store et aux services.
 */
@Component({
  selector: 'app-root',
  imports: [
    FormsModule,
    Calendar,
    Dashboard,
    JourneeDetail,
    DocumentEditor,
    PlanningEditor,
    FrenchDatePipe,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly store = inject(PlanningStore);
  private readonly dialog = inject(DialogService);

  protected readonly authenticated = this.auth.authenticated;
  protected readonly loading = this.store.loading;
  protected readonly error = this.store.error;
  protected readonly domaines = this.store.domaines;
  protected readonly catalog = this.store.catalog;
  protected readonly upcoming = this.store.upcoming;

  protected readonly legendStatuts = LEGEND_STATUTS;
  protected readonly statutUi = STATUT_UI;

  /** Onglet de l'accueil : calendrier ou tableau de bord. */
  protected readonly homeTab = signal<'calendrier' | 'bilan'>('calendrier');

  /** Journée en cours d'édition (copie de travail), ou null sur le calendrier. */
  protected readonly selected = signal<Journee | null>(null);

  /** Document (devis/facture) ouvert par-dessus la fiche, ou null. */
  protected readonly documentRequest = signal<DocumentRequest | null>(null);
  protected readonly nextDevis = signal(1);
  protected readonly nextFacture = signal(1);

  /** Éditeur de planning ouvert par-dessus la fiche. */
  protected readonly planningOpen = signal(false);

  /** Nombre d'événements le même jour que la sélection. */
  protected readonly sameDayCount = computed(() => {
    const current = this.selected();
    return current ? this.store.entriesOn(current.date).length : 0;
  });

  private snapshot = '';
  private eventIndex = 0;

  protected passphrase = '';

  constructor() {
    if (this.authenticated()) this.init();
  }

  protected unlock(): void {
    if (this.auth.unlock(this.passphrase)) {
      this.passphrase = '';
      this.init();
    }
  }

  private init(): void {
    this.store.load();
    this.store.loadDomaines();
    this.store.loadCatalog();
  }

  // --- Documents (devis / facture) ------------------------------------------

  protected openDocument(request: DocumentRequest): void {
    const numbers = this.store.nextNumbers();
    this.nextDevis.set(numbers.devis);
    this.nextFacture.set(numbers.facture);
    this.documentRequest.set(request);
  }

  /** Le document a été appliqué à la copie de travail : retour à la fiche. */
  protected onDocumentSaved(): void {
    this.documentRequest.set(null);
  }

  protected onDocumentClosed(): void {
    this.documentRequest.set(null);
  }

  /** Suppression d'une facture depuis l'éditeur. */
  protected onDocumentRemoved(index: number): void {
    const journee = this.selected();
    if (journee && index >= 0) journee.factures.splice(index, 1);
    this.documentRequest.set(null);
  }

  // --- Planning du jour-J ---------------------------------------------------

  protected openPlanning(): void {
    this.planningOpen.set(true);
  }

  /** Le planning a été appliqué à la copie de travail : retour à la fiche. */
  protected onPlanningSaved(): void {
    this.planningOpen.set(false);
  }

  protected onPlanningClosed(): void {
    this.planningOpen.set(false);
  }

  // --- Sélection / ouverture d'une journée ----------------------------------

  protected onDaySelected(date: string): void {
    const events = this.store.entriesOn(date);
    this.eventIndex = 0;
    this.open(events.length > 0 ? deepClone(events[0]) : blankJournee(date));
  }

  private open(journee: Journee): void {
    this.selected.set(journee);
    this.snapshot = JSON.stringify(journee);
  }

  private hasUnsavedChanges(): boolean {
    const current = this.selected();
    return current !== null && JSON.stringify(current) !== this.snapshot;
  }

  private async confirmDiscard(): Promise<boolean> {
    if (!this.hasUnsavedChanges()) return true;
    return this.dialog.confirm(
      'Vous avez des modifications non enregistrées. Voulez-vous vraiment quitter ?',
    );
  }

  protected async closeFiche(): Promise<void> {
    if (!(await this.confirmDiscard())) return;
    this.selected.set(null);
  }

  // --- Actions CRUD ---------------------------------------------------------

  protected saveFiche(): void {
    const journee = this.selected();
    if (!journee) return;
    this.store.save(journee);
    this.selected.set(null);
  }

  protected cloturerFiche(): void {
    const journee = this.selected();
    if (!journee) return;
    journee.etape = Etape.Termine;
    this.store.save(journee);
    this.selected.set(null);
  }

  protected async removeFiche(): Promise<void> {
    const journee = this.selected();
    if (journee?.id === undefined) return;
    const ok = await this.dialog.confirm('Voulez-vous vraiment supprimer ces données ?');
    if (!ok) return;
    this.store.remove(journee.id);
    this.selected.set(null);
  }

  protected async addEvent(): Promise<void> {
    const journee = this.selected();
    if (!journee || !(await this.confirmDiscard())) return;
    this.eventIndex = 0;
    this.open(blankJournee(journee.date));
  }

  // --- Navigation entre événements / jours ----------------------------------

  protected async changeEvent(delta: number): Promise<void> {
    const current = this.selected();
    if (!current || !(await this.confirmDiscard())) return;
    const events = this.store.entriesOn(current.date);
    if (events.length === 0) return;
    let index = this.eventIndex + delta;
    if (index >= events.length) index = 0;
    else if (index < 0) index = events.length - 1;
    this.eventIndex = index;
    this.open(deepClone(events[index]));
  }

  protected async changeDay(delta: number): Promise<void> {
    const current = this.selected();
    if (!current || !(await this.confirmDiscard())) return;
    const today = parseFrDate(current.date);
    if (!today) return;

    const dated = this.store
      .calendarEntries()
      .map((journee) => ({ journee, date: parseFrDate(journee.date) }))
      .filter((entry): entry is { journee: Journee; date: Date } => entry.date !== null);

    if (delta > 0) {
      const limit = new Date(today);
      limit.setDate(limit.getDate() + 1);
      const next = dated
        .filter((entry) => entry.date >= limit)
        .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
      if (next) this.onDaySelected(next.journee.date);
    } else {
      const limit = new Date(today);
      limit.setDate(limit.getDate() - 1);
      const previous = dated
        .filter((entry) => entry.date <= limit)
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      if (previous.length > 0) this.onDaySelected(previous[previous.length - 1].journee.date);
    }
  }

  protected openUpcoming(): void {
    const next = this.upcoming();
    if (next) this.onDaySelected(next.date);
  }

  // --- Essai → mariage ------------------------------------------------------

  protected goToWedding(): void {
    const essai = this.selected();
    if (!essai) return;
    const wedding = this.store
      .journees()
      .find(
        (j) =>
          j.statut !== Statut.Essai &&
          j.essai?.date === essai.date &&
          j.client.nom === essai.client.nom,
      );
    if (wedding) this.open(deepClone(wedding));
  }

  // --- Relance --------------------------------------------------------------

  protected relance(): void {
    const journee = this.selected();
    if (!journee) return;
    const dateLabel = frenchLongDate(journee.date);
    const subject = encodeURIComponent(relanceSubject(dateLabel));
    const body = encodeURIComponent(relanceBody(journee.client.nom, dateLabel));

    if (journee.client.mail) {
      window.location.href = `mailto:${journee.client.mail}?subject=${subject}&body=${body}`;
    } else if (journee.mariagenet) {
      void navigator.clipboard.writeText(decodeURIComponent(body));
      window.open(mariagesNetUrl(journee.mariagenet), '_blank');
    } else {
      void navigator.clipboard.writeText(decodeURIComponent(body));
    }
  }
}
