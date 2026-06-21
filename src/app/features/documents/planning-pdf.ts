import { Component, inject, input } from '@angular/core';

import { Artist, Langue, PlanningSlot } from '../../core/models';
import { PlanningService } from '../../core/services/planning.service';
import { PLANNING_HEADERS, RETOUCHES_COL, SLOT_LABELS } from './planning.constants';
import { PlanningEditorState } from './planning.types';

/** Un artiste retenu pour l'affichage, avec son index d'origine. */
interface ArtistEntry {
  artist: Artist;
  index: number;
  rows: PlanningSlot[];
  /** Matrice des cellules horaires (lignes × 8 colonnes). */
  cells: string[][];
}

/**
 * Rendu imprimable du planning du jour-J (`#htmlContent`, capturé tel quel par
 * html2canvas). Reproduit fidèlement le format d'origine : en-têtes diagonaux,
 * tableau par artiste avec fusion de cellules (rowspan / colspan) sur les
 * horaires identiques. Composant purement présentationnel (détection par défaut
 * pour refléter en direct les saisies de l'éditeur).
 */
@Component({
  selector: 'app-planning-pdf',
  imports: [],
  templateUrl: './planning-pdf.html',
  styleUrl: './planning-pdf.scss',
})
export class PlanningPdf {
  private readonly planning = inject(PlanningService);

  readonly state = input.required<PlanningEditorState>();
  readonly lang = input.required<Langue>();

  protected readonly headers = PLANNING_HEADERS;
  protected readonly columns = [0, 1, 2, 3, 4, 5, 6, 7];

  protected fr(): boolean {
    return this.lang() === Langue.Francais;
  }

  /** Artistes ayant au moins une ligne, avec leur matrice de cellules. */
  protected entries(): ArtistEntry[] {
    const state = this.state();
    const result: ArtistEntry[] = [];
    for (let index = 0; index < state.artists.length; index++) {
      const rows = this.planning.slotsOf(state, index);
      if (rows.length === 0) continue;
      result.push({
        artist: state.artists[index],
        index,
        rows,
        cells: rows.map((slot) => this.planning.slotCells(slot)),
      });
    }
    return result;
  }

  /** Plusieurs artistes interviennent : on affiche leur nom sous chaque tableau. */
  protected multiArtist(): boolean {
    return this.entries().length > 1;
  }

  /** Libellé d'une ligne : nom personnalisé, sinon « Invitée N » / « Mariée ». */
  protected slotLabel(entry: ArtistEntry, i: number): string {
    const slot = entry.rows[i];
    if (slot.nomPerso) return slot.nomPerso;
    if (slot.type === 1) return this.fr() ? SLOT_LABELS.mariee.fr : SLOT_LABELS.mariee.en;
    const label = this.fr() ? SLOT_LABELS.invitee.fr : SLOT_LABELS.invitee.en;
    let n = 1;
    for (let x = 0; x < i; x++) if (entry.rows[x].type === slot.type) n++;
    return `${label} ${n}`;
  }

  /** Texte d'une cellule horaire (préfixe « Jusqu'à » / « Until » sur les retouches). */
  protected cellText(cells: string[][], i: number, j: number): string {
    const value = cells[i][j];
    if (!value) return '';
    if (j === RETOUCHES_COL) return `${this.fr() ? "Jusqu'à " : 'Until '}${value}`;
    return value;
  }

  /** Nombre de lignes fusionnées vers le bas (rowspan). */
  protected rowSpan(cells: string[][], i: number, j: number): number {
    const value = cells[i][j];
    let count = 1;
    for (let k = i + 1; k < cells.length; k++) {
      if (value !== '' && cells[k][j] === value) count++;
      else break;
    }
    return count;
  }

  /** Nombre de colonnes fusionnées vers la droite (colspan). */
  protected colSpan(cells: string[][], i: number, j: number): number {
    const value = cells[i][j];
    let count = 1;
    for (let k = j + 1; k < cells[i].length; k++) {
      if (value !== '' && cells[i][k] === value) count++;
      else break;
    }
    return count;
  }

  /** Cellule fusionnée dans une voisine (gauche ou haut) → masquée. */
  protected hidden(cells: string[][], i: number, j: number): boolean {
    const value = cells[i][j];
    if (value === '') return false;
    if (j > 0 && cells[i][j - 1] === value) return true;
    if (i > 0 && cells[i - 1][j] === value) return true;
    return false;
  }

  protected formatDate(value: string | undefined): string {
    if (!value) return '';
    if (this.fr()) return value;
    const [d, m, y] = value.split('/');
    return `${m}/${d}/${y}`;
  }

  protected artistName(artist: Artist): string {
    return `${artist.prenom} ${artist.nom}`;
  }
}
