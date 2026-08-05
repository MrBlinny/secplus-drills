// Hand-rolled charts. No library, nothing from a CDN.
//
// Palette note: data marks use their own tokens, not the UI accent. --accent
// (#58a6ff) sits outside the dark lightness band for chart marks, so marks use
// the validated dark-surface steps below. Validated as a set against the panel
// surface #161b22: lightness band, chroma floor, CVD separation (worst all-pairs
// ΔE 9.4 deutan), normal-vision floor (20.9) and 3:1 contrast all pass.

import { el, clear, add, escapeHtml } from './ui.js';

export const SERIES = {
  A: '#3987e5',   // slot 1 blue   — wrong term
  B: '#d95926',   // slot 2 orange — wrong tier
  C: '#199e70',   // slot 3 aqua   — didn't know
};
export const MARK = '#3987e5';          // single-series magnitude
const INK_MUTED = '#898781';
const AXIS = '#383835';

const svgNS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}, ...kids) {
  const n = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    n.setAttribute(k, String(v));
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    n.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

/* ------------------------------------------------------------------ */
/* 1. Weighted projection: hero number + track with a baseline marker   */
/* ------------------------------------------------------------------ */

export function projectionTrack(host, { weighted, baseline }) {
  clear(host);
  const has = weighted !== null && weighted !== undefined;

  const track = el('div', {
    style: 'position:relative;height:14px;border-radius:7px;background:#1c232c;'
      + 'border:1px solid var(--line);overflow:hidden',
  });
  if (has) {
    track.append(el('div', {
      style: `position:absolute;inset:0 auto 0 0;width:${Math.max(0, Math.min(100, weighted))}%;`
        + `background:${MARK};border-radius:7px 0 0 7px`,
    }));
  }
  // Baseline reference: a neutral rule, never a series color. Drawn only when
  // a baseline exists — this cert has no cold pre-study sitting to draw one
  // from, and a marker at 0% would read as a real measurement.
  const hasBase = baseline !== null && baseline !== undefined;
  if (hasBase) {
    track.append(el('div', {
      title: `pre-study baseline ${baseline}%`,
      style: `position:absolute;top:-3px;bottom:-3px;left:${baseline}%;width:2px;`
        + 'background:#c9d1d9;box-shadow:0 0 0 2px #161b22',
    }));
  }

  const scale = el('div', {
    style: 'position:relative;height:16px;margin-top:5px;font:11px var(--mono);color:var(--dim)',
  },
    el('span', { style: 'position:absolute;left:0', text: '0%' }),
    ...(hasBase ? [el('span', {
      style: `position:absolute;left:${baseline}%;transform:translateX(-50%);white-space:nowrap;color:#c9d1d9`,
      text: `baseline ${baseline}%`,
    })] : []),
    el('span', { style: 'position:absolute;right:0', text: '100%' }),
  );

  add(host, track, scale);
  return host;
}

/* ------------------------------------------------------------------ */
/* 2. Per-domain bars — track WIDTH is blueprint weight                 */
/* ------------------------------------------------------------------ */

/**
 * Track width is proportional to the domain's exam weight and the fill is its
 * accuracy, so the filled area *is* that domain's contribution to the weighted
 * projection — and Domain 2 dominates the row stack on sight.
 */
export function domainBars(host, byDomain, { baseline = null } = {}) {
  clear(host);
  const rows = Object.values(byDomain);
  const maxW = Math.max(...rows.map((r) => r.weight));

  for (const r of rows) {
    const acc = r.accuracy === null ? null : r.accuracy * 100;
    const head = el('div', {
      style: 'display:flex;align-items:baseline;gap:10px;margin-bottom:5px;flex-wrap:wrap',
    },
      el('span', { style: 'font-size:14px', text: `${r.domain} ${r.label}` }),
      el('span', { class: 'tag', text: `${Math.round(r.weight * 100)}% of exam` }),
      el('span', { class: 'spacer', style: 'flex:1' }),
      el('span', {
        style: 'font:600 15px var(--mono)'
          + (acc === null ? ';color:var(--dim)'
            : baseline !== null && acc < baseline ? ';color:var(--warn)' : ''),
        text: acc === null ? 'no data' : `${acc.toFixed(1)}%`,
      }),
      el('span', { class: 'dim', style: 'font:12px var(--mono)', text: `${r.correct}/${r.n}` }),
    );

    // A no-data track is dashed, so "nothing answered" never reads as "0%".
    const track = el('div', {
      title: acc === null
        ? `${r.domain} — no answers in scope`
        : `${r.domain} — ${r.correct}/${r.n} correct`,
      style: `width:${(r.weight / maxW) * 100}%;height:22px;border-radius:5px;`
        + 'background:#1c232c;overflow:hidden;'
        + (acc === null
          ? 'border:1px dashed #3a434f;opacity:.55'
          : 'border:1px solid var(--line)'),
    });
    if (acc !== null) {
      track.append(el('div', {
        style: `width:${acc}%;height:100%;background:${MARK}`,
      }));
    }

    host.append(el('div', { style: 'margin-bottom:16px' }, head, track));
  }
  return host;
}

/* ------------------------------------------------------------------ */
/* 3. Miss types over time — stacked bars, 3 categorical series         */
/* ------------------------------------------------------------------ */

const MISS_LABEL = { A: 'A · wrong term', B: 'B · wrong tier', C: "C · didn't know" };

export function missTypeChart(host, byDay, { total } = {}) {
  clear(host);
  const days = byDay.filter((d) => d.A + d.B + d.C + d.untagged > 0);

  if (!days.length) {
    host.append(el('p', { class: 'empty', text: 'No tagged misses yet.' }));
    return host;
  }

  const W = 640;
  const H = 190;
  const PAD = { t: 10, r: 10, b: 30, l: 30 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  const max = Math.max(...days.map((d) => d.A + d.B + d.C));
  const step = plotW / days.length;
  const bw = Math.min(46, step * 0.62);
  const y = (v) => PAD.t + plotH - (v / Math.max(1, max)) * plotH;

  const svg = s('svg', {
    viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid meet',
    role: 'img', 'aria-label': 'Miss types by day',
    style: 'display:block;width:100%;height:auto;overflow:visible',
  });

  // recessive gridlines + y ticks
  const ticks = max <= 4 ? max : 4;
  for (let i = 0; i <= ticks; i++) {
    const v = (max / ticks) * i;
    svg.append(
      s('line', { x1: PAD.l, x2: W - PAD.r, y1: y(v), y2: y(v), stroke: '#2c2c2a', 'stroke-width': 1 }),
      s('text', {
        x: PAD.l - 7, y: y(v) + 4, 'text-anchor': 'end',
        fill: INK_MUTED, 'font-size': 11, 'font-family': 'ui-monospace,monospace',
      }, String(Math.round(v))),
    );
  }
  svg.append(s('line', {
    x1: PAD.l, x2: W - PAD.r, y1: PAD.t + plotH, y2: PAD.t + plotH, stroke: AXIS, 'stroke-width': 1,
  }));

  days.forEach((d, i) => {
    const x = PAD.l + step * i + (step - bw) / 2;
    let acc = 0;
    for (const k of ['A', 'B', 'C']) {
      const v = d[k];
      if (!v) continue;
      const h = (v / Math.max(1, max)) * plotH;
      const top = y(acc + v);
      // 2px surface gap between stacked segments
      svg.append(s('rect', {
        x, y: top, width: bw, height: Math.max(1, h - 2), rx: 3, fill: SERIES[k],
      }, s('title', {}, `${d.day} — ${MISS_LABEL[k]}: ${v}`)));
      acc += v;
    }
    svg.append(s('text', {
      x: x + bw / 2, y: H - PAD.b + 16, 'text-anchor': 'middle',
      fill: INK_MUTED, 'font-size': 11, 'font-family': 'ui-monospace,monospace',
    }, d.day.slice(5)));
  });

  host.append(svg);
  return host;
}

/** Legend + running totals. Identity is never carried by color alone. */
export function missTypeLegend(host, total) {
  clear(host);
  for (const k of ['A', 'B', 'C']) {
    host.append(el('span', { style: 'display:inline-flex;align-items:center;gap:6px;margin-right:16px' },
      el('span', {
        style: `width:10px;height:10px;border-radius:2px;background:${SERIES[k]};display:inline-block`,
      }),
      el('span', { text: `${MISS_LABEL[k]} — ${total?.[k] ?? 0}` }),
    ));
  }
  if (total?.untagged) {
    host.append(el('span', { class: 'dim', text: `untagged — ${total.untagged}` }));
  }
  return host;
}
