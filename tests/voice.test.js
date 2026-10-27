// Test del riconoscimento dei comandi vocali: node tests/voice.test.js
const assert = require('assert');
const { parseCommand } = require('../voice.js');

const today = '2026-10-27'; // martedì
const ctx = {
  today, now: '12:00',
  goals: [
    { id: 'read', name: 'Leggere', unit: 'pagine', freq: 'daily', target: 10 },
    { id: 'gym', name: 'Palestra', unit: '', freq: 'daily', target: 1 },
    { id: 'water', name: 'Bere acqua', unit: 'bicchieri', freq: 'daily', target: 8 },
    { id: 'med', name: 'Meditare', unit: '', freq: 'daily', target: 1 },
    { id: 'run', name: 'Corsa', unit: 'volte', freq: 'weekly', target: 3 },
    { id: 'walk', name: 'Camminare', unit: 'minuti', freq: 'daily', target: 30 },
  ],
  tasks: [{ id: 'dent', title: 'Chiamare il dentista', date: today, done: false }],
};
const p = t => parseCommand(t, ctx);
let n = 0;
const check = (text, expected) => {
  const got = p(text);
  for (const [k, v] of Object.entries(expected)) {
    const actual = k.split('.').reduce((o, x) => o && o[x], got);
    assert.deepStrictEqual(actual, v, `"${text}" -> ${k}: atteso ${JSON.stringify(v)}, ottenuto ${JSON.stringify(actual)} (${JSON.stringify(got)})`);
  }
  n++;
};

// segnare come fatto
check('Ho letto 10 pagine', { type: 'done', id: 'read', qty: 10 });
check('ho letto dieci pagine', { type: 'done', id: 'read', qty: 10 });
check('Ho fatto palestra', { type: 'done', id: 'gym', qty: null });
check('fatto la palestra oggi', { type: 'done', id: 'gym' });
check('ho bevuto 3 bicchieri d\'acqua', { type: 'done', id: 'water', qty: 3 });
check('ho fatto meditazione', { type: 'done', id: 'med' });
check('Ho fatto una corsa', { type: 'done', id: 'run' });
check('ho camminato 20 minuti', { type: 'done', id: 'walk', qty: 20 });
check('ho chiamato il dentista', { type: 'done', kind: 'task', id: 'dent' });
check('ieri ho letto 10 pagine', { type: 'done', id: 'read', date: '2026-10-26' });
check('segna lettura', { type: 'done', id: 'read' });
check('non ho fatto palestra', { type: 'negative' });

// aggiungere cose da fare
check('Domani alle 10 chiamare il dentista', { type: 'addTask', 'task.date': '2026-10-28', 'task.time': '10:00', 'task.title': 'Chiamare il dentista', 'task.icon': '🦷' });
check('ricordami di pagare la bolletta venerdì', { type: 'addTask', 'task.date': '2026-10-30', 'task.title': 'Pagare la bolletta' });
check('aggiungi fare la spesa dopodomani alle 18:30', { type: 'addTask', 'task.date': '2026-10-29', 'task.time': '18:30', 'task.title': 'Fare la spesa' });
check('domani devo portare la macchina dal meccanico alle 9 e mezza', { type: 'addTask', 'task.date': '2026-10-28', 'task.time': '09:30', 'task.title': 'Portare la macchina dal meccanico' });
check('stasera alle 8 cena con Marco', { type: 'addTask', 'task.date': today, 'task.time': '20:00', 'task.title': 'Cena con Marco' });
check('aggiungi comprare il regalo per il 5 novembre', { type: 'addTask', 'task.date': '2026-11-05', 'task.title': 'Comprare il regalo' });
check('devo chiamare la mamma', { type: 'addTask', 'task.date': today, 'task.title': 'Chiamare la mamma' });
check('ricordami alle 9 di prendere le medicine', { type: 'addTask', 'task.date': '2026-10-28', 'task.time': '09:00' }); // le 9 sono passate
check('lunedì visita dal medico', { type: 'addTask', 'task.date': '2026-11-02', 'task.title': 'Visita dal medico' });
check('domani ho la riunione alle 10', { type: 'addTask', 'task.date': '2026-10-28', 'task.time': '10:00' });
check('aggiungi caffè con Giulia domani', { type: 'addTask', 'task.title': 'Caffè con Giulia' });

// nuovi obiettivi fissi
check('nuovo obiettivo bere 8 bicchieri al giorno', { type: 'addGoal', 'goal.name': 'Bere', 'goal.target': 8, 'goal.unit': 'bicchieri', 'goal.freq': 'daily' });
check('aggiungi obiettivo leggere 20 pagine ogni giorno alle 21', { type: 'addGoal', 'goal.name': 'Leggere', 'goal.target': 20, 'goal.unit': 'pagine', 'goal.remind': '21:00' });
check('nuovo obiettivo palestra 3 volte a settimana', { type: 'addGoal', 'goal.name': 'Palestra', 'goal.target': 3, 'goal.unit': 'volte', 'goal.freq': 'weekly' });
check('aggiungi obiettivo risparmiare 200 euro al mese', { type: 'addGoal', 'goal.freq': 'monthly', 'goal.target': 200, 'goal.unit': 'euro', 'goal.name': 'Risparmiare' });
check('aggiungi nuoto ogni lunedì e giovedì', { type: 'addGoal', 'goal.name': 'Nuoto', 'goal.days': [1, 4], 'goal.freq': 'daily' });
check('nuovo obiettivo meditare', { type: 'addGoal', 'goal.name': 'Meditare', 'goal.target': 1 });

// domande e comandi
check('cosa devo fare oggi?', { type: 'query', date: today });
check('cosa ho in programma domani', { type: 'query', date: '2026-10-28' });
check('cosa mi manca', { type: 'query' });
check('quanti punti ho', { type: 'status' });
check('annulla', { type: 'undo' });
check('blablabla xyz', { type: 'unknown' });

console.log(`✓ ${n} comandi vocali riconosciuti correttamente`);
