import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Etape, Journee, Statut } from '../../core/models';
import { CalendarStateService } from '../../core/services/calendar-state.service';
import { PlanningStore } from '../../core/services/planning-store.service';
import {
  MONTHS_FR,
  WEEKDAYS_FR,
  daysInMonth,
  firstWeekdayOffset,
  toDateString,
} from '../../core/utils/calendar.utils';
import { compareFrDates, isPastFr, isTodayFr } from '../../core/utils/date.utils';
import { statutClass, statutLabel } from '../../shared/statut-ui';
import { FrenchDatePipe } from '../../shared/pipes/french-date.pipe';

interface DayCell {
  day: number;
  date: string;
  statutClass: string;
  name: string;
  isToday: boolean;
  isPast: boolean;
  missingEssai: boolean;
  missingPlanning: boolean;
  count: number;
}

interface SearchResult {
  journee: Journee;
  statutClass: string;
  statutLabel: string;
}

/** Calendrier en vue mensuelle, avec recherche globale en liste. */
@Component({
  selector: 'app-calendar',
  imports: [FormsModule, FrenchDatePipe],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Calendar {
  private readonly store = inject(PlanningStore);
  private readonly calState = inject(CalendarStateService);

  /** Ouverture d'une journée (date + identifiant d'événement précis si connu). */
  readonly daySelected = output<{ date: string; id?: number }>();

  protected readonly weekDays = WEEKDAYS_FR;
  protected readonly months = MONTHS_FR;
  // Mois/année affichés : conservés dans un service pour revenir sur le dernier
  // mois consulté après ouverture d'un événement (retour / sauvegarde).
  protected readonly year = this.calState.year;
  protected readonly monthIndex = this.calState.monthIndex;
  protected readonly search = signal('');

  /** Années sélectionnables (autour de l'année courante, sélection incluse). */
  protected readonly yearOptions = computed(() => {
    const base = new Date().getFullYear();
    const years = new Set<number>();
    for (let y = base - 4; y <= base + 4; y++) years.add(y);
    years.add(this.year());
    return [...years].sort((a, b) => a - b);
  });

  /** Clé de remontage de la grille (déclenche l'animation au changement de mois). */
  protected readonly gridKey = computed(() => `${this.year()}-${this.monthIndex()}`);

  private readonly byDate = computed(() => {
    const map = new Map<string, Journee[]>();
    const add = (date: string, entry: Journee) => {
      const list = map.get(date);
      if (list) list.push(entry);
      else map.set(date, [entry]);
    };
    for (const entry of this.store.calendarEntries()) {
      // L'événement apparaît sur sa date principale ET chacune de ses dates liées.
      add(entry.date, entry);
      for (const d of entry.linkedDates ?? []) add(d, entry);
    }
    return map;
  });

  /** Cellules du mois affiché (cases vides + jours), recalculées à la demande. */
  protected readonly cells = computed(() => {
    const year = this.year();
    const month = this.monthIndex();
    const term = this.search().trim().toLowerCase();
    const map = this.byDate();

    const days: DayCell[] = daysInMonth(year, month).map((day) => {
      const date = toDateString(day, month, year);
      let entries = map.get(date) ?? [];
      if (term) entries = entries.filter((e) => this.matches(e, term));
      const first = entries[0];
      const reserveActive =
        !!first && first.statut === Statut.Reserve && first.etape !== Etape.Termine;
      return {
        day,
        date,
        statutClass: first ? statutClass(first.statut, first.etape) : '',
        name: first?.client.nom ?? '',
        isToday: isTodayFr(date),
        isPast: isPastFr(date),
        missingEssai: reserveActive && !first.essai?.date,
        missingPlanning: reserveActive && !first.planning?.date,
        count: entries.length,
      };
    });

    return { blanks: Array.from({ length: firstWeekdayOffset(year, month) }), days };
  });

  /** Résultats de la recherche globale (toutes dates confondues). */
  protected readonly results = computed<SearchResult[]>(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return [];
    return this.store
      .calendarEntries()
      .filter((entry) => this.matches(entry, term))
      .sort((a, b) => compareFrDates(b.date, a.date)) // du futur vers le passé
      .map((journee) => ({
        journee,
        statutClass: statutClass(journee.statut, journee.etape),
        statutLabel: statutLabel(journee.statut, journee.etape),
      }));
  });

  private matches(entry: Journee, term: string): boolean {
    return JSON.stringify(entry).toLowerCase().includes(term);
  }

  protected prevMonth(): void {
    this.shiftMonth(-1);
  }

  protected nextMonth(): void {
    this.shiftMonth(1);
  }

  private shiftMonth(delta: number): void {
    const next = this.monthIndex() + delta;
    if (next < 0) {
      this.monthIndex.set(11);
      this.year.update((y) => y - 1);
    } else if (next > 11) {
      this.monthIndex.set(0);
      this.year.update((y) => y + 1);
    } else {
      this.monthIndex.set(next);
    }
  }

  protected goToday(): void {
    const now = new Date();
    this.year.set(now.getFullYear());
    this.monthIndex.set(now.getMonth());
    this.search.set('');
  }

  // --- Balayage (mobile) : mois précédent/suivant ---------------------------

  private touchX = 0;
  private touchY = 0;

  protected onTouchStart(event: TouchEvent): void {
    const t = event.changedTouches[0];
    this.touchX = t.clientX;
    this.touchY = t.clientY;
  }

  protected onTouchEnd(event: TouchEvent): void {
    const t = event.changedTouches[0];
    const dx = t.clientX - this.touchX;
    const dy = t.clientY - this.touchY;
    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    if (dx > 0)
      this.prevMonth(); // balayage vers la droite → mois précédent
    else this.nextMonth(); // balayage vers la gauche → mois suivant
  }

  /** Clic sur une case du calendrier : ouvre le premier événement du jour. */
  protected select(date: string): void {
    this.daySelected.emit({ date });
  }

  /** Clic sur un résultat de recherche : ouvre cet événement précis. */
  protected openResult(journee: Journee): void {
    this.daySelected.emit({ date: journee.date, id: journee.id });
  }
}
