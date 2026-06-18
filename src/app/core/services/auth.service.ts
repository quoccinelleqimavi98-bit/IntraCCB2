import { Injectable, isDevMode, signal } from '@angular/core';

/**
 * Verrou d'accès à l'application.
 *
 * ⚠️ Sécurité : il s'agit d'un verrou « soft » côté client (comme l'app
 * d'origine, qui comparait un mot de passe en clair dans le bundle). Ce n'est
 * PAS une protection réelle — la véritable authentification doit être assurée
 * par l'API (voir docs/api-contract.md, section Auth). À brancher dans une étape
 * ultérieure ; en développement, l'accès est ouvert automatiquement.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _authenticated = signal(isDevMode());

  readonly authenticated = this._authenticated.asReadonly();

  /**
   * Déverrouille l'accès. Placeholder : accepte toute saisie non vide.
   * Sera remplacé par un appel d'authentification serveur.
   */
  unlock(passphrase: string): boolean {
    if (passphrase.trim().length === 0) return false;
    this._authenticated.set(true);
    return true;
  }

  lock(): void {
    this._authenticated.set(false);
  }
}
