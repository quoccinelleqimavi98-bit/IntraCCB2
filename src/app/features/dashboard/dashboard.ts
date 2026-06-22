import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Statut } from '../../core/models';
import { PlanningStore } from '../../core/services/planning-store.service';
import { SettingsService } from '../../core/services/settings.service';
import { FactureLigne, StatsService } from '../../core/services/stats.service';
import { MONTHS_FR } from '../../core/utils/calendar.utils';
import { formatAmount } from '../../core/utils/money.utils';

/** Géométrie commune des deux graphes (coordonnées du viewBox SVG). */
const CHART = { w: 340, h: 170, padL: 6, padR: 6, padT: 12, padB: 22 } as const;
const PLOT_W = CHART.w - CHART.padL - CHART.padR;
const PLOT_H = CHART.h - CHART.padT - CHART.padB;

/** Palette des années, alignée sur la charte. */
const YEAR_COLORS = ['#aa82ba', '#5b7fb0', '#b0894e', '#6c8b65', '#a96fa3'];

interface SeriesView {
  year: number;
  color: string;
  line: string;
  cumLine: string;
  dots: Array<{ x: number; y: number }>;
  cumDots: Array<{ x: number; y: number }>;
}

/**
 * Tableau de bord financier : revenus, heures travaillées, estimations,
 * factures du mois et graphes annuels. Reprend les indicateurs de l'application
 * d'origine (calculés par `StatsService`) dans une présentation refondue,
 * responsive et filtrable par année / mois.
 */
@Component({
  selector: 'app-dashboard',
  imports: [FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly store = inject(PlanningStore);
  private readonly stats = inject(StatsService);
  private readonly settings = inject(SettingsService);

  /** Ouvre la journée correspondant à une date (clic sur une facture). */
  readonly daySelected = output<string>();

  protected readonly year = signal(new Date().getFullYear());
  /** Mois sélectionné (1–12) ou null pour toute l'année. */
  protected readonly month = signal<number | null>(null);

  protected readonly months = MONTHS_FR;
  protected readonly chartGeo = CHART;

  private readonly entries = this.store.calendarEntries;

  protected changeYear(delta: number): void {
    this.year.update((y) => y + delta);
  }

  protected onMonth(value: string): void {
    this.month.set(value === '' ? null : Number(value));
  }

  protected get periodLabel(): string {
    return this.month() === null ? 'année' : 'mois';
  }

  // --- Indicateurs -----------------------------------------------------------

  protected readonly alreadyPaid = computed(() =>
    this.stats.alreadyPaid(this.entries(), this.year(), this.month()),
  );
  protected readonly notPaid = computed(() =>
    this.stats.notPaid(this.entries(), this.year(), this.month()),
  );
  protected readonly helpers = computed(() =>
    this.stats.helpers(this.entries(), this.year(), this.month()),
  );
  protected readonly estimate = computed(() =>
    this.stats.estimate(this.entries(), this.year(), this.month()),
  );
  protected readonly total = computed(() =>
    this.stats.totalRevenue(this.entries(), this.year(), this.month()),
  );

  protected readonly hours = computed(() => {
    const e = this.entries();
    const y = this.year();
    const m = this.month();
    return {
      done: this.formatHours(e, y, m, false, true),
      upcoming: this.formatHours(e, y, m, true, false),
      period: this.formatHours(e, y, m, false, false),
    };
  });

  private formatHours(
    entries: ReturnType<typeof this.entries>,
    year: number,
    month: number | null,
    fromNow: boolean,
    untilNow: boolean,
  ): { time: string; rate: number } {
    const mins = this.stats.hoursWorked(entries, year, month, fromNow, untilNow);
    const rate = this.stats.perHour(entries, year, month, fromNow, untilNow);
    return { time: `${Math.trunc(mins / 60)}h ${mins % 60}min`, rate };
  }

  /** Montant net après abattement (taux configurable en admin). */
  protected net(amount: number): number {
    return Math.trunc(amount - amount * this.settings.taxRate());
  }

  // --- Compteurs de statuts --------------------------------------------------

  protected readonly counters = computed(() => {
    const e = this.entries();
    const y = this.year();
    const m = this.month();
    const reserve = this.stats.statutCount(e, Statut.Reserve, y, m);
    const demande = this.stats.statutCount(e, Statut.Demande, y, m);
    const essai = this.stats.statutCount(e, Statut.Essai, y, m);
    const autre = this.stats.statutCount(e, Statut.Autre, y, m);
    return [
      { label: 'Mariages', still: reserve.still, over: reserve.over, showOver: true },
      { label: 'Demandes', still: demande.still, over: demande.over, showOver: false },
      { label: 'Essais', still: essai.still, over: essai.over, showOver: true },
      { label: 'Autres', still: autre.still, over: autre.over, showOver: true },
    ];
  });

  protected readonly finished = computed(() =>
    this.stats.etapeCount(this.entries(), 999, this.year(), this.month()),
  );

  // --- Factures --------------------------------------------------------------

  protected readonly paidFactures = computed(() =>
    this.stats.monthFactures(this.entries(), this.year(), this.month()),
  );
  protected readonly missingFactures = computed(() =>
    this.stats.monthFacturesMissing(this.entries(), this.year(), this.month()),
  );

  // --- Graphes ---------------------------------------------------------------

  private readonly series = computed(() => this.stats.yearSeries(this.entries()));

  protected readonly chart = computed(() => {
    const series = this.series();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    let maxMonthly = 0;
    let maxCum = 0;
    const meta = series.map((s) => {
      const count = s.year >= currentYear ? Math.min(currentMonth, 12) : 12;
      for (let i = 0; i < count; i++) {
        if (s.monthly[i] > maxMonthly) maxMonthly = s.monthly[i];
        if (s.cumulative[i] > maxCum) maxCum = s.cumulative[i];
      }
      return { ...s, count };
    });
    maxMonthly = maxMonthly || 1;
    maxCum = maxCum || 1;

    const views: SeriesView[] = meta.map((s, idx) => {
      const monthlyDots = this.dots(s.monthly, maxMonthly, s.count);
      const cumDots = this.dots(s.cumulative, maxCum, s.count);
      return {
        year: s.year,
        color: YEAR_COLORS[idx % YEAR_COLORS.length],
        line: monthlyDots.map((d) => `${d.x},${d.y}`).join(' '),
        cumLine: cumDots.map((d) => `${d.x},${d.y}`).join(' '),
        dots: monthlyDots,
        cumDots,
      };
    });

    return { views, maxMonthly, maxCum, monthTicks: this.monthTicks() };
  });

  private dots(values: number[], max: number, count: number): Array<{ x: number; y: number }> {
    const out: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < count; i++) {
      out.push({
        x: CHART.padL + (i * PLOT_W) / 11,
        y: CHART.padT + PLOT_H - (values[i] / max) * PLOT_H,
      });
    }
    return out;
  }

  private monthTicks(): Array<{ x: number; label: string }> {
    return ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((label, i) => ({
      x: CHART.padL + (i * PLOT_W) / 11,
      label,
    }));
  }

  protected readonly axisY = CHART.padT + PLOT_H;

  protected money(value: number | string): string {
    return formatAmount(value);
  }

  protected openDay(ligne: FactureLigne): void {
    this.daySelected.emit(ligne.date);
  }
}
