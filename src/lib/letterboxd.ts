import type { RankItem } from '@/types';

// In production, this goes through a Vercel serverless function to avoid CORS
// For now, we'll structure it to work with a proxy endpoint
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
  // Fetch through proxy to avoid CORS
  const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error('Failed to fetch Letterboxd list');

  const html = await res.text();
  return parseLetterboxdHtml(html);
}

export function parseLetterboxdHtml(html: string): RankItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const items: RankItem[] = [];

  // Parse film posters from list pages
  const posterElements = doc.querySelectorAll('.poster-container .film-poster, li.poster-container .film-poster');

  posterElements.forEach((el, index) => {
    const slug = el.getAttribute('data-film-slug') || '';
    const imgEl = el.querySelector('img');
    const title = imgEl?.getAttribute('alt') || slug.replace(/-/g, ' ');
    const posterSrc = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '';

    // Try to get a larger poster URL
    let posterUrl: string | null = posterSrc;
    if (posterSrc.includes('ltrbxd.com')) {
      posterUrl = posterSrc.replace(/\-0\-[0-9]+\-0\-[0-9]+\-crop/, '').replace(/\/[0-9]+x[0-9]+\//, '/500x750/');
    }

    items.push({
      id: `lb-${slug || index}`,
      title: title.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      imageUrl: posterUrl || null,
      subtitle: undefined,
      metadata: { letterboxdSlug: slug, source: 'letterboxd' },
    });
  });

  // Fallback: parse from list detail pages with different structure
  if (items.length === 0) {
    const filmItems = doc.querySelectorAll('.film-list .film-detail, .list-entries .film-detail');
    filmItems.forEach((el, index) => {
      const titleEl = el.querySelector('h2 a, .headline-2 a');
      const title = titleEl?.textContent?.trim() || '';
      const yearEl = el.querySelector('.metadata .year, small.metadata a');
      const year = yearEl?.textContent?.trim() || '';

      if (title) {
        items.push({
          id: `lb-${index}`,
          title,
          imageUrl: null,
          subtitle: year || undefined,
          metadata: { source: 'letterboxd' },
        });
      }
    });
  }

  return items;
}

export function isValidLetterboxdUrl(url: string): boolean {
  const parsed = parseLetterboxdUrl(url);
  return parsed.type !== 'unknown';
}
