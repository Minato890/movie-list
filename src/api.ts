export const API = 'https://moviesuggestion.milkyway4a.workers.dev';
export const KINDS = ['Movie', 'Series', 'Anime', 'Music', 'Book'] as const;
export type Kind = (typeof KINDS)[number];
export type Suggestion = { id: string; title: string; by: string; kind: Kind; comment: string; date: string };

export async function getSuggestions(): Promise<Suggestion[]> {
  const r = await fetch(`${API}/suggestions`);
  if (!r.ok) throw new Error('load failed');
  return (await r.json()).items;
}

export async function postSuggestion(b: { kind: Kind; title: string; name: string; comment: string }): Promise<Suggestion> {
  const r = await fetch(`${API}/suggestions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Something went wrong');
  return j.item;
}
