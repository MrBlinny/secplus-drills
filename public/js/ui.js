// Shared DOM and formatting helpers.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

export const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); return node; };

/**
 * append() that drops null/undefined/false instead of stringifying them.
 * Node.append(null) renders the literal text "null", which is never wanted.
 */
export function add(node, ...kids) {
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false || kid === '') continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

/** One decimal, or an em dash when there is nothing to show. */
export const pct = (v, digits = 1) =>
  v === null || v === undefined || Number.isNaN(v) ? '—' : `${Number(v).toFixed(digits)}%`;

export const pctOf = (frac, digits = 1) =>
  frac === null || frac === undefined ? '—' : `${(frac * 100).toFixed(digits)}%`;

export function signed(v, digits = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const s = Number(v).toFixed(digits);
  return Number(v) > 0 ? `+${s}` : s;
}

export function timeAgo(ts) {
  const secs = Math.max(0, (Date.now() - Date.parse(ts)) / 1000);
  if (secs < 90) return 'just now';
  const mins = secs / 60;
  if (mins < 60) return `${Math.round(mins)}m ago`;
  const hrs = mins / 60;
  if (hrs < 24) return `${Math.round(hrs)}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function mmss(ms) {
  const t = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

let toastTimer;
export function toast(msg, ms = 1600) {
  let node = $('.toast');
  if (!node) { node = el('div', { class: 'toast' }); document.body.append(node); }
  node.textContent = msg;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), ms);
}

/** Shared top bar, so every page navigates the same way. */
export function mountBar(current, right = '') {
  const links = [
    ['/', 'Dashboard'],
    ['/learn.html', 'Learn'],
    ['/lists.html', 'Lists'],
    ['/blank.html', 'Blank paper'],
    ['/drill.html', 'Drill'],
    ['/pairs.html', 'Pairs'],
    ['/cram.html', 'Cram'],
    ['/weak.html', 'Weak areas'],
    ['/pbq.html', 'PBQ'],
    ['/exam.html', 'Exam sim'],
  ];
  const bar = el('header', { class: 'bar' },
    el('div', { class: 'brand' }, el('a', { href: '/', text: 'Security+ Tutor' })),
    el('nav', {}, links.map(([href, label]) =>
      el('a', { href, ...(href === current ? { 'aria-current': 'page' } : {}), text: label }))),
    el('div', { class: 'spacer' }),
    el('div', { class: 'meta', id: 'barmeta', html: right }),
  );
  document.body.prepend(bar);
  return bar;
}

export const setBarMeta = (html) => { const n = $('#barmeta'); if (n) n.innerHTML = html; };

/** True when a text field has focus, so page hotkeys can stand down. */
export const typing = () => {
  const a = document.activeElement;
  return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
};

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
