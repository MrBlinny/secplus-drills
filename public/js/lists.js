// The write-it-out reference: every enumerable list in the syllabus.
//
// Two jobs. Read mode is a reference you can print and copy onto paper. Hide
// mode turns each list into numbered blanks, which is the same retrieval
// exercise as blank-paper mode but away from the keyboard — click one line to
// peek at it without giving away the rest.

import { api } from './api.js';
import { $, $$, el, clear, add, mountBar, toast, typing } from './ui.js';

mountBar('/lists.html');

const state = { lists: [], sections: [], bankCodes: [] };

/* ------------------------------------------------------------------ */
/* render                                                              */
/* ------------------------------------------------------------------ */

function termRow(t) {
  return el('li', { class: t.sub ? 'sub' : '', ...(t.missed ? { 'data-missed': 'yes' } : {}) },
    el('span', { class: 't', text: t.term }),
    t.gloss ? el('span', { class: 'g', text: `— ${t.gloss}` }) : null,
    t.missed ? el('span', {
      class: 'mk',
      title: 'You failed to recall this in blank paper, a PBQ cell, or a confusion pair.',
      text: t.missed > 1 ? `dropped ${t.missed}×` : 'dropped',
    }) : null,
  );
}

function card(l) {
  const acts = [
    l.taxonomy
      ? el('a', { href: `/blank.html?t=${encodeURIComponent(l.taxonomy)}`, text: 'Blank paper →' })
      : null,
    state.bankCodes.includes(l.code)
      ? el('a', { href: `/drill.html?code=${encodeURIComponent(l.code)}`, text: 'Drill →' })
      : null,
    /^\d\.\d$/.test(l.code)
      ? el('a', { href: `/learn.html?code=${encodeURIComponent(l.code)}`, text: 'Learn →' })
      : null,
  ].filter(Boolean);

  return el('section', {
    class: 'listcard', id: l.id,
    'data-graded': l.graded ? 'yes' : 'no',
  },
  el('h3', {},
    l.code !== 'sup' ? el('span', { class: 'k', text: l.code }) : null,
    el('span', { class: 'ttl', text: l.group }),
    el('span', { class: 'ct', text: String(l.count) }),
    l.graded ? el('span', { class: 'bdg good', text: 'blank paper' }) : null,
    l.verbatim ? el('span', { class: 'bdg warn', text: 'verbatim' }) : null,
    l.ordered ? el('span', { class: 'bdg', text: 'order matters' }) : null,
    l.source === 'curriculum.md' ? el('span', { class: 'bdg dim', text: 'supplementary' }) : null,
  ),
  el('ol', { class: 'terms', onclick: (ev) => {
    // Peek at one line without revealing the list.
    const li = ev.target.closest('li');
    if (li) li.toggleAttribute('data-peek');
  } }, l.terms.map(termRow)),
  l.caveat ? el('p', { class: 'caveat', text: l.caveat }) : null,
  acts.length ? el('p', { class: 'acts' }, acts) : null,
  );
}

function render() {
  const onlyGraded = $('#verbatim').checked;
  const shown = state.lists.filter((l) => !onlyGraded || l.graded);

  const main = clear($('#main'));
  const toc = clear($('#toc'));

  for (const s of state.sections) {
    const mine = shown.filter((l) => l.domain === s.domain);
    if (!mine.length) continue;

    const terms = mine.reduce((a, l) => a + l.count, 0);
    main.append(el('h2', { class: 'sechead', id: `sec-${s.domain}` },
      el('span', { text: s.title }),
      el('span', { class: 'dim', text: `${mine.length} lists · ${terms} terms${s.weight ? ` · ${s.weight} of the exam` : ''}` }),
    ));
    add(main, el('div', { class: 'listgrid' }, mine.map(card)));

    toc.append(el('div', { class: 'navgroup', text: s.title }));
    for (const l of mine) {
      toc.append(el('a', { href: `#${l.id}` },
        el('b', { text: l.code === 'sup' ? '·' : l.code }),
        el('span', { text: l.group }),
        el('span', { class: 'n dim', text: String(l.count) })));
    }
  }

  const totalTerms = shown.reduce((a, l) => a + l.count, 0);
  const dropped = shown.reduce((a, l) => a + l.terms.filter((t) => t.missed).length, 0);
  $('#tally').textContent =
    `${shown.length} lists · ${totalTerms} terms`
    + (dropped ? ` · ${dropped} you have failed to recall at least once` : '');
}

/* ------------------------------------------------------------------ */
/* controls                                                            */
/* ------------------------------------------------------------------ */

function applyFlags() {
  document.body.dataset.hide = $('#hide').checked ? 'yes' : 'no';
  document.body.dataset.marks = $('#marks').checked ? 'yes' : 'no';
  // Peeked lines are only meaningful while hidden.
  if (!$('#hide').checked) $$('#main li[data-peek]').forEach((li) => li.removeAttribute('data-peek'));
}

function bind() {
  $('#hide').addEventListener('change', applyFlags);
  $('#marks').addEventListener('change', applyFlags);
  $('#verbatim').addEventListener('change', render);
  $('#print').addEventListener('click', () => window.print());

  document.addEventListener('keydown', (ev) => {
    if (typing() || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.key.toLowerCase() === 'h') {
      ev.preventDefault();
      $('#hide').checked = !$('#hide').checked;
      applyFlags();
      toast($('#hide').checked ? 'Terms hidden — click a line to peek' : 'Terms shown');
    }
    if (ev.key.toLowerCase() === 'p') { ev.preventDefault(); window.print(); }
  });
}

/* ------------------------------------------------------------------ */

try {
  const data = await api.lists();
  state.lists = data.lists;
  state.sections = data.sections;
  state.bankCodes = data.bankCodes;
  bind();
  applyFlags();
  render();
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
} catch (e) {
  clear($('#main')).append(el('div', { class: 'panel' },
    el('p', { class: 'empty', text: `Could not load the lists: ${e.message}` })));
}
