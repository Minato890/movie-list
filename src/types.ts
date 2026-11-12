export type Title = { title: string; year: number | null; kind: string; status: string; rating: number | null;
  note: string | null; lists: string[]; rank: number | null; listRank: number | null;
  tmdbId?: number | null; poster?: string | null };
export type Data = { top: Title[]; lists: { name: string; items: Title[] }[]; titles: Title[] };
export type Pick = { name: string; sub?: string; image: string | null; url: string };
export type Music = { artists: Pick[]; tracks: Pick[] };
export type AnimeEntry = {
  id: number;
  title: string;
  url: string;
  image: string | null;
  status: string;
  score: number | null;
  episodes: number;
  total: number | null;
};
