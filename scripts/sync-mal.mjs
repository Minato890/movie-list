import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const USER = process.env.MAL_USERNAME || 'dr_jupiter';
const CLIENT_ID = process.env.MAL_CLIENT_ID;
const STATUS = { watching: 'Watching', completed: 'Completed', on_hold: 'On hold', dropped: 'Dropped', plan_to_watch: 'Plan to watch' };
const ORDER = ['Watching', 'Completed', 'On hold', 'Dropped', 'Plan to watch'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fail(msg) { console.error(`\nMAL sync failed:\n${msg}\n`); process.exit(1); }
if (!CLIENT_ID) fail('MAL_CLIENT_ID is missing. Add it under Settings > Secrets and variables > Actions.');

async function get(url) {
  for (let i = 1; i <= 4; i++) {
    try {
      const res = await fetch(url, { headers: { 'X-MAL-CLIENT-ID': CLIENT_ID } });
      if (res.ok) return await res.json();
      if ((res.status === 429 || res.status >= 500) && i < 4) { await sleep(2500 * i); continue; }
      const hint = res.status === 404 ? `\nHint: no MAL user "${USER}", or the list is private.`
        : [401, 403].includes(res.status) ? '\nHint: check MAL_CLIENT_ID, and that the anime list is public.' : '';
      fail(`MAL returned ${res.status}: ${await res.text()}${hint}`);
    } catch (e) {
      if (i === 4) fail(`Network error: ${e.cause?.code ?? e.message}`);
      await sleep(2500 * i);
    }
  }
}

const raw = [];
let url = `https://api.myanimelist.net/v2/users/${encodeURIComponent(USER)}/animelist?fields=list_status,num_episodes&limit=1000&nsfw=true`;
while (url) {
  const d = await get(url);
  if (!Array.isArray(d.data)) fail(`Unexpected response shape: ${JSON.stringify(d).slice(0, 300)}`);
  raw.push(...d.data);
  url = d.paging?.next;
}

const errors = [];
const entries = raw.map((e) => {
  const n = e.node ?? {};
  const ls = e.list_status ?? {};
  const status = STATUS[ls.status];
  if (!n.id || !n.title || !status) { errors.push(`Unrecognised entry: ${JSON.stringify(e).slice(0, 200)}`); return null; }
  return {
    id: n.id, title: n.title, url: `https://myanimelist.net/anime/${n.id}`,
    image: n.main_picture?.large ?? n.main_picture?.medium ?? null,
    status, score: ls.score > 0 ? ls.score : null,
    episodes: ls.num_episodes_watched ?? 0, total: n.num_episodes > 0 ? n.num_episodes : null,
  };
}).filter(Boolean);
if (errors.length) fail(errors.slice(0, 5).join('\n'));

entries.sort((x, y) => ORDER.indexOf(x.status) - ORDER.indexOf(y.status) || x.title.localeCompare(y.title));

// Safety net: never replace good data with an empty or suddenly much smaller result.
const prev = existsSync('data/anime.json') ? JSON.parse(readFileSync('data/anime.json', 'utf8')).entries.length : 0;
if (!process.env.ALLOW_SHRINK && prev >= 10 && entries.length < prev * 0.5) {
  fail(`Got ${entries.length} items but the saved data has ${prev}. Keeping the saved data. If this is intentional, re-run the workflow with "allow_shrink" ticked.`);
}
mkdirSync('data', { recursive: true });
writeFileSync('data/anime.json', JSON.stringify({ user: USER, entries }, null, 2) + '\n');
console.log(`Wrote data/anime.json: ${entries.length} anime for ${USER}.`);