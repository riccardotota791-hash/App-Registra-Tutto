// Dopo "npx cap add android": aggiunge i permessi (microfono, notifiche, sveglie esatte)
// e sostituisce l'icona di default con quella dell'app.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const res = path.join(root, 'android/app/src/main/res');
const manifestPath = path.join(root, 'android/app/src/main/AndroidManifest.xml');

let xml = fs.readFileSync(manifestPath, 'utf8');
const perms = [
  'android.permission.RECORD_AUDIO',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.WAKE_LOCK',
];
const add = perms.filter(p => !xml.includes(`"${p}"`)).map(p => `    <uses-permission android:name="${p}" />`).join('\n');
// Android 11+: serve dichiarare il servizio di riconoscimento vocale che si vuole usare
const queries = xml.includes('android.speech.RecognitionService') ? '' :
  '    <queries>\n        <intent>\n            <action android:name="android.speech.RecognitionService" />\n        </intent>\n' +
  '        <intent>\n            <action android:name="android.intent.action.TTS_SERVICE" />\n        </intent>\n    </queries>\n';
xml = xml.replace('</manifest>', `${add}\n${queries}</manifest>`);
fs.writeFileSync(manifestPath, xml);

// icona: PNG in tutte le densità, senza icona adattiva
fs.rmSync(path.join(res, 'mipmap-anydpi-v26'), { recursive: true, force: true });
const icon = path.join(root, 'icons/icon-192.png');
for (const dir of fs.readdirSync(res).filter(d => d.startsWith('mipmap-'))) {
  for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png'])
    if (fs.existsSync(path.join(res, dir, name))) fs.copyFileSync(icon, path.join(res, dir, name));
}
console.log('AndroidManifest e icone aggiornati');
