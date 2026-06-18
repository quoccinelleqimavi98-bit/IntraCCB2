import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { JourneeDto, PrestaDto } from '../dto/journee.dto';
import { journeeToDomain, journeeToDto } from '../mappers/journee.mapper';
import { CatalogItem, Domaine, Journee } from '../models';
import { parseAmount } from '../utils/money.utils';

/**
 * Accès à l'API. Unique point de contact réseau de l'application.
 *
 * Toutes les méthodes renvoient des modèles de DOMAINE (jamais des DTO) ; la
 * traduction est déléguée aux mappers. On utilise `HttpClient` classique
 * (réponses lisibles, gestion d'erreurs RxJS) — on abandonne le `fetch` en
 * `no-cors` de l'app d'origine, inutile puisque le front et l'API partagent le
 * même domaine en production.
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
