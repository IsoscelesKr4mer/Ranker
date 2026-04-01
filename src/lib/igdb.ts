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

export async function searchGames(query: string, offset = 0): Promise<{ games: IGDBGame[]; hasMore: boolean }> {
  const res = await fetch('/api/igdb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'search', query, offset }),
  });

  if (!res.ok) {
    console.error('IGDB search failed:', res.status);
    return { games: [], hasMore: false };
  }

  const data = await res.json();
  const games = data.results || [];
  return { games, hasMore: games.length === 20 };
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
