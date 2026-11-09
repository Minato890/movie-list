// Reads the "Cinema Library" database from Notion and writes data/movies.json.
// Also looks up posters on TMDB (optional). Runs in GitHub Actions (see .github/workflows/sync-notion.yml).
// Needs NOTION_TOKEN. TMDB_TOKEN is optional; without it posters are skipped.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const TOKEN = process.env.NOTION_TOKEN;
const TMDB_TOKEN = process.env.TMDB_TOKEN;
const SOURCE = process.env.NOTION_DATA_SOURCE_ID || '1787f6c2-c9c1-42b5-9d22-0ae66c5f4f83';
const KINDS = ['Film', 'Series', 'Anime', 'Doc'];
const STATUSES = ['Watched', 'Watching', 'Up next', 'Dropped'];
// Order of the Collections buttons. Use the exact tag names from Notion; any tag not listed goes last, A to Z.
const LIST_ORDER = ['Documentaries', 'Bollywood', 'Neo-Noir', 'Anime', 'Feel-Good', 'TV Series',
  'Classics', 'Sitcoms', 'Biopics', 'Comfort Films', 'On Love', 'Inspirational'];

function fail(msg) { console.error(`\nSync failed:\n${msg}\n`); process.exit(1); }
if (!TOKEN) fail('NOTION_TOKEN is missing. Add it under Settings > Secrets and variables > Actions.');

async function fetchAll() {
  const rows = [];
  let cursor;
  do {
    const res = await fetch(`https://api.notion.com/v1/data_sources/${SOURCE}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Notion-Version': '2025-09-03', 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_size: 100, ...(cursor && { start_cursor: cursor }) }),
    });
    if (!res.ok) {
      const hint = res.status === 404 || res.status === 403
        ? '\nHint: open the Cinema Library database in Notion > ... > Connections and make sure your connection is added.' : '';
      fail(`Notion returned ${res.status}: ${await res.text()}${hint}`);
    }
    const data = await res.json();
    rows.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return rows;
}

const text = (p) => (p?.rich_text ?? p?.title ?? []).map((t) => t.plain_text).join('').trim();

function parse(page) {
  const p = page.properties;
  return {
    title: text(p.Title),
    year: p.Year?.number ?? null,
    kind: p.Kind?.select?.name ?? null,
    status: p.Status?.select?.name ?? null,
    rating: p.Rating?.number ?? null,
    note: text(p.Note) || null,
    lists: (p.Lists?.multi_select ?? []).map((o) => o.name),
    rank: p.Rank?.number ?? null,
    listRank: p['List Rank']?.number ?? null,
    tmdbId: p['TMDB ID']?.number ?? null, // optional: type a TMDB id here to force the right poster
  };
}

function validate(items) {
  const errors = [];
  const seen = new Set();
  const ranks = new Map();
  for (const t of items) {
    const who = `"${t.title}"${t.year ? ` (${t.year})` : ''}`;
    if (!KINDS.includes(t.kind)) errors.push(`${who}: Kind is missing or unknown (${t.kind})`);
    if (!STATUSES.includes(t.status)) errors.push(`${who}: Status is missing or unknown (${t.status})`);
    if (t.rating !== null && (t.rating < 1 || t.rating > 5)) errors.push(`${who}: Rating must be 1 to 5`);
    if (t.lists.includes('Top 10')) {
      if (t.rank === null) errors.push(`${who}: is in Top 10 but has no Rank`);
      else if (!Number.isInteger(t.rank) || t.rank < 1 || t.rank > 10) errors.push(`${who}: Rank ${t.rank} must be a whole number from 1 to 10`);
      else if (ranks.has(t.rank)) errors.push(`${who}: Rank ${t.rank} is already used by ${ranks.get(t.rank)}`);
      else ranks.set(t.rank, who);
    }
    const key = `${t.title.toLowerCase()}|${t.year ?? ''}`;
    if (seen.has(key)) errors.push(`${who}: duplicate title and year`);
    seen.add(key);
  }
  return errors;
}

// ---------- Posters (TMDB) ----------
const keyOf = (t) => `${t.title.toLowerCase()}|${t.year ?? ''}`;
const typesFor = (kind) => (kind === 'Series' || kind === 'Anime' ? ['tv', 'movie'] : ['movie', 'tv']);

async function tmdb(path, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TMDB_TOKEN}`, accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`TMDB returned ${res.status}`);
  return res.json();
}

async function findPoster(t) {
  const order = typesFor(t.kind);
  if (t.tmdbId) {
    for (const type of order) {
      const d = await tmdb(`/${type}/${t.tmdbId}`);
      if (d?.poster_path) return d.poster_path;
    }
    return null;
  }
  // First try with the year (precise), then without it (forgiving of a wrong year).
  for (const withYear of t.year ? [true, false] : [false]) {
    for (const type of order) {
      const params = { query: t.title, include_adult: 'false' };
      if (withYear) params[type === 'tv' ? 'first_air_date_year' : 'year'] = String(t.year);
      const data = await tmdb(`/search/${type}`, params);
      const hit = data?.results?.find((r) => r.poster_path);
      if (hit) return hit.poster_path;
    }
  }
  return null;
}

async function addPosters(items) {
  let previous = new Map();
  try {
    const old = JSON.parse(readFileSync('data/movies.json', 'utf8'));
    previous = new Map((old.titles ?? []).map((t) => [keyOf(t), t]));
  } catch { /* first run */ }

  // Reuse posters we already found, unless the TMDB ID in Notion changed.
  for (const t of items) {
    const old = previous.get(keyOf(t));
    t.poster = old?.poster && (old.tmdbId ?? null) === t.tmdbId ? old.poster : null;
  }
  if (!TMDB_TOKEN) { console.warn('TMDB_TOKEN is missing: skipping poster lookup.'); return; }

  const todo = items.filter((t) => !t.poster);
  let problem = false;
  for (let i = 0; i < todo.length && !problem; i += 8) {
    await Promise.all(todo.slice(i, i + 8).map(async (t) => {
      try { t.poster = await findPoster(t); }
      catch (e) { if (!problem) { problem = true; console.warn(`Poster lookup stopped: ${e.message}. Check TMDB_TOKEN.`); } }
    }));
  }
  if (problem) return;
  const none = items.filter((t) => !t.poster);
  if (none.length) {
    console.warn(`\nNo poster found for ${none.length} title(s). Fix the spelling/year in Notion, or add a TMDB ID:`);
    none.forEach((t) => console.warn(`  - ${t.title}${t.year ? ` (${t.year})` : ''} [${t.kind}]`));
  }
}

// ---------- Build ----------
const byNum = (a, b) => (a ?? 1e9) - (b ?? 1e9);
const byTitle = (a, b) => a.title.localeCompare(b.title);

const rows = await fetchAll();
const items = rows.map(parse).filter((t) => {
  if (!t.title) { console.warn('Skipping a row with no title'); return false; }
  return true;
});

const errors = validate(items);
if (errors.length) fail(errors.map((e) => `  - ${e}`).join('\n') + '\n\nFix these in Notion; the site keeps its last good data.');

await addPosters(items);

const listNames = [...new Set(items.flatMap((t) => t.lists).filter((n) => n !== 'Top 10'))]
  .sort((a, b) => {
    const ia = LIST_ORDER.indexOf(a), ib = LIST_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });

const out = {
  top: items.filter((t) => t.lists.includes('Top 10')).sort((a, b) => byNum(a.rank, b.rank) || byTitle(a, b)),
  lists: listNames.map((name) => ({
    name,
    items: items.filter((t) => t.lists.includes(name)).sort((a, b) => byNum(a.listRank, b.listRank) || byTitle(a, b)),
  })),
  titles: [...items].sort(byTitle),
};

if (out.top.length !== 10) console.warn(`Note: Top 10 has ${out.top.length} titles.`);
mkdirSync('data', { recursive: true });
writeFileSync('data/movies.json', JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote data/movies.json: ${items.length} titles, ${out.top.length} in Top 10, ${out.lists.length} lists, ${items.filter((t) => t.poster).length} posters.`);
