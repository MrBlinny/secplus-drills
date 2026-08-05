import { api } from './api.js';
import { $, el, mountBar, toast } from './ui.js';
import { Quiz } from './quiz.js';

mountBar('/drill.html');

const boot = await api.bootstrap();
const params = new URLSearchParams(location.search);

/* ---------------- scope picker ---------------- */

const scope = $('#scope');
// Default scope. Ordered by what it is most useful to press Enter on: the
// coverage sweep first, because "have I seen all of this" is the question that
// matters when the exam is close.
scope.append(el('option', { value: 'coverage', text: 'Cover everything — unproven items first' }));
scope.append(el('option', { value: '', text: `Everything (${boot.counts.items} items)` }));

for (const [d, label] of Object.entries(boot.domainLabels)) {
  const n = boot.objectives.filter((o) => o.domain === d).reduce((s, o) => s + o.count, 0);
  scope.append(el('option', { value: `domain:${d}`, text: `${d} ${label} — ${n} items` }));
}
for (const o of boot.objectives) {
  scope.append(el('option', { value: `objective:${o.objective}`, text: `    ${o.objective} — ${o.count} items` }));
}

// Deep link from the dashboard's weakest-objective buttons (?objective=full
// label) and from the lists page, which only knows the code (?code=2.6). A
// code that covers several bank labels picks the first; a code with no items
// leaves the scope on Everything rather than selecting nothing.
const preset = params.get('objective')
  ?? boot.objectives.find((o) => o.code === params.get('code'))?.objective;
if (preset) scope.value = `objective:${preset}`;

function hint() {
  $('#setuphint').textContent = scope.value === 'coverage'
    ? 'Serves the items you have never got right first, then ones you have never '
      + 'seen, spread across objectives. Repeat until it stops finding new ones.'
    : 'Pick 1–4 to answer and reveal. Enter for the next question.';
}
scope.addEventListener('change', hint);
hint();

function query() {
  const v = scope.value;
  const limit = $('#count').value;
  if (v.startsWith('domain:')) return `?domain=${encodeURIComponent(v.slice(7))}&limit=${limit}`;
  if (v.startsWith('objective:')) return `?objective=${encodeURIComponent(v.slice(10))}&limit=${limit}`;
  return `?limit=${limit}`;
}

async function start() {
  const coverage = scope.value === 'coverage';
  let data;
  try {
    data = coverage
      ? await api.coverage($('#count').value)
      : await api.drill(query());
  } catch (e) {
    toast(`Could not load questions: ${e.message}`, 4000);
    return;
  }
  if (!data.questions.length) {
    toast('No items in the bank for that scope yet', 3000);
    return;
  }
  if (coverage) {
    toast(`${data.unproven} of ${data.total} items still unproven`, 3500);
  }
  new Quiz({ questions: data.questions, mode: coverage ? 'coverage' : 'drill' }).start();
}

$('#go').addEventListener('click', start);
$('#again').addEventListener('click', () => { $('#done').hidden = true; $('#setup').hidden = false; });

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && !$('#setup').hidden) { ev.preventDefault(); start(); }
});

if (params.get('auto') === '1') start();
