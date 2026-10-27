'use strict';
/* ============ Assistente vocale ============
   parseCommand() è pura (testabile in Node): trasforma una frase in un'azione.
   Il resto del file collega microfono, sintesi vocale e interfaccia. */

const VoiceParser = (() => {
  const pad = n => String(n).padStart(2, '0');
  const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = parse(k); d.setDate(d.getDate() + n); return key(d); };

  const deaccent = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const NUM = { due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, undici: 11,
    dodici: 12, tredici: 13, quattordici: 14, quindici: 15, sedici: 16, diciassette: 17, diciotto: 18,
    diciannove: 19, venti: 20, trenta: 30, quaranta: 40, cinquanta: 50, sessanta: 60, cento: 100, mille: 1000 };
  const WD = { domenica: 0, lunedi: 1, martedi: 2, mercoledi: 3, giovedi: 4, venerdi: 5, sabato: 6 };
  const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const STOP = new Set(('ho hai ha abbiamo il lo la i gli le l un una uno di d del dello della dei degli delle a al allo alla ai agli alle ' +
    'da dal dalla dai in nel nella con per tra fra e ed o che mi ti si ci oggi ieri gia appena fatto fatta fatti fatte completato completata ' +
    'finito finita eseguito eseguita segna segnami segnare come sono stato stata andato andata anche altre altri altro altra ancora ' +
    'poi volta volte ok allora ehi adesso ora bene si mio mia miei mie tutto tutti tutte').split(' '));
  // participi irregolari per riconoscere "ho letto" -> "Leggere"
  const IRR = { leggere: 'letto', scrivere: 'scritto', correre: 'corso', bere: 'bevuto', prendere: 'preso', chiudere: 'chiuso',
    mettere: 'messo', rispondere: 'risposto', vedere: 'visto', spendere: 'speso', fare: 'fatto', dire: 'detto', cuocere: 'cotto',
    spegnere: 'spento', accendere: 'acceso', aprire: 'aperto', muovere: 'mosso', scendere: 'sceso', vincere: 'vinto',
    perdere: 'perso', stendere: 'steso', dipingere: 'dipinto', rompere: 'rotto', ridere: 'riso', piangere: 'pianto',
    risolvere: 'risolto', scegliere: 'scelto', togliere: 'tolto', raccogliere: 'raccolto' };
  const ICONS = [
    [/dentist/, '🦷'], [/medic|dottor|visita|ospedal|analisi/, '🩺'], [/spesa|supermercat|comprar/, '🛒'],
    [/chiam|telefon/, '📞'], [/pagar|bollett|bonific|tass/, '💶'], [/palestr|allenam|pesi/, '🏋️'], [/cors[ae]|correr/, '🏃'],
    [/studi|esam|compit/, '📚'], [/legg|libr|pagin|lettur/, '📖'], [/pulir|pulizi|aspirapolv/, '🧹'], [/lavatric|bucato/, '🧺'],
    [/mail|email|posta/, '📧'], [/regal/, '🎁'], [/compleann|festa/, '🎂'], [/auto|macchin|benzin|meccanic/, '🚗'],
    [/cane|gatto/, '🐾'], [/acqua|bere|bicchier/, '💧'], [/medit|respir|yoga/, '🧘'], [/cammin|passegg/, '🚶'],
    [/risparm|soldi|euro/, '💰'], [/cucin|ricett/, '🍳'], [/dorm|sonno|letto presto/, '😴'], [/lavor|riunion|ufficio/, '💼'],
    [/scriv|diario/, '✍️'], [/mamma|papa|famigl|nonn/, '👨‍👩‍👧'], [/nuot|piscin/, '🏊'], [/bici/, '🚴'], [/frutt|verdur/, '🥗'],
  ];
  const iconFor = s => { const n = deaccent(s.toLowerCase()); for (const [re, ic] of ICONS) if (re.test(n)) return ic; return null; };

  function tokenize(text) {
    const orig = text.replace(/(\d)[.,](\d{2})\b/g, '$1:$2').replace(/[^\p{L}\p{N}: ]/gu, ' ').split(/\s+/).filter(Boolean);
    const dict = {};
    // dict: parola normalizzata -> parola originale (con accenti e maiuscole, per i titoli)
    const toks = orig.map(o => { const n = deaccent(o.toLowerCase()); const v = NUM[n] != null ? String(NUM[n]) : n; if (!dict[v]) dict[v] = o; return v; });
    return { toks, dict };
  }
  const prefixLen = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
  const close = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && prefixLen(a, b) >= Math.max(4, Math.min(a.length, b.length) - 2));
  const forms = w => {
    const f = [w];
    if (IRR[w]) f.push(IRR[w]);
    else if (/are$/.test(w)) f.push(w.slice(0, -3) + 'ato');
    else if (/ere$/.test(w)) f.push(w.slice(0, -3) + 'uto');
    else if (/ire$/.test(w)) f.push(w.slice(0, -3) + 'ito');
    return f;
  };
  const words = s => tokenize(s).toks.filter(w => w.length >= 3 && !STOP.has(w) && !/^\d/.test(w));

  // punteggio di somiglianza tra la frase e il nome di un obiettivo / cosa da fare
  function score(toks, name, unit) {
    let sc = 0;
    for (const w of words(name)) if (toks.some(t => forms(w).some(f => close(t, f)))) sc += 2;
    if (unit) for (const w of words(unit)) if (w !== 'volte' && toks.some(t => close(t, w))) sc += 1;
    return sc;
  }

  function extractTime(s) {
    let time = null;
    s = s.replace(/\b(?:a )?mezzogiorno\b/, () => { time = '12:00'; return ' '; });
    const re = /\b(?:alle|all|per le|verso le|entro le|ore)\s+(\d{1,2})(?::(\d{2}))?(?:\s+e\s+(mezza|mezzo|un quarto|quarto|\d{1,2}))?(?:\s+(di mattina|del mattino|di sera|della sera|del pomeriggio|di pomeriggio|di notte))?\b/;
    s = s.replace(re, (m, h, mm, extra, part) => {
      h = Number(h); let min = mm ? Number(mm) : 0;
      if (extra) min = /mezz/.test(extra) ? 30 : /quarto/.test(extra) ? 15 : Number(extra);
      if (part && /sera|pomeriggio|notte/.test(part) && h < 12) h += 12;
      if (h > 23 || min > 59) return m;
      time = `${pad(h)}:${pad(min)}`;
      return ' ';
    });
    return { time, s };
  }

  function extractDate(s, today) {
    let date = null, evening = false;
    const sub = (re, fn) => { s = s.replace(re, (...a) => { const r = fn(...a); return r === false ? a[0] : ' '; }); };
    sub(/\bdopodomani\b/, () => { date = addDays(today, 2); });
    if (!date) sub(/\bdomani\b/, () => { date = addDays(today, 1); });
    if (!date) sub(/\b(stasera|stamattina|oggi pomeriggio|oggi)\b/, (m) => { date = today; evening = m === 'stasera' || m === 'oggi pomeriggio'; });
    if (!date) sub(/\bieri\b/, () => { date = addDays(today, -1); });
    if (!date) sub(/\b(?:il |di |questo |questa |per )?(lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)(?: prossim[oa])?\b/, (m, wd) => {
      let diff = (WD[wd] - parse(today).getDay() + 7) % 7; if (diff === 0) diff = 7;
      date = addDays(today, diff);
    });
    if (!date) sub(new RegExp(`\\b(?:il |per il )?(\\d{1,2})(?: (${MONTHS.join('|')}))?\\b`), (m, d, mon) => {
      if (!mon && !/^(il|per)/.test(m)) return false; // un numero da solo non è una data
      const t = parse(today); d = Number(d);
      let y = t.getFullYear(), mo = mon ? MONTHS.indexOf(mon) : t.getMonth();
      let cand = new Date(y, mo, d);
      if (cand.getDate() !== d) return false;
      if (key(cand) < today) cand = mon ? new Date(y + 1, mo, d) : new Date(y, mo + 1, d);
      date = key(cand);
    });
    return { date, evening, s };
  }

  const LEAD = new Set(('ok allora ehi senti aggiungi aggiungimi aggiungere ricordami ricordarmi ricorda ricordati programma programmami ' +
    'pianifica inserisci metti crea segna segnami nuova nuovo una un attivita impegno cosa che di devo dovro mi per anche poi').split(' '));
  const TRAIL = new Set('di a per e alle il la lo i le da che'.split(' '));
  const cleanTitle = (toks, dict) => {
    let t = toks.filter(Boolean);
    while (t.length && LEAD.has(t[0])) t.shift();
    while (t.length && TRAIL.has(t[t.length - 1])) t.pop();
    const s = t.map(w => dict[w] || w).join(' ').trim();
    return s ? s[0].toUpperCase() + s.slice(1) : '';
  };

  const ADD_RE = /^(?:ok |allora |ehi |senti )?(aggiungi|aggiungimi|aggiungere|ricordami|ricordarmi|ricorda|ricordati|programma|programmami|pianifica|inserisci|metti|crea|nuovo|nuova|devo|dovro|segna da fare|segnami da fare)\b/;
  const GOAL_RE = /\b(obiettivo|abitudine|ogni giorno|tutti i giorni|al giorno|ogni sera|ogni mattina|a settimana|alla settimana|ogni settimana|per settimana|al mese|ogni mese|per mese|ogni (?:lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica))\b/;
  const DONE_RE = /\b(ho|fatto|fatta|completato|completata|finito|finita|eseguito|eseguita|segna|segnami|spunta|spuntare|fatto)\b/;

  function parseCommand(text, ctx) {
    const today = ctx.today;
    const { toks, dict } = tokenize(text);
    const s0 = ' ' + toks.join(' ') + ' ';
    const s = s0.trim();
    if (!s) return { type: 'unknown' };

    if (/^(annulla|annullare|torna indietro|cancella (l )?ultim\w*|no annulla)\b/.test(s)) return { type: 'undo' };
    if (/\b(quanti punti|quanti xp|che livello|a che livello|mio livello|quanta esperienza)\b/.test(s)) return { type: 'status' };
    if (/\b(cosa|che cosa|che) (devo|ho da|mi (?:resta|rimane|manca)|resta|rimane|manca)\b|\bcosa (?:c e|ce|ho) (?:in programma|da fare)\b|\bprogramma di (oggi|domani)\b|\bcosa mi manca\b/.test(s))
      return { type: 'query', date: /\bdomani\b/.test(s) ? addDays(today, 1) : today };
    const isAdd = ADD_RE.test(s);
    if (!isAdd && /\bnon (?:ho|l ho|li ho|sono|abbiamo)\b/.test(s)) return { type: 'negative' };
    // nuovo obiettivo fisso
    if (isAdd && GOAL_RE.test(s) || /^(?:nuovo |aggiungi (?:un )?(?:nuovo )?)?(obiettivo|abitudine)\b/.test(s)) {
      let r = extractTime(s), str = ' ' + r.s + ' ';
      let freq = 'daily', days = null;
      if (/\b(a settimana|alla settimana|ogni settimana|per settimana|settimanale|la settimana)\b/.test(str)) freq = 'weekly';
      else if (/\b(al mese|ogni mese|per mese|mensile|il mese)\b/.test(str)) freq = 'monthly';
      const wds = [...str.matchAll(/\b(lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b/g)].map(m => WD[m[1]]);
      if (freq === 'daily' && wds.length) days = [...new Set(wds)].sort();
      str = str.replace(/\b(obiettivo|abitudine|fisso|nuovo|nuova|ogni giorno|tutti i giorni|al giorno|giornaliero|quotidiano|ogni sera|ogni mattina|a settimana|alla settimana|ogni settimana|per settimana|settimanale|la settimana|al mese|ogni mese|per mese|mensile|il mese|ogni|il|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b/g, ' ')
        .replace(ADD_RE, ' ');
      let t = str.split(/\s+/).filter(Boolean);
      t = t.filter((w, i) => !(w === 'e' && i > 0)); // "lunedi e giovedi"
      let target = 1, unit = '', name;
      const ni = t.findIndex(w => /^\d+$/.test(w));
      if (ni >= 0) {
        target = Math.max(1, Number(t[ni]));
        if (t[ni + 1] && !STOP.has(t[ni + 1]) || t[ni + 1] === 'volte') unit = dict[t[ni + 1]] || t[ni + 1];
        const before = t.slice(0, ni), after = t.slice(ni + (unit ? 2 : 1));
        name = cleanTitle(before, dict) || cleanTitle(after, dict);
      } else name = cleanTitle(t, dict);
      if (!name) return { type: 'unknown' };
      return { type: 'addGoal', goal: { name, freq, target, unit, days, remind: r.time || '', icon: iconFor(name + ' ' + unit) || '⭐' } };
    }

    // nuova cosa da fare (anche senza verbo se c'è una data: "domani dentista alle 10")
    const r1 = extractTime(s);
    const r2 = extractDate(r1.s, today);
    const hasDoneVerb = DONE_RE.test(s) && !isAdd;
    if (isAdd || (r2.date && r2.date > today) || ((r1.time || r2.date === today) && !hasDoneVerb)) {
      let time = r1.time, date = r2.date || today;
      if (time && r2.evening && Number(time.slice(0, 2)) < 12) time = pad(Number(time.slice(0, 2)) + 12) + time.slice(2);
      if (!r2.date && time && time <= ctx.now) date = addDays(today, 1);
      let str = (' ' + r2.s + ' ')
        .replace(/\b(in calendario|in agenda|tra le cose da fare|nelle cose da fare|come cosa da fare|da fare|un promemoria per|un promemoria|promemoria per|promemoria)\b/g, ' ')
        .replace(ADD_RE, ' ');
      const title = cleanTitle(str.split(/\s+/), dict);
      if (!title) return { type: 'unknown' };
      return { type: 'addTask', task: { title, date, time: time || '', icon: iconFor(title) || '📝' } };
    }

    // segna come fatto
    const r3 = extractDate(s, today);
    const date = r3.date && r3.date < today ? r3.date : today;
    const numTok = r3.s.split(/\s+/).find(w => /^\d+$/.test(w));
    const qty = numTok ? Number(numTok) : null;
    let best = null;
    for (const g of ctx.goals) {
      if (g.archived) continue;
      const sc = score(toks, g.name, g.unit);
      if (sc > 0 && (!best || sc > best.sc)) best = { sc, kind: 'goal', id: g.id };
    }
    for (const t of ctx.tasks) {
      if (t.date > today) continue;
      const sc = score(toks, t.title) + (t.done ? 0 : 0.5) + (t.date === date ? 0.5 : 0);
      if (sc >= 2 && (!best || sc > best.sc)) best = { sc, kind: 'task', id: t.id };
    }
    if (!best) return { type: 'unknown' };
    return { type: 'done', kind: best.kind, id: best.id, qty, date };
  }

  return { parseCommand, iconFor, tokenize };
})();
if (typeof module !== 'undefined') module.exports = VoiceParser;

/* ============ Parte interattiva (solo nel browser / app) ============ */
if (typeof window !== 'undefined') {
  const Cap = window.Capacitor;
  const native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  const NSR = native && Cap.registerPlugin('SpeechRecognition');
  const NTTS = native && Cap.registerPlugin('TextToSpeech');
  const WebSR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const voiceSupported = () => !!(NSR || WebSR);
  let undoStack = [];
  let listening = false, webRec = null;

  window.speak = function speak(text) {
    if (S.settings.voiceReply === false) return;
    const clean = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '');
    if (NTTS) { NTTS.speak({ text: clean, lang: 'it-IT', rate: 1.05 }).catch(() => {}); return; }
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'it-IT';
    const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith('it'));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  };

  const ctxNow = () => ({ goals: S.goals, tasks: S.tasks, today: todayKey(), now: nowHHMM() });

  function remainingToday(d) {
    const out = [];
    for (const g of S.goals) {
      if (!isActive(g, d)) continue;
      if (g.freq === 'daily') {
        const v = val(d, g);
        if (v < g.target) out.push(g.target === 1 ? g.name : `${g.name}, ${g.target - v}${g.unit ? ' ' + g.unit : ''}`);
      } else if (d === todayKey()) {
        const prog = R.sums[g.id + '|' + periodKey(g, d)] || 0;
        if (prog < g.target) out.push(`${g.name} (${prog} su ${g.target} ${g.freq === 'weekly' ? 'questa settimana' : 'questo mese'})`);
      }
    }
    for (const t of tasksOn(d)) if (!t.done) out.push(t.time ? `${t.title} alle ${t.time}` : t.title);
    return out;
  }

  // esegue l'azione e restituisce { ok, text }
  function execute(a) {
    const before = R.xp;
    const snap = JSON.stringify(S);
    const done = (text) => { undoStack.push(snap); if (undoStack.length > 20) undoStack.shift(); save(); render(); const gain = R.xp - before;
      return { ok: true, changed: true, text: text + (gain > 0 ? ` +${gain} XP!` : '') }; };
    switch (a.type) {
      case 'undo': {
        const prev = undoStack.pop();
        if (!prev) return { ok: false, text: 'Non c\'è niente da annullare.' };
        S = JSON.parse(prev); save(); render();
        return { ok: true, text: 'Fatto, ho annullato l\'ultima azione.' };
      }
      case 'status': {
        const next = xpForLevel(R.level + 1) - R.xp;
        return { ok: true, text: `Sei al livello ${R.level}, grado ${R.rank.title}, con ${R.xp} XP. Ti mancano ${next} XP per il livello ${R.level + 1}.` };
      }
      case 'query': {
        const list = remainingToday(a.date);
        const when = a.date === todayKey() ? 'Oggi' : 'Domani';
        if (!list.length) return { ok: true, text: a.date === todayKey() ? 'Hai completato tutto per oggi. Giornata perfetta!' : 'Per domani non hai ancora niente in programma.' };
        return { ok: true, text: `${when} ${a.date === todayKey() ? 'ti mancano' : 'hai'}: ${list.join('; ')}.` };
      }
      case 'negative': return { ok: false, text: 'Va bene, non segno niente. C\'è ancora tempo!' };
      case 'addTask': {
        const t = { id: uid(), done: false, xp: TASK_XP, ...a.task };
        S.tasks.push(t);
        if (t.time) askNotifOnce();
        return done(`Aggiunto per ${relDay(t.date).toLowerCase()}${t.time ? ' alle ' + t.time : ''}: ${t.title}.`);
      }
      case 'addGoal': {
        const g = { id: uid(), created: todayKey(), xp: DEFAULT_XP[a.goal.freq], ...a.goal };
        S.goals.push(g);
        if (g.remind) askNotifOnce();
        const fr = g.freq === 'daily' ? (g.days ? daysLabel(g) : 'ogni giorno') : g.freq === 'weekly' ? 'a settimana' : 'al mese';
        return done(`Nuovo obiettivo fisso: ${g.name}, ${g.target}${g.unit ? ' ' + g.unit : ''} ${fr}.`);
      }
      case 'done': {
        const d = a.date;
        if (a.kind === 'task') {
          const t = S.tasks.find(x => x.id === a.id);
          if (t.done) return { ok: false, text: `"${t.title}" era già segnato come fatto.` };
          t.done = true; if (t.date < d) t.date = d;
          return done(`Ottimo! "${t.title}" completato.`);
        }
        const g = S.goals.find(x => x.id === a.id);
        if (!isActive(g, d)) return { ok: false, text: `${g.name} non è in programma ${d === todayKey() ? 'oggi' : 'quel giorno'}.` };
        const cur = val(d, g);
        let nv;
        if (g.freq === 'daily') nv = a.qty != null ? cur + a.qty : Math.max(cur, g.target);
        else nv = cur + (a.qty != null ? a.qty : 1);
        if (nv === cur) return { ok: false, text: `${g.name} era già completato.` };
        S.log[d] ||= {}; S.log[d][g.id] = nv;
        save(); R = compute();
        const prog = g.freq === 'daily' ? nv : (R.sums[g.id + '|' + periodKey(g, d)] || 0);
        const unit = g.unit ? ' ' + g.unit : '';
        const per = g.freq === 'weekly' ? ' questa settimana' : g.freq === 'monthly' ? ' questo mese' : '';
        const msg = prog >= g.target
          ? `Grande! ${g.name} completato${g.target > 1 ? ` (${prog} su ${g.target}${unit}${per})` : ''}.`
          : `Segnato: ${g.name}, ${prog} su ${g.target}${unit}${per}. Te ne mancano ${g.target - prog}.`;
        return done((d !== todayKey() ? `Per ${relDay(d).toLowerCase()}: ` : '') + msg);
      }
    }
    return { ok: false, text: 'Non ho capito. Prova con "ho letto 10 pagine" oppure "domani alle 10 chiamare il dentista".' };
  }

  window.runVoiceCommand = function (alternatives) {
    if (typeof alternatives === 'string') { alternatives = [alternatives]; if (webRec) webRec.abort(); }
    let action = { type: 'unknown' }, heard = alternatives[0] || '';
    for (const alt of alternatives) {
      const a = VoiceParser.parseCommand(alt, ctxNow());
      if (a.type !== 'unknown') { action = a; heard = alt; break; }
    }
    const res = execute(action);
    showVoiceResult(heard, res);
    speak(res.text);
    return res;
  };

  /* ---- Microfono ---- */
  async function listen() {
    if (NSR) {
      try {
        const perm = await NSR.checkPermissions();
        if (perm.speechRecognition !== 'granted') {
          const r = await NSR.requestPermissions();
          if (r.speechRecognition !== 'granted') throw new Error('perm');
        }
        setVoiceStatus('🎙️ Ti ascolto…', true);
        const r = await NSR.start({ language: 'it-IT', maxResults: 3, partialResults: false, popup: true, prompt: 'Dimmi cosa hai fatto…' });
        return (r && r.matches) || [];
      } finally { setVoiceStatus('', false); }
    }
    return new Promise((resolve, reject) => {
      const rec = webRec = new WebSR();
      rec.lang = 'it-IT'; rec.interimResults = true; rec.maxAlternatives = 3; rec.continuous = false;
      let finalAlts = null;
      rec.onresult = e => {
        const res = e.results[e.results.length - 1];
        const live = document.getElementById('v-heard');
        if (live) live.textContent = '“' + res[0].transcript + '”';
        if (res.isFinal) finalAlts = Array.from(res).map(x => x.transcript);
      };
      rec.onerror = e => reject(new Error(e.error));
      rec.onend = () => { webRec = null; setVoiceStatus('', false); resolve(finalAlts || []); };
      setVoiceStatus('🎙️ Ti ascolto…', true);
      rec.start();
    });
  }

  window.startListening = async function () {
    if (listening) { if (webRec) webRec.stop(); return; }
    if (!voiceSupported()) { setVoiceStatus('Il riconoscimento vocale non è disponibile qui: usa Chrome su Android o scrivi il comando.', false); return; }
    listening = true;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    try {
      const alts = await listen();
      if (alts.length) runVoiceCommand(alts);
      else setVoiceStatus('Non ho sentito niente. Tocca il microfono e riprova.', false);
    } catch (e) {
      const m = String(e.message || e);
      setVoiceStatus(/perm|not-allowed|denied/.test(m) ? 'Serve il permesso per il microfono.' : /no-speech/.test(m) ? 'Non ho sentito niente, riprova.' : 'Errore del microfono: ' + m, false);
    } finally { listening = false; }
  };

  /* ---- Interfaccia ---- */
  const EXAMPLES = ['Ho letto 10 pagine', 'Ho fatto palestra', 'Domani alle 10 chiamare il dentista',
    'Ricordami di pagare la bolletta venerdì', 'Nuovo obiettivo bere 8 bicchieri al giorno', 'Cosa mi manca oggi?', 'Quanti punti ho?', 'Annulla'];

  window.openVoice = function (autoStart = true) {
    openModal(`
      <div style="text-align:center">
        <h3>Assistente vocale</h3>
        <button class="vmic" id="v-mic" onclick="startListening()" aria-label="Parla">🎤</button>
        <div id="v-status" class="muted" style="min-height:22px">${voiceSupported() ? 'Tocca il microfono e parla' : 'Voce non disponibile su questo browser: scrivi il comando'}</div>
        <div id="v-heard" style="font-weight:700;min-height:22px;margin-top:4px"></div>
        <div id="v-result"></div>
      </div>
      <form onsubmit="event.preventDefault();const i=document.getElementById('v-text');if(i.value.trim()){runVoiceCommand(i.value);i.value=''}" style="display:flex;gap:8px;margin-top:12px">
        <input id="v-text" placeholder="…oppure scrivi un comando" style="flex:1;height:42px;border:1px solid var(--border);border-radius:12px;padding:0 12px;background:var(--surface);font-size:16px">
        <button class="btn" type="submit" style="padding:0 14px">➤</button>
      </form>
      <p class="note" style="margin:12px 0 6px">Prova a dire:</p>
      <div class="chips">${EXAMPLES.map(e => `<button class="chip" onclick="runVoiceCommand(this.textContent)">${esc(e)}</button>`).join('')}</div>
      <button class="btn ghost full" style="margin-top:14px" onclick="closeModal()">Chiudi</button>`);
    if (autoStart && voiceSupported()) startListening();
  };

  function setVoiceStatus(text, on) {
    const st = document.getElementById('v-status'), mic = document.getElementById('v-mic');
    if (st && (text || !on)) st.textContent = text || 'Tocca il microfono per un altro comando';
    if (mic) mic.classList.toggle('on', on);
    const fab = document.getElementById('fab');
    if (fab) fab.classList.toggle('on', on);
    if (on) { const h = document.getElementById('v-heard'); if (h) h.textContent = ''; const r = document.getElementById('v-result'); if (r) r.innerHTML = ''; }
  }
  function showVoiceResult(heard, res) {
    if (!document.getElementById('v-result')) { toast(res.ok ? '🎤' : '🤔', heard, res.text); return; }
    document.getElementById('v-heard').textContent = heard ? '“' + heard + '”' : '';
    document.getElementById('v-result').innerHTML = `<div class="card vres ${res.ok ? 'ok' : ''}">${esc(res.text)}
      ${res.changed ? `<div><button class="smallbtn" style="margin-top:8px" onclick="runVoiceCommand('annulla')">↩️ Annulla</button></div>` : ''}</div>`;
  }

  // scorciatoia dall'icona dell'app: ?voice=1
  if (new URLSearchParams(location.search).get('voice') === '1') setTimeout(() => openVoice(true), 400);
}
