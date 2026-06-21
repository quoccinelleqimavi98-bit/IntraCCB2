import { PlanningState } from '../../core/services/planning.service';

/**
 * État de travail complet de l'éditeur de planning : l'état d'algorithme
 * (`PlanningState`) enrichi des informations de lieu et de la date du planning.
 */
export interface PlanningEditorState extends PlanningState {
  /** Date du planning au format jj/mm/aaaa. */
  date: string;
  domaine: string;
  adresse: string;
  codepostal: string;
}
