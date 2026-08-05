// The question flow, shared by drill, weak-areas and cover-everything.
//
// Key contract: 1-4 picks and immediately reveals, Enter advances. Nothing else.
// The flow used to capture a confidence rating before the reveal and a miss
// classification after it. Both are gone: the only thing recorded now is
// whether the answer was right, which is the only thing being studied for.

import { api } from './api.js';
import { $, $$, el, clear, add, toast, typing } from './ui.js';

/** A miss comes back this many questions later, in the same session. */
const REQUEUE_GAP = 4;

export class Quiz {
  constructor({ questions, mode = 'drill', onDone }) {
    this.queue = [...questions];
    this.mode = mode;
    this.onDone = onDone;
    this.answered = 0;
    this.correct = 0;
    this.planned = questions.length;
    this.missed = [];
    this.state = 'answering';
    this.bindKeys();
  }

  /* ---------------- lifecycle ---------------- */

  start() {
    $('#setup').hidden = true;
    $('#run').hidden = false;
    $('#done').hidden = true;
    this.next();
  }

  next() {
    if (!this.queue.length) return this.finish();
    this.q = this.queue.shift();
    this.picked = null;
    this.isCorrect = null;
    this.state = 'answering';
    this.shownAt = performance.now();
    this.render();
  }

  finish() {
    $('#run').hidden = true;
    $('#done').hidden = false;
    const acc = this.answered ? Math.round((this.correct / this.answered) * 100) : 0;
    add(clear($('#summary')),
      el('div', {}, el('div', { class: 'v', text: `${this.correct}/${this.answered}` }),
        el('div', { class: 'l', text: 'correct' })),
      el('div', {}, el('div', { class: 'v', text: `${acc}%` }),
        el('div', { class: 'l', text: 'accuracy' })),
    );

    // What was missed, in plain sight, so the set ends with the list to reread.
    const host = $('#missedlist');
    if (host) {
      clear(host);
      const unique = [...new Map(this.missed.map((m) => [m.id, m])).values()];
      if (unique.length) {
        add(host,
          el('h3', { text: `Missed ${unique.length}` }),
          el('ul', { class: 'missed' }, ...unique.map((m) => el('li', {},
            el('span', { class: 'tag', text: m.objective }),
            el('span', { text: ` ${m.answer}` }),
          ))));
      }
    }
    this.onDone?.();
  }

  /* ---------------- render ---------------- */

  render() {
    const q = this.q;
    $('#prog').style.width =
      `${Math.min(100, (this.answered / Math.max(1, this.planned)) * 100)}%`;

    add(clear($('#qmeta')),
      el('span', { class: 'tag', text: q.objective }),
      el('span', { text: `#${this.answered + 1}` }),
      q.repeat ? el('span', { class: 'warn', text: 'repeat — you missed this' }) : null,
      q.unverified ? el('span', { class: 'warn', text: 'unverified' }) : null,
      q.off_syllabus
        ? el('span', {
          class: 'warn',
          title: 'The credited answer for this one uses no term from the objectives '
               + 'document. Do not memorise the wording.',
          text: 'off-syllabus wording',
        })
        : null,
      q.origin === 'practice'
        ? el('span', {
          class: 'dim',
          title: 'Third-party practice-test question. Its wording is not CompTIA\'s'
               + (q.objective_inferred ? ', and its objective was inferred from the answer text.' : '.'),
          text: q.exam ? `practice · ${q.exam.toLowerCase()}` : 'practice',
        })
        : null,
    );

    $('#stem').textContent = q.stem;

    const opts = clear($('#options'));
    q.options.forEach((text, i) => {
      opts.append(el('button', {
        class: 'opt', 'data-i': i,
        onclick: () => this.pick(i),
      }, el('span', { class: 'num', text: String(i + 1) }), el('span', { text })));
    });

    $('#reveal').hidden = true;
    $('#keys').innerHTML = `Pick with <kbd>1</kbd>–<kbd>${q.options.length}</kbd>`;
  }

  /* ---------------- steps ---------------- */

  async pick(i) {
    if (this.state !== 'answering') return;
    this.picked = i;
    this.ms = Math.round(performance.now() - this.shownAt);
    this.state = 'submitting';

    $$('#options .opt').forEach((b) =>
      b.setAttribute('data-state', Number(b.dataset.i) === i ? 'picked' : ''));

    let r;
    try {
      r = await api.answer({
        item_id: this.q.id,
        chosen: this.picked,
        mode: this.mode,
        ms_to_answer: this.ms,
      });
    } catch (e) {
      toast(`Could not log answer: ${e.message}`, 4000);
      this.state = 'answering';
      return;
    }

    this.isCorrect = r.is_correct;
    this.answered++;
    if (r.is_correct) {
      this.correct++;
    } else {
      this.missed.push({
        id: this.q.id,
        objective: this.q.objective,
        answer: this.q.options[r.correct],
      });
      this.requeue();
    }

    this.showReveal(r);
  }

  requeue() {
    const again = { ...this.q, repeat: true };
    const at = Math.min(REQUEUE_GAP, this.queue.length);
    this.queue.splice(at, 0, again);
  }

  showReveal(r) {
    this.state = 'revealed';

    $$('#options .opt').forEach((b) => {
      const i = Number(b.dataset.i);
      b.setAttribute('data-state',
        i === r.correct ? 'right' : (i === this.picked && !r.is_correct ? 'wrong' : ''));
    });

    const v = $('#verdict');
    v.textContent = r.is_correct ? 'Correct' : 'Wrong';
    v.className = `verdict ${r.is_correct ? 'good' : 'bad'}`;

    $('#explanation').textContent = r.explanation ?? '';

    add(clear($('#ruleref')), el('a', {
      class: 'btn learnlink',
      href: `/learn.html?code=${encodeURIComponent(this.q.code ?? this.q.objective)}`,
      target: '_blank', rel: 'noopener',
      text: `Read the material on ${this.q.objective} →`,
    }));

    $('#reveal').hidden = false;
    $('#advance').innerHTML = 'Press <kbd>Enter</kbd> for the next question';
    $('#keys').innerHTML = '<kbd>Enter</kbd> next';
  }

  advance() {
    if (this.state !== 'revealed') return;
    this.next();
  }

  /* ---------------- keyboard ---------------- */

  bindKeys() {
    document.addEventListener('keydown', (ev) => {
      if ($('#run').hidden) return;
      const k = ev.key;

      if (k === 'Enter') { ev.preventDefault(); this.advance(); return; }
      if (typing()) return;

      if (this.state === 'answering') {
        if (/^[1-9]$/.test(k)) {
          const i = Number(k) - 1;
          if (i < (this.q?.options.length ?? 0)) { ev.preventDefault(); this.pick(i); }
          return;
        }
        if (k === ' ') { ev.preventDefault(); toast('Pick an answer first (1–4)'); }
        return;
      }

      // Space on the reveal would scroll the page; Enter is the only advance.
      if (this.state === 'revealed' && k === ' ') ev.preventDefault();
    });
  }
}
