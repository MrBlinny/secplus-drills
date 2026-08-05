// Free-recall flashcards. Keyboard only: type, Enter reveals, Y/N self-grades
// and advances. Typed input is logged so a later session can see the exact
// wrong word that was reached for.

import { api } from './api.js';
import { $, el, clear, add, mountBar, toast } from './ui.js';

mountBar('/pairs.html');

const boot = await api.bootstrap();
const params = new URLSearchParams(location.search);

const REQUEUE_GAP = 4;

/* ---------------- scope ---------------- */

const scope = $('#scope');
scope.append(el('option', { value: '', text: `Everything (${boot.counts.pairs} pairs)` }));
for (const [d, label] of Object.entries(boot.domainLabels)) {
  scope.append(el('option', { value: `domain:${d}`, text: `${d} ${label}` }));
}

let queue = [];
let card = null;
let state = 'typing';
let shownAt = 0;
let answered = 0;
let got = 0;

function query() {
  const v = scope.value;
  const limit = $('#count').value;
  return v.startsWith('domain:')
    ? `?domain=${encodeURIComponent(v.slice(7))}&limit=${limit}`
    : `?limit=${limit}`;
}

async function start() {
  let data;
  try { data = await api.pairs(query()); } catch (e) { toast(e.message, 4000); return; }
  if (!data.cards.length) { toast('No pairs for that scope'); return; }

  queue = data.cards;
  answered = 0;
  got = 0;
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
    el('span', { class: 'tag', text: card.objective }),
    el('span', { text: `#${answered + 1}` }),
    card.repeat ? el('span', { class: 'warn', text: 'repeat — you missed this' }) : null);

  $('#cue').textContent = card.cue;
  $('#answerbox').hidden = false;
  $('#reveal').hidden = true;
  $('#typed').value = '';
  $('#typed').focus();
  $('#keys').innerHTML = '<kbd>Enter</kbd> reveals';
}

async function reveal() {
  if (state !== 'typing') return;
  state = 'revealing';
  let r;
  try { r = await api.pairAnswer({ id: card.id }); } catch (e) { toast(e.message, 4000); state = 'typing'; return; }

  $('#term').textContent = r.correct_term;
  $('#trap').textContent = r.common_trap;
  $('#disc').textContent = r.discriminator;

  const typed = $('#typed').value.trim();
  $('#yourswas').innerHTML = typed
    ? `You wrote <b class="mono">${typed.replace(/[<>&]/g, '')}</b>`
    : '<span class="dim">You left it blank.</span>';

  add(clear($('#learnlink')), el('a', {
    class: 'btn learnlink',
    href: `/learn.html?code=${encodeURIComponent(card.objective)}`,
    target: '_blank', rel: 'noopener',
    text: `Read the material on ${card.objective} →`,
  }));

  $('#answerbox').hidden = true;
  $('#reveal').hidden = false;
  $('#keys').innerHTML = 'Self-grade <kbd>Y</kbd> got it &nbsp; <kbd>N</kbd> missed it';
  state = 'grading';
}

async function grade(correct) {
  if (state !== 'grading') return;
  state = 'saving';
  try {
    await api.pairAnswer({
      id: card.id,
      typed: $('#typed').value.trim(),
      correct,
      ms_to_answer: Math.round(performance.now() - shownAt),
    });
  } catch (e) { toast(e.message, 4000); state = 'grading'; return; }

  answered++;
  if (correct) got++;
  else queue.splice(Math.min(REQUEUE_GAP, queue.length), 0, { ...card, repeat: true });
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
    if (/^[yj1]$/i.test(ev.key)) { ev.preventDefault(); grade(true); }
    else if (/^[n2]$/i.test(ev.key)) { ev.preventDefault(); grade(false); }
    else if (ev.key === 'Enter') { ev.preventDefault(); toast('Grade yourself: Y or N'); }
  }
});

if (params.get('auto') === '1') start();
