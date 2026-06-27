import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Etape, Journee, Statut } from './core/models';
import { blankJournee } from './core/factories/journee.factory';
import { AuthService } from './core/services/auth.service';
import { DialogService } from './core/services/dialog.service';
import { PlanningStore } from './core/services/planning-store.service';
import { SettingsService } from './core/services/settings.service';
import { frenchLongDate, parseFrDate } from './core/utils/date.utils';
import { deepClone } from './core/utils/object.utils';
import { mariagesNetUrl, relanceBody, relanceSubject } from './core/utils/relance.utils';
import { Admin } from './features/admin/admin';
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
    Admin,
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
  private readonly settings = inject(SettingsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly docEditorRef = viewChild(DocumentEditor);
  private readonly planEditorRef = viewChild(PlanningEditor);

  protected readonly authenticated = this.auth.authenticated;
  protected readonly loading = this.store.loading;
  protected readonly error = this.store.error;
  protected readonly catalog = this.store.catalog;
  protected readonly upcoming = this.store.upcoming;

  /** Domaines : liste personnalisée en admin, sinon celle du backend. */
  protected readonly domaines = computed(() => this.settings.domaines() ?? this.store.domaines());

  protected readonly legendStatuts = LEGEND_STATUTS;
  protected readonly statutUi = STATUT_UI;

  /** Onglet de l'accueil : calendrier ou tableau de bord. */
  protected readonly homeTab = signal<'calendrier' | 'bilan'>('calendrier');

  /** Espace d'administration ouvert. */
  protected readonly adminOpen = signal(false);

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

  /** Une entrée d'historique « sentinelle » est en place (on est en sous-vue). */
  private armed = false;
  /** Ignore le prochain `popstate` (déclenché par notre propre `history.back`). */
  private ignorePop = false;

  protected passphrase = '';
  /** Dernière tentative de déverrouillage rejetée (mot de passe incorrect). */
  protected readonly authError = signal(false);

  constructor() {
    if (this.authenticated()) this.init();

    // Le bouton « retour » du navigateur / mobile remonte d'un niveau dans
    // l'app (éditeur → fiche → accueil) au lieu de quitter la page. On maintient
    // une entrée d'historique tant qu'une sous-vue est ouverte.
    effect(() => {
      const depth = this.viewDepth();
      untracked(() => this.syncHistory(depth));
    });

    const onPop = (): void => this.onPopState();
    window.addEventListener('popstate', onPop);
    this.destroyRef.onDestroy(() => window.removeEventListener('popstate', onPop));

    // Confirme avant un rechargement / une fermeture de l'app (utile sur mobile).
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (!this.authenticated()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    this.destroyRef.onDestroy(() => window.removeEventListener('beforeunload', onBeforeUnload));
  }

  // --- Administration --------------------------------------------------------

  protected openAdmin(): void {
    this.adminOpen.set(true);
  }

  protected closeAdmin(): void {
    this.adminOpen.set(false);
  }

  /** Nombre de jours avant un événement, en clair. */
  protected daysUntil(date: string): string {
    const target = parseFrDate(date);
    if (!target) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (diff <= 0) return "aujourd'hui";
    if (diff === 1) return 'demain';
    if (diff < 31) return `dans ${diff} jours`;
    const months = Math.round(diff / 30);
    return `dans ${months} mois`;
  }

  // --- Bouton retour matériel / navigateur ----------------------------------

  /** Profondeur de navigation : 0 accueil, 1 fiche/admin, 2 éditeur. */
  private viewDepth(): number {
    if (this.documentRequest() !== null || this.planningOpen()) return 2;
    if (this.selected() !== null || this.adminOpen()) return 1;
    return 0;
  }

  /** Met l'historique en phase avec la profondeur (pose/retire la sentinelle). */
  private syncHistory(depth: number): void {
    if (depth > 0 && !this.armed) {
      this.armed = true;
      history.pushState({ ccb: true }, '');
    } else if (depth === 0 && this.armed) {
      this.armed = false;
      this.ignorePop = true;
      history.back();
    }
  }

  private onPopState(): void {
    if (this.ignorePop) {
      this.ignorePop = false;
      return;
    }
    if (!this.armed) return; // pas en sous-vue : on laisse le navigateur agir
    this.armed = false; // notre sentinelle vient d'être consommée
    void this.goUp().then(() => this.syncHistory(this.viewDepth()));
  }

  /** Exécute l'action « retour » de la vue courante (avec garde-fou éventuel). */
  private async goUp(): Promise<void> {
    if (this.documentRequest() !== null) {
      const editor = this.docEditorRef();
      if (editor) await editor.attemptClose();
      else this.onDocumentClosed();
    } else if (this.planningOpen()) {
      const editor = this.planEditorRef();
      if (editor) await editor.attemptClose();
      else this.onPlanningClosed();
    } else if (this.adminOpen()) {
      this.adminOpen.set(false);
    } else if (this.selected() !== null) {
      await this.closeFiche();
    }
  }

  protected unlock(): void {
    this.auth.unlock(this.passphrase).subscribe((ok) => {
      if (ok) {
        this.passphrase = '';
        this.authError.set(false);
        this.init();
      } else {
        this.authError.set(true);
      }
    });
  }

  private init(): void {
    this.store.load();
    this.store.loadDomaines();
    this.store.loadCatalog();
  }

  // --- Documents (devis / facture) ------------------------------------------

  protected openDocument(request: DocumentRequest): void {
    // On inclut la copie de travail courante : ses devis/factures déjà créés
    // mais pas encore enregistrés doivent compter dans la numérotation.
    const numbers = this.store.nextNumbers(this.selected() ?? undefined);
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

  protected onDaySelected(target: { date: string; id?: number }): void {
    const events = this.store.entriesOn(target.date);
    // Si un identifiant d'événement est fourni (clic sur une ligne précise :
    // facture, résultat de recherche, prochain événement), on ouvre CET
    // événement, pas le premier du jour. Sinon (clic sur une case du
    // calendrier) on ouvre le premier et la navigation jour/événement prend le
    // relais.
    const index = target.id !== undefined ? events.findIndex((e) => e.id === target.id) : -1;
    if (index < 0 && target.id !== undefined) {
      // Événement ANNULÉ (exclu du calendrier) : on y accède via sa facture.
      const cancelled = this.store.journees().find((j) => j.id === target.id);
      if (cancelled) {
        this.eventIndex = 0;
        this.open(deepClone(cancelled));
        return;
      }
    }
    this.eventIndex = index >= 0 ? index : 0;
    this.open(events.length > 0 ? deepClone(events[this.eventIndex]) : blankJournee(target.date));
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

  protected async annulerFiche(): Promise<void> {
    const journee = this.selected();
    if (!journee) return;
    const ok = await this.dialog.confirm(
      'Annuler cet événement ? Ses factures restent comptées dans le bilan, mais il disparaît du planning (accessible via sa facture).',
    );
    if (!ok) return;
    journee.statut = Statut.Annule;
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
      if (next) this.onDaySelected({ date: next.journee.date, id: next.journee.id });
    } else {
      const limit = new Date(today);
      limit.setDate(limit.getDate() - 1);
      const previous = dated
        .filter((entry) => entry.date <= limit)
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      if (previous.length > 0) {
        const target = previous[previous.length - 1].journee;
        this.onDaySelected({ date: target.date, id: target.id });
      }
    }
  }

  protected openUpcoming(): void {
    const next = this.upcoming();
    if (next) this.onDaySelected({ date: next.date, id: next.id });
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
