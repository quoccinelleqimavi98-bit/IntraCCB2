import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

/**
 * Boîtes de dialogue de l'application. Encapsule SweetAlert2 derrière une API
 * minimale afin de pouvoir en changer l'implémentation sans toucher aux vues.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  /** Demande une confirmation (oui / annuler). Résout à `true` si confirmé. */
  async confirm(text: string, title = 'Attention'): Promise<boolean> {
    const result = await Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Oui',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#aa82ba',
      cancelButtonColor: '#7c7184',
    });
    return result.isConfirmed;
  }

  /** Demande une saisie texte. Résout à la valeur, ou `null` si annulé. */
  async prompt(title: string, value = ''): Promise<string | null> {
    const result = await Swal.fire({
      title,
      input: 'text',
      inputValue: value,
      showCancelButton: true,
      confirmButtonText: 'Valider',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#aa82ba',
      cancelButtonColor: '#7c7184',
    });
    return result.isConfirmed ? (result.value ?? '') : null;
  }
}
