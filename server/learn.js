// Learn mode — surfaces the teaching content that already exists in content/
// but was previously unreachable from the app.
//
// Two sources, both keyed to the same objective codes the item bank tags
// questions with, so any miss can link straight to the material:
//   objectives.md  — the authoritative list. What the credited answers are.
//   curriculum.md  — the cram sheet. The discriminators that separate them.
//
// Rendered server-side by a deliberately small markdown converter: these files
// use only headings, tables, lists, bold/italic and rules. No code fences, no
// links, no images — checked, not assumed.

import fs from 'node:fs';
import { OBJECTIVES_FILE, CURRICULUM_FILE, DEEP_DIVES_FILE } from './paths.js';
import { PAIRS, RULES, objectiveCode, domainOf, DOMAIN_LABELS } from './content.js';

/* ------------------------------------------------------------------ */
/* markdown                                                            */
/* ------------------------------------------------------------------ */

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/** Inline: bold, then italic. Escaped first, so no markup can be injected. */
function inline(s) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
}

const isTableRow = (l) => /^\s*\|/.test(l);
const isDivider = (l) => /^\s*\|[\s:|-]+\|\s*$/.test(l);

function renderTable(rows) {
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const head = cells(rows[0]);
  const body = rows.slice(isDivider(rows[1]) ? 2 : 1);
  const headHtml = head.some((h) => h)
    ? `<thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead>`
    : '';
  const bodyHtml = body
    .map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<table class="tbl">${headHtml}<tbody>${bodyHtml}</tbody></table>`;
}

/** Nested bullets: indentation of 2+ spaces opens a sub-list. */
function renderList(items) {
  let html = '<ul>';
  let open = false;
  for (const { depth, text } of items) {
    if (depth > 0 && !open) { html += '<ul>'; open = true; }
    else if (depth === 0 && open) { html += '</ul>'; open = false; }
    html += `<li>${inline(text)}</li>`;
  }
  if (open) html += '</ul>';
  return `${html}</ul>`;
}

export function markdown(src) {
  const lines = src.split(/\r?\n/);
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = Math.min(6, h[1].length + 1);   // page owns h1
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    if (isTableRow(line)) {
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) rows.push(lines[i++]);
      out.push(renderTable(rows));
      continue;
    }

    if (/^\s*-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)-\s+(.*)$/);
        items.push({ depth: m[1].length >= 2 ? 1 : 0, text: m[2] });
        i++;
      }
      out.push(renderList(items));
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      out.push(`<ol>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</ol>`);
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim()
           && !isTableRow(lines[i]) && !/^\s*-\s+/.test(lines[i])
           && !/^\s*\d+\.\s+/.test(lines[i])
           && !/^#{1,4}\s/.test(lines[i]) && !/^---+\s*$/.test(lines[i])) {
      para.push(lines[i++]);
    }
    // Line breaks are preserved rather than collapsed: in these files every
    // line is a distinct point, and nothing is hard-wrapped prose.
    if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`);
  }

  // A section usually ends on the `---` that precedes the next heading; that
  // rule belongs to the split, not to the content.
  while (out.length && out[out.length - 1] === '<hr>') out.pop();

  return out.join('\n');
}

/* ------------------------------------------------------------------ */
/* section extraction                                                  */
/* ------------------------------------------------------------------ */

/**
 * Split a markdown file on `## ` headings into {title, body} sections.
 *
 * A `# ` h1 also closes the current section — objectives.md starts each domain
 * with one, and without this the last objective of a domain swallows the next
 * domain's banner.
 */
function splitSections(text) {
  const lines = text.split(/\r?\n/);
  const sections = [];
  let cur = null;
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.*)$/);
    const h1 = line.match(/^#\s+(.*)$/);
    if (h2) {
      if (cur) sections.push(cur);
      cur = { title: h2[1].trim(), lines: [] };
    } else if (h1) {
      if (cur) sections.push(cur);
      cur = null;
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  if (cur) sections.push(cur);
  return sections.map((s) => ({ title: s.title, body: s.lines.join('\n').trim() }));
}

/**
 * Which curriculum section teaches which objective. curriculum.md carries one
 * `## <code>` section per objective, so this is the identity map — but it is
 * kept explicit rather than assumed, so a cram sheet that merges two
 * objectives later can say so in one line instead of silently showing nothing.
 */
const CURRICULUM_FOR = {};

/**
 * deep-dives.md is long-form reference rather than a cram sheet, covering the
 * material Sec+ examines heavily but the objectives document only gestures at:
 * the port and protocol table, which algorithm is symmetric vs asymmetric vs a
 * hash, what each wireless and authentication protocol actually does, and what
 * each log source can and cannot prove.
 *
 * Each section hangs off the objective it serves rather than being folded into
 * the cram sheet, whose whole value is being short enough to read the night
 * before. A section is matched by the objective code in its own heading —
 * `## 4.5 — Ports and protocols` — so adding one needs no code change.
 */
function build() {
  const objText = fs.readFileSync(OBJECTIVES_FILE, 'utf8');
  const curText = fs.readFileSync(CURRICULUM_FILE, 'utf8');
  const deepText = fs.readFileSync(DEEP_DIVES_FILE, 'utf8');

  const deepDives = splitSections(deepText).map((s) => ({
    id: `deep-${s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    code: objectiveCode(s.title),
    title: s.title,
    html: markdown(s.body),
  }));

  // objectives.md: `## 2.6 Given a scenario, analyze ...`
  const objSections = new Map();
  for (const s of splitSections(objText)) {
    const code = objectiveCode(s.title);
    if (code) objSections.set(code, s);
  }

  // curriculum.md: `## 4.5 Given a scenario, …`, plus general sections.
  const curSections = new Map();
  const general = [];
  for (const s of splitSections(curText)) {
    const code = objectiveCode(s.title);
    if (code) curSections.set(code, s);
    else general.push(s);
  }

  const codes = [...new Set([...objSections.keys(), ...Object.keys(CURRICULUM_FOR)])]
    .filter((c) => /^\d\.\d$/.test(c))
    .sort();

  const topics = codes.map((code) => {
    const obj = objSections.get(code);
    const cur = curSections.get(CURRICULUM_FOR[code] ?? code);
    return {
      code,
      domain: domainOf(code),
      domainLabel: DOMAIN_LABELS[domainOf(code)] ?? '',
      title: obj ? obj.title : code,
      shortTitle: obj ? obj.title.replace(/^\d\.\d\s*/, '') : code,
      objectivesHtml: obj ? markdown(obj.body) : null,
      curriculumTitle: cur ? cur.title : null,
      curriculumHtml: cur ? markdown(cur.body) : null,
      curriculumShared: cur ? (CURRICULUM_FOR[code] ?? code) !== code : false,
      deepDive: deepDives.filter((d) => d.code === code)
        .map((d) => ({ id: d.id, title: d.title })),
      pairs: PAIRS.filter((p) => p.objective === code)
        .map((p) => ({ id: p.id, cue: p.cue, correct_term: p.correct_term,
          common_trap: p.common_trap, discriminator: p.discriminator })),
    };
  });

  return {
    topics,
    deepDives,
    // The cram sheet restates the rules as a compact list, but
    // scenario-rules.json is the authoritative source and renders as a proper
    // when/then table — so that section is dropped here to avoid two nav
    // entries for the same content.
    general: general
      .filter((s) => !/scenario rules/i.test(s.title))
      .map((s) => ({
      id: s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      title: s.title,
      html: markdown(s.body),
    })),
    rules: RULES,
  };
}

/**
 * Cross-cutting codes the bank uses (e.g. "3.x Business context") have no
 * objective section of their own, so they resolve to the domain's lead topic
 * rather than dead-ending a link from a miss.
 */
const X_ALIAS = { '1.x': '1.1', '2.x': '2.1', '3.x': '3.1', '4.x': '4.1', '5.x': '5.1' };

let cache = null;
export const learnIndex = () => (cache ??= build());

export function learnTopic(code) {
  const want = String(code ?? '').toLowerCase();
  const topics = learnIndex().topics;
  return topics.find((t) => t.code === want)
    ?? topics.find((t) => t.code === X_ALIAS[want])
    ?? null;
}
