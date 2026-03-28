import type { RankItem } from '@/types';

export type MusicSearchType = 'track' | 'album' | 'artist';

export interface DeezerResult {
  id: number;
  title: string;
  artist: string | null;
  imageUrl: string | null;
  year: string | null;
  type: MusicSearchType;
  duration?: number | null;
  albumTitle?: string | null;
  trackCount?: number | null;
  fanCount?: number | null;
}

export async function searchMusic(
  query: string,
  type: MusicSearchType = 'track'
): Promise<{ results: DeezerResult[] }> {
  const res = await fetch(`/api/deezer?q=${encodeURIComponent(query)}&type=${type}&limit=20`);

  if (!res.ok) {
    console.error('Deezer search failed:', res.status);
    return { results: [] };
  }

  const data = await res.json();
  return { results: data.results || [] };
}

export function deezerToRankItem(result: DeezerResult): RankItem {
  const subtitle = result.type === 'track'
    ? result.artist || undefined
    : result.type === 'album'
    ? result.artist || undefined
    : result.fanCount
    ? `${(result.fanCount / 1000).toFixed(0)}k fans`
    : undefined;

  return {
    id: `deezer-${result.type}-${result.id}`,
    title: result.title,
    imageUrl: result.imageUrl || undefined,
    subtitle,
    metadata: {
      deezerId: result.id,
      mediaType: result.type === 'track' ? 'song' : result.type,
      artist: result.artist,
      albumTitle: result.albumTitle,
      duration: result.duration,
    },
  };
}
