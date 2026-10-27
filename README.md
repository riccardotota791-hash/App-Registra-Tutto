# Applicazione Quotidianità 🎮

Habit tracker trasformato in videogioco, pensato per il telefono: segna gli obiettivi fissi e le cose
da fare, ricevi i promemoria, guadagna XP, sali di livello e sblocca premi.

## Funzioni
- **Obiettivi fissi** che si ripetono da soli: ogni giorno, solo in certi giorni (es. palestra lun/mer/ven),
  ogni settimana o ogni mese. A spunta o a quantità (es. "Leggere · 10 pagine al giorno").
- **Calendario con le cose da fare**: aggiungi attività singole per domani o per qualsiasi giorno;
  quando le completi danno punti. Quelle non fatte compaiono "in ritardo" e si possono spostare a oggi.
- **Promemoria / notifiche**: un'ora per ogni obiettivo o cosa da fare, più un promemoria di fine giornata
  se manca ancora qualcosa. Arrivano solo se la cosa non è già fatta.
- **Oggi**: progressi del giorno, giornata perfetta, anteprima di domani; si possono correggere i giorni passati.
- **Riepilogo** alla prima apertura del giorno (com'è andata ieri + cosa c'è in programma) e pagella del mese (S/A/B/C/D).
- **XP, livelli, gradi** (Novizio → Immortale), **aspetti** del personaggio e **premi** (es. "Mese perfetto: Leggere").
- **Assistente vocale** 🎤 (pulsante al centro della barra in basso): segni le cose fatte e ne aggiungi di nuove solo parlando.

## Assistente vocale – cosa puoi dire
| Esempio | Cosa fa |
|---|---|
| "Ho letto 10 pagine", "ho fatto palestra", "ho bevuto 3 bicchieri" | Segna il progresso sull'obiettivo giusto |
| "Ho chiamato il dentista" | Spunta la cosa da fare corrispondente |
| "Ieri ho letto 10 pagine" | Segna sul giorno prima |
| "Domani alle 10 chiamare il dentista", "ricordami di pagare la bolletta venerdì" | Aggiunge una cosa da fare in calendario (con promemoria se dici l'ora) |
| "Nuovo obiettivo bere 8 bicchieri al giorno", "palestra 3 volte a settimana", "nuoto ogni lunedì e giovedì" | Crea un obiettivo fisso |
| "Cosa mi manca oggi?", "cosa ho in programma domani?" | Ti legge cosa resta da fare |
| "Quanti punti ho?" | Livello e XP |
| "Annulla" | Annulla l'ultima azione |

L'assistente risponde anche a voce (si può disattivare in *Eroe*). C'è anche un campo per scrivere i comandi.

## Regole dei punti
| Azione | XP |
|---|---|
| Obiettivo fisso giornaliero / settimanale / mensile | 10 / 40 / 150 (modificabili) |
| Cosa da fare in calendario | 15 (modificabile) |
| Serie consecutiva | +5% per volta, max +50% |
| Giornata perfetta (tutto il programma del giorno fatto) | +25 |
| Pagella mensile S / A / B | +300 / +150 / +75 |
| Mese perfetto su un obiettivo | +500 |

Tutti i punti vengono ricalcolati dallo storico: se togli una spunta, perdi esattamente i punti che ti aveva dato.

## Installarla sul telefono
### App Android (consigliata)
Ad ogni modifica GitHub costruisce da solo l'APK (workflow *App Android* in `.github/workflows/android.yml`).
Dal telefono apri **[Releases → ultima versione](https://github.com/riccardotota791-hash/App-Registra-Tutto/releases/latest)**,
scarica `Quotidianita.apk` e aprilo (la prima volta Android chiede di consentire l'installazione da quella fonte).
Gli aggiornamenti si installano sopra la versione precedente senza perdere i dati.
Con l'app Android i promemoria arrivano **anche ad app chiusa** e il microfono usa il riconoscimento vocale di Google.

### Versione web (PWA)
Attiva GitHub Pages: *Settings → Pages → Deploy from a branch → `main` / root*. L'app sarà su
`https://riccardotota791-hash.github.io/App-Registra-Tutto/`; da Chrome: menu ⋮ → *Installa app*.
Tenendo premuta l'icona compare la scorciatoia **Comando vocale**.

I dati restano salvati sul dispositivo; dalla scheda *Eroe* si possono esportare/importare in JSON.

## Struttura
| File | Contenuto |
|---|---|
| `index.html` | Pagina principale |
| `styles.css` | Grafica (tema chiaro/scuro automatico) |
| `app.js` | Logica: motore dei punti, schermate, promemoria |
| `voice.js` | Assistente vocale: interpretazione dei comandi in italiano, microfono, risposte a voce |
| `tests/voice.test.js` | Test dei comandi vocali (`npm test`) |
| `package.json`, `capacitor.config.json`, `scripts/` | Impacchettamento come app Android con Capacitor |
| `ci/debug.keystore` | Chiave di firma fissa delle build (permette gli aggiornamenti senza disinstallare) |
| `sw.js` | Service worker: funzionamento offline e clic sulle notifiche |
| `manifest.webmanifest`, `icons/` | Dati per l'installazione come app |

## Note
- Nella versione web le notifiche partono solo mentre l'app è aperta o in sottofondo; nell'app Android sempre.
- I dati dell'app Android e quelli della versione web sono separati: per spostarli usa *Esporta/Importa dati*.

## Sviluppo
```bash
npm install
npm test                  # test dei comandi vocali
npm run android:prepare   # genera il progetto Android in android/ (serve l'Android SDK per compilarlo)
```
