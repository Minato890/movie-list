# movie-list
Notion (Cinema Library) + Spotify → GitHub Action syncs `data/movies.json` and `data/music.json` → Vite + React site → GitHub Pages.
- Edit movies in Notion only. The site updates within ~30 min (or run "Sync from Notion" in Actions).
- Posters come from TMDB. If one is wrong or missing, put the right id in the optional `TMDB ID` column in Notion.
- Music tab: profile link and playlists live in `src/config.ts`. Top artists/tracks sync from Spotify (last ~4 weeks).
- Collections order: `LIST_ORDER` in `scripts/sync-notion.mjs`. Quotes: `QUOTES` in `src/App.tsx`. Hero image: `public/hero.jpg`.
- Secrets: NOTION_TOKEN, TMDB_TOKEN, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN.
- Local: `npm install && npm run dev`. Pages needs Settings → Pages → Source: GitHub Actions.

## To do
- [ ] Rename the `Lists` tags in Notion (e.g. "Top 5 Bollywood"), then update `LIST_ORDER` in `scripts/sync-notion.mjs` to the new names, in the order you want the Collections buttons.
- [ ] Decide where the TMDB credit line goes (posters come from TMDB) once you've seen the site.
- [ ] Fix the Top 10 ranks in Notion (the sync will tell you which titles clash).
