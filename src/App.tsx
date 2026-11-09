import { useMemo, useState } from 'react';
import raw from '../data/movies.json';
import musicRaw from '../data/music.json';
import type { Data, Music, Pick, Title } from './types';
import { PLAYLISTS, SPOTIFY_PROFILE } from './config';

const D = raw as Data;
const M = musicRaw as Music;
// Add more quotes here; one is picked at random per visit.
const QUOTES = [{ text: 'A film is — or should be — more like music than like fiction.', by: 'Stanley Kubrick' }];
const STATUSES = ['Watched', 'Watching', 'Up next', 'Dropped'];
const KINDS = ['All', 'Film', 'Series', 'Anime', 'Doc'];
const TABS = [['top', 'Top 12'], ['collections', 'Collections'], ['library', 'Library'], ['music', 'Music']] as const;
type Tab = (typeof TABS)[number][0];
const POSTER = 'https://image.tmdb.org/t/p/w185';

const match = (t: Title, s: string) => `${t.title} ${t.year ?? ''} ${t.kind} ${t.lists.join(' ')}`.toLowerCase().includes(s);
const playlistId = (url: string) => url.match(/playlist\/([A-Za-z0-9]+)/)?.[1];

// Shows the poster; if it is missing or fails to load, nothing renders and the plain ticket remains.
function Poster({ path }: { path?: string | null }) {
  const [bad, setBad] = useState(false);
  if (!path || bad) return null;
  return <img className="poster" src={POSTER + path} alt="" loading="lazy" onError={() => setBad(true)} />;
}

function Ticket({ t, n }: { t: Title; n?: number }) {
  return (
    <li className="ticket">
      {n !== undefined && <span className="no">{n}</span>}
      <Poster path={t.poster} />
      <div>
        <b>{t.title}</b>
        <small>{t.year} {t.kind}</small>
        {t.rating && <i aria-label={`${t.rating} of 5`}>{'★'.repeat(Math.max(0, Math.floor(t.rating)))}</i>}
        {t.note && <p>{t.note}</p>}
      </div>
    </li>
  );
}

function PickCard({ p, n, round }: { p: Pick; n: number; round?: boolean }) {
  return (
    <li className="ticket">
      <span className="no sm">{n}</span>
      {p.image && <img className={round ? 'pic round' : 'pic'} src={p.image} alt="" loading="lazy" />}
      <div>
        <a href={p.url} target="_blank" rel="noreferrer noopener"><b>{p.name}</b></a>
        {p.sub && <small>{p.sub}</small>}
      </div>
    </li>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('top');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Watched');
  const [kind, setKind] = useState('All');
  const [pick, setPick] = useState('');
  const quote = useMemo(() => QUOTES[Math.floor(Math.random() * QUOTES.length)], []);
  const s = q.trim().toLowerCase();

  const top = D.top.filter((t) => match(t, s));
  const found = D.lists.map((l) => ({ ...l, items: l.items.filter((t) => match(t, s)) })).filter((l) => l.items.length);
  const active = D.lists.find((l) => l.name === pick) ?? D.lists[0];
  const library = D.titles.filter((t) => (s || t.status === status) && (kind === 'All' || t.kind === kind) && match(t, s));
  const count = (st: string) => D.titles.filter((t) => t.status === st).length;
  const embeds = PLAYLISTS.map(playlistId).filter((id): id is string => !!id);
  const nothing = <p className="empty">Nothing matches that.</p>;

  return (
    <>
      <header className="hero">
        <div className="marquee"><h1>Cinema</h1></div>
        <blockquote>“{quote.text}”<cite>{quote.by}</cite></blockquote>
      </header>

      <div className="bar">
        <nav className="tabs" aria-label="Sections">
          {TABS.map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}
        </nav>
        {tab !== 'music' && (
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a title, year, kind or list" aria-label="Search" />
        )}
      </div>

      <main>
        {D.titles.length === 0 && tab !== 'music' && <p className="empty">No data yet. Run “Sync from Notion” in the repo’s Actions tab.</p>}

        {tab === 'top' && (
          <section>
            <h2>Top twelve</h2>
            <ol className="grid">{top.map((t) => <Ticket key={t.title + t.year} t={t} n={t.rank ?? undefined} />)}</ol>
            {D.top.length > 0 && top.length === 0 && nothing}
          </section>
        )}

        {tab === 'collections' && (
          <section>
            {!s && active && (
              <>
                <div className="chips" role="group" aria-label="Collections">
                  {D.lists.map((l) => (
                    <button key={l.name} aria-pressed={active.name === l.name} onClick={() => setPick(l.name)}>{l.name} {l.items.length}</button>
                  ))}
                </div>
                <h2>{active.name}</h2>
                <ul className="grid">{active.items.map((t) => <Ticket key={t.title + t.year} t={t} />)}</ul>
              </>
            )}
            {s && found.map((l) => (
              <div key={l.name}><h2>{l.name}</h2><ul className="grid">{l.items.map((t) => <Ticket key={t.title + t.year} t={t} />)}</ul></div>
            ))}
            {s && found.length === 0 && nothing}
          </section>
        )}

        {tab === 'library' && (
          <section>
            <h2>The library</h2>
            <div className="chips" role="group" aria-label="Filter">
              {STATUSES.map((st) => <button key={st} aria-pressed={!s && status === st} onClick={() => { setStatus(st); setQ(''); }}>{st} {count(st)}</button>)}
              <span className="gap" />
              {KINDS.map((k) => <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{k}</button>)}
            </div>
            <ul className="grid small">{library.map((t) => <Ticket key={t.title + t.year} t={t} />)}</ul>
            {D.titles.length > 0 && library.length === 0 && nothing}
          </section>
        )}

        {tab === 'music' && (
          <>
            {SPOTIFY_PROFILE && <a className="spotify" href={SPOTIFY_PROFILE} target="_blank" rel="noreferrer noopener">Open my Spotify profile</a>}

            {(M.artists.length > 0 || M.tracks.length > 0) && (
              <section>
                <h2>What I’ve been listening to</h2>
                <p className="sub">The last 4 weeks, straight from Spotify.</p>
                {M.artists.length > 0 && (<><h3>Top artists</h3><ol className="grid small">{M.artists.map((a, i) => <PickCard key={a.url} p={a} n={i + 1} round />)}</ol></>)}
                {M.tracks.length > 0 && (<><h3>Top tracks</h3><ol className="grid small">{M.tracks.map((t, i) => <PickCard key={t.url} p={t} n={i + 1} />)}</ol></>)}
              </section>
            )}

            {embeds.length > 0 && (
              <section>
                <h2>Playlists</h2>
                <div className="embeds">
                  {embeds.map((id) => (
                    <iframe key={id} title="Spotify playlist" src={`https://open.spotify.com/embed/playlist/${id}?utm_source=generator`}
                      loading="lazy" allow="encrypted-media; clipboard-write; fullscreen" />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
