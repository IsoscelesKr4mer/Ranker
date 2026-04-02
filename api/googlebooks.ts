import type { VercelRequest, VercelResponse } from '@vercel/node';

const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY || '';

/** Normalise a title for dedup: lowercase, strip subtitles / edition tags / punctuation */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(.*?\)/g, '')                       // remove parentheticals "(Movie Tie-In)"
    .replace(/\[.*?\]/g, '')                       // remove brackets "[Large Print]"
    .replace(/:\s*.*/g, '')                        // strip subtitle after colon
    .replace(/\b(edition|reprint|anniversary|illustrated|deluxe|enhanced|abridged|unabridged|vol\.?\s*\d*|volume\s*\d*)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, '')                   // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

interface BookResult {
  id: string;
  title: string;
  author: string | null;
  imageUrl: string | null;
  year: string | null;
  description: string | null;
  pageCount: number | null;
  categories: string[];
  averageRating: number | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { q, type = 'title', limit = '20', startIndex = '0' } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Missing q parameter' });
  }

  if (!GOOGLE_BOOKS_API_KEY) {
    return res.status(500).json({ error: 'Google Books API key not configured' });
  }

  const start = parseInt(startIndex as string) || 0;
  const requestedLimit = Math.min(parseInt(limit as string) || 20, 40);

  // Over-fetch so we still have enough results after dedup/filtering
  const fetchLimit = Math.min(requestedLimit + 15, 40);

  const fetchBooks = async (queryStr: string, maxResults: number, offset: number) => {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(queryStr)}&maxResults=${maxResults}&startIndex=${offset}&printType=books&langRestrict=en&orderBy=relevance&key=${GOOGLE_BOOKS_API_KEY}`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!response.ok) throw new Error(`Google Books API error: ${response.status}`);
    return response.json();
  };

  try {
    let data: any;
    if (type === 'author') {
      data = await fetchBooks(`inauthor:${q}`, fetchLimit, start);
      if (start === 0 && (!data.items || data.items.length === 0)) {
        data = await fetchBooks(q as string, fetchLimit, 0);
      }
    } else {
      data = await fetchBooks(`intitle:${q}`, fetchLimit, start);
    }

    // ── Map raw items ────────────────────────────────────────────────────
    const rawResults: BookResult[] = (data.items || []).map((item: any) => {
      const info = item.volumeInfo || {};

      // Extract ISBN-13 (preferred) or ISBN-10 for Open Library cover
      const identifiers = info.industryIdentifiers || [];
      const isbn13 = identifiers.find((id: any) => id.type === 'ISBN_13')?.identifier;
      const isbn10 = identifiers.find((id: any) => id.type === 'ISBN_10')?.identifier;
      const isbn = isbn13 || isbn10 || null;

      // Use Open Library covers (high-res) when ISBN available, fall back to Google Books thumbnail
      let imageUrl: string | null = null;
      if (isbn) {
        imageUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
      } else {
        const rawThumb =
          info.imageLinks?.extraLarge ||
          info.imageLinks?.large ||
          info.imageLinks?.medium ||
          info.imageLinks?.thumbnail ||
          info.imageLinks?.smallThumbnail ||
          null;
        imageUrl = rawThumb
          ? rawThumb.replace(/^http:/, 'https:').replace('&edge=curl', '')
          : null;
      }

      const year = info.publishedDate ? info.publishedDate.slice(0, 4) : null;
      const author = info.authors?.[0] || null;

      return {
        id: item.id,
        title: info.title || 'Unknown Title',
        author,
        imageUrl,
        year,
        description: info.description || null,
        pageCount: info.pageCount || null,
        categories: info.categories || [],
        averageRating: info.averageRating || null,
      };
    });

    // ── Filter junk ──────────────────────────────────────────────────────
    const filtered = rawResults.filter(book => {
      const t = book.title.toLowerCase();
      // Drop study guides, summaries, companion books, workbooks, coloring books
      if (/\b(sparknotes|cliffsnotes|study guide|summary|analysis|workbook|coloring|activity book|quiz book|trivia|companion guide|reader'?s? guide|teacher'?s? guide|lesson plan)\b/i.test(book.title)) return false;
      // Drop books with no title match for title searches (sanity check)
      if (type === 'title' && q.length > 3) {
        const queryWords = (q as string).toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const titleLower = t;
        const matched = queryWords.some(w => titleLower.includes(w));
        if (!matched) return false;
      }
      return true;
    });

    // ── Deduplicate by normalised title + author ─────────────────────────
    const seen = new Map<string, BookResult>();
    for (const book of filtered) {
      const key = `${normalizeTitle(book.title)}|${(book.author || '').toLowerCase().trim()}`;
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, book);
      } else {
        // Keep the one with an image, or more metadata
        const score = (b: BookResult) =>
          (b.imageUrl ? 10 : 0) +
          (b.description ? 3 : 0) +
          (b.pageCount ? 2 : 0) +
          (b.year ? 1 : 0);
        if (score(book) > score(existing)) {
          seen.set(key, book);
        }
      }
    }

    const results = Array.from(seen.values()).slice(0, requestedLimit);

    const totalItems = data.totalItems || 0;
    const hasMore = start + fetchLimit < totalItems;
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.status(200).json({ results, hasMore, totalItems });
  } catch (err: any) {
    console.error('Google Books proxy error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
