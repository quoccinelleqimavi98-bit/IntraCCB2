import { Injectable, signal } from '@angular/core';

/**
 * Conserve le mois/année affiché par le calendrier entre deux consultations.
 *
 * Le composant calendrier est détruit puis recréé quand on ouvre un événement ;
 * en gardant cet état dans un service singleton, on revient sur le DERNIER mois
 * consulté (retour, sauvegarde) plutôt que sur le mois courant à chaque fois.
 */
@Injectable({ providedIn: 'root' })
export class CalendarStateService {
  readonly year = signal(new Date().getFullYear());
  readonly monthIndex = signal(new Date().getMonth());
}
