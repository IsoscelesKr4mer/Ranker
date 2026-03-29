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

export interface IGDBCharacter {
  id: number;
  name: string;
  mugShot: string | null;
  mugShotSmall: string | null;
  description: string | null;
  games: (string | number)[];
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

export async function getCharactersByGame(gameId: number): Promise<{ characters: IGDBCharacter[] }> {
  const res = await fetch('/api/igdb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'characters', gameId }),
  });

  if (!res.ok) {
    console.error('IGDB characters fetch failed:', res.status);
    return { characters: [] };
  }

  const data = await res.json();
  return { characters: data.results || [] };
}

export async function searchCharacters(query: string): Promise<{ characters: IGDBCharacter[] }> {
  const res = await fetch('/api/igdb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'search_characters', query }),
  });

  if (!res.ok) {
    console.error('IGDB character search failed:', res.status);
    return { characters: [] };
  }

  const data = await res.json();
  return { characters: data.results || [] };
}

export async function lookupGame(query: string): Promise<{ games: IGDBGame[] }> {
  const res = await fetch('/api/igdb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'game_lookup', query }),
  });

  if (!res.ok) {
    console.error('IGDB game lookup failed:', res.status);
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

export function igdbCharacterToRankItem(char: IGDBCharacter): RankItem {
  return {
    id: `igdb-char-${char.id}`,
    title: char.name,
    imageUrl: char.mugShot,
    subtitle: undefined,
    metadata: {
      igdbCharId: char.id,
      mediaType: 'character',
      description: char.description,
    },
  };
}
