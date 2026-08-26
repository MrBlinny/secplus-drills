// Cram decks. Same free-recall shape as pairs, but the server grades the typed
// string instead of asking you to, so the loop runs several times faster. You
// still get the final say: an auto-verdict pre-selects Right or Wrong and Y/N
// overrides it, because a card you half-knew is yours to judge.

import { api } from './api.js';
import { $, el, clear, add, mountBar, toast } from './ui.js';

mountBar('/cram.html');

const boot = await api.bootstrap();
const params = new URLSearchParams(location.search);

const REQUEUE_GAP = 5;

let deck = params.get('deck') || (boot.cramDecks[0]?.id ?? 'acronyms');
let queue = [];
let card = null;
let state = 'typing';
let shownAt = 0;
let answered = 0;
let got = 0;
let missed = [];

/* ---------------- deck picker ---------------- */

function paintDecks() {
  add(clear($('#decks')), boot.cramDecks.map((d) =>
    el('button', {
      class: d.id === deck ? 'primary' : '',
      style: 'text-align:left;padding:13px 15px',
      onclick: () => { deck = d.id; paintDecks(); },
    },
      el('div', { style: 'font-weight:600;font-size:16px', text: `${d.label} — ${d.count} cards` }),
      el('div', { class: 'hint', style: 'margin:4px 0 0', text: d.blurb }),
    )));
}
paintDecks();

/* ---------------- run ---------------- */

async function start() {
  let data;
  try {
    data = await api.cram(`?deck=${encodeURIComponent(deck)}&limit=${$('#count').value}`);
  } catch (e) { toast(e.message, 4000); return; }
  if (!data.cards.length) { toast('That deck is empty'); return; }

  queue = data.cards;
  answered = 0;
  got = 0;
  missed = [];
  $('#setup').hidden = true;
  $('#done').hidden = true;
  $('#run').hidden = false;
  next();
}

function next() {
  if (!queue.length) return finish();
  card = queue.shift();
  state = 'typing';
  shownAt = performance.now();

  $('#prog').style.width = `${(answered / Math.max(1, answered + queue.length + 1)) * 100}%`;
  add(clear($('#cmeta')),
    el('span', { class: 'tag', text: deck }),
    el('span', { text: `#${answered + 1}` }),
    card.repeat ? el('span', { class: 'warn', text: 'repeat — you missed this' }) : null);

  $('#cue').textContent = card.cue;
  $('#hint').textContent = card.hint ? `Hint: ${card.hint}` : '';
  $('#answerbox').hidden = false;
  $('#reveal').hidden = true;
  $('#typed').value = '';
  $('#typed').focus();
  $('#keys').innerHTML = '<kbd>Enter</kbd> checks it';
}

async function reveal() {
  if (state !== 'typing') return;
  state = 'revealing';
  const typed = $('#typed').value.trim();

  let r;
  try { r = await api.cramAnswer({ id: card.id, typed }); }
  catch (e) { toast(e.message, 4000); state = 'typing'; return; }

  $('#ans').textContent = r.answer;
  $('#detail').textContent = r.detail ?? '';
  $('#secure').textContent = r.secure ? `Encrypted equivalent: ${r.secure}` : '';

  const auto = r.verdict === 'exact';
  const label = {
    exact: '<b class="good">Correct.</b>',
    close: '<b class="warn">Almost — a typo away.</b>',
    wrong: '<b class="bad">Not it.</b>',
    blank: '<span class="dim">Left blank.</span>',
  }[r.verdict];

  $('#yourswas').innerHTML = typed
    ? `${label} You wrote <b class="mono">${typed.replace(/[<>&]/g, '')}</b>`
    : label;

  // Pre-select the auto verdict so the common case is one keypress, but leave
  // both buttons live: "close" is deliberately not credited automatically.
  $('#got').classList.toggle('primary', auto);
  $('#miss').classList.toggle('primary', !auto);

  $('#answerbox').hidden = true;
  $('#reveal').hidden = false;
  $('#keys').innerHTML = '<kbd>Enter</kbd> accepts &nbsp; <kbd>Y</kbd> right &nbsp; <kbd>N</kbd> wrong';
  card.auto = auto;
  card.answerText = r.answer;
  state = 'grading';
}

async function grade(correct) {
  if (state !== 'grading') return;
  state = 'saving';
  try {
    await api.cramAnswer({
      id: card.id,
      typed: $('#typed').value.trim(),
      correct,
      ms_to_answer: Math.round(performance.now() - shownAt),
    });
  } catch (e) { toast(e.message, 4000); state = 'grading'; return; }

  answered++;
  if (correct) got++;
  else {
    missed.push({ cue: card.cue, answer: card.answerText });
    queue.splice(Math.min(REQUEUE_GAP, queue.length), 0, { ...card, repeat: true });
  }
  next();
}

function finish() {
  $('#run').hidden = true;
  $('#done').hidden = false;
  add(clear($('#summary')),
    el('div', {}, el('div', { class: 'v', text: `${got}/${answered}` }),
      el('div', { class: 'l', text: 'recalled' })),
    el('div', {}, el('div', { class: 'v', text: `${answered ? Math.round((got / answered) * 100) : 0}%` }),
      el('div', { class: 'l', text: 'accuracy' })),
  );

  // Distinct misses, most recent first — the list to re-read before closing.
  const uniq = [...new Map(missed.map((m) => [m.cue, m])).values()];
  clear($('#missed'));
  if (uniq.length) {
    add($('#missed'),
      el('p', { class: 'rowlabel', text: `Missed (${uniq.length})` }),
      el('ul', { style: 'margin:6px 0 0;padding-left:20px;line-height:1.75' },
        uniq.map((m) => el('li', {},
          el('span', { text: `${m.cue} — ` }),
          el('b', { class: 'good', text: m.answer })))));
  }
}

/* ---------------- wiring ---------------- */

$('#go').addEventListener('click', start);
$('#again').addEventListener('click', () => { $('#done').hidden = true; $('#setup').hidden = false; });
$('#got').addEventListener('click', () => grade(true));
$('#miss').addEventListener('click', () => grade(false));

document.addEventListener('keydown', (ev) => {
  if (!$('#setup').hidden) {
    if (ev.key === 'Enter') { ev.preventDefault(); start(); }
    return;
  }
  if ($('#run').hidden) return;

  if (state === 'typing' && ev.key === 'Enter') { ev.preventDefault(); reveal(); return; }
  if (state === 'grading') {
    if (ev.key === 'Enter') { ev.preventDefault(); grade(card.auto); }
    else if (/^[y1]$/i.test(ev.key)) { ev.preventDefault(); grade(true); }
    else if (/^[n2]$/i.test(ev.key)) { ev.preventDefault(); grade(false); }
  }
});

if (params.get('auto') === '1') start();
