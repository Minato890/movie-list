// Cloudflare Worker: saves friend suggestions to Notion and serves the public list.
// Secret needed: NOTION_TOKEN (the "Cinema Suggestions" integration, which can only touch the Suggestions database).
const DS = '41995c47-255a-8137-9d47-000b2c145fac'; // Suggestions data source
const ORIGINS = ['https://minato890.github.io', 'http://localhost:5173'];
const KINDS = ['Movie', 'Series', 'Anime', 'Music', 'Book'];
const NOTION = 'https://api.notion.com/v1';
const HEADERS = (env) => ({ Authorization: `Bearer ${env.NOTION_TOKEN}`, 'Notion-Version': '2025-09-03', 'Content-Type': 'application/json' });

let cache = { at: 0, items: null };   // best-effort 30s cache, per Worker instance
const hits = new Map();                // best-effort rate limit, per Worker instance

const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const text = (p) => (p?.rich_text ?? p?.title ?? []).map((x) => x.plain_text).join('');
const toItem = (pg) => ({
  id: pg.id, title: text(pg.properties.Title), by: text(pg.properties['Recommended by']),
  kind: pg.properties.Kind?.select?.name ?? 'Movie', comment: text(pg.properties.Comment), date: pg.created_time,
});

async function list(env) {
  if (cache.items && Date.now() - cache.at < 30000) return cache.items;
  const res = await fetch(`${NOTION}/data_sources/${DS}/query`, {
    method: 'POST', headers: HEADERS(env),
    body: JSON.stringify({ page_size: 100, filter: { property: 'Hidden', checkbox: { equals: false } },
      sorts: [{ timestamp: 'created_time', direction: 'descending' }] }),
  });
  if (!res.ok) throw new Error(`Notion ${res.status}`);
  cache = { at: Date.now(), items: (await res.json()).results.map(toItem) };
  return cache.items;
}

async function create(req, env, json) {
  const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 600000);
  if (recent.length >= 5) return json({ error: 'Too many suggestions. Try again in a few minutes.' }, 429);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const kind = String(body.kind);
  const title = clean(body.title, 100), name = clean(body.name, 40), comment = clean(body.comment, 280);
  if (!KINDS.includes(kind)) return json({ error: 'Pick what you are suggesting.' }, 400);
  if (!title) return json({ error: 'Please add a title.' }, 400);
  if (!name) return json({ error: 'Please add your name.' }, 400);
  if (/https?:\/\/|www\./i.test(`${title} ${name} ${comment}`)) return json({ error: 'Links are not allowed.' }, 400);

  const properties = {
    Title: { title: [{ text: { content: title } }] },
    'Recommended by': { rich_text: [{ text: { content: name } }] },
    Kind: { select: { name: kind } },
    ...(comment && { Comment: { rich_text: [{ text: { content: comment } }] } }),
  };
  const res = await fetch(`${NOTION}/pages`, {
    method: 'POST', headers: HEADERS(env),
    body: JSON.stringify({ parent: { type: 'data_source_id', data_source_id: DS }, properties }),
  });
  if (!res.ok) return json({ error: 'Could not save right now. Try again later.' }, 502);
  hits.set(ip, [...recent, now]);
  cache.at = 0;
  return json({ item: toItem(await res.json()) }, 201);
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = ORIGINS.includes(origin);
    const cors = { 'Access-Control-Allow-Origin': allowed ? origin : ORIGINS[0], 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' };
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (new URL(req.url).pathname !== '/suggestions') return json({ error: 'Not found' }, 404);
    try {
      if (req.method === 'GET') return json({ items: await list(env) });
      if (req.method === 'POST') return allowed ? await create(req, env, json) : json({ error: 'Not allowed' }, 403);
      return json({ error: 'Method not allowed' }, 405);
    } catch { return json({ error: 'Server error' }, 500); }
  },
};
