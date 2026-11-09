// Reads the "Cinema Library" database from Notion and writes data/movies.json.
// Runs in GitHub Actions (see .github/workflows/sync-notion.yml). Needs NOTION_TOKEN.
import { mkdirSync, writeFileSync } from 'node:fs';

const TOKEN = process.env.NOTION_TOKEN;
const SOURCE = process.env.NOTION_DATA_SOURCE_ID || '1787f6c2-c9c1-42b5-9d22-0ae66c5f4f83';
const KINDS = ['Film', 'Series', 'Anime', 'Doc'];
const STATUSES = ['Watched', 'Watching', 'Up next', 'Dropped'];
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
  };
}

function validate(items) {
  const errors = [];
  const seen = new Set();
  for (const t of items) {
    const who = `"${t.title}"${t.year ? ` (${t.year})` : ''}`;
    if (!KINDS.includes(t.kind)) errors.push(`${who}: Kind is missing or unknown (${t.kind})`);
    if (!STATUSES.includes(t.status)) errors.push(`${who}: Status is missing or unknown (${t.status})`);
    if (t.rating !== null && (t.rating < 1 || t.rating > 5)) errors.push(`${who}: Rating must be 1 to 5`);
    if (t.lists.includes('Top 10') && t.rank === null) errors.push(`${who}: is in Top 10 but has no Rank`);
    const key = `${t.title.toLowerCase()}|${t.year ?? ''}`;
    if (seen.has(key)) errors.push(`${who}: duplicate title and year`);
    seen.add(key);
  }
  return errors;
}

const byNum = (a, b) => (a ?? 1e9) - (b ?? 1e9);
const byTitle = (a, b) => a.title.localeCompare(b.title);

const rows = await fetchAll();
const items = rows.map(parse).filter((t) => {
  if (!t.title) { console.warn('Skipping a row with no title'); return false; }
  return true;
});

const errors = validate(items);
if (errors.length) fail(errors.map((e) => `  - ${e}`).join('\n') + '\n\nFix these in Notion; the site keeps its last good data.');

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

mkdirSync('data', { recursive: true });
writeFileSync('data/movies.json', JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote data/movies.json: ${items.length} titles, ${out.top.length} in Top 10, ${out.lists.length} lists.`);
