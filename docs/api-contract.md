# Contrat d'API cible

Ce document décrit l'API **visée** après réécriture du backend (étape 6). Tant
qu'elle n'existe pas, le front parle à l'API PHP actuelle via la couche
`dto/` + `mappers/` : passer à ce contrat ne touchera que `ApiService` et les
mappers, jamais le domaine ni les composants.

## Principes

- Routes **REST** ressource-orientées, en JSON.
- **Codes HTTP** signifiants (200/201/204, 400, 401, 404, 409, 500) au lieu de
  réponses opaques.
- **CORS** explicite ; suppression du contournement `no-cors`.
- Authentification par **jeton** (cookie httpOnly ou `Authorization: Bearer`),
  vérifiée côté serveur.
- Le paramètre `artiste` (multi-tenant) passe par le chemin : `/artistes/{slug}/…`.

## Endpoints

| Méthode | Chemin                                   | Rôle                              | Réponse |
| ------- | ---------------------------------------- | -------------------------------- | ------- |
| GET     | `/artistes/{slug}/journees`              | Liste des journées               | `200` `Journee[]` |
| GET     | `/artistes/{slug}/journees/{id}`         | Détail d'une journée             | `200` `Journee` |
| POST    | `/artistes/{slug}/journees`              | Création                         | `201` `Journee` |
| PUT     | `/artistes/{slug}/journees/{id}`         | Mise à jour complète             | `200` `Journee` |
| DELETE  | `/artistes/{slug}/journees/{id}`         | Suppression                      | `204` |
| GET     | `/artistes/{slug}/catalogue`             | Catalogue de prestations         | `200` `CatalogItem[]` |
| GET     | `/artistes/{slug}/domaines`              | Domaines référencés              | `200` `Domaine[]` |
| POST    | `/auth/login`                            | Authentification                 | `200` `{ token }` / `401` |

## Correspondance avec l'API actuelle

| Cible                                   | Existant (legacy)                          |
| --------------------------------------- | ------------------------------------------ |
| `GET /artistes/cloe/journees`           | `GET cloeplanning.php?artiste=cloe`        |
| `POST /artistes/cloe/journees`          | `POST cloeplanningcreate.php?artiste=cloe` |
| `PUT /artistes/cloe/journees/{id}`      | `POST cloeplanningupdate.php?artiste=cloe` |
| `DELETE /artistes/cloe/journees/{id}`   | `POST cloeplanningdelete.php?artiste=cloe` |
| `GET /artistes/cloe/catalogue`          | `GET getintraccbdata.php`                  |
| `GET /artistes/cloe/domaines`           | `domaines.json` (statique)                 |

## Format JSON cible

Le JSON échangé doit refléter le **modèle de domaine** (voir `src/app/core/models`)
plutôt que le format historique : coordonnées client regroupées dans `client`,
planning décrit par objets nommés (`artistes`, `slots`, `prestas`) au lieu de
tableaux positionnels, montants/quantités en nombres. Le mapping positionnel
documenté dans `planning.model.ts` disparaîtra alors côté serveur.
