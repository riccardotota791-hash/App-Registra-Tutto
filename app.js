'use strict';
/* ============ Utility date ============ */
const pad = n => String(n).padStart(2, '0');
const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parse(k); d.setDate(d.getDate() + n); return key(d); };
const todayKey = () => key(new Date());
const monthKey = k => k.slice(0, 7);
const weekStart = k => { const d = parse(k); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return key(d); };
const isSunday = k => parse(k).getDay() === 0;
const isMonthEnd = k => addDays(k, 1).slice(8) === '01';
const daysInMonth = mk => { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const shiftMonth = (mk, n) => { const d = parse(mk + '-01'); d.setMonth(d.getMonth() + n); return monthKey(key(d)); };
const nowHHMM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const minutes = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const MESI = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
const GIORNI = ['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
// ordine italiano (lunedì primo) -> numero JS di getDay()
const WEEK = [{ n: 1, l: 'L' }, { n: 2, l: 'M' }, { n: 3, l: 'M' }, { n: 4, l: 'G' }, { n: 5, l: 'V' }, { n: 6, l: 'S' }, { n: 0, l: 'D' }];
const monthName = mk => { const [y, m] = mk.split('-').map(Number); return `${MESI[m - 1]} ${y}`; };
const niceDay = k => { const d = parse(k); return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`; };
const relDay = k => { const t = todayKey(); return k === t ? 'Oggi' : k === addDays(t, 1) ? 'Domani' : k === addDays(t, -1) ? 'Ieri' : niceDay(k); };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);

/* ============ Stato ============ */
const STORE = 'quotidianita_v1';
function defaultState() {
  return { name: 'Eroe', skin: null, goals: [], tasks: [], log: {}, seen: {}, maxLevel: 1, lastSeen: null,
    settings: { notif: false, evening: '21:00', voiceReply: true }, fired: {} };
}
function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) { const s = Object.assign(defaultState(), JSON.parse(raw)); s.settings = Object.assign(defaultState().settings, s.settings); return s; }
  } catch (e) {}
  return defaultState();
}
function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} scheduleNativeSync(); }
let S = load();

/* ============ Regole di gioco ============ */
const FREQ = { daily: 'Giornaliero', weekly: 'Settimanale', monthly: 'Mensile' };
const DEFAULT_XP = { daily: 10, weekly: 40, monthly: 150 };
const TASK_XP = 15;
const PERFECT_DAY_BONUS = 25;
const GRADE_BONUS = { S: 300, A: 150, B: 75, C: 0, D: 0 };

// XP cumulativi per raggiungere il livello L: 0, 100, 300, 600, 1000, ...
const xpForLevel = L => 50 * L * (L - 1);
const levelFromXp = xp => { let L = 1; while (xp >= xpForLevel(L + 1)) L++; return L; };

const RANKS = [
  { lvl: 1,  title: 'Novizio',       skin: '🐣' },
  { lvl: 3,  title: 'Apprendista',   skin: '🧑‍🎓' },
  { lvl: 5,  title: 'Avventuriero',  skin: '🧝' },
  { lvl: 8,  title: 'Guerriero',     skin: '🥷' },
  { lvl: 12, title: 'Mago',          skin: '🧙' },
  { lvl: 16, title: 'Campione',      skin: '🦸' },
  { lvl: 20, title: 'Leggenda',      skin: '🐉' },
  { lvl: 30, title: 'Immortale',     skin: '👑' },
];
const rankFor = L => RANKS.filter(r => r.lvl <= L).pop();

// Premi fissi. "test" riceve le statistiche correnti mentre si scorre lo storico.
const ACHIEVEMENTS = [
  { id: 'first',  icon: '👣', title: 'Primo passo',        desc: 'Completa il tuo primo obiettivo',                xp: 50,   test: r => r.completions >= 1 },
  { id: 'pd1',    icon: '🌟', title: 'Giornata perfetta',  desc: 'Completa tutto quello che avevi in programma in un giorno', xp: 50, test: r => r.perfectDays >= 1 },
  { id: 'task1',  icon: '📝', title: 'Organizzato',        desc: 'Completa una cosa da fare messa in calendario',   xp: 50,   test: r => r.tasksDone >= 1 },
  { id: 'plan',   icon: '🗓️', title: 'Pianificatore',      desc: 'Completa un obiettivo settimanale o mensile',     xp: 100,  test: r => r.periodDone >= 1 },
  { id: 's7',     icon: '🔥', title: 'In fiamme',          desc: 'Serie di 7 volte di fila su un obiettivo',        xp: 150,  test: r => r.bestStreak >= 7 },
  { id: 'c50',    icon: '💪', title: 'Costante',           desc: '50 obiettivi completati',                         xp: 150,  test: r => r.completions >= 50 },
  { id: 'task25', icon: '📋', title: 'Macchina da guerra', desc: '25 cose da fare completate',                      xp: 250,  test: r => r.tasksDone >= 25 },
  { id: 'pd7',    icon: '🦁', title: 'Settimana d\'oro',   desc: '7 giornate perfette di fila',                     xp: 300,  test: r => r.bestPerfect >= 7, skin: '🦁' },
  { id: 's30',    icon: '☄️', title: 'Inarrestabile',      desc: 'Serie di 30 volte di fila su un obiettivo',       xp: 500,  test: r => r.bestStreak >= 30, skin: '🐺' },
  { id: 'c200',   icon: '⚔️', title: 'Instancabile',       desc: '200 obiettivi completati',                        xp: 400,  test: r => r.completions >= 200 },
  { id: 'pd30',   icon: '🏰', title: 'Mese leggendario',   desc: '30 giornate perfette di fila',                    xp: 1000, test: r => r.bestPerfect >= 30, skin: '🦅' },
  { id: 's100',   icon: '💎', title: 'Leggenda vivente',   desc: 'Serie di 100 volte di fila su un obiettivo',      xp: 1500, test: r => r.bestStreak >= 100, skin: '🔮' },
];
const PERFECT_MONTH_XP = 500;

const gradeOf = p => p >= 0.95 ? 'S' : p >= 0.85 ? 'A' : p >= 0.7 ? 'B' : p >= 0.5 ? 'C' : 'D';
// un obiettivo giornaliero può valere solo in certi giorni della settimana (g.days)
const isActive = (g, k) => g.created <= k && (!g.archived || k < g.archived)
  && (g.freq !== 'daily' || !g.days || g.days.includes(parse(k).getDay()));
const periodKey = (g, k) => g.freq === 'weekly' ? weekStart(k) : monthKey(k);
const val = (k, g) => (S.log[k] && S.log[k][g.id]) || 0;
const tasksOn = k => S.tasks.filter(t => t.date === k).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
const daysLabel = g => !g.days || g.days.length === 7 ? 'tutti i giorni'
  : WEEK.filter(w => g.days.includes(w.n)).map(w => GIORNI[w.n].slice(0, 3)).join(' ');

/* ============ Motore: ricalcola tutto dallo storico ============
   Ogni punto è derivato dal registro, quindi togliere una spunta
   restituisce esattamente i punti guadagnati. */
function compute() {
  const today = todayKey();
  const R = { xp: 0, completions: 0, periodDone: 0, tasksDone: 0, perfectDays: 0, perfectStreak: 0, bestPerfect: 0,
    streak: {}, best: {}, bestStreak: 0, days: {}, months: {}, ach: {}, sums: {} };
  const goals = S.goals;
  const byDate = {};
  for (const t of S.tasks) if (t.date <= today) (byDate[t.date] ||= []).push(t);
  let start = goals.reduce((m, g) => g.created < m ? g.created : m, today);
  for (const d in byDate) if (d < start) start = d;
  const dailyDone = {}, dailySched = {}; // goalId|mese -> giorni fatti / giorni previsti

  const addXP = (d, n) => { R.xp += n; R.days[d].xp += n; R.months[monthKey(d)].xp += n; };
  const unlock = (id, d, meta) => { if (!R.ach[id]) { R.ach[id] = { ...meta, id, date: d }; addXP(d, meta.xp); } };

  for (let d = start; d <= today; d = addDays(d, 1)) {
    const mk = monthKey(d);
    const M = R.months[mk] ||= { poss: 0, done: 0, xp: 0, perfectDays: 0 };
    const day = R.days[d] = { total: 0, done: 0, xp: 0, items: [], perfect: false };

    for (const g of goals) {
      if (!isActive(g, d)) continue;
      const v = val(d, g);
      if (g.freq === 'daily') {
        const done = v >= g.target, dk = g.id + '|' + mk;
        day.total++; M.poss++;
        dailySched[dk] = (dailySched[dk] || 0) + 1;
        if (done) {
          day.done++; M.done++; R.completions++;
          const st = R.streak[g.id] = (R.streak[g.id] || 0) + 1;
          R.best[g.id] = Math.max(R.best[g.id] || 0, st);
          R.bestStreak = Math.max(R.bestStreak, st);
          // bonus serie: +5% per ogni volta consecutiva, massimo +50%
          addXP(d, g.xp + Math.floor(g.xp * 0.05 * Math.min(st - 1, 10)));
          dailyDone[dk] = (dailyDone[dk] || 0) + 1;
        } else if (d < today) R.streak[g.id] = 0;
        day.items.push({ icon: g.icon, name: g.name, v, target: g.target, unit: g.unit, done });
      } else {
        const pk = g.id + '|' + periodKey(g, d);
        const prev = R.sums[pk] || 0, now = prev + v;
        R.sums[pk] = now;
        if (prev < g.target && now >= g.target) { R.completions++; R.periodDone++; addXP(d, g.xp); }
        const periodEnd = g.freq === 'weekly' ? isSunday(d) : isMonthEnd(d);
        if (periodEnd || (d === today && now >= g.target)) { M.poss++; if (now >= g.target) M.done++; }
      }
    }

    for (const t of byDate[d] || []) {
      day.total++; M.poss++;
      if (t.done) { day.done++; M.done++; R.completions++; R.tasksDone++; addXP(d, t.xp); }
      day.items.push({ icon: t.icon || '📝', name: t.title, v: t.done ? 1 : 0, target: 1, unit: '', done: !!t.done });
    }

    if (day.total > 0 && day.done === day.total) {
      day.perfect = true; R.perfectDays++; M.perfectDays++;
      R.bestPerfect = Math.max(R.bestPerfect, ++R.perfectStreak);
      addXP(d, PERFECT_DAY_BONUS);
    } else if (day.total > 0 && d < today) R.perfectStreak = 0;

    for (const a of ACHIEVEMENTS) if (a.test(R)) unlock(a.id, d, a);

    // Fine mese (solo mesi conclusi): pagella + premi "mese perfetto"
    if (isMonthEnd(d) && d < today) {
      const first = mk + '-01';
      for (const g of goals) {
        if (g.freq !== 'daily' || g.created > first || (g.archived && g.archived <= d)) continue;
        const dk = g.id + '|' + mk;
        if (dailySched[dk] && dailyDone[dk] === dailySched[dk])
          unlock('pm|' + g.id + '|' + mk, d, { icon: '🏆', title: `Mese perfetto: ${g.name}`,
            desc: `Hai completato "${g.name}" ogni volta prevista di ${monthName(mk)}!`, xp: PERFECT_MONTH_XP, skin: '🦄' });
      }
      if (M.poss) {
        M.grade = gradeOf(M.done / M.poss);
        M.bonus = GRADE_BONUS[M.grade];
        if (M.bonus) addXP(d, M.bonus);
        M.closed = true;
      }
    }
  }
  R.level = levelFromXp(R.xp);
  R.rank = rankFor(R.level);
  return R;
}

function skinsFor(R) {
  const list = RANKS.map(r => ({ skin: r.skin, label: 'Lv ' + r.lvl, ok: R.level >= r.lvl }));
  for (const a of ACHIEVEMENTS) if (a.skin) list.push({ skin: a.skin, label: a.title, ok: !!R.ach[a.id] });
  list.push({ skin: '🦄', label: 'Mese perfetto', ok: Object.keys(R.ach).some(k => k.startsWith('pm|')) });
  return list;
}

/* ============ UI ============ */
let tab = 'oggi';
let viewDay = todayKey();
let calMonth = monthKey(todayKey());
let calSel = todayKey();
let R = compute();

const TABS = [
  { id: 'oggi', icon: '✅', label: 'Oggi' },
  { id: 'calendario', icon: '📅', label: 'Calendario' },
  { id: 'obiettivi', icon: '🎯', label: 'Obiettivi' },
  { id: 'premi', icon: '🏆', label: 'Premi' },
  { id: 'eroe', icon: '🧙', label: 'Eroe' },
];

function render() {
  R = compute();
  renderHero(); renderTabs();
  const v = document.getElementById('view');
  v.innerHTML = ({ oggi: viewOggi, calendario: viewCalendario, obiettivi: viewObiettivi, premi: viewPremi, eroe: viewEroe })[tab]();
  checkRewards();
}

function renderHero() {
  const L = R.level, base = xpForLevel(L), next = xpForLevel(L + 1);
  const pct = Math.round((R.xp - base) / (next - base) * 100);
  const skin = S.skin && skinsFor(R).some(s => s.ok && s.skin === S.skin) ? S.skin : R.rank.skin;
  document.getElementById('hero').innerHTML = `
    <div class="row">
      <div class="avatar">${skin}</div>
      <div style="flex:1;min-width:0">
        <h1>${esc(S.name)} <span class="lvl">Lv ${L}</span></h1>
        <div class="rank">${R.rank.title} · ${R.xp} XP totali</div>
        <div class="xpbar"><i style="width:${pct}%"></i></div>
        <div class="xptext"><span>${R.xp - base} / ${next - base} XP</span><span>Lv ${L + 1} tra ${next - R.xp} XP</span></div>
      </div>
    </div>`;
}

function renderTabs() {
  const btns = TABS.map(t =>
    `<button class="${t.id === tab ? 'on' : ''}" onclick="go('${t.id}')"><span>${t.icon}</span>${t.label}</button>`);
  // al centro il pulsante dell'assistente vocale
  btns.splice(2, 0, `<button class="mictab" id="fab" onclick="openVoice(true)" aria-label="Assistente vocale"><span>🎤</span>Voce</button>`);
  document.getElementById('tabs').innerHTML = btns.join('');
}
function go(t) { tab = t; closeModal(); render(); window.scrollTo(0, 0); }

function openModal(html) {
  document.getElementById('modal').innerHTML = `<div class="modal" onclick="if(event.target===this)closeModal()"><div class="card">${html}</div></div>`;
}
function closeModal() { document.getElementById('modal').innerHTML = ''; }

/* ---- Oggi ---- */
function goalRow(g, d, prog) {
  const v = val(d, g);
  const target = g.target, done = prog >= target;
  const pct = Math.min(100, Math.round(prog / target * 100));
  const st = g.freq === 'daily' && R.streak[g.id] ? `<span class="streak">🔥${R.streak[g.id]}</span>` : '';
  const unit = g.unit ? ' ' + esc(g.unit) : '';
  const bell = g.remind ? ` · <span style="white-space:nowrap">🔔${g.remind}</span>` : '';
  let sub;
  if (g.freq === 'daily') sub = (target === 1 ? (done ? 'Fatto!' : 'Da fare') : `${prog} / ${target}${unit}`) + bell;
  else sub = `${prog} / ${target}${unit} ${g.freq === 'weekly' ? 'questa settimana' : 'questo mese'}` + (v ? ` · oggi +${v}` : '') + bell;
  const ctrl = (g.freq === 'daily' && target === 1)
    ? `<button class="check ${done ? 'on' : ''}" onclick="toggle('${g.id}')" aria-label="Segna">${done ? '✓' : ''}</button>`
    : `<div class="ctrl">
         <button onclick="bump('${g.id}',-1)" aria-label="Meno">−</button>
         <input type="number" inputmode="numeric" min="0" value="${v}" onchange="setVal('${g.id}',this.value)" aria-label="Valore di oggi">
         <button onclick="bump('${g.id}',1)" aria-label="Più">+</button>
       </div>`;
  return `<div class="card goal ${done ? 'ok' : ''}">
    <div class="ic">${esc(g.icon || '⭐')}</div>
    <div class="info">
      <div class="name">${esc(g.name)}</div>
      <div class="sub">${sub}${st}<span class="xpchip">+${g.xp} XP</span></div>
      ${target > 1 ? `<div class="pbar"><i style="width:${pct}%"></i></div>` : ''}
    </div>
    ${ctrl}
  </div>`;
}

function taskRow(t, opts = {}) {
  const today = todayKey();
  const canCheck = t.date <= today;
  const late = !t.done && t.date < today;
  const when = [opts.showDate || late ? relDay(t.date) : '', t.time ? '🔔 ' + t.time : ''].filter(Boolean).join(' · ');
  return `<div class="card goal task ${t.done ? 'ok' : ''} ${late ? 'late' : ''}">
    <div class="ic">${esc(t.icon || '📝')}</div>
    <div class="info" onclick="taskForm('${t.id}')" style="cursor:pointer">
      <div class="name">${esc(t.title)}</div>
      <div class="sub">${when ? `<span class="when">${when}</span> ` : ''}<span class="xpchip">+${t.xp} XP</span></div>
    </div>
    ${late && opts.moveBtn ? `<button class="smallbtn" onclick="moveTask('${t.id}')">→ Oggi</button>` : ''}
    ${canCheck ? `<button class="check ${t.done ? 'on' : ''}" onclick="toggleTask('${t.id}')" aria-label="Fatto">${t.done ? '✓' : ''}</button>` : ''}
  </div>`;
}

function viewOggi() {
  const d = viewDay, today = todayKey();
  const active = S.goals.filter(g => isActive(g, d));
  const daily = active.filter(g => g.freq === 'daily');
  const weekly = active.filter(g => g.freq === 'weekly');
  const monthly = active.filter(g => g.freq === 'monthly');
  const tasks = tasksOn(d);
  const late = d === today ? S.tasks.filter(t => !t.done && t.date < today && t.date >= addDays(today, -14)) : [];
  const tomorrow = tasksOn(addDays(d, 1));
  const day = R.days[d] || { total: 0, done: 0, xp: 0 };
  const pct = day.total ? Math.round(day.done / day.total * 100) : 0;
  const allDone = day.total > 0 && day.done === day.total;
  const minDay = Math.min(...[today, ...S.goals.map(g => g.created), ...S.tasks.map(t => t.date)].map(k => parse(k).getTime()));
  const label = d === today ? 'Oggi' : d === addDays(today, -1) ? 'Ieri' : 'Giorno passato';

  let msg;
  const left = day.total - day.done;
  if (!day.total) msg = `<b>Niente in programma</b><span class="muted">Aggiungi un obiettivo fisso o una cosa da fare.</span>`;
  else if (allDone) msg = `<b>🎉 Obiettivo giornaliero raggiunto!</b><span class="muted">Giornata perfetta: +${PERFECT_DAY_BONUS} XP bonus. Oggi hai guadagnato ${day.xp} XP.</span>`;
  else msg = `<b>${day.done} di ${day.total} completati</b><span class="muted">${left === 1 ? 'Ne manca 1' : `Ne mancano ${left}`} per la giornata perfetta (+${PERFECT_DAY_BONUS} XP). ${day.xp} XP finora.</span>`;

  // per i giorni passati la somma del periodo si ferma a quel giorno
  const periodProg = g => {
    let s = 0, k = g.freq === 'weekly' ? weekStart(d) : monthKey(d) + '-01';
    for (; k <= d; k = addDays(k, 1)) if (isActive(g, k)) s += val(k, g);
    return s;
  };

  return `
    <div class="daynav">
      <button onclick="shiftDay(-1)" ${parse(d).getTime() <= minDay ? 'disabled' : ''} aria-label="Giorno precedente">‹</button>
      <div class="d">${label}<small>${niceDay(d)}</small></div>
      <button onclick="shiftDay(1)" ${d >= today ? 'disabled' : ''} aria-label="Giorno successivo">›</button>
    </div>
    <div class="card summary ${allDone ? 'done' : ''}">
      <div class="ring" style="--p:${pct}"><span>${allDone ? '🏅' : pct + '%'}</span></div>
      <div class="msg">${msg}</div>
    </div>
    ${!S.goals.length && !S.tasks.length ? `<div class="card empty" style="margin-top:14px">Nessun obiettivo ancora.<br><br><button class="btn" onclick="go('obiettivi')">Crea il primo obiettivo</button></div>` : ''}
    ${late.length ? `<h2>⏰ In ritardo</h2><div class="stack">${late.map(t => taskRow(t, { moveBtn: true })).join('')}</div>` : ''}
    <h2>📝 Cose da fare <small>${tasks.filter(t => t.done).length}/${tasks.length}</small></h2>
    <div class="stack">${tasks.map(t => taskRow(t)).join('')}</div>
    <button class="addbtn" onclick="taskForm(null,'${d}')">+ Aggiungi per ${relDay(d).toLowerCase()}</button>
    ${daily.length ? `<h2>☀️ Fissi giornalieri</h2><div class="stack">${daily.map(g => goalRow(g, d, val(d, g))).join('')}</div>` : ''}
    ${weekly.length ? `<h2>📆 Settimanali</h2><div class="stack">${weekly.map(g => goalRow(g, d, periodProg(g))).join('')}</div>` : ''}
    ${monthly.length ? `<h2>🗓️ Mensili</h2><div class="stack">${monthly.map(g => goalRow(g, d, periodProg(g))).join('')}</div>` : ''}
    ${d === today ? `<h2>🌙 Domani <small>${tomorrow.length === 1 ? '1 cosa' : tomorrow.length + ' cose'} da fare</small></h2>
      <div class="stack">${tomorrow.map(t => taskRow(t)).join('')}</div>
      <button class="addbtn" onclick="taskForm(null,'${addDays(today, 1)}')">+ Programma qualcosa per domani</button>` : ''}
  `;
}

function shiftDay(n) { viewDay = addDays(viewDay, n); if (viewDay > todayKey()) viewDay = todayKey(); render(); }
function setVal(id, v) {
  v = Math.max(0, Math.floor(Number(v) || 0));
  const d = viewDay;
  S.log[d] ||= {};
  if (v) S.log[d][id] = v; else delete S.log[d][id];
  if (!Object.keys(S.log[d]).length) delete S.log[d];
  save(); render();
}
function bump(id, n) { const g = S.goals.find(x => x.id === id); setVal(id, val(viewDay, g) + n); }
function toggle(id) { const g = S.goals.find(x => x.id === id); setVal(id, val(viewDay, g) >= g.target ? 0 : g.target); }

/* ---- Cose da fare (attività singole in calendario) ---- */
function toggleTask(id) {
  const t = S.tasks.find(x => x.id === id);
  if (t.date > todayKey()) return;
  t.done = !t.done; save(); render();
}
function moveTask(id) { const t = S.tasks.find(x => x.id === id); t.date = todayKey(); save(); render(); }

function taskForm(id, date) {
  const t = id ? S.tasks.find(x => x.id === id) : { icon: '📝', title: '', date: date || addDays(todayKey(), 1), time: '', xp: TASK_XP };
  openModal(`
    <h3>${id ? 'Modifica' : 'Nuova'} cosa da fare</h3>
    <p class="note" style="margin:2px 0 12px">Vale solo per il giorno scelto e dà punti quando la completi.</p>
    <form onsubmit="saveTask(event,${id ? `'${id}'` : 'null'})">
      <div class="grid3">
        <div class="field"><label for="t-icon">Icona</label><input id="t-icon" maxlength="4" value="${esc(t.icon)}"></div>
        <div class="field"><label for="t-title">Cosa devi fare?</label><input id="t-title" required value="${esc(t.title)}" placeholder="es. Chiamare il dentista"></div>
      </div>
      <div class="grid2">
        <div class="field"><label for="t-date">Giorno</label><input id="t-date" type="date" required value="${t.date}"></div>
        <div class="field"><label for="t-time">Promemoria (ora)</label><input id="t-time" type="time" value="${t.time || ''}"></div>
      </div>
      <div class="field"><label for="t-xp">XP ricompensa</label><input id="t-xp" type="number" min="1" value="${t.xp}"></div>
      <div class="row2">
        ${id ? `<button type="button" class="btn danger" onclick="deleteTask('${id}')">Elimina</button>` : `<button type="button" class="btn ghost" onclick="closeModal()">Annulla</button>`}
        <button class="btn" type="submit">Salva</button>
      </div>
    </form>`);
  if (!id) setTimeout(() => document.getElementById('t-title').focus(), 50);
}
function saveTask(e, id) {
  e.preventDefault();
  const $ = i => document.getElementById(i).value.trim();
  const data = { icon: $('t-icon') || '📝', title: $('t-title'), date: $('t-date'), time: $('t-time'),
    xp: Math.max(1, Math.floor(Number($('t-xp')) || TASK_XP)) };
  if (!data.title || !data.date) return;
  if (id) Object.assign(S.tasks.find(x => x.id === id), data);
  else { S.tasks.push({ id: uid(), done: false, ...data }); toast('📝', 'Aggiunto in calendario', `${relDay(data.date)}: ${data.title}`); }
  if (data.time) askNotifOnce();
  save(); closeModal(); render();
}
function deleteTask(id) {
  if (!confirm('Eliminare questa cosa da fare?')) return;
  S.tasks = S.tasks.filter(x => x.id !== id); save(); closeModal(); render();
}

/* ---- Calendario ---- */
function viewCalendario() {
  const mk = calMonth, today = todayKey();
  const M = R.months[mk] || { poss: 0, done: 0, xp: 0, perfectDays: 0 };
  const p = M.poss ? M.done / M.poss : 0;
  const grade = M.poss ? (M.grade || gradeOf(p)) : '–';
  const first = parse(mk + '-01'), offset = (first.getDay() + 6) % 7, dim = daysInMonth(mk);
  const taskDays = new Set(S.tasks.filter(t => !t.done).map(t => t.date));
  let cells = WEEK.map(w => `<div class="h">${w.l}</div>`).join('');
  cells += '<div></div>'.repeat(offset);
  for (let i = 1; i <= dim; i++) {
    const k = `${mk}-${pad(i)}`, day = R.days[k];
    let cls = 'c';
    if (k > today) cls += ' fut' + (taskDays.has(k) ? '' : ' empty');
    else if (day && day.total) {
      const r = day.done / day.total;
      cls += day.perfect ? ' l4' : r >= 0.66 ? ' l3' : r >= 0.33 ? ' l2' : r > 0 ? ' l1' : '';
    }
    if (k === today) cls += ' today';
    if (k === calSel) cls += ' sel';
    cells += `<button class="${cls}" onclick="calSel='${k}';render()" aria-label="${niceDay(k)}">${i}${taskDays.has(k) ? '<span class="dot"></span>' : ''}</button>`;
  }
  const awards = Object.values(R.ach).filter(a => a.id.startsWith('pm|') && a.id.endsWith(mk));
  const nextM = shiftMonth(mk, 1);

  // dettaglio del giorno selezionato
  const sel = calSel, selTasks = tasksOn(sel), selDay = R.days[sel];
  const fixed = S.goals.filter(g => g.freq === 'daily' && (sel > today ? (!g.archived && (!g.days || g.days.includes(parse(sel).getDay()))) : isActive(g, sel)));
  let detail = `<h2>${sel === today ? '📍' : sel > today ? '🔮' : '📖'} ${relDay(sel)} <small>${sel === today || sel.slice(0, 7) !== mk || relDay(sel) !== niceDay(sel) ? niceDay(sel) : ''}</small></h2>`;
  if (sel <= today && selDay && selDay.total)
    detail += `<p class="muted" style="margin:-4px 0 8px;font-size:13px">${selDay.done}/${selDay.total} completati · ${selDay.xp} XP${selDay.perfect ? ' · 🌟 giornata perfetta' : ''}</p>`;
  detail += `<div class="stack">${selTasks.map(t => taskRow(t)).join('')}</div>
    <button class="addbtn" onclick="taskForm(null,'${sel}')">+ Aggiungi cosa da fare</button>`;
  if (fixed.length) detail += `<h2 style="font-size:14px">🔁 Fissi di questo giorno</h2>
    <div class="card"><ul class="reslist" style="margin:0">${fixed.map(g => {
      const st = sel > today ? '⏳' : val(sel, g) >= g.target ? '✅' : sel === today ? '⏳' : '❌';
      return `<li>${st} ${esc(g.icon || '')} ${esc(g.name)}<span class="muted" style="margin-left:auto">${g.target}${g.unit ? ' ' + esc(g.unit) : ''}</span></li>`;
    }).join('')}</ul></div>`;
  if (sel <= today) detail += `<button class="btn ghost full" style="margin-top:10px" onclick="openDay('${sel}')">Apri e modifica questo giorno</button>`;

  return `
    <div class="daynav">
      <button onclick="calMonth=shiftMonth(calMonth,-1);render()" aria-label="Mese precedente">‹</button>
      <div class="d" style="text-transform:capitalize">${monthName(mk)}<small>${M.closed ? 'Mese concluso' : mk === monthKey(today) ? 'In corso' : mk > monthKey(today) ? 'Da pianificare' : ''}</small></div>
      <button onclick="calMonth='${nextM}';render()" aria-label="Mese successivo">›</button>
    </div>
    ${mk <= monthKey(today) ? `<div class="card" style="margin-top:12px;display:flex;gap:16px;align-items:center">
      <div class="grade ${grade}">${grade}</div>
      <div style="flex:1">
        <b>Punteggio del mese: ${Math.round(p * 100)}%</b>
        <div class="muted" style="font-size:13px">${M.done}/${M.poss} completati · ${M.perfectDays} giornate perfette · ${M.xp} XP
          ${M.bonus ? `<br>Bonus pagella: +${M.bonus} XP` : (!M.closed && M.poss ? `<br>A fine mese: S = +${GRADE_BONUS.S} XP, A = +${GRADE_BONUS.A}, B = +${GRADE_BONUS.B}` : '')}</div>
      </div>
    </div>` : ''}
    <div class="card" style="margin-top:10px">
      <div class="cal">${cells}</div>
      <div class="legend">Meno <i style="background:var(--heat-0)"></i><i style="background:var(--heat-1)"></i><i style="background:var(--heat-2)"></i><i style="background:var(--heat-3)"></i> Più <i style="background:var(--heat-4);margin-left:8px"></i> Perfetta · <span style="color:var(--accent)">●</span> da fare</div>
    </div>
    ${detail}
    ${awards.length ? `<h2>🏆 Premi del mese</h2><div class="stack">${awards.map(a => achCard(a)).join('')}</div>` : ''}`;
}
function openDay(k) { viewDay = k; go('oggi'); }

/* ---- Obiettivi fissi ---- */
const PRESETS = [
  { icon: '📖', name: 'Leggere', freq: 'daily', target: 10, unit: 'pagine' },
  { icon: '💧', name: 'Bere acqua', freq: 'daily', target: 8, unit: 'bicchieri' },
  { icon: '🧘', name: 'Meditare', freq: 'daily', target: 1, unit: '' },
  { icon: '🚶', name: 'Camminare', freq: 'daily', target: 30, unit: 'minuti' },
  { icon: '🏋️', name: 'Palestra', freq: 'daily', target: 1, unit: '', days: [1, 3, 5] },
  { icon: '🏃', name: 'Allenamento', freq: 'weekly', target: 3, unit: 'volte' },
  { icon: '📞', name: 'Chiamare la famiglia', freq: 'weekly', target: 1, unit: '' },
  { icon: '💰', name: 'Risparmiare', freq: 'monthly', target: 200, unit: '€' },
  { icon: '📚', name: 'Finire un libro', freq: 'monthly', target: 1, unit: '' },
];

function viewObiettivi() {
  const active = S.goals.filter(g => !g.archived);
  return `
    <h2>➕ Nuovo obiettivo fisso</h2>
    <div class="card">
      <p class="note" style="margin:0 0 10px">Gli obiettivi fissi si ripetono da soli (ogni giorno, in certi giorni, ogni settimana o ogni mese). Per le cose da fare una volta sola usa il <a href="#" onclick="go('calendario');return false">Calendario</a>.</p>
      <div class="chips">${PRESETS.map((p, i) => `<button class="chip" onclick="goalForm(null,${i})">${p.icon} ${esc(p.name)}</button>`).join('')}</div>
      <button class="btn full" style="margin-top:12px" onclick="goalForm()">Crea obiettivo personalizzato</button>
    </div>
    <h2>🎯 I tuoi obiettivi fissi <small>${active.length}</small></h2>
    <div class="stack">
      ${active.length ? active.map(g => `
        <div class="card goal" onclick="goalForm('${g.id}')" style="cursor:pointer">
          <div class="ic">${esc(g.icon || '⭐')}</div>
          <div class="info">
            <div class="name">${esc(g.name)}</div>
            <div class="sub">${g.freq === 'daily' ? daysLabel(g) : FREQ[g.freq]} · ${g.target}${g.unit ? ' ' + esc(g.unit) : (g.target === 1 ? ' (spunta)' : '')} · ${g.xp} XP
              ${g.remind ? ` · 🔔${g.remind}` : ''}${g.freq === 'daily' ? ` · record 🔥${R.best[g.id] || 0}` : ''}</div>
          </div>
          <span class="muted">✏️</span>
        </div>`).join('') : `<div class="card empty">Nessun obiettivo. Usa le idee veloci qui sopra!</div>`}
    </div>`;
}

let formDays = null;
function goalForm(id, presetIdx) {
  const p = presetIdx != null ? PRESETS[presetIdx] : null;
  const g = id ? S.goals.find(x => x.id === id)
    : { icon: p ? p.icon : '⭐', name: p ? p.name : '', freq: p ? p.freq : 'daily', target: p ? p.target : 1,
        unit: p ? p.unit : '', xp: DEFAULT_XP[p ? p.freq : 'daily'], days: p && p.days ? p.days : null, remind: '' };
  formDays = g.days ? [...g.days] : WEEK.map(w => w.n);
  openModal(`
    <h3>${id ? 'Modifica obiettivo' : 'Nuovo obiettivo fisso'}</h3>
    <form onsubmit="saveGoal(event,${id ? `'${id}'` : 'null'})" style="margin-top:12px">
      <div class="grid3">
        <div class="field"><label for="f-icon">Icona</label><input id="f-icon" maxlength="4" value="${esc(g.icon)}"></div>
        <div class="field"><label for="f-name">Nome</label><input id="f-name" required value="${esc(g.name)}" placeholder="es. Leggere"></div>
      </div>
      <div class="grid2">
        <div class="field"><label for="f-freq">Frequenza</label>
          <select id="f-freq" onchange="onFreq(this.value)">
            ${Object.entries(FREQ).map(([k, l]) => `<option value="${k}" ${g.freq === k ? 'selected' : ''}>${l}</option>`).join('')}
          </select></div>
        <div class="field"><label for="f-xp">XP ricompensa</label><input id="f-xp" type="number" min="1" value="${g.xp}"></div>
      </div>
      <div class="field" id="f-days-wrap" style="${g.freq === 'daily' ? '' : 'display:none'}"><label>In quali giorni?</label>
        <div class="wd" id="f-days">${daysButtons()}</div></div>
      <div class="grid2">
        <div class="field"><label for="f-target">Quantità</label><input id="f-target" type="number" min="1" value="${g.target}"></div>
        <div class="field"><label for="f-unit">Unità</label><input id="f-unit" value="${esc(g.unit || '')}" placeholder="pagine, minuti…"></div>
      </div>
      <div class="field"><label for="f-remind">🔔 Promemoria (ora, facoltativo)</label><input id="f-remind" type="time" value="${g.remind || ''}"></div>
      <p class="note" style="margin:0 0 6px">Quantità 1 = semplice spunta. Il promemoria arriva solo se non l'hai ancora completato.</p>
      <div class="row2">
        ${id ? `<button type="button" class="btn danger" onclick="archiveGoal('${id}')">Rimuovi</button>` : `<button type="button" class="btn ghost" onclick="closeModal()">Annulla</button>`}
        <button class="btn" type="submit">Salva</button>
      </div>
    </form>`);
}
function daysButtons() {
  return WEEK.map(w => `<button type="button" class="${formDays.includes(w.n) ? 'on' : ''}" onclick="toggleFormDay(${w.n})">${w.l}</button>`).join('');
}
function toggleFormDay(n) {
  formDays = formDays.includes(n) ? formDays.filter(x => x !== n) : [...formDays, n];
  document.getElementById('f-days').innerHTML = daysButtons();
}
function onFreq(v) {
  document.getElementById('f-xp').value = DEFAULT_XP[v];
  document.getElementById('f-days-wrap').style.display = v === 'daily' ? '' : 'none';
}
function saveGoal(e, id) {
  e.preventDefault();
  const $ = i => document.getElementById(i).value.trim();
  const name = $('f-name'); if (!name) return;
  const freq = $('f-freq');
  if (freq === 'daily' && !formDays.length) { alert('Scegli almeno un giorno'); return; }
  const data = { icon: $('f-icon') || '⭐', name, freq,
    target: Math.max(1, Math.floor(Number($('f-target')) || 1)), unit: $('f-unit'),
    xp: Math.max(1, Math.floor(Number($('f-xp')) || 10)),
    days: freq === 'daily' && formDays.length < 7 ? [...formDays].sort() : null, remind: $('f-remind') };
  if (id) Object.assign(S.goals.find(x => x.id === id), data);
  else { S.goals.push({ id: uid(), created: todayKey(), ...data }); toast('🎯', 'Obiettivo aggiunto', name); }
  if (data.remind) askNotifOnce();
  save(); closeModal(); render();
}
function archiveGoal(id) {
  const g = S.goals.find(x => x.id === id);
  if (!confirm(`Rimuovere "${g.name}"? I punti già guadagnati restano.`)) return;
  if (g.created === todayKey()) S.goals = S.goals.filter(x => x.id !== id); // creato oggi: elimina del tutto
  else g.archived = todayKey();
  save(); closeModal(); render();
}

/* ---- Premi ---- */
function achCard(a, locked) {
  return `<div class="card ach ${locked ? 'locked' : ''}">
    <div class="ic">${a.icon}</div>
    <div><div class="t">${esc(a.title)}</div><div class="muted" style="font-size:13px">${esc(a.desc)}${a.skin ? ` · sblocca ${a.skin}` : ''}
      ${!locked && a.date ? `<br><span style="font-size:12px">Ottenuto ${niceDay(a.date)}</span>` : ''}</div></div>
    <div class="x">+${a.xp} XP</div>
  </div>`;
}
function viewPremi() {
  const got = Object.values(R.ach).sort((a, b) => b.date.localeCompare(a.date));
  const locked = ACHIEVEMENTS.filter(a => !R.ach[a.id]);
  locked.push({ icon: '🏆', title: 'Mese perfetto', desc: 'Completa un obiettivo fisso ogni volta prevista per un mese intero', xp: PERFECT_MONTH_XP, skin: '🦄' });
  return `
    <h2>🏆 Premi ottenuti <small>${got.length}</small></h2>
    <div class="stack">${got.length ? got.map(a => achCard(a)).join('') : '<div class="card empty">Ancora nessun premio: completa il tuo primo obiettivo!</div>'}</div>
    <h2>🔒 Da sbloccare</h2>
    <div class="stack">${locked.map(a => achCard(a, true)).join('')}</div>
    <h2>📈 Gradi del personaggio</h2>
    <div class="stack">${RANKS.map(r => `<div class="card ach ${R.level >= r.lvl ? '' : 'locked'}">
      <div class="ic">${r.skin}</div><div><div class="t">${r.title}</div><div class="muted" style="font-size:13px">Livello ${r.lvl} · ${xpForLevel(r.lvl)} XP</div></div></div>`).join('')}</div>`;
}

/* ---- Personaggio ---- */
function viewEroe() {
  const skins = skinsFor(R);
  const cur = S.skin && skins.some(s => s.ok && s.skin === S.skin) ? S.skin : R.rank.skin;
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return `
    <h2>📊 Statistiche</h2>
    <div class="card stats">
      <div class="stat"><b>${R.completions}</b><span>completati</span></div>
      <div class="stat"><b>${R.perfectDays}</b><span>giornate perfette</span></div>
      <div class="stat"><b>🔥${R.bestStreak}</b><span>serie record</span></div>
    </div>
    <h2>🎭 Aspetto</h2>
    <div class="skins">${skins.map(s => `<button class="skin ${s.skin === cur ? 'sel' : ''} ${s.ok ? '' : 'locked'}" ${s.ok ? `onclick="pickSkin('${s.skin}')"` : 'disabled'} title="${esc(s.label)}">${s.skin}<small>${esc(s.label)}</small></button>`).join('')}</div>
    ${!standalone && !isNative ? `<h2>📱 Installa sul telefono</h2>
    <div class="card">
      ${installEvt ? `<button class="btn full" onclick="installApp()">Installa l'app</button>`
        : ios ? `<p class="note" style="margin:0">Su iPhone: apri questa pagina con <b>Safari</b>, tocca <b>Condividi</b> ⬆️ e poi <b>"Aggiungi alla schermata Home"</b>. Le notifiche su iPhone funzionano solo dall'app installata.</p>`
        : `<p class="note" style="margin:0">Dal menu del browser (⋮) scegli <b>"Installa app"</b> o <b>"Aggiungi a schermata Home"</b>.</p>`}
      ${/android/i.test(navigator.userAgent) ? `<a class="btn ghost full" style="display:grid;place-items:center;margin-top:10px;text-decoration:none" href="${APK_URL}" target="_blank" rel="noopener">⬇️ Scarica l'app Android (APK)</a>
        <p class="note" style="margin:6px 0 0">Con l'app Android i promemoria arrivano anche ad app chiusa.</p>` : ''}
    </div>` : ''}
    <h2>🎤 Assistente vocale</h2>
    <div class="card">
      <label class="switch"><span>Risposte a voce</span><input type="checkbox" ${S.settings.voiceReply !== false ? 'checked' : ''} onchange="S.settings.voiceReply=this.checked;save()"></label>
      <button class="btn ghost full" onclick="openVoice(false)">Apri l'assistente e vedi gli esempi</button>
    </div>
    <h2>🔔 Notifiche</h2>
    <div class="card">
      ${isNative ? `<label class="switch"><span>Promemoria attivi</span><input type="checkbox" ${S.settings.notif ? 'checked' : ''} onchange="setNotif(this.checked)"></label>`
        : perm === 'unsupported' ? `<p class="note" style="margin:0 0 8px">Questo browser non supporta le notifiche${ios ? ': installa prima l\'app sulla schermata Home' : ''}.</p>`
        : perm === 'denied' ? `<p class="note" style="margin:0 0 8px">Le notifiche sono bloccate: riattivale dalle impostazioni del telefono/browser.</p>`
        : `<label class="switch"><span>Promemoria attivi</span><input type="checkbox" ${S.settings.notif && perm === 'granted' ? 'checked' : ''} onchange="setNotif(this.checked)"></label>`}
      <div class="field" style="margin-top:6px"><label for="f-evening">🌙 Promemoria di fine giornata (se manca qualcosa)</label>
        <input id="f-evening" type="time" value="${S.settings.evening || ''}" onchange="S.settings.evening=this.value;save()"></div>
      <button class="btn ghost full" onclick="testNotif()">Prova una notifica</button>
      <p class="note" style="margin:10px 0 0">Ogni obiettivo fisso e ogni cosa da fare può avere la sua ora di promemoria. ${isNative ? 'Arrivano anche ad app chiusa.' : 'Le notifiche arrivano mentre l\'app è aperta o in sottofondo.'}</p>
    </div>
    <h2>⚙️ Impostazioni</h2>
    <div class="card">
      <div class="field"><label for="f-hero">Nome del personaggio</label><input id="f-hero" value="${esc(S.name)}" onchange="S.name=this.value.trim()||'Eroe';save();render()"></div>
      <div class="grid2">
        <button class="btn ghost" onclick="exportData()">⬇️ Esporta dati</button>
        <button class="btn ghost" onclick="document.getElementById('imp').click()">⬆️ Importa dati</button>
      </div>
      <input type="file" id="imp" accept="application/json" style="display:none" onchange="importData(this.files[0])">
      <button class="btn danger full" style="margin-top:10px" onclick="resetAll()">Ricomincia da zero</button>
      <p class="note" style="margin:10px 0 0">I dati sono salvati solo su questo dispositivo. Esportali ogni tanto come backup.</p>
    </div>
    <h2>📜 Come si guadagnano punti</h2>
    <div class="card muted" style="font-size:13.5px">
      • Ogni obiettivo fisso completato dà i suoi XP (default: giornaliero ${DEFAULT_XP.daily}, settimanale ${DEFAULT_XP.weekly}, mensile ${DEFAULT_XP.monthly}).<br>
      • Ogni cosa da fare in calendario completata: ${TASK_XP} XP (modificabili).<br>
      • Serie consecutive: +5% XP per ogni volta di fila, fino a +50%.<br>
      • Giornata perfetta (tutto ciò che era in programma fatto): +${PERFECT_DAY_BONUS} XP.<br>
      • Pagella di fine mese: S +${GRADE_BONUS.S}, A +${GRADE_BONUS.A}, B +${GRADE_BONUS.B} XP.<br>
      • Mese perfetto su un obiettivo: +${PERFECT_MONTH_XP} XP e il premio 🏆.<br>
      • Salendo di livello sblocchi nuovi gradi e aspetti per il personaggio.
    </div>`;
}
function pickSkin(s) { S.skin = s; save(); render(); }
function exportData() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `quotidianita-${todayKey()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function importData(file) {
  if (!file) return;
  file.text().then(t => {
    try { const d = JSON.parse(t); if (!Array.isArray(d.goals)) throw 0; S = Object.assign(defaultState(), d); save(); toast('✅', 'Dati importati', ''); render(); }
    catch (e) { alert('File non valido'); }
  });
}
function resetAll() {
  if (!confirm('Cancellare tutti gli obiettivi, i punti e i premi?')) return;
  S = defaultState(); S.lastSeen = todayKey(); save(); render();
}

/* ============ App nativa Android (Capacitor) ============ */
const Cap = window.Capacitor;
const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
// capacitor.js (aggiunto solo nella build Android) fornisce registerPlugin
const LN = isNative ? Cap.registerPlugin('LocalNotifications') : null;
const APK_URL = 'https://github.com/riccardotota791-hash/App-Registra-Tutto/releases/latest';

/* ============ Installazione (PWA) ============ */
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (tab === 'eroe') render(); });
function installApp() { if (installEvt) { installEvt.prompt(); installEvt = null; render(); } }
if (!isNative && 'serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

/* ============ Notifiche e promemoria ============ */
async function setNotif(on) {
  if (on && LN) {
    const p = await LN.requestPermissions();
    on = p.display === 'granted';
    if (on && LN.checkExactNotificationSetting) {
      const ex = await LN.checkExactNotificationSetting().catch(() => null);
      if (ex && ex.exact_alarm !== 'granted' && confirm('Per ricevere i promemoria all\'ora esatta, consenti "Sveglie e promemoria" nella prossima schermata.'))
        await LN.changeExactNotificationSetting().catch(() => {});
    }
  } else if (on && 'Notification' in window && Notification.permission !== 'granted') {
    const p = await Notification.requestPermission();
    on = p === 'granted';
  }
  S.settings.notif = on; save(); render();
  if (on) toast('🔔', 'Promemoria attivi', 'Ti avviserò alle ore che hai scelto');
}
function askNotifOnce() {
  if (S.settings.notif || S.settings.asked || (!LN && (!('Notification' in window) || Notification.permission === 'denied'))) return;
  S.settings.asked = true; save();
  setTimeout(() => { if (confirm('Vuoi ricevere le notifiche per i promemoria?')) setNotif(true); }, 300);
}
async function notify(title, body, tag) {
  toast('🔔', title, body);
  if (isNative) return; // nell'app Android le notifiche sono programmate dal sistema (scheduleNativeSync)
  if (!S.settings.notif || !('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', renotify: true };
  try {
    const reg = 'serviceWorker' in navigator && await navigator.serviceWorker.getRegistration();
    if (reg) return reg.showNotification(title, opts);
  } catch (e) {}
  try { new Notification(title, opts); } catch (e) {}
}
function testNotif() {
  if (LN) {
    const go = () => LN.schedule({ notifications: [{ id: 999999, title: 'Funziona! 🎉', body: 'Così arriveranno i tuoi promemoria',
      schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true } }] }).then(() => toast('🔔', 'Notifica tra 3 secondi', 'Puoi anche chiudere l\'app'));
    if (!S.settings.notif) setNotif(true).then(() => S.settings.notif && go()); else go();
    return;
  }
  if (!S.settings.notif) { setNotif(true).then(() => notify('Funziona! 🎉', 'Così arriveranno i tuoi promemoria', 'test')); return; }
  notify('Funziona! 🎉', 'Così arriveranno i tuoi promemoria', 'test');
}

// Promemoria da inviare ora: ora raggiunta da meno di 60 minuti e cosa non ancora fatta
function dueReminders() {
  const today = todayKey(), now = minutes(nowHHMM());
  const due = (hhmm) => hhmm && now >= minutes(hhmm) && now - minutes(hhmm) <= 60;
  const out = [];
  for (const g of S.goals) {
    if (!g.remind || !isActive(g, today) || !due(g.remind)) continue;
    const prog = g.freq === 'daily' ? val(today, g) : (R.sums[g.id + '|' + periodKey(g, today)] || 0);
    if (prog >= g.target) continue;
    const left = g.target - prog;
    out.push({ id: 'g' + g.id, title: `${g.icon || '⭐'} ${g.name}`,
      body: g.target === 1 ? 'È il momento! Spuntalo per guadagnare XP.' : `Ti mancano ${left}${g.unit ? ' ' + g.unit : ''}. Forza! (+${g.xp} XP)` });
  }
  for (const t of S.tasks) {
    if (t.date !== today || t.done || !due(t.time)) continue;
    out.push({ id: 't' + t.id, title: `${t.icon || '📝'} ${t.title}`, body: `Da fare oggi · +${t.xp} XP` });
  }
  const day = R.days[today];
  if (due(S.settings.evening) && day && day.total > day.done) {
    const left = day.total - day.done;
    out.push({ id: 'evening', title: '🌙 La giornata sta finendo',
      body: `${left === 1 ? 'Ti manca ancora 1 cosa' : `Ti mancano ancora ${left} cose`} per la giornata perfetta (+${PERFECT_DAY_BONUS} XP)` });
  }
  return out.map(r => ({ ...r, key: today + '|' + r.id })).filter(r => !S.fired[r.key]);
}
function checkReminders() {
  const list = dueReminders();
  if (!list.length) return;
  for (const r of list) { S.fired[r.key] = 1; notify(r.title, r.body, r.id); }
  save();
}
/* Nell'app Android i promemoria dei prossimi 7 giorni vengono programmati nel sistema,
   così arrivano anche ad app chiusa. Si riprogrammano a ogni modifica. */
let nativeSyncTimer = null;
function scheduleNativeSync() {
  if (!LN) return;
  clearTimeout(nativeSyncTimer);
  nativeSyncTimer = setTimeout(syncNativeReminders, 800);
}
const notifId = str => { let h = 7; for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % 2000000000 + 1; };
async function syncNativeReminders() {
  try {
    const pending = await LN.getPending();
    if (pending.notifications.length) await LN.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
    if (!S.settings.notif) return;
    const today = todayKey(), now = Date.now(), list = [];
    const at = (d, hhmm) => { const [h, m] = hhmm.split(':').map(Number); const x = parse(d); x.setHours(h, m, 0, 0); return x; };
    const add = (id, d, hhmm, title, body) => { const when = at(d, hhmm); if (when.getTime() > now) list.push({ id: notifId(d + id), title, body, schedule: { at: when, allowWhileIdle: true }, extra: { tab: 'oggi' } }); };
    const Rn = compute();
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, i);
      for (const g of S.goals) {
        if (!g.remind || !isActive(g, d)) continue;
        if (i === 0) {
          const prog = g.freq === 'daily' ? val(d, g) : (Rn.sums[g.id + '|' + periodKey(g, d)] || 0);
          if (prog >= g.target) continue;
        }
        add('g' + g.id, d, g.remind, `${g.icon || '⭐'} ${g.name}`,
          g.target === 1 ? 'È il momento! Spuntalo per guadagnare XP.' : `Obiettivo: ${g.target}${g.unit ? ' ' + g.unit : ''}. Forza! (+${g.xp} XP)`);
      }
      for (const t of S.tasks) if (t.date === d && t.time && !t.done) add('t' + t.id, d, t.time, `${t.icon || '📝'} ${t.title}`, `Da fare oggi · +${t.xp} XP`);
      if (S.settings.evening) {
        const day = Rn.days[d];
        if (!(i === 0 && day && day.total && day.done === day.total))
          add('evening', d, S.settings.evening, '🌙 La giornata sta finendo', `Hai completato tutto? Una giornata perfetta vale +${PERFECT_DAY_BONUS} XP`);
      }
    }
    if (list.length) await LN.schedule({ notifications: list });
  } catch (e) { console.warn('promemoria', e); }
}

function pruneFired() {
  const today = todayKey();
  for (const k in S.fired) if (k.slice(0, 10) < today) delete S.fired[k];
}

/* ============ Notifiche di gioco ============ */
// coda: i premi compaiono uno alla volta, massimo 2 sullo schermo
const toastQueue = [];
let toastsOnScreen = 0;
function toast(icon, title, text) { toastQueue.push({ icon, title, text }); pumpToasts(); }
function pumpToasts() {
  while (toastsOnScreen < 2 && toastQueue.length) {
    const t = toastQueue.shift();
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<div class="ic">${t.icon}</div><div><b>${esc(t.title)}</b><span class="muted" style="font-size:13px">${esc(t.text)}</span></div>`;
    el.onclick = () => { el.remove(); toastsOnScreen--; pumpToasts(); };
    document.getElementById('toasts').appendChild(el);
    toastsOnScreen++;
    setTimeout(() => { if (el.isConnected) el.onclick(); }, 3000);
  }
}
function checkRewards() {
  let changed = false;
  for (const a of Object.values(R.ach)) if (!S.seen[a.id]) {
    S.seen[a.id] = a.date; changed = true;
    toast(a.icon, `Premio sbloccato: ${a.title}`, `+${a.xp} XP${a.skin ? ' · nuovo aspetto ' + a.skin : ''}`);
  }
  if (R.level > S.maxLevel) {
    const newRank = R.rank.lvl > S.maxLevel ? R.rank : null;
    toast('⬆️', `Livello ${R.level}!`, newRank ? `Nuovo grado: ${newRank.title} ${newRank.skin}` : 'Continua così!');
    S.maxLevel = R.level; changed = true;
  }
  if (changed) save();
}

/* Riepilogo di fine giornata / fine mese, mostrato alla prima apertura del giorno */
function showRecap() {
  const today = todayKey(), last = S.lastSeen;
  S.lastSeen = today; save();
  if (!last || last >= today || (!S.goals.length && !S.tasks.length)) return;
  const y = addDays(today, -1), day = R.days[y];
  let html = '';
  if (day && day.total) {
    const ok = day.done === day.total;
    html += `<h3>${ok ? '🎉 Obiettivo di ieri raggiunto!' : '📋 Com\'è andata ieri'}</h3>
      <div class="muted">${niceDay(y)} · ${day.done}/${day.total} completati · ${day.xp} XP</div>
      <ul class="reslist">${day.items.map(i => `<li>${i.done ? '✅' : '❌'} ${esc(i.icon || '')} ${esc(i.name)}
        <span class="muted" style="margin-left:auto">${i.target > 1 ? `${i.v}/${i.target}${i.unit ? ' ' + esc(i.unit) : ''}` : ''}</span></li>`).join('')}</ul>`;
  }
  const pm = monthKey(y), M = R.months[pm];
  if (monthKey(last) !== monthKey(today) && M && M.closed) {
    const awards = Object.values(R.ach).filter(a => a.id.startsWith('pm|') && a.id.endsWith(pm));
    html += `<h3 style="margin-top:14px;text-transform:capitalize">📅 Pagella di ${monthName(pm)}</h3>
      <div style="display:flex;gap:14px;align-items:center;margin:8px 0">
        <div class="grade ${M.grade}">${M.grade}</div>
        <div>Punteggio ${Math.round(M.done / M.poss * 100)}% · ${M.xp} XP<br><span class="muted">${M.bonus ? `Bonus pagella +${M.bonus} XP` : 'Il mese prossimo puoi fare meglio!'}</span></div>
      </div>
      ${awards.map(a => `<div class="muted">🏆 ${esc(a.desc)} +${a.xp} XP</div>`).join('')}`;
  }
  const todo = tasksOn(today);
  if (todo.length) html += `<h3 style="margin-top:14px">📝 Oggi hai in programma</h3>
    <ul class="reslist">${todo.map(t => `<li>${esc(t.icon || '📝')} ${esc(t.title)}${t.time ? `<span class="muted" style="margin-left:auto">🔔 ${t.time}</span>` : ''}</li>`).join('')}</ul>`;
  if (!html) return;
  openModal(`${html}<button class="btn full" style="margin-top:12px" onclick="closeModal()">Andiamo! 💪</button>`);
}

/* ============ Avvio e cambio giorno ============ */
let lastDay = todayKey();
function tick() {
  const t = todayKey();
  if (t !== lastDay) { if (viewDay === lastDay) viewDay = t; lastDay = t; pruneFired(); render(); showRecap(); }
  checkReminders();
}
setInterval(tick, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); render(); } });

// apertura da una notifica o da una scorciatoia: ?tab=calendario
const qsTab = new URLSearchParams(location.search).get('tab');
if (TABS.some(t => t.id === qsTab)) tab = qsTab;

if (LN) LN.addListener('localNotificationActionPerformed', () => { tab = 'oggi'; viewDay = todayKey(); render(); });
scheduleNativeSync();

pruneFired();
render();
showRecap();
checkReminders();
