/**
 * Déploiement de la NOUVELLE version (IntraCCB2) sur l'hébergement OVH, au même
 * emplacement que l'ancien IntraCCB : https://www.cloechaudronbeauty.com/intraccb
 *
 * `npm run deploy` :
 *   1. build de production (base-href relatif, pour fonctionner sous /intraccb) ;
 *   2. connexion FTP, suppression de l'ancienne version, envoi de la nouvelle.
 *
 * L'API (……/backend/api) n'est PAS touchée : on ne remplace que le front. Comme
 * le front est alors servi depuis la même origine que l'API, les écritures
 * repassent automatiquement par HttpClient (pas de souci CORS — voir api.service).
 *
 * Identifiants : repris de l'ancien deploy.js, surchargés par des variables
 * d'environnement si on préfère ne pas les garder en clair (CCB_FTP_*).
 */
const ftp = require('basic-ftp');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const FTP_HOST = process.env.CCB_FTP_HOST || 'ftp.chcl8760.odns.fr';
const FTP_USER = process.env.CCB_FTP_USER || 'chcl8760';
const FTP_PASSWORD = process.env.CCB_FTP_PASSWORD || 'q8x3-7N5U-WR8}';
const FTP_REMOTE_PATH = '/public_html/intraccb'; // remplace l'ancienne version
const BUILD_DIR = path.join(__dirname, 'dist', 'intra-ccb2', 'browser');

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
    console.error('Échec du déploiement :', err);
    process.exitCode = 1;
  } finally {
    client.close();
  }
}