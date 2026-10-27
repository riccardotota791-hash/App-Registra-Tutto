// Copia i file della web app in www/, la cartella che Capacitor impacchetta nell'app Android.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
const FILES = ['index.html', 'styles.css', 'app.js', 'voice.js', 'sw.js', 'manifest.webmanifest', 'icons'];
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const f of FILES) fs.cpSync(path.join(root, f), path.join(out, f), { recursive: true });
// runtime di Capacitor (registerPlugin) solo per l'app: va caricato prima di app.js
fs.copyFileSync(path.join(root, 'node_modules/@capacitor/core/dist/capacitor.js'), path.join(out, 'capacitor.js'));
const html = path.join(out, 'index.html');
fs.writeFileSync(html, fs.readFileSync(html, 'utf8').replace('<script src="app.js">', '<script src="capacitor.js"></script>\n<script src="app.js">'));
console.log('www/ pronta:', FILES.join(', '));
