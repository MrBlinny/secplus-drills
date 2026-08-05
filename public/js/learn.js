import { get } from './api.js';
import { $, el, clear, add, mountBar, escapeHtml } from './ui.js';

mountBar('/learn.html');

const index = await get('/api/learn');
let general = null;

/* ---------------- sidebar ---------------- */

const toc = clear($('#toc'));
let lastDomain = null;
for (const t of index.topics) {
  if (t.domain !== lastDomain) {
    toc.append(el('div', { class: 'navgroup', text: `${t.domain} ${t.domainLabel}` }));
    lastDomain = t.domain;
  }
  toc.append(el('a', {
    href: `#${t.code}`, 'data-code': t.code,
    title: t.title,
  }, el('b', { text: t.code }), ' ', el('span', { text: t.shortTitle })));
}

const tr = clear($('#tocreg'));
for (const r of index.deepDives) {
  tr.append(el('a', { href: `#${r.id}`, 'data-gen': r.id, text: r.title }));
}

const tg = clear($('#tocgeneral'));
for (const g of index.general) {
  tg.append(el('a', { href: `#${g.id}`, 'data-gen': g.id, text: g.title }));
}
tg.append(el('a', { href: '#rules', 'data-gen': 'rules', text: `The ${index.ruleCount} scenario rules` }));

function markActive(hash) {
  for (const a of document.querySelectorAll('#toc a, #tocreg a, #tocgeneral a')) {
    a.setAttribute('aria-current', a.getAttribute('href') === `#${hash}` ? 'page' : 'false');
  }
}

/* ---------------- rendering ---------------- */

function section(title, html, note, cls = '') {
  return el('div', { class: 'panel' },
    el('h2', { text: title }),
    note ? el('p', { class: 'hint', style: 'margin:-6px 0 12px', html: note }) : null,
    el('div', { class: `prose ${cls}`.trim(), html }));
}

async function showTopic(code) {
  let t;
  try {
    t = await get(`/api/learn/${encodeURIComponent(code)}`);
  } catch (e) {
    clear($('#main')).append(el('div', { class: 'panel' },
      el('h2', { text: 'No material for that objective' }),
      el('p', { class: 'empty', text: e.message })));
    return;
  }
  const main = clear($('#main'));

  const acc = t.seen ? `${t.correct}/${t.seen} correct so far` : 'not answered yet';
  add(main, el('div', { class: 'panel' },
    el('div', { class: 'qmeta' },
      el('span', { class: 'tag', text: t.code }),
      el('span', { text: `${t.domain} ${t.domainLabel}` }),
      el('span', { text: `${t.bankItems} questions in the bank` }),
      el('span', { class: t.seen && t.correct / t.seen < 0.7 ? 'warn' : 'dim', text: acc })),
    el('h1', { style: 'margin:6px 0 14px;font-size:24px;line-height:1.3', text: t.title }),
    el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
      el('a', { class: 'btn', href: `/drill.html?objective=${encodeURIComponent(t.code)}&auto=1`,
        text: 'Drill this objective' }),
      t.pairs.length
        ? el('a', { class: 'btn', href: `/pairs.html?objective=${encodeURIComponent(t.code)}`,
          text: `Recall the ${t.pairs.length} pairs` })
        : null)));

  // The objectives name the 4.3 instruments and stop. Offer the explanation
  // above the list, since reading the list first teaches nothing here.
  if (t.deepDive?.length) {
    add(main, el('div', { class: 'panel' },
      el('h2', { text: 'Understand the instruments first' }),
      el('p', { class: 'hint', style: 'margin:-6px 0 12px' },
        'What each one is, whether it binds you, who it applies to, and who enforces it. '
        + 'The objectives list below names them but does not explain them.'),
      el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
        t.deepDive.map((d) => el('a', { class: 'btn', href: `#${d.id}`, text: d.title })))));
  }

  if (t.objectivesHtml) {
    add(main, section('What the objectives actually say', t.objectivesHtml,
      'Verbatim from <span class="mono">content/objectives.md</span>. '
      + 'These exact words are the credited answers.'));
  }

  if (t.curriculumHtml) {
    add(main, section(
      t.curriculumShared ? `Discriminators — ${escapeHtml(t.curriculumTitle)}` : 'Discriminators',
      t.curriculumHtml,
      t.curriculumShared
        ? `From the cram sheet. This section covers several objectives together, so it is broader than ${t.code}.`
        : 'From the cram sheet. Not definitions — the binary tests that separate adjacent terms.'));
  }

  if (t.pairs.length) {
    const rows = t.pairs.map((p) => el('tr', {},
      el('td', {}, p.cue),
      el('td', {}, el('b', { class: 'good', text: p.correct_term })),
      el('td', {}, el('span', { class: 'bad', text: p.common_trap })),
      el('td', { class: 'dim' }, p.discriminator)));
    add(main, el('div', { class: 'panel' },
      el('h2', { text: `Confusion pairs for ${t.code}` }),
      el('p', { class: 'hint', style: 'margin:-6px 0 12px',
        text: 'Read these last. Then go recall them with the cue hidden.' }),
      el('div', { style: 'overflow-x:auto' },
        el('table', { class: 'tbl' },
          el('thead', {}, el('tr', {},
            el('th', { text: 'Cue in the stem' }), el('th', { text: 'Answer' }),
            el('th', { text: 'The trap' }), el('th', { text: 'Discriminator' }))),
          el('tbody', {}, rows)))));
  }

  if (!t.objectivesHtml && !t.curriculumHtml) {
    add(main, el('div', { class: 'panel' },
      el('p', { class: 'empty', text: 'No written material for this objective yet.' })));
  }

  markActive(t.code);
  window.scrollTo({ top: 0 });
}

async function showGeneral(id) {
  general ??= await get('/api/learn/general');
  const main = clear($('#main'));

  if (id === 'rules') {
    add(main, el('div', { class: 'panel' },
      el('h2', { text: `The ${general.rules.length} scenario rules` }),
      el('p', { class: 'hint', style: 'margin:-6px 0 14px',
        text: 'Induced from scenario questions actually missed. These target the '
          + 'reasonable-practitioner trap: picking the sensible operational fix where the '
          + 'credited answer is architectural, mathematical, or the hard compliance line.' }),
      el('div', { style: 'overflow-x:auto' },
        el('table', { class: 'tbl' },
          el('thead', {}, el('tr', {},
            el('th', { text: '#' }), el('th', { text: 'When' }), el('th', { text: 'Then' }))),
          el('tbody', {}, general.rules.map((r) => el('tr', {},
            el('td', { class: 'mono' }, String(r.n)),
            el('td', {}, el('b', { text: r.when })),
            el('td', {}, r.then))))))));
  } else {
    const g = general.general.find((x) => x.id === id)
      ?? general.deepDives.find((x) => x.id === id);
    if (!g) { add(main, el('div', { class: 'panel' }, el('p', { class: 'empty', text: 'Not found.' }))); return; }
    // The deep-dive write-ups are long enough to navigate by subheading, so
    // they get a stronger heading treatment than the short cram-sheet sections.
    add(main, section(g.title, g.html, null, id.startsWith('reg-') ? 'longform' : ''));
    if (id.startsWith('reg-')) {
      const i = general.deepDives.findIndex((x) => x.id === id);
      const prev = general.deepDives[i - 1];
      const next = general.deepDives[i + 1];
      add(main, el('div', { class: 'panel' },
        el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center' },
          prev ? el('a', { class: 'btn', href: `#${prev.id}`, text: `← ${prev.title}` }) : null,
          next ? el('a', { class: 'btn', href: `#${next.id}`, text: `${next.title} →` }) : null,
          el('a', { class: 'btn', href: '#4.3', text: 'Back to 4.3' }),
          el('a', { class: 'btn', href: '/drill.html?code=4.3&auto=1', text: 'Drill 4.3' }))));
    }
  }
  markActive(id);
  window.scrollTo({ top: 0 });
}

/* ---------------- routing ---------------- */

function route() {
  const hash = decodeURIComponent(location.hash.slice(1));
  if (!hash) return showTopic(index.topics[0].code);
  if (index.topics.some((t) => t.code === hash)) return showTopic(hash);
  if (hash === 'rules'
      || index.general.some((g) => g.id === hash)
      || index.deepDives.some((r) => r.id === hash)) return showGeneral(hash);
  // Tolerate a full bank label ("2.6 Attacks") and cross-cutting codes
  // ("3.x Business context") — the server resolves both.
  const code = (hash.match(/^\d\.(?:\d|x)/) ?? [])[0];
  if (code) return showTopic(code);
  return showTopic(index.topics[0].code);
}

window.addEventListener('hashchange', route);

// ?code=2.6 or ?code=2.6%20Attacks from a reveal link
const preset = new URLSearchParams(location.search).get('code');
if (preset && !location.hash) location.hash = preset;
await route();
