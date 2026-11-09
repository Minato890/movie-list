export type Title = { title: string; year: number | null; kind: string; status: string; rating: number | null;
  note: string | null; lists: string[]; rank: number | null; listRank: number | null };
export type Data = { top: Title[]; lists: { name: string; items: Title[] }[]; titles: Title[] };
