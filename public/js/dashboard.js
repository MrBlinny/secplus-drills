import { api } from './api.js';
import { $, el, clear, add, mountBar, pct, pctOf, signed } from './ui.js';
import { projectionTrack, domainBars } from './charts.js';

mountBar('/');

let includeBaseline = localStorage.getItem('incbase') === '1';
$('#incbase').checked = includeBaseline;

async function load() {
  const d = await api.dashboard(includeBaseline);
  const taxonomies = await api.taxonomies();
  // A broken PBQ bank must not take the whole dashboard down with it.
  const pbqs = await api.pbqList().then((r) => r.items).catch(() => null);
  render(d, taxonomies, pbqs);
}

function render(d, taxonomies, pbqs) {
  const p = d.projection;

  /* ---- headline: weighted projection ---- */

  // Below this many graded answers the weighted number is noise, not a
  // projection. Show it, but greyed and captioned — never as a headline claim.
  const MIN_N = 20;
  const thin = p.weighted !== null && p.n < MIN_N;

  $('#weighted').innerHTML = p.weighted === null
    ? '<span style="font-size:30px;color:var(--dim);font-weight:600">not yet</span>'
    : `${p.weighted.toFixed(1)}<small>%</small>`;
  $('#weighted').style.color = thin ? 'var(--dim)' : '';

  $('#weightedsub').textContent = p.weighted === null
    ? 'No answers in scope yet — answer some questions and this fills in.'
    : thin
      ? `provisional — only ${p.n} answer${p.n === 1 ? '' : 's'}, too few to project. `
        + `${MIN_N - p.n} more and this becomes meaningful.`
      : `blueprint-weighted · n=${p.n} answers · covers ${p.coverage}% of the blueprint`;

  $('#raw').textContent = pct(p.raw);
  // No cold pre-study sitting exists for this cert, so the baseline tile has
  // nothing to show and is removed rather than left reading "—".
  const baseTile = $('#baselinebox');
  if (d.baselineWeighted === null || d.baselineWeighted === undefined) baseTile?.remove();
  else $('#baseline').textContent = pct(d.baselineWeighted);

  const delta = (p.weighted === null || thin || d.baselineWeighted == null)
    ? null : p.weighted - d.baselineWeighted;
  $('#deltaline').innerHTML = delta === null ? ''
    : `movement <b class="delta ${delta >= 0 ? 'good' : 'bad'}">${signed(delta)} pts</b>`;

  const roll = d.rolling50;
  clear($('#rollingbox'));
  if (roll?.weighted !== null && roll?.weighted !== undefined) {
    add($('#rollingbox'),
      el('div', { text: 'last 50 answers' }),
      el('div', {}, el('b', { text: pct(roll.weighted) })),
      el('div', { class: 'dim', style: 'font-size:12px', text: `raw ${pct(roll.raw)}` }));
  }

  projectionTrack($('#projchart'), { weighted: p.weighted, baseline: d.baselineWeighted });

  $('#scopenote').textContent = includeBaseline
    ? `showing all ${d.counts.total} answers, baseline included`
    : d.counts.baseline
      ? `showing your ${d.counts.study} study answers — the ${d.counts.baseline} baseline rows are excluded`
      : `showing all ${d.counts.study} study answers`;

  /* ---- per-domain ---- */

  domainBars($('#domains'), p.byDomain, { baseline: d.baselineWeighted });

  /* ---- coverage ----
   * Replaces the old miss-type chart. Miss classification is no longer
   * collected, so that chart could only ever have been empty from here on.
   */

  const c = d.coverage;
  $('#covnum').textContent = `${c.proven}/${c.total}`;
  $('#covsub').textContent = c.unproven
    ? `${c.unproven} still unproven`
    : 'every authored item proven';
  $('#covpanel').classList.toggle('danger', c.unproven > 0);

  const ct = clear($('#covtable'));
  ct.append(el('thead', {}, el('tr', {},
    el('th', { text: 'Objective' }),
    el('th', { class: 'num', text: 'Proven' }),
    el('th', { class: 'num', text: 'Left' }))));
  const cb = el('tbody');
  // Worst first: the objectives with the most still unproven are the ones to
  // point at, not the ones that happen to sort first alphabetically.
  for (const r of [...c.rows].sort((a, b) => (b.total - b.proven) - (a.total - a.proven))) {
    const left = r.total - r.proven;
    cb.append(el('tr', {},
      el('td', {}, el('a', { href: `/drill.html?objective=${encodeURIComponent(r.objective)}`, text: r.objective })),
      el('td', { class: 'num', text: `${r.proven}/${r.total}` }),
      el('td', { class: `num ${left ? 'bad' : 'good'}`, text: left ? String(left) : '✓' })));
  }
  ct.append(cb);
  $('#covhint').innerHTML = c.unproven
    ? 'Run <a href="/drill.html">Cover everything</a> until this is clear.'
    : 'Nothing left unproven. Move to exam sims.';

  /* ---- activity ---- */

  const a = d.activity;
  add(clear($('#activity')),
    el('div', {}, el('div', { class: 'v', text: String(a.answeredToday) }),
      el('div', { class: 'l', text: 'answered today' })),
    el('div', {},
      el('div', { class: 'v', text: `${a.correctToday}/${a.gradedToday}` }),
      el('div', { class: 'l', text: 'graded correct' })),
    el('div', {}, el('div', { class: 'v', text: `${a.streak}d` }),
      el('div', { class: 'l', text: 'streak' })),
    el('div', {}, el('div', { class: 'v', text: String(a.totalAnswered) }),
      el('div', { class: 'l', text: 'total answers' })),
  );

  /* ---- due ---- */

  const due = clear($('#due'));
  if (!d.due.total) {
    due.append(el('p', { class: 'empty', text: 'Nothing due. Misses come back in ~10 minutes.' }));
  } else {
    add(due, el('div', { class: 'stat' },
      el('div', {}, el('div', { class: 'v', text: String(d.due.items) }),
        el('div', { class: 'l', text: 'items due' })),
      el('div', {}, el('div', { class: 'v', text: String(d.due.pairs) }),
        el('div', { class: 'l', text: 'pairs due' })),
    ),
    el('p', { style: 'margin:12px 0 0;display:flex;gap:8px;flex-wrap:wrap' },
      d.due.items ? el('a', { class: 'btn', href: '/drill.html?auto=1', text: 'Drill what is due' }) : null,
      d.due.pairs ? el('a', { class: 'btn', href: '/pairs.html?auto=1', text: 'Review pairs' }) : null,
    ));
  }

  /* ---- weakest five ---- */

  const t = clear($('#weakest'));
  t.append(el('thead', {}, el('tr', {},
    el('th', { text: 'Objective' }),
    el('th', { class: 'r', text: 'Accuracy' }),
    el('th', { class: 'r', text: 'Seen' }),
    el('th', { text: '' }),
  )));
  const tb = el('tbody');
  for (const w of d.weakest) {
    tb.append(el('tr', {},
      el('td', {},
        el('div', { text: w.objective }),
        w.basis === 'baseline-domain'
          ? el('div', { class: 'dim', style: 'font-size:12px', text: 'from baseline domain accuracy — no objective-level answers yet' })
          : null),
      el('td', { class: 'r mono', text: w.accuracy === null ? '—' : pctOf(w.accuracy) }),
      el('td', { class: 'r mono dim', text: w.n ? `${w.correct}/${w.n}` : '0' }),
      el('td', { class: 'r' }, el('div', { style: 'display:flex;gap:6px;justify-content:flex-end' },
        el('a', {
          class: 'btn', text: 'Read',
          href: `/learn.html?code=${encodeURIComponent(w.objective)}`,
        }),
        el('a', {
          class: 'btn', text: 'Drill',
          href: `/drill.html?objective=${encodeURIComponent(w.objective)}&auto=1`,
        }))),
    ));
  }
  t.append(tb);

  /* ---- quick blank paper ---- */

  const qb = clear($('#quickblank'));
  taxonomies.forEach((tx, i) => {
    qb.append(el('a', {
      class: 'btn', href: `/blank.html?t=${tx.id}`,
      style: 'display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:150px',
    },
      el('span', { class: 'k', style: 'font:12px var(--mono);color:var(--accent)', text: `${i + 1}  ${tx.code}` }),
      el('span', { style: 'font-size:14px', text: tx.title }),
      el('span', { style: 'font:11px var(--mono);color:var(--dim)', text: `${tx.count} terms` }),
    ));
  });

  /* ---- PBQs ---- */

  const qp = clear($('#quickpbq'));
  if (pbqs) {
    // Untried first, then weakest — the same "go where it hurts" ordering the
    // rest of the dashboard uses.
    const ranked = [...pbqs].sort((a, b) =>
      (a.history ? 1 : 0) - (b.history ? 1 : 0)
      || (a.history?.best ?? 0) - (b.history?.best ?? 0));
    for (const p of ranked.slice(0, 6)) {
      const best = p.history ? `best ${Math.round(p.history.best * 100)}%` : 'not attempted';
      qp.append(el('a', {
        class: 'btn', href: `/pbq.html#${p.id}`,
        style: 'display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:170px',
      },
      el('span', { style: 'font:12px var(--mono);color:var(--accent)', text: p.objective }),
      el('span', { style: 'font-size:14px', text: p.title }),
      el('span', {
        style: `font:11px var(--mono);color:var(--${p.history && p.history.best === 1 ? 'good' : 'dim'})`,
        text: `~${p.minutes} min · ${best}`,
      })));
    }
    const done = pbqs.filter((p) => p.history).length;
    $('#pbqnote').textContent = done === 0
      ? `${pbqs.length} authored, none attempted. Budget about a minute a question on the real `
        + 'paper — a four-minute PBQ costs four multiple-choice answers.'
      : `${done} of ${pbqs.length} attempted. Press Q for the full list.`;
  } else {
    qp.append(el('p', { class: 'empty', text: 'PBQ bank unavailable.' }));
  }

}

$('#incbase').addEventListener('change', (ev) => {
  includeBaseline = ev.target.checked;
  localStorage.setItem('incbase', includeBaseline ? '1' : '0');
  load();
});

/* Letter keys jump straight into a mode. */
document.addEventListener('keydown', (ev) => {
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const map = {
    d: '/drill.html', b: '/blank.html', p: '/pairs.html',
    w: '/weak.html', e: '/exam.html', q: '/pbq.html',
  };
  if (map[ev.key.toLowerCase()]) location.href = map[ev.key.toLowerCase()];
});

await load();
