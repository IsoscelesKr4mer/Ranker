import type { RankItem } from '@/types';

export interface IGDBGame {
  id: number;
  name: string;
  cover: string | null;
  coverSmall: string | null;
  releaseDate: number | null;
  platforms: string[];
  summary: string | null;
  rating: number | null;
  genres: string[];
}

export async function searchGames(query: string): Promise<{ games: IGDBGame[] }> {
  const res = await fetch('/api/igdb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'search', query }),
  });

  if (!res.ok) {
    console.error('IGDB search failed:', res.status);
    return { games: [] };
  }

  const data = await res.json();
  return { games: data.results || [] };
}

export function igdbToRankItem(game: IGDBGame): RankItem {
  return {
    id: `igdb-${game.id}`,
    title: game.name,
    imageUrl: game.cover,
    subtitle: game.releaseDate ? String(game.releaseDate) : undefined,
    metadata: {
      igdbId: game.id,
      mediaType: 'game',
      summary: game.summary,
      rating: game.rating,
      platforms: game.platforms,
      genres: game.genres,
    },
  };
}
