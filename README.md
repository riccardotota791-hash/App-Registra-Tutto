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
È una **PWA** (app web installabile): va pubblicata su un indirizzo `https://`, poi dal telefono:
- **Android (Chrome)**: menu ⋮ → *Installa app*.
- **iPhone (Safari)**: Condividi ⬆️ → *Aggiungi alla schermata Home* (le notifiche su iPhone funzionano solo così, iOS 16.4+).

Per pubblicarla gratis con **GitHub Pages**: *Settings → Pages → Deploy from a branch → `main` / root*.
(Su un account gratuito GitHub Pages richiede che la repository sia pubblica.)

I dati restano salvati sul dispositivo; dalla scheda *Personaggio* si possono esportare/importare in JSON.

## Struttura
| File | Contenuto |
|---|---|
| `index.html` | Pagina principale |
| `styles.css` | Grafica (tema chiaro/scuro automatico) |
| `app.js` | Logica: motore dei punti, schermate, promemoria |
| `sw.js` | Service worker: funzionamento offline e clic sulle notifiche |
| `manifest.webmanifest`, `icons/` | Dati per l'installazione come app |

## Limiti attuali
Le notifiche di una PWA partono mentre l'app è aperta o in sottofondo. Per promemoria garantiti anche ad app
completamente chiusa il prossimo passo è impacchettarla come app nativa (Capacitor + notifiche locali).
