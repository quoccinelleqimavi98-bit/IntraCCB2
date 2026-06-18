import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthService } from './core/services/auth.service';
import { PlanningStore } from './core/services/planning-store.service';

/**
 * Composant racine — coquille applicative (étape 1 : fondations).
 *
 * Pour l'instant : verrou d'accès puis chargement de l'état. Les fonctionnalités
 * (calendrier, fiche journée, documents PDF, tableau de bord) viendront se
 * greffer ici dans les étapes suivantes.
 */
@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly store = inject(PlanningStore);

  protected readonly authenticated = this.auth.authenticated;
  protected readonly loading = this.store.loading;
  protected readonly error = this.store.error;
  protected readonly loaded = this.store.loaded;
  protected readonly count = this.store.count;

  protected passphrase = '';

  constructor() {
    if (this.authenticated()) this.store.load();
  }

  protected unlock(): void {
    if (this.auth.unlock(this.passphrase)) {
      this.passphrase = '';
      this.store.load();
    }
  }
}
