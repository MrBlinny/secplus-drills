// Thin fetch wrapper. Everything is same-origin and offline-safe.

async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `${method} ${url} failed (${res.status})`);
  return data;
}

export const get = (url) => req('GET', url);
export const post = (url, body) => req('POST', url, body);

export const api = {
  bootstrap: () => get('/api/bootstrap'),
  drill: (q = '') => get(`/api/drill${q}`),
  coverage: (limit = 60) => get(`/api/coverage?limit=${limit}`),
  weak: (limit = 20) => get(`/api/weak?limit=${limit}`),
  exam: (count = 60) => get(`/api/exam?count=${count}`),
  examSubmit: (body) => post('/api/exam-submit', body),
  answer: (body) => post('/api/answer', body),
  tag: (body) => post('/api/tag', body),
  pairs: (q = '') => get(`/api/pairs${q}`),
  pairAnswer: (body) => post('/api/pair-answer', body),
  taxonomies: () => get('/api/taxonomies'),
  lists: () => get('/api/lists'),
  blank: (body) => post('/api/blank', body),
  dashboard: (includeBaseline = false) =>
    get(`/api/dashboard${includeBaseline ? '?includeBaseline=1' : ''}`),
  pbqList: () => get('/api/pbq'),
  pbq: (id) => get(`/api/pbq/${encodeURIComponent(id)}`),
  pbqAnswer: (body) => post('/api/pbq-answer', body),
  due: () => get('/api/due'),
};
