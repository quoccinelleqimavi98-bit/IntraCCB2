const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const LOCAL_PATH = path.join(__dirname, "docs"); // dossier build Angular admin
const BROWSER_PATH = path.join(LOCAL_PATH, "browser"); // si nécessaire

// Déplace tout le contenu de browser vers docs
function moveBrowserContent() {
    if (!fs.existsSync(BROWSER_PATH)) return;
    const files = fs.readdirSync(BROWSER_PATH);
    for (const file of files) {
        const src = path.join(BROWSER_PATH, file);
        const dest = path.join(LOCAL_PATH, file);
        fs.renameSync(src, dest);
    }
    fs.rmdirSync(BROWSER_PATH);
}

function gitCommitPush() {
    try {
        execSync("git add .", { stdio: "inherit" });
        execSync('git commit -m "deploy admin"', { stdio: "inherit" });
        execSync("git push", { stdio: "inherit" });
    } catch (err) {
        console.log("Git commit/push ignoré (peut-être pas de changements).");
    }
}

// Supprime tout le contenu d'un dossier distant
async function removeAll(client, dir) {
    const list = await client.list(dir);
    for (const item of list) {
        const remotePath = `${dir}/${item.name}`;
        if (item.isDirectory) {
            await client.removeDir(remotePath);
        } else {
            await client.remove(remotePath);
        }
    }
}

async function uploadDir(client, localDir, remoteDir) {
    const files = fs.readdirSync(localDir);
    for (const file of files) {
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

async function deployAdmin() {
    console.log("Build Angular admin...");
    execSync("ng build --configuration=production --output-path docs --base-href ./", { stdio: "inherit" });

    console.log("Déplacement du contenu de browser vers docs si nécessaire...");
    moveBrowserContent();

    console.log("Commit + push Git...");
    gitCommitPush();
}

deployAdmin();
