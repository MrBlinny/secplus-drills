import { api } from './api.js';
import { $, el, clear, mountBar, toast, pctOf } from './ui.js';
import { Quiz } from './quiz.js';

mountBar('/weak.html');

const boot = await api.bootstrap();

async function preview() {
  const d = await api.weak(1);          // cheap call: we only want the ranking
  const t = clear($('#targets'));
  if (!d.objectives.length) {
    t.append(el('caption', { class: 'empty', style: 'text-align:left', text: 'No history yet — this fills in once you have drilled.' }));
    return;
  }
  t.append(el('thead', {}, el('tr', {},
    el('th', { text: 'Weakest objectives' }),
    el('th', { class: 'r', text: 'Accuracy' }),
    el('th', { class: 'r', text: 'Seen' }))));
  const tb = el('tbody');
  for (const o of d.objectives) {
    tb.append(el('tr', {},
      el('td', {}, el('div', { text: o.objective }),
        o.basis === 'baseline-domain'
          ? el('div', { class: 'dim', style: 'font-size:12px', text: 'ranked from baseline domain accuracy' })
          : null),
      el('td', { class: 'r mono', text: o.accuracy === null ? '—' : pctOf(o.accuracy) }),
      el('td', { class: 'r mono dim', text: o.n ? `${o.correct}/${o.n}` : '0' })));
  }
  t.append(tb);
}

async function start() {
  let data;
  try { data = await api.weak(Number($('#count').value)); } catch (e) { toast(e.message, 4000); return; }
  if (!data.questions.length) { toast('No questions available yet'); return; }
  new Quiz({ questions: data.questions, mode: 'weak' }).start();
}

$('#go').addEventListener('click', start);
$('#again').addEventListener('click', () => { $('#done').hidden = true; $('#setup').hidden = false; preview(); });
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && !$('#setup').hidden) { ev.preventDefault(); start(); }
});

await preview();
if (new URLSearchParams(location.search).get('auto') === '1') start();
