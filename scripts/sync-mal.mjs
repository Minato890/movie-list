// Downloads the public MyAnimeList anime list via Jikan (unofficial MAL API) into data/anime.json.
// Separate from the Notion library. No API key needed. The list must be public.
import { mkdirSync, writeFileSync } from 'node:fs';

const USER = process.env.MAL_USERNAME || 'dr_jupiter';
const BASE = 'https://api.jikan.moe/v4';
const STATUS = { 1: 'Watching', 2: 'Completed', 3: 'On hold', 4: 'Dropped', 6: 'Plan to watch',
  watching: 'Watching', completed: 'Completed', onhold: 'On hold', on_hold: 'On hold', dropped: 'Dropped',
  plantowatch: 'Plan to watch', plan_to_watch: 'Plan to watch' };
const ORDER = ['Watching', 'Completed', 'On hold', 'Dropped', 'Plan to watch'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fail(msg) { console.error(`\nMAL sync failed:\n${msg}\n`); process.exit(1); }

async function get(url) {
  for (let i = 1; i <= 4; i++) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.ok) return res.json();
    if ([429, 500, 502, 503, 504].includes(res.status) && i < 4) { await sleep(2500 * i); continue; }
    const hint = res.status === 404 ? `\nHint: no MAL user "${USER}".`
      : [400, 403].includes(res.status) ? '\nHint: is the anime list set to public in MAL privacy settings?' : '';
    fail(`Jikan returned ${res.status}: ${await res.text()}${hint}`);
  }
}

const raw = [];
for (let page = 1; ; page++) {
  const d = await get(`${BASE}/users/${encodeURIComponent(USER)}/animelist?page=${page}`);
  if (!Array.isArray(d.data)) fail(`Unexpected response shape: ${JSON.stringify(d).slice(0, 300)}`);
  raw.push(...d.data);
  if (!d.pagination?.has_next_page) break;
  await sleep(1200); // Jikan allows ~3 requests/second
}

const errors = [];
const entries = raw.map((e) => {
  const a = e.anime ?? e.entry ?? e.node ?? e;
  const list = e.list_status ?? e;
  const id = a.mal_id ?? a.id;
  const status = STATUS[list.watching_status] ?? STATUS[list.status] ?? STATUS[e.watching_status] ?? STATUS[e.status];
  if (!id || !a.title || !status) { errors.push(`Unrecognised entry, keys: ${Object.keys(e).join(', ')}`); return null; }
  return {
    id, title: a.title, url: a.url ?? `https://myanimelist.net/anime/${id}`,
    image: a.images?.jpg?.image_url ?? a.images?.webp?.image_url ?? a.main_picture?.medium ?? null,
    status, score: list.score > 0 ? list.score : null,
    episodes: list.episodes_watched ?? list.num_episodes_watched ?? 0, total: a.episodes ?? null,
  };
}).filter(Boolean);
if (errors.length) fail(errors.slice(0, 5).join('\n'));

entries.sort((x, y) => ORDER.indexOf(x.status) - ORDER.indexOf(y.status) || x.title.localeCompare(y.title));
mkdirSync('data', { recursive: true });
writeFileSync('data/anime.json', JSON.stringify({ user: USER, entries }, null, 2) + '\n');
console.log(`Wrote data/anime.json: ${entries.length} anime for ${USER}.`);
