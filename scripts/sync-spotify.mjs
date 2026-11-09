// Reads your top artists and tracks from the last ~4 weeks and writes data/music.json.
// Needs SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN. On any failure the old file is kept.
import { mkdirSync, writeFileSync } from 'node:fs';

const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret, SPOTIFY_REFRESH_TOKEN: refresh } = process.env;
if (!id || !secret || !refresh) { console.warn('Spotify secrets are missing: skipping music sync.'); process.exit(0); }

function fail(msg) { console.error(`\nSpotify sync failed:\n${msg}\nThe site keeps its last good music data.\n`); process.exit(1); }

const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
  method: 'POST',
  headers: { Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh }),
});
const tokenData = await tokenRes.json().catch(() => ({}));
if (!tokenRes.ok || !tokenData.access_token) {
  fail(`Could not get an access token (${tokenRes.status} ${tokenData.error ?? ''}). If this persists, run the token script again and update SPOTIFY_REFRESH_TOKEN.`);
}

async function top(kind) {
  // short_term is roughly the last 4 weeks
  const res = await fetch(`https://api.spotify.com/v1/me/top/${kind}?time_range=short_term&limit=10`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!res.ok) fail(`Spotify returned ${res.status} for top ${kind}: ${await res.text()}`);
  return (await res.json()).items ?? [];
}

const img = (images) => (images?.[1] ?? images?.[0])?.url ?? null; // ~300px version if available

const artists = (await top('artists')).map((a) => ({ name: a.name, image: img(a.images), url: a.external_urls?.spotify }));
const tracks = (await top('tracks')).map((t) => ({
  name: t.name, sub: (t.artists ?? []).map((a) => a.name).join(', '), image: img(t.album?.images), url: t.external_urls?.spotify,
}));

mkdirSync('data', { recursive: true });
writeFileSync('data/music.json', JSON.stringify({ artists, tracks }, null, 2) + '\n');
console.log(`Wrote data/music.json: ${artists.length} artists, ${tracks.length} tracks.`);
