import type { RankItem } from '@/types';

const PROXY_URL = import.meta.env.VITE_LETTERBOXD_PROXY_URL || '/api/letterboxd';

export function parseLetterboxdUrl(url: string): { username?: string; listSlug?: string; type: 'list' | 'watchlist' | 'films' | 'unknown' } {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('letterboxd.com')) {
      return { type: 'unknown' };
    }

    const parts = parsed.pathname.split('/').filter(Boolean);

    if (parts.length >= 2 && parts[1] === 'list') {
      return { username: parts[0], listSlug: parts[2], type: 'list' };
    }
    if (parts.length >= 2 && parts[1] === 'watchlist') {
      return { username: parts[0], type: 'watchlist' };
    }
    if (parts.length >= 2 && parts[1] === 'films') {
      return { username: parts[0], type: 'films' };
    }

    return { type: 'unknown' };
  } catch {
    return { type: 'unknown' };
  }
}

export async function importLetterboxdList(url: string): Promise<RankItem[]> {
  const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errData.error || `Failed to fetch: ${res.status}`);
  }

  const data = await res.json();

  if (!data.films || data.films.length === 0) {
    return [];
  }

  return data.films.map((film: { slug: string; title: string; posterUrl: string | null; year: string | null }, index: number) => ({
    id: `lb-${film.slug || index}`,
    title: film.title,
    imageUrl: film.posterUrl,
    subtitle: film.year || undefined,
    metadata: { letterboxdSlug: film.slug, source: 'letterboxd' },
  }));
}

export function isValidLetterboxdUrl(url: string): boolean {
  const parsed = parseLetterboxdUrl(url);
  return parsed.type !== 'unknown';
}
