import { api } from './api.js';
import { $, $$, el, clear, mountBar, toast, mmss, pctOf } from './ui.js';

mountBar('/blank.html');

const taxonomies = await api.taxonomies();
let current = null;
let startedAt = 0;
let ticker = null;

/* ---------------- taxonomy picker ---------------- */

const pick = clear($('#taxpick'));
taxonomies.forEach((t, i) => {
  pick.append(el('button', {
    'data-id': t.id, 'aria-pressed': 'false', onclick: () => choose(t.id),
  },
    el('span', { class: 'k', text: `${i + 1}  ${t.code}` }),
    el('span', { class: 't', text: t.title }),
    el('span', { class: 'n', text: `${t.count} terms${t.supplementary ? ' · supplementary' : ''}` }),
  ));
});

function choose(id) {
  current = taxonomies.find((t) => t.id === id);
  $$('#taxpick button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));

  $('#writepanel').hidden = false;
  $('#result').hidden = true;
  $('#writetitle').textContent = current.title;
  $('#writehint').innerHTML = current.supplementary
    ? `${current.count} terms. Not in the objectives document — this list comes from `
      + `<span class="mono">curriculum.md</span>.`
    : `${current.count} terms, from <span class="mono">objectives.md</span>. No peeking.`;
  $('#input').value = '';
  $('#input').focus();
  updateCounter();

  startedAt = Date.now();
  clearInterval(ticker);
  ticker = setInterval(() => { $('#timer').textContent = mmss(Date.now() - startedAt); }, 1000);
  $('#timer').textContent = '00:00';
  $('#writepanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---------------- writing ---------------- */

function updateCounter() {
  const n = $('#input').value.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).length;
  $('#counter').textContent = n ? `${n} written` : '';
}
$('#input').addEventListener('input', updateCounter);

async function submit() {
  if (!current) return;
  const text = $('#input').value.trim();
  if (!text) { toast('Write something first'); return; }

  clearInterval(ticker);
  let r;
  try {
    r = await api.blank({ taxonomy: current.id, text, ms_to_answer: Date.now() - startedAt });
  } catch (e) {
    toast(`Could not save: ${e.message}`, 4000);
    return;
  }
  render(r);
}

$('#submit').addEventListener('click', submit);

/* ---------------- result ---------------- */

function render(r) {
  $('#writepanel').hidden = true;
  $('#result').hidden = false;

  $('#score').textContent = `${r.recalled.length}/${r.total}`;
  $('#score').className = `big ${r.score >= 0.8 ? 'good' : r.score >= 0.5 ? 'warn' : 'bad'}`;
  $('#scoresub').textContent =
    `${pctOf(r.score, 0)} of ${r.taxonomy.label} recalled in ${mmss(Date.now() - startedAt)}`;
  clear($('#prevbest'));
  add($('#prevbest'),
    r.taxonomy.supplementary
      ? el('div', { text: 'This list is supplementary — it is not in the objectives document.' })
      : null,
    r.missed.length
      ? el('a', {
        class: 'btn learnlink',
        href: `/learn.html?code=${encodeURIComponent(r.taxonomy.code)}`,
        text: `Read the material on ${r.taxonomy.code} — you missed ${r.missed.length} →`,
      })
      : null);

  $('#okhead').textContent = `Recalled — ${r.recalled.length}`;
  const ok = clear($('#okterms'));
  if (!r.recalled.length) ok.append(el('li', { class: 'dim', text: 'nothing' }));
  for (const x of r.recalled) {
    ok.append(el('li', {}, x.term,
      x.exact ? null : el('span', { class: 'approx', text: `you wrote "${x.input}"` })));
  }

  $('#nohead').textContent = `Missed — ${r.missed.length}`;
  const no = clear($('#noterms'));
  if (!r.missed.length) no.append(el('li', { class: 'good', text: 'nothing missed — full list' }));
  for (const t of r.missed) no.append(el('li', { text: t }));

  $('#invpanel').hidden = r.invented.length === 0 && r.duplicates.length === 0;
  $('#invhead').textContent = `Invented — ${r.invented.length}`;
  const inv = clear($('#invterms'));
  for (const x of r.invented) {
    inv.append(el('li', {}, el('b', { text: x.input }), el('small', { text: x.note })));
  }
  for (const d of r.duplicates) {
    inv.append(el('li', {}, el('b', { text: d.input }),
      el('small', { text: `Duplicate — you already wrote "${d.term}".` })));
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$('#retry').addEventListener('click', () => choose(current.id));
$('#another').addEventListener('click', () => {
  $('#result').hidden = true;
  $('#writepanel').hidden = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ---------------- keyboard ---------------- */

document.addEventListener('keydown', (ev) => {
  const inBox = document.activeElement === $('#input');

  if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); submit(); return; }
  if (inBox) return;

  if (/^[1-6]$/.test(ev.key)) {
    const t = taxonomies[Number(ev.key) - 1];
    if (t) { ev.preventDefault(); choose(t.id); }
  }
});

// One keystroke in: the picker has focus on load, and ?t= deep-links straight
// to a list from the dashboard.
const preset = new URLSearchParams(location.search).get('t');
if (preset && taxonomies.some((t) => t.id === preset)) choose(preset);
else $$('#taxpick button')[0]?.focus();
