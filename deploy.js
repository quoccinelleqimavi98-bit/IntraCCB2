/**
 * Déploiement de la NOUVELLE version (IntraCCB2) sur l'hébergement OVH, au même
 * emplacement que l'ancien IntraCCB : https://www.cloechaudronbeauty.com/intraccb
 *
 * `npm run deploy` :
 *   1. build de production (base-href relatif, pour fonctionner sous /intraccb) ;
 *   2. connexion FTP, suppression de l'ancienne version, envoi de la nouvelle.
 *
 * L'API (……/backend/api) n'est PAS touchée : on ne remplace que le front.
 *
 * ⚠️ IDENTIFIANTS : aucun mot de passe n'est écrit en dur dans ce fichier.
 *    Ils sont lus depuis, dans l'ordre :
 *      1. les variables d'environnement CCB_FTP_HOST / CCB_FTP_USER / CCB_FTP_PASSWORD ;
 *      2. le fichier local deploy.config.json (ignoré par git — voir
 *         deploy.config.example.json).
 *
 * ⚠️ Le port FTP (21) est souvent bloqué dans les environnements cloud / CI
 *    (dont Claude Code sur le web). Pour déployer sans machine locale, on utilise
 *    plutôt le workflow GitHub Actions « Déploiement FTP (OVH) » — voir CLAUDE.md.
 *    Ce script reste utile pour un déploiement manuel depuis un PC.
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// `basic-ftp` est une dépendance de dev : si elle manque, message clair plutôt
// qu'une stack trace illisible (cause n°1 de « npm run deploy ne fait rien »).
let ftp;
try {
  ftp = require('basic-ftp');
} catch {
  console.error(
    "\n[deploy] Le module 'basic-ftp' est introuvable.\n" +
      '         Lance d’abord :  npm install\n',
  );
  process.exit(1);
}

// Config locale optionnelle (ignorée par git). Cf. deploy.config.example.json.
let cfg = {};
try {
  cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'deploy.config.json'), 'utf8'));
} catch {
  // Pas de fichier local : on se rabat sur les variables d'environnement.
}

const FTP_HOST = process.env.CCB_FTP_HOST || cfg.host;
const FTP_USER = process.env.CCB_FTP_USER || cfg.user;
const FTP_PASSWORD = process.env.CCB_FTP_PASSWORD || cfg.password;
const FTP_REMOTE_PATH = process.env.CCB_FTP_REMOTE_PATH || cfg.remotePath || '/public_html/intraccb';
const BUILD_DIR = path.join(__dirname, 'dist', 'intra-ccb2', 'browser');

if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD) {
  console.error(
    '\n[deploy] Identifiants FTP manquants.\n' +
      '         Copiez deploy.config.example.json en deploy.config.json et renseignez\n' +
      '         vos identifiants (ou définissez CCB_FTP_HOST / CCB_FTP_USER / CCB_FTP_PASSWORD).\n',
  );
  process.exit(1);
}

/** Supprime tout le contenu d'un dossier distant (ignore s'il n'existe pas). */
async function removeAll(client, dir) {
  let list;
  try {
    list = await client.list(dir);
  } catch {
    return; // dossier absent : rien à supprimer
  }
  for (const item of list) {
    const remotePath = `${dir}/${item.name}`;
    if (item.isDirectory) await client.removeDir(remotePath);
    else await client.remove(remotePath);
  }
}

/** Envoie récursivement le contenu d'un dossier local vers le distant. */
async function uploadDir(client, localDir, remoteDir) {
  for (const file of fs.readdirSync(localDir)) {
    const localPath = path.join(localDir, file);
    const remotePath = `${remoteDir}/${file}`;
    if (fs.lstatSync(localPath).isDirectory()) {
      await client.ensureDir(remotePath);
      await uploadDir(client, localPath, remotePath);
    } else {
      await client.uploadFrom(localPath, remotePath);
    }
  }
}

async function deploy() {
  console.log('=== Déploiement IntraCCB2 → ' + FTP_HOST + FTP_REMOTE_PATH + ' ===');
  console.log('Build de production (base-href ./)…');
  execSync('npx ng build --configuration production --base-href ./', { stdio: 'inherit' });

  if (!fs.existsSync(BUILD_DIR)) {
    throw new Error(`Build introuvable : ${BUILD_DIR}`);
  }

  const client = new ftp.Client();
  client.ftp.verbose = true;
  try {
    console.log('Connexion FTP…');
    await client.access({ host: FTP_HOST, user: FTP_USER, password: FTP_PASSWORD, secure: false });

    console.log("Suppression de l'ancienne version…");
    await client.ensureDir(FTP_REMOTE_PATH);
    await removeAll(client, FTP_REMOTE_PATH);

    console.log('Envoi de la nouvelle version…');
    await uploadDir(client, BUILD_DIR, FTP_REMOTE_PATH);

    console.log('Déploiement terminé : https://www.cloechaudronbeauty.com/intraccb');
  } catch (err) {
    console.error('\n[deploy] Échec du déploiement :', err && err.message ? err.message : err);
    if (err && (err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED')) {
      console.error(
        '         Le serveur FTP est injoignable. Lance « npm run deploy » depuis\n' +
          '         une machine ayant un accès FTP (le port 21 est souvent bloqué\n' +
          '         dans les environnements cloud / CI). Sinon, utilise le workflow\n' +
          '         GitHub Actions « Déploiement FTP (OVH) ».',
      );
    }
    process.exitCode = 1;
  } finally {
    client.close();
  }
}

deploy();
