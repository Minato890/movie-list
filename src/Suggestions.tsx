import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { KINDS, getSuggestions, postSuggestion } from './api';
import type { Kind, Suggestion } from './api';

const LABEL: Record<Kind, string> = { Movie: 'Movie title', Series: 'Series title', Anime: 'Anime title', Music: 'Song or album', Book: 'Book title' };
const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function Suggestions() {
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [tab, setTab] = useState<'All' | Kind>('All');
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind | null>(null);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { getSuggestions().then(setItems).catch(() => setLoadErr(true)); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!kind) return;
    setBusy(true); setErr('');
    try {
      const item = await postSuggestion({ kind, title, name, comment });
      setItems((cur) => [item, ...(cur ?? [])]);
      setOpen(false); setKind(null); setTitle(''); setComment('');
    } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Something went wrong'); }
    setBusy(false);
  }

  const shown = (items ?? []).filter((s) => tab === 'All' || s.kind === tab);

  return (
    <main>
      <section>
        <h2>Suggestions</h2>
        <p className="lead">Something I should watch, listen to or read? Leave it here.</p>
        {!open && <button className="cta" onClick={() => setOpen(true)}>Suggest something</button>}
        {open && (
          <form className="sform" onSubmit={submit}>
            <p className="step">What are you suggesting?</p>
            <div className="chips" role="group" aria-label="Kind">
              {KINDS.map((k) => <button type="button" key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{k}</button>)}
            </div>
            {kind && (
              <>
                <label>{LABEL[kind]}<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required /></label>
                <label>Comment (optional)<textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={280} rows={3} /></label>
                <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required /></label>
                {err && <p className="ferr" role="alert">{err}</p>}
                <div className="actions">
                  <button type="submit" className="cta" disabled={busy}>{busy ? 'Sending…' : 'Send'}</button>
                  <button type="button" onClick={() => setOpen(false)}>Cancel</button>
                </div>
              </>
            )}
          </form>
        )}
        <div className="chips" role="group" aria-label="Filter suggestions" style={{ margin: '2rem 0 1rem' }}>
          {(['All', ...KINDS] as const).map((k) => <button type="button" key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{k}</button>)}
        </div>
        {items === null && !loadErr && <p className="empty">Loading…</p>}
        {loadErr && <p className="empty">Couldn’t load suggestions right now. Try again in a minute.</p>}
        {items && shown.length === 0 && <p className="empty">Nothing here yet. Be the first.</p>}
        <ul className="sgrid">
          {shown.map((s) => (
            <li key={s.id} className={`sg k-${s.kind.toLowerCase()}`}>
              <span className="tag">{s.kind}</span>
              <b>{s.title}</b>
              {s.comment && <p>“{s.comment}”</p>}
              <div className="meta"><span>from {s.by}</span><time className="stamp" dateTime={s.date}>{fmt(s.date)}</time></div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
