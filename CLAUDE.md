# CLAUDE.md — IntraCCB2

Guide de référence pour travailler sur ce dépôt (lu en priorité par Claude, et
utile à toute personne qui reprend le projet).

## C'est quoi ce projet ?

Outil **interne** de gestion pour Cloé Chaudron Beauty (devis, factures,
planning du jour-J, fiches de renseignements, tableau de bord).
Application **Angular 21** (TypeScript strict, signals, zoneless).

Il est mis en ligne à l'adresse : **https://www.cloechaudronbeauty.com/intraccb**
(c'est un sous-dossier du site principal, sur le même hébergement OVH).

Il n'a **pas de backend propre** : il parle à l'API PHP du site principal
(`https://www.cloechaudronbeauty.com/backend/api/`, cf. `src/environments/`).

## Développement local

```bash
npm install        # une fois (installe les dépendances)
npm start          # serveur de dev sur http://localhost:4200
npm run build      # build de production dans dist/intra-ccb2
npm run format     # met en forme le code (Prettier)
```

## 🤖 Règle : aller jusqu'à la mise en ligne, sans demander

Quand la propriétaire (Cloé) demande une modification, elle veut le résultat
**en ligne**, tout de suite. Elle ne crée pas et ne fusionne pas de Pull Request
elle-même. Donc, pour toute demande de sa part :

1. Fais la modification et commit.
2. **Fais-la arriver sur `main`** — c'est `main` qui déclenche la mise en ligne
   automatique. Deux façons acceptables (`main` n'est pas protégée) :
   - pousser directement sur `main` ; **ou**
   - si l'environnement impose une branche de travail, ouvrir la Pull Request
     **puis la fusionner toi-même** dans `main` dans la foulée (aucune revue
     n'est requise).
3. **Ne t'arrête pas pour demander « veux-tu que je crée / fusionne la PR ?».**
   Va jusqu'au bout : la modif doit se retrouver sur `main` sans action de Cloé.
4. À la fin, dis-lui simplement que c'est en ligne (ou le sera dans ~2 min).

## 🚀 Mettre en ligne (déploiement)

**Le plus simple, et sans rien installer : passer par GitHub.**

1. Faire la modification (ou demander à Claude de la faire).
2. La faire arriver sur la branche `main` (Claude s'en charge : commit + push,
   ou fusion de la Pull Request).
3. **C'est tout.** Le workflow GitHub Actions « Déploiement FTP (OVH) » se lance
   tout seul, build l'appli et l'envoie en FTP sur OVH. Le site est à jour en
   ~2 minutes.

On peut aussi le lancer à la main : onglet **Actions** du dépôt sur GitHub →
« Déploiement FTP (OVH) » → **Run workflow**.

### ⚙️ Réglage à faire UNE SEULE FOIS sur GitHub

Le déploiement a besoin du mot de passe FTP, stocké de façon sécurisée (pas dans
le code) :

1. **D'abord, changer le mot de passe FTP côté OVH** (l'ancien a été exposé —
   voir plus bas). Espace client OVH → Hébergement → FTP-SSH → modifier le mot
   de passe de l'utilisateur `chcl8760`.
2. Sur GitHub : dépôt **IntraCCB2** → **Settings** → **Secrets and variables** →
   **Actions** → **New repository secret**.
   - Name : `FTP_PASSWORD`
   - Secret : le **nouveau** mot de passe FTP OVH.
3. Enregistrer. Terminé — plus jamais à refaire.

*(L'hôte `ftp.chcl8760.odns.fr` et l'utilisateur `chcl8760` sont déjà réglés par
défaut. Pour les changer, créer des* variables *`FTP_HOST` / `FTP_USER` /
`FTP_REMOTE_PATH` au même endroit.)*

### Déploiement depuis un PC (solution de secours)

Depuis un ordinateur perso avec un accès FTP :

```bash
cp deploy.config.example.json deploy.config.json   # puis y mettre le mot de passe
npm run deploy
```

`deploy.config.json` est ignoré par git (jamais versionné).

> ⚠️ **Le FTP ne marche PAS depuis Claude sur le web** (le port 21 est bloqué
> dans le cloud). Depuis Claude, on déploie **uniquement** via GitHub (push sur
> `main` ou « Run workflow »). Ne pas essayer `npm run deploy` depuis Claude web.

## 🔐 Sécurité — à savoir

- L'ancien `deploy.js` contenait le mot de passe FTP **en clair** dans le code
  (il est donc dans l'historique git). Il a été retiré du code, mais **il faut
  changer ce mot de passe côté OVH** (étape 1 ci-dessus). Tant que ce n'est pas
  fait, considérez-le comme compromis.
- Aucun secret ne doit être écrit dans le code ni committé. Les identifiants
  vivent soit dans un secret GitHub (`FTP_PASSWORD`), soit dans le
  `deploy.config.json` local (non versionné).

## Pour Cloé (en clair)

Pour changer quelque chose sur l'outil interne : **demande à Claude.** Une fois
que c'est validé et que Claude a poussé sur `main`, le site se met à jour tout
seul en quelques minutes. Tu n'as jamais besoin de manipuler le FTP toi-même.
Le seul réglage à faire une fois, c'est d'ajouter le secret `FTP_PASSWORD` sur
GitHub (voir ci-dessus).
