import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, map, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { JourneeDto, PrestaDto } from '../dto/journee.dto';
import { journeeToDomain, journeeToDto } from '../mappers/journee.mapper';
import { CatalogItem, Domaine, Journee } from '../models';
import { parseAmount } from '../utils/money.utils';

/**
 * Accès à l'API. Unique point de contact réseau de l'application.
 *
 * Toutes les méthodes renvoient des modèles de DOMAINE (jamais des DTO) ; la
 * traduction est déléguée aux mappers. En production le front et l'API
 * partagent le même domaine : on utilise alors `HttpClient` (réponses lisibles,
 * gestion d'erreurs RxJS). Lorsque l'app est servie depuis une autre origine
 * (GitHub Pages), les écritures repassent par un `fetch` en `no-cors` comme
 * l'app d'origine, faute d'en-têtes CORS côté backend (voir `post`).
 *
 * Le contrat REST cible (quand le PHP sera réécrit) est décrit dans
 * docs/api-contract.md ; seul ce service et les mappers changeront alors.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /** Identifiant d'artiste attendu par l'API actuelle. */
  private readonly artiste = 'cloe';

  /**
   * Vrai si l'API est servie depuis une autre origine que la page (typiquement
   * l'app hébergée sur GitHub Pages, `chiyanoyuuki.github.io`, alors que l'API
   * reste sur `cloechaudronbeauty.com`). Dans ce cas les écritures POST ne
   * peuvent pas passer par `HttpClient` : avec un `Content-Type: application/json`
   * le navigateur déclenche un preflight CORS que le PHP n'autorise pas, et la
   * sauvegarde échoue. On bascule alors sur un `fetch` en mode `no-cors`.
   */
  private readonly crossOrigin = this.detectCrossOrigin();

  private detectCrossOrigin(): boolean {
    try {
      return new URL(this.baseUrl, window.location.href).origin !== window.location.origin;
    } catch {
      return false;
    }
  }

  /**
   * Valide un mot de passe côté serveur (endpoint `cloeauth.php`, qui compare à
   * un hash stocké sur le serveur — jamais dans le bundle). Renvoie `true` si
   * le mot de passe est correct.
   *
   * En multi-origine (GitHub Pages) la réponse n'est pas lisible (no-cors), on
   * retombe alors sur un verrou souple (toute saisie non vide) — la validation
   * serveur n'est possible qu'en même origine (déploiement /intraccb).
   */
  login(password: string): Observable<boolean> {
    if (this.crossOrigin) return of(password.trim().length > 0);
    return this.http
      .post<{ ok?: boolean }>(`${this.baseUrl}cloeauth.php`, { password })
      .pipe(
        map((res) => res?.ok === true),
        catchError(() => of(false)),
      );
  }

  /** Récupère toutes les journées du planning. */
  getJournees(): Observable<Journee[]> {
    return this.http
      .get<JourneeDto[]>(`${this.baseUrl}cloeplanning.php`, {
        params: { artiste: this.artiste },
      })
      .pipe(map((dtos) => dtos.map(journeeToDomain)));
  }

  /** Crée une nouvelle journée. */
  createJournee(journee: Journee): Observable<unknown> {
    return this.post('cloeplanningcreate.php', journeeToDto(journee));
  }

  /** Met à jour une journée existante. */
  updateJournee(journee: Journee): Observable<unknown> {
    return this.post('cloeplanningupdate.php', journeeToDto(journee));
  }

  /** Supprime une journée par son identifiant. */
  deleteJournee(id: number): Observable<unknown> {
    return this.post('cloeplanningdelete.php', { id });
  }

  /** Récupère le catalogue de prestations de base. */
  getCatalog(): Observable<CatalogItem[]> {
    return this.http
      .get<PrestaDto[]>(`${this.baseUrl}getintraccbdata.php`)
      .pipe(map((items) => items.map((item) => this.normalizeCatalogItem(item))));
  }

  /** Récupère la liste des domaines référencés (asset statique). */
  getDomaines(): Observable<Domaine[]> {
    return this.http.get<Domaine[]>('domaines.json');
  }

  private post(endpoint: string, body: unknown): Observable<unknown> {
    if (this.crossOrigin) {
      // Origine différente (GitHub Pages…) : l'API n'expose pas d'en-têtes CORS.
      // On envoie la requête en `no-cors`, comme l'ancien site : elle part et le
      // backend l'enregistre, mais la réponse est opaque (illisible). C'est un
      // envoi « fire-and-forget » — suffisant ici car on recharge ensuite.
      const url = `${this.baseUrl}${endpoint}?artiste=${this.artiste}`;
      return from(
        fetch(url, {
          method: 'POST',
          body: JSON.stringify(body),
          headers: { 'Content-Type': 'application/json' },
          mode: 'no-cors',
        }),
      );
    }
    return this.http.post(`${this.baseUrl}${endpoint}`, body, {
      params: { artiste: this.artiste },
    });
  }

  /** Coerce les champs numériques du catalogue (le backend peut renvoyer des chaînes). */
  private normalizeCatalogItem(dto: PrestaDto): CatalogItem {
    return {
      id: dto.id,
      nom: dto.nom,
      en: dto.en,
      desc: dto.desc,
      prix: dto.prix === undefined || dto.prix === '' ? undefined : parseAmount(dto.prix),
      reduc: dto.reduc === undefined || dto.reduc === '' ? undefined : parseAmount(dto.reduc),
      kilorly: dto.kilorly,
      hourly: dto.hourly,
      bride: dto.bride,
      onlyOne: dto.onlyOne,
      time: dto.time,
      maquillage: dto.maquillage,
      coiffure: dto.coiffure,
      titre: dto.titre,
    };
  }
}
