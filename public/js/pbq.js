// PBQ mode. Three board shapes, one submit path, partial credit on the reveal.
//
// Keyboard-first like the rest of the app, but PBQs are grids rather than a
// single question, so the model is a cursor: up/down moves between rows, and a
// number key sets the row you are on. Nothing here needs the mouse, and
// everything here also works with it.

import { get, post } from './api.js';
import { $, el, clear, add, mountBar, toast, mmss, typing } from './ui.js';

mountBar('/pbq.html');

const index = await get('/api/pbq');

let pbq = null;        // the running question
let answer = [];       // assign/order: per-row value. select: array of picks
let cursor = 0;
let startedAt = 0;
let ticker = null;

/* ------------------------------------------------------------------ */
/* the list                                                            */
/* ------------------------------------------------------------------ */

function renderPicker() {
  const pick = clear($('#pick'));
  index.items.forEach((p, i) => {
    const h = p.history;
    const label = h ? `best ${Math.round(h.best * 100)}% · ${h.runs} run${h.runs === 1 ? '' : 's'}`
      : 'not attempted';
    pick.append(el('button', {
      'data-id': p.id,
      title: `${p.objective} — ${p.cellCount} cells, about ${p.minutes} minutes`,
      onclick: () => start(p.id),
    },
    el('span', { class: 'k', text: `${i + 1}. ${p.objective}` }),
    el('span', { class: 't', text: p.title }),
    el('span', {
      class: 'n',
      text: `${p.type} · ${p.cellCount} cells · ~${p.minutes} min · ${label}`,
    })));
  });
}
renderPicker();

/* ------------------------------------------------------------------ */
/* running one                                                         */
/* ------------------------------------------------------------------ */

async function start(id) {
  pbq = await get(`/api/pbq/${encodeURIComponent(id)}`);
  answer = pbq.type === 'select' ? [] : new Array(rowCount()).fill(null);
  // An ordering board starts filled with the scrambled order rather than
  // blank: the task is to rearrange, not to type from nothing.
  if (pbq.type === 'order') answer = [...pbq.steps];
  cursor = 0;

  $('#pickpanel').hidden = true;
  $('#result').hidden = true;
  $('#run').hidden = false;

  add(clear($('#qmeta')),
    el('span', { class: 'tag', text: pbq.objective }),
    el('span', { text: pbq.type }),
    el('span', { text: `${pbq.cellCount} cells` }),
    el('span', { class: 'dim', text: `target ~${pbq.minutes} min` }));

  $('#title').textContent = pbq.title;
  $('#brief').textContent = pbq.brief;
  $('#instruction').textContent = pbq.instruction;
  $('#boardhint').innerHTML = hintFor(pbq.type);

  startedAt = Date.now();
  clearInterval(ticker);
  ticker = setInterval(tick, 250);
  tick();

  renderBoard();
  window.scrollTo({ top: 0 });
}

/** Keyboard label for pool position k: 1-9, then 0+digit for 10-19. */
const poolKey = (k) => (k < 9 ? String(k + 1) : k < 19 ? `0${k - 8}` : '—');

const rowCount = () => (pbq.type === 'assign' ? pbq.cells.length
  : pbq.type === 'order' ? pbq.steps.length : pbq.pool.length);

function hintFor(type) {
  const nav = '<kbd>↑</kbd><kbd>↓</kbd> move · ';
  if (type === 'assign') {
    return `${nav}<kbd>1</kbd>–<kbd>9</kbd> or <kbd>0</kbd> then a digit picks for the current row · click also works`;
  }
  if (type === 'select') {
    return `${nav}<kbd>Space</kbd> toggles · pick exactly ${pbq.choose}`;
  }
  return `${nav}<kbd>Shift</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> moves the selected step`;
}

function tick() {
  const ms = Date.now() - startedAt;
  const over = ms > pbq.minutes * 60_000;
  const t = $('#timer');
  t.textContent = `${mmss(ms)} / ${pbq.minutes}:00`;
  t.className = over ? 'mono bad' : 'hint mono';
}

/* ------------------------------------------------------------------ */
/* boards                                                              */
/* ------------------------------------------------------------------ */

function renderBoard() {
  const board = clear($('#board'));
  if (pbq.type === 'assign') renderAssign(board);
  else if (pbq.type === 'select') renderSelect(board);
  else renderOrder(board);
  updateFilled();
}

function renderAssign(board) {
  // The pool shown once, numbered, so the key that picks an option is visible.
  // Without this the number shortcuts map to nothing the eye can see.
  board.append(el('div', { class: 'pbqpool' },
    el('span', { class: 'pbqpoollabel', text: 'Pool' }),
    pbq.pool.map((opt, k) => el('span', {
      class: 'pbqtoken',
      'data-used': answer.includes(opt) ? 'yes' : 'no',
      title: `Press ${poolKey(k)} to put this in the current row`,
      onclick: () => { answer[cursor] = opt; cursor = Math.min(rowCount() - 1, cursor + 1); renderBoard(); },
    }, el('b', { text: poolKey(k) }), ' ', opt))));

  pbq.cells.forEach((c, i) => {
    const sel = el('select', {
      class: 'pbqsel',
      onchange: (e) => { answer[i] = e.target.value || null; cursor = i; updateFilled(); },
    }, el('option', { value: '', text: '— choose —' }),
    pbq.pool.map((opt) => el('option', {
      value: opt, text: opt, ...(answer[i] === opt ? { selected: 'selected' } : {}),
    })));

    board.append(el('div', {
      class: 'pbqrow', 'data-i': i,
      ...(i === cursor ? { 'data-cursor': 'on' } : {}),
      onclick: () => { cursor = i; paintCursor(); },
    },
    el('div', { class: 'pbqprompt' },
      el('span', { class: 'pbqn', text: String(i + 1) }),
      el('span', { text: c.prompt })),
    el('div', { class: 'pbqpick' }, sel)));
  });
}

function renderSelect(board) {
  pbq.pool.forEach((opt, i) => {
    const on = answer.includes(opt);
    board.append(el('div', {
      class: 'pbqrow pbqcheck', 'data-i': i,
      'data-on': on ? 'yes' : 'no',
      ...(i === cursor ? { 'data-cursor': 'on' } : {}),
      onclick: () => { cursor = i; toggle(i); },
    },
    el('div', { class: 'pbqprompt' },
      el('span', { class: 'pbqbox', text: on ? '✓' : '' }),
      el('span', { text: opt }))));
  });
}

function toggle(i) {
  const opt = pbq.pool[i];
  if (answer.includes(opt)) answer = answer.filter((a) => a !== opt);
  else if (answer.length >= pbq.choose) {
    toast(`Pick exactly ${pbq.choose} — deselect one first`);
    return;
  } else answer.push(opt);
  renderBoard();
}

function renderOrder(board) {
  answer.forEach((step, i) => {
    board.append(el('div', {
      class: 'pbqrow pbqorder', 'data-i': i,
      ...(i === cursor ? { 'data-cursor': 'on' } : {}),
      onclick: () => { cursor = i; paintCursor(); },
    },
    el('div', { class: 'pbqprompt' },
      el('span', { class: 'pbqn', text: String(i + 1) }),
      el('span', { text: step })),
    el('div', { class: 'pbqpick' },
      el('button', {
        class: 'tiny', title: 'Move up', text: '↑',
        onclick: (e) => { e.stopPropagation(); move(i, -1); },
      }),
      el('button', {
        class: 'tiny', title: 'Move down', text: '↓',
        onclick: (e) => { e.stopPropagation(); move(i, 1); },
      }))));
  });
}

function move(i, d) {
  const j = i + d;
  if (j < 0 || j >= answer.length) return;
  [answer[i], answer[j]] = [answer[j], answer[i]];
  cursor = j;
  renderBoard();
}

function paintCursor() {
  for (const row of document.querySelectorAll('.pbqrow')) {
    row.toggleAttribute('data-cursor', Number(row.dataset.i) === cursor);
    if (Number(row.dataset.i) === cursor) row.setAttribute('data-cursor', 'on');
  }
}

function updateFilled() {
  const n = pbq.type === 'select' ? answer.length : answer.filter(Boolean).length;
  const want = pbq.type === 'select' ? pbq.choose : rowCount();
  $('#filled').textContent = `${n} of ${want} set`;
  $('#filled').className = n === want ? 'hint good' : 'hint';
}

/* ------------------------------------------------------------------ */
/* submit and reveal                                                   */
/* ------------------------------------------------------------------ */

async function submit() {
  const n = pbq.type === 'select' ? answer.length : answer.filter(Boolean).length;
  const want = pbq.type === 'select' ? pbq.choose : rowCount();
  if (n < want && !confirm(`${want - n} still unset. Submit anyway?`)) return;

  clearInterval(ticker);
  const ms = Date.now() - startedAt;
  const r = await post('/api/pbq-answer', { id: pbq.id, response: answer, ms_to_answer: ms });

  $('#run').hidden = true;
  $('#result').hidden = false;

  const pctv = Math.round(r.score * 100);
  $('#score').textContent = `${pctv}%`;
  $('#score').className = `big ${pctv === 100 ? 'good' : pctv >= 70 ? '' : 'bad'}`;
  $('#scoresub').textContent = `${r.right} of ${r.total} correct`;

  const budget = pbq.minutes * 60_000;
  $('#pace').textContent = ms > budget
    ? `Took ${mmss(ms)} against a ${pbq.minutes}-minute target — ${mmss(ms - budget)} over. `
      + 'On the real paper that time comes out of your multiple-choice questions.'
    : `Took ${mmss(ms)}, inside the ${pbq.minutes}-minute target.`;
  $('#pace').className = ms > budget ? 'hint warn' : 'hint good';

  const cells = clear($('#cells'));
  r.cells.forEach((c, i) => {
    cells.append(el('div', { class: 'pbqresult', 'data-ok': c.ok ? 'yes' : 'no' },
      el('div', { class: 'pbqprompt' },
        el('span', { class: 'pbqn', text: c.ok ? '✓' : '✗' }),
        el('span', { text: c.prompt })),
      el('div', { class: 'pbqverdict' },
        c.ok
          ? el('span', { class: 'good', text: c.answer ?? 'correct' })
          : add(el('span', {}),
            c.chosen
              ? el('span', { class: 'bad', text: `you: ${c.chosen}` })
              : el('span', { class: 'dim', text: c.missed ? 'not selected' : 'left blank' }),
            c.answer && c.answer !== c.chosen
              ? el('span', { class: 'good', style: 'margin-left:10px', text: `→ ${c.answer}` })
              : null)),
      c.explanation
        ? el('p', { class: 'explanation', style: 'margin:8px 0 0', text: c.explanation })
        : null));
  });

  if (r.explanation) {
    $('#notepanel').hidden = false;
    $('#note').textContent = r.explanation;
  } else $('#notepanel').hidden = true;

  $('#learnlink').href = `/learn.html?code=${encodeURIComponent(pbq.code ?? pbq.objective)}`;
  $('#learnlink').textContent = `Read the material on ${pbq.objective} →`;

  // Refresh the picker so best-score labels are current next time it is shown.
  const fresh = await get('/api/pbq');
  index.items = fresh.items;
  renderPicker();
  window.scrollTo({ top: 0 });
}

function backToList() {
  clearInterval(ticker);
  pbq = null;
  $('#run').hidden = true;
  $('#result').hidden = true;
  $('#pickpanel').hidden = false;
  window.scrollTo({ top: 0 });
}

$('#submit').onclick = submit;
$('#quit').onclick = backToList;
$('#another').onclick = backToList;
$('#retry').onclick = () => start(pbq.id);

/* ------------------------------------------------------------------ */
/* keyboard                                                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* deep link                                                           */
/* ------------------------------------------------------------------ */

// The dashboard links straight at one: /pbq.html#PBQ-003
const wanted = decodeURIComponent(location.hash.slice(1));
if (wanted && index.items.some((p) => p.id === wanted)) await start(wanted);

// Two-digit pool picks: "0" then "3" means option 13 in a pool longer than 9.
let tens = false;
let tensTimer = null;

document.addEventListener('keydown', (e) => {
  // The picker: number keys open a PBQ.
  if (!pbq && !$('#pickpanel').hidden && /^[1-9]$/.test(e.key)) {
    const p = index.items[Number(e.key) - 1];
    if (p) { e.preventDefault(); start(p.id); }
    return;
  }
  if (!pbq || $('#run').hidden) return;

  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submit(); return; }
  if (typing()) return;

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const d = e.key === 'ArrowDown' ? 1 : -1;
    if (pbq.type === 'order' && e.shiftKey) { move(cursor, d); return; }
    cursor = Math.max(0, Math.min(rowCount() - 1, cursor + d));
    paintCursor();
    return;
  }

  if (pbq.type === 'select' && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault();
    toggle(cursor);
    return;
  }

  if (pbq.type === 'assign' && /^[0-9]$/.test(e.key)) {
    e.preventDefault();
    const d = Number(e.key);
    if (d === 0 && pbq.pool.length > 9) {
      tens = true;
      clearTimeout(tensTimer);
      tensTimer = setTimeout(() => { tens = false; }, 1200);
      return;
    }
    const idx = tens ? 9 + d : d - 1;
    tens = false;
    const opt = pbq.pool[idx];
    if (!opt) return;
    answer[cursor] = opt;
    // Advance like a form: setting a row should move you to the next one.
    cursor = Math.min(rowCount() - 1, cursor + 1);
    renderBoard();
  }
});
