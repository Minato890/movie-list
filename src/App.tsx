import { useEffect, useMemo, useState } from 'react';
import Suggestions from './Suggestions';
import raw from '../data/movies.json';
import animeRaw from '../data/anime.json';
import type { AnimeEntry, Data, Title } from './types';

const D = raw as Data;
const A = (animeRaw as { entries: AnimeEntry[] }).entries;
const ASTATUS = ['Watching', 'Completed', 'On hold', 'Dropped', 'Plan to watch'];
// Add more quotes here; one is picked at random per visit.
const QUOTES = [{ text: 'A film is — or should be — more like music than like fiction.', by: 'Stanley Kubrick' }];
const STATUSES = ['Watched', 'Watching', 'Up next', 'Dropped'];
const KINDS = ['All', 'Film', 'Series', 'Anime', 'Doc'];

const match = (t: Title, s: string) => `${t.title} ${t.year ?? ''} ${t.kind} ${t.lists.join(' ')}`.toLowerCase().includes(s);

function Ticket({ t, n }: { t: Title; n?: number }) {
  return (
    <li className="ticket">
      {n !== undefined && <span className="no">{n}</span>}
      <div>
        <b>{t.title}</b>
        <small>{t.year} {t.kind}</small>
        {t.rating && <i aria-label={`${t.rating} of 5`}>{'★'.repeat(t.rating)}</i>}
        {t.note && <p>{t.note}</p>}
      </div>
    </li>
  );
}

export default function App() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Watched');
  const [kind, setKind] = useState('All');
  const [astat, setAstat] = useState('Watching');
  const [route, setRoute] = useState(window.location.hash);
  useEffect(() => {
    const f = () => { setRoute(window.location.hash); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  const onSug = route === '#suggestions';
  const quote = useMemo(() => QUOTES[Math.floor(Math.random() * QUOTES.length)], []);
  const s = q.trim().toLowerCase();

  const top = D.top.filter((t) => match(t, s));
  const lists = D.lists.map((l) => ({ ...l, items: l.items.filter((t) => match(t, s)) })).filter((l) => l.items.length);
  const library = D.titles.filter((t) => (s || t.status === status) && (kind === 'All' || t.kind === kind) && match(t, s));
  const anime = A.filter((a) => (s || a.status === astat) && a.title.toLowerCase().includes(s));
  const acount = (st: string) => A.filter((a) => a.status === st).length;
  const count = (st: string) => D.titles.filter((t) => t.status === st).length;

  return (
    <>
      <header className="hero">
        <div className="marquee"><h1>Cinema</h1></div>
        <blockquote>“{quote.text}”<cite>{quote.by}</cite></blockquote>
      </header>

      <div className="bar">
        <nav className="nav"><a href="#" aria-current={!onSug ? 'page' : undefined}>Library</a><a href="#suggestions" aria-current={onSug ? 'page' : undefined}>Suggestions</a></nav>
        {!onSug && <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a title, year, kind or list" aria-label="Search" />}
      </div>

      {onSug ? <Suggestions /> : (
      <main>
        {D.titles.length === 0 && <p className="empty">No data yet. Run “Sync from Notion” in the repo’s Actions tab.</p>}

        {top.length > 0 && (<section><h2>Top twelve</h2><ol className="grid">{top.map((t) => <Ticket key={t.title} t={t} n={t.rank ?? undefined} />)}</ol></section>)}

        {lists.map((l) => (
          <section key={l.name}><h2>{l.name}</h2><ul className="row">{l.items.map((t) => <Ticket key={t.title} t={t} />)}</ul></section>
        ))}

        <section>
          <h2>The library</h2>
          <div className="chips" role="group" aria-label="Filter">
            {STATUSES.map((st) => <button key={st} aria-pressed={!s && status === st} onClick={() => { setStatus(st); setQ(''); }}>{st} {count(st)}</button>)}
            <span className="gap" />
            {KINDS.map((k) => <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{k}</button>)}
          </div>
          <ul className="grid small">{library.map((t) => <Ticket key={t.title + t.year} t={t} />)}</ul>
          {D.titles.length > 0 && library.length === 0 && <p className="empty">Nothing matches that.</p>}
        </section>

        {A.length > 0 && (
          <section>
            <h2>My anime list</h2>
            <div className="chips" role="group" aria-label="Anime status">
              {ASTATUS.map((st) => <button key={st} aria-pressed={!s && astat === st} onClick={() => { setAstat(st); setQ(''); }}>{st} {acount(st)}</button>)}
            </div>
            <ul className="posters">
              {anime.map((a) => (
                <li key={a.id}>
                  <a href={a.url} target="_blank" rel="noreferrer">
                    {a.image ? <img src={a.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <div className="noimg" />}
                    <b>{a.title}</b>
                    <small>{a.score ? `★ ${a.score}/10 · ` : ''}{a.episodes}{a.total ? `/${a.total}` : ''} ep</small>
                  </a>
                </li>
              ))}
            </ul>
            {anime.length === 0 && <p className="empty">Nothing matches that.</p>}
          </section>
        )}
      </main>
      )}
      <footer>Add and edit titles in Notion. This page updates itself.</footer>
    </>
  );
}
