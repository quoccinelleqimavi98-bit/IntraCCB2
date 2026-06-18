# IntraCCB2

Outil interne de gestion pour **Cloé Chaudron Beauty** (maquillage & coiffure mariage) :
calendrier des prestations, devis, factures, plannings du jour-J, fiches de
renseignements et tableau de bord financier.

Réécriture professionnelle d'IntraCCB : même fonctionnel, même identité visuelle
et mêmes documents PDF, mais une base de code repensée (architecture, modèles,
requêtes) sur **Angular 21** (signals, zoneless, control flow, TypeScript strict).

## Prérequis

- Node.js `^20.19` ou `^22.12` (≥ 22.22.3 requis seulement pour passer à Angular 22)
- npm 10+

## Démarrage

```bash
npm install
npm start          # serveur de dev sur http://localhost:4200
npm run build      # build de production dans dist/intra-ccb2
npm run format     # formatage Prettier
```

## Architecture

Organisation par responsabilités, pensée pour grossir feature par feature :

```
src/
  app/
    core/                  # socle métier, sans UI
      models/              # modèles de domaine typés (Journee, Devis, Presta…)
      dto/                 # format brut de l'API (couche anti-corruption)
      mappers/             # traduction DTO ⇆ domaine
      services/            # api (HTTP), planning-store (état signals), auth
      utils/               # fonctions pures (dates, montants)
    features/              # à venir : calendar, journee, devis, facture, planning…
    shared/                # à venir : composants/pipes réutilisables
    app.ts / app.config.ts # coquille racine + providers
  documents/               # à venir : gabarits PDF (visuel conservé à l'identique)
  styles/                  # thème : _variables (palette), _mixins, _base
  environments/            # configuration dev / prod (sans secret)
```

### Principes

- **Domaine propre, isolé du backend.** Les modèles ne portent aucun état d'UI.
  Le format imparfait de l'API actuelle (champs `number|string`, tableaux
  positionnels du planning, coordonnées à plat) est confiné aux `dto/` + `mappers/`.
- **Logique métier dans des services purs et testables** (montants, dates, …),
  source unique de vérité (fini les `calc()`/`transform()` dupliqués 3 fois).
- **État via signals** (`PlanningStore`) plutôt que des tableaux recalculés en
  continu dans des composants géants.
- **Un seul point réseau** (`ApiService`), requêtes typées via `HttpClient`
  (abandon du `fetch` en `no-cors`).
- **Cohérence** : TypeScript strict, Prettier, conventions Angular 21.

## Feuille de route (par étapes)

1. ✅ **Fondations & architecture** — config, thème, modèles, services core.
2. ⬜ Calendrier + fiche journée (tranche verticale).
3. ⬜ Documents PDF (devis, facture, planning, renseignements) — visuel identique.
4. ⬜ Éditeur de planning (calcul des horaires).
5. ⬜ Tableau de bord & statistiques.
6. ⬜ API repensée (contrat REST, voir `docs/api-contract.md`) + authentification serveur.

## Sécurité

Le verrou d'accès actuel est volontairement « soft » (héritage de l'app
d'origine). La véritable authentification doit être portée par l'API lors de
l'étape 6. Aucun secret n'est versionné dans ce dépôt.
