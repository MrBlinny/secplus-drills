// Exam sim: 90 at blueprint weights, 90 minutes, no feedback until submit.
// The real exam allows 90 minutes for a maximum of 90 questions — one minute
// each. Length and clock come from the API so there is a single source of them.

import { api } from './api.js';
import { $, el, clear, add, mountBar, toast, mmss, pct, signed, setBarMeta } from './ui.js';
import { projectionTrack, domainBars } from './charts.js';

mountBar('/exam.html');

const boot = await api.bootstrap();
// Real exam length and clock, served by the API so there is one source of it.
const MINUTES = boot.examMinutes ?? 90;
const COUNT = boot.examQuestions ?? 90;

let qs = [];
let answers = [];      // index -> chosen option or null
let flagged = [];
let shownAt = [];      // per-question accumulated ms
let cur = 0;
let deadline = 0;
let ticker = null;
let live = false;

/* ---------------- setup ---------------- */

$('#quota').innerHTML = 'Blueprint draw: '
  + Object.entries(boot.examQuota)
    .map(([d, n]) => `<b>${d}</b> ${n}`).join(' &nbsp;·&nbsp; ')
  + ` &nbsp;=&nbsp; ${Object.values(boot.examQuota).reduce((a, b) => a + b, 0)} questions`;

async function begin() {
  let data;
  try { data = await api.exam(COUNT); } catch (e) { toast(e.message, 4000); return; }

  const notes = [];
  if (Object.keys(data.shortfall).length) {
    const s = Object.entries(data.shortfall).map(([d, n]) => `${d} short by ${n}`).join(', ');
    notes.push(`The bank cannot fill the blueprint exactly: ${s}. `
      + `The paper runs at ${data.questions.length} questions instead of ${COUNT}.`);
  }
  // Say plainly how clean the measurement is. A sim padded with questions from
  // the last few hours reads high for the wrong reason, and a score you cannot
  // trust is worse than no score.
  if (data.reusedRecent) {
    notes.push(`${data.reusedRecent} of these ${data.questions.length} questions were answered `
      + `in the last ${data.freshHours}h — not enough unseen items left to fill the blueprint. `
      + `Treat the score as slightly flattering.`);
  } else if (data.freshHours) {
    notes.push(`Clean draw: nothing here has been answered in the last ${data.freshHours} hours.`);
  }
  const sf = clear($('#shortfall'));
  for (const n of notes) sf.append(el('div', { class: 'ruleref', text: n }));

  qs = data.questions;
  answers = qs.map(() => null);
  flagged = qs.map(() => false);
  shownAt = qs.map(() => 0);
  cur = 0;
  live = true;

  $('#setup').hidden = true;
  $('#run').hidden = false;
  deadline = Date.now() + MINUTES * 60000;
  tick();
  ticker = setInterval(tick, 1000);
  buildGrid();
  show(0);
}

function tick() {
  const left = deadline - Date.now();
  setBarMeta(`<span style="color:${left < 5 * 60000 ? 'var(--bad)' : 'var(--muted)'}">${mmss(left)} left</span>`);
  if (left <= 0) { toast('Time — submitting', 3000); submit(); }
}

/* ---------------- navigation ---------------- */

let enteredAt = 0;

function show(i) {
  if (enteredAt) shownAt[cur] += Date.now() - enteredAt;
  cur = Math.max(0, Math.min(qs.length - 1, i));
  enteredAt = Date.now();

  const q = qs[cur];
  add(clear($('#qmeta')),
    el('span', { class: 'tag', text: q.objective }),
    el('span', { text: `${cur + 1} of ${qs.length}` }),
    flagged[cur] ? el('span', { class: 'warn', text: 'flagged' }) : null);

  $('#stem').textContent = q.stem;
  const opts = clear($('#options'));
  q.options.forEach((text, n) => {
    opts.append(el('button', {
      class: 'opt', 'data-i': n,
      'data-state': answers[cur] === n ? 'picked' : '',
      onclick: () => choose(n),
    }, el('span', { class: 'num', text: String(n + 1) }), el('span', { text })));
  });

  $('#prog').style.width = `${(answers.filter((a) => a !== null).length / qs.length) * 100}%`;
  $('#flag').innerHTML = flagged[cur] ? 'Unflag' : '<kbd>F</kbd> Flag';
  paintGrid();
}

function choose(n) {
  answers[cur] = answers[cur] === n ? null : n;
  show(cur);
}

function buildGrid() {
  const g = clear($('#grid'));
  qs.forEach((_, i) => {
    g.append(el('button', {
      'data-g': i, onclick: () => show(i),
      style: 'width:34px;height:30px;padding:0;font:12px var(--mono)',
      text: String(i + 1),
    }));
  });
  $('#gridlegend').innerHTML =
    '<span class="good">answered</span> &nbsp; <span class="warn">flagged</span> '
    + '&nbsp; <span class="dim">blank</span> &nbsp;·&nbsp; current is outlined';
}

function paintGrid() {
  for (const b of $('#grid').children) {
    const i = Number(b.dataset.g);
    b.style.borderColor = i === cur ? 'var(--accent)'
      : flagged[i] ? 'var(--warn)'
        : answers[i] !== null ? 'var(--good)' : 'var(--line)';
    b.style.color = answers[i] !== null ? 'var(--text)' : 'var(--dim)';
    b.style.background = i === cur ? '#14263d' : 'var(--panel-2)';
  }
}

/* ---------------- submit ---------------- */

let submitting = false;

async function submit() {
  if (submitting) return;
  const blank = answers.filter((a) => a === null).length;
  if (blank && deadline - Date.now() > 0
      && !confirm(`${blank} question${blank === 1 ? '' : 's'} still blank. Submit anyway?`)) return;

  submitting = true;
  live = false;
  clearInterval(ticker);
  if (enteredAt) shownAt[cur] += Date.now() - enteredAt;

  let r;
  try {
    r = await api.examSubmit({
      elapsed_ms: MINUTES * 60000 - Math.max(0, deadline - Date.now()),
      // The flag is the learner's own judgement that something was odd or not
      // understood, which is the most useful review signal on the paper — so it
      // goes to the log, not just to the grid.
      answers: qs.map((q, i) => ({
        item_id: q.id, chosen: answers[i], ms_to_answer: shownAt[i] || null,
        flagged: flagged[i] === true,
      })),
    });
  } catch (e) { toast(`Submit failed: ${e.message}`, 6000); submitting = false; live = true; return; }

  renderResults(r);
}

function renderResults(r) {
  $('#run').hidden = true;
  $('#results').hidden = false;
  setBarMeta('');

  $('#rweighted').innerHTML = r.weighted === null ? '—' : `${r.weighted.toFixed(1)}<small>%</small>`;
  $('#rsub').textContent = `blueprint-weighted · ${r.correct}/${r.total} correct`;
  $('#rraw').textContent = pct(r.raw);
  const rbaseTile = $('#rbasebox');
  if (boot.baselineWeighted === null || boot.baselineWeighted === undefined) rbaseTile?.remove();
  else $('#rbase').textContent = pct(boot.baselineWeighted);
  const delta = (r.weighted === null || boot.baselineWeighted == null)
    ? null : r.weighted - boot.baselineWeighted;
  $('#rdelta').innerHTML = delta === null ? ''
    : `movement <b class="delta ${delta >= 0 ? 'good' : 'bad'}">${signed(delta)} pts</b>`;
  $('#rtime').textContent = mmss(r.elapsed_ms ?? 0);

  projectionTrack($('#rtrack'), { weighted: r.weighted, baseline: boot.baselineWeighted });

  const byDomain = {};
  for (const [d, v] of Object.entries(r.byDomain)) {
    byDomain[d] = {
      domain: d, label: boot.domainLabels[d], weight: boot.domainWeights[d],
      n: v.n, correct: v.correct, accuracy: v.n ? v.correct / v.n : null,
    };
  }
  domainBars($('#rdomains'), byDomain, { baseline: boot.baselineWeighted });

  const nFlagged = r.review.filter((x) => x.flagged).length;
  $('#flagcount').textContent = nFlagged
    ? `${nFlagged} flagged`
    : 'nothing flagged on this paper';

  const draw = () => {
    const onlyWrong = $('#onlywrong').checked;
    const onlyFlagged = $('#onlyflagged').checked;
    const host = clear($('#review'));
    const rows = r.review.filter((x) => (!onlyWrong || !x.is_correct)
      && (!onlyFlagged || x.flagged));
    if (!rows.length) {
      host.append(el('p', { class: 'empty', text: 'Nothing matches those filters.' }));
      return;
    }
    rows.forEach((x) => {
      const n = r.review.indexOf(x) + 1;
      host.append(el('div', { style: 'padding:14px 0;border-bottom:1px solid #1e242c' },
        el('div', { class: 'qmeta' },
          el('span', { class: 'tag', text: x.objective }),
          el('span', { text: `Q${n}` }),
          el('span', { class: x.is_correct ? 'good' : 'bad', text: x.is_correct ? 'correct' : 'wrong' }),
          x.flagged ? el('span', { class: 'warn', text: 'you flagged this' }) : null),
        el('p', { style: 'margin:0 0 8px', text: x.stem }),
        el('div', { style: 'font-size:14px;margin-bottom:8px' },
          el('span', { class: x.is_correct ? 'good' : 'bad',
            text: `you: ${x.chosen === null ? '(blank)' : x.options[x.chosen]}` }),
          el('span', { class: 'dim', text: '   →   ' }),
          el('span', { class: 'good', text: `answer: ${x.options[x.correct]}` })),
        el('div', { class: 'explanation', text: x.explanation }),
        x.is_correct && !x.flagged ? null : el('a', {
          class: 'btn learnlink',
          href: `/learn.html?code=${encodeURIComponent(x.objective)}`,
          target: '_blank', rel: 'noopener',
          text: `Read the material on ${x.objective} →`,
        })));
    });
  };
  $('#onlywrong').addEventListener('change', draw);
  $('#onlyflagged').addEventListener('change', draw);
  draw();
  window.scrollTo({ top: 0 });
}

/* ---------------- wiring ---------------- */

$('#go').addEventListener('click', begin);
$('#prev').addEventListener('click', () => show(cur - 1));
$('#next').addEventListener('click', () => show(cur + 1));
$('#submit').addEventListener('click', submit);
$('#flag').addEventListener('click', () => { flagged[cur] = !flagged[cur]; show(cur); });

document.addEventListener('keydown', (ev) => {
  if (!live) {
    if (ev.key === 'Enter' && !$('#setup').hidden) { ev.preventDefault(); begin(); }
    return;
  }
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const k = ev.key.toLowerCase();

  if (/^[1-9]$/.test(k) && Number(k) <= qs[cur].options.length) { ev.preventDefault(); choose(Number(k) - 1); }
  else if (ev.key === 'Enter' || k === 'n' || ev.key === 'ArrowRight') { ev.preventDefault(); show(cur + 1); }
  else if (k === 'p' || ev.key === 'ArrowLeft') { ev.preventDefault(); show(cur - 1); }
  else if (k === 'f') { ev.preventDefault(); flagged[cur] = !flagged[cur]; show(cur); }
});

window.addEventListener('beforeunload', (ev) => {
  if (live) { ev.preventDefault(); ev.returnValue = ''; }
});
