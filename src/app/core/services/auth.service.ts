import { Injectable, inject, isDevMode, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { ApiService } from './api.service';

/** Clé de mémorisation de la session (verrou déjà ouvert). */
const STORAGE_KEY = 'ccb-auth';

/**
 * Verrou d'accès à l'application.
 *
 * Le mot de passe est validé CÔTÉ SERVEUR (`ApiService.login` → `cloeauth.php`),
 * il n'est donc plus jamais présent dans le bundle. La session est mémorisée
 * (localStorage) pour ne pas re-verrouiller à chaque rafraîchissement.
 *
 * ⚠️ Cela reste un confort d'accès, pas une sécurité forte : la protection
 * réelle des données doit être assurée par l'API sur CHAQUE requête (un drapeau
 * local est contournable). En développement, l'accès est ouvert automatiquement.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly _authenticated = signal(this.restore());

  readonly authenticated = this._authenticated.asReadonly();

  /**
   * Déverrouille l'accès après validation serveur du mot de passe. Émet `true`
   * si le mot de passe est correct (et mémorise alors la session), sinon `false`.
   */
  unlock(passphrase: string): Observable<boolean> {
    return this.api.login(passphrase).pipe(
      tap((ok) => {
        if (ok) {
          this._authenticated.set(true);
          this.persist(true);
        }
      }),
    );
  }

  /** Re-verrouille l'accès et oublie la session mémorisée. */
  lock(): void {
    this._authenticated.set(false);
    this.persist(false);
  }

  private restore(): boolean {
    if (isDevMode()) return true;
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  private persist(value: boolean): void {
    try {
      if (value) localStorage.setItem(STORAGE_KEY, '1');
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* stockage indisponible : la session ne sera pas mémorisée */
    }
  }
}
