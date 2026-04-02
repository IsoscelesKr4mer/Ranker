import type { VercelRequest, VercelResponse } from '@vercel/node';

const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY || '';

/** Normalise a title for dedup: lowercase, strip subtitles / edition tags / punctuation */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(.*?\)/g, '')                       // remove parentheticals "(Movie Tie-In)"
    .replace(/\[.*?\]/g, '')                       // remove brackets "[Large Print]"
    .replace(/:\s*.*/g, '')                        // strip subtitle after colon
    .replace(/\b(edition|reprint|anniversary|illustrated|deluxe|enhanced|abridged|unabridged|vol\.?\s*\d*|volume\s*\d*|book\s*\d+|paperback|hardcover|mass\s*market)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, '')                   // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/** Junk title patterns — box sets, study guides, merchandise, companions, etc. */
const JUNK_PATTERNS = /\b(sparknotes|cliffsnotes|cliff'?s?\s*notes|study\s*guide|summary\s*(and|&)?\s*analysis|analysis\s*of|workbook|coloring\s*book|activity\s*book|quiz\s*book|trivia|companion\s*guide|reader'?s?\s*guide|teacher'?s?\s*guide|lesson\s*plan|box\s*set|boxed\s*set|book\s*set|collection\s*set|pocket\s*potters|unofficial|paper\s*craft|post\s*box|library\s*box|journal|notebook|calendar|diary|poster\s*book|pop-?up|sticker|cookbook|recipe|lego|mini\s*fig|magnets|bookmark)/i;

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

  // Over-fetch so we still have enough after dedup/filtering
  const fetchLimit = 40;

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
    interface BookResult {
      id: string;
      title: string;
      author: string | null;
      imageUrl: string | null;
      fallbackImageUrl: string | null;
      year: string | null;
      description: string | null;
      pageCount: number | null;
      categories: string[];
      averageRating: number | null;
    }

    const rawResults: BookResult[] = (data.items || []).map((item: any) => {
      const info = item.volumeInfo || {};

      // Extract ISBN-13 (preferred) or ISBN-10 for Open Library cover
      const identifiers = info.industryIdentifiers || [];
      const isbn13 = identifiers.find((id: any) => id.type === 'ISBN_13')?.identifier;
      const isbn10 = identifiers.find((id: any) => id.type === 'ISBN_10')?.identifier;
      const isbn = isbn13 || isbn10 || null;

      // Google Books thumbnail (always available if the book has images) — use zoom=2 for better quality
      const rawThumb =
        info.imageLinks?.thumbnail ||
        info.imageLinks?.smallThumbnail ||
        null;
      const googleImageUrl = rawThumb
        ? rawThumb
            .replace(/^http:/, 'https:')
            .replace('&edge=curl', '')
            .replace(/zoom=\d/, 'zoom=2')
        : null;

      // Primary: Open Library high-res cover (only if we have a real ISBN-13)
      // Fallback: Google Books thumbnail at zoom=2
      const imageUrl = isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : googleImageUrl;
      const fallbackImageUrl = isbn ? googleImageUrl : null;

      const year = info.publishedDate ? info.publishedDate.slice(0, 4) : null;
      const author = info.authors?.[0] || null;

      return {
        id: item.id,
        title: info.title || 'Unknown Title',
        author,
        imageUrl,
        fallbackImageUrl,
        year,
        description: info.description || null,
        pageCount: info.pageCount || null,
        categories: info.categories || [],
        averageRating: info.averageRating || null,
      };
    });

    // ── Filter junk ──────────────────────────────────────────────────────
    const filtered = rawResults.filter(book => {
      // Must have a title
      if (!book.title || book.title === 'Unknown Title') return false;

      // Must have an author
      if (!book.author) return false;

      // Must have some kind of image
      if (!book.imageUrl && !book.fallbackImageUrl) return false;

      // Drop junk titles
      if (JUNK_PATTERNS.test(book.title)) return false;

      // For title searches, at least one query word should appear in the title
      if (type === 'title' && q.length > 3) {
        const queryWords = (q as string).toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const titleLower = book.title.toLowerCase();
        if (!queryWords.some(w => titleLower.includes(w))) return false;
      }

      return true;
    });

    // ── Deduplicate by normalised title + author ─────────────────────────
    const seen = new Map<string, BookResult>();
    for (const book of filtered) {
      const normTitle = normalizeTitle(book.title);
      const normAuthor = (book.author || '').toLowerCase().replace(/[^a-z\s]/g, '').trim();
      const key = `${normTitle}|${normAuthor}`;

      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, book);
      } else {
        // Keep the one with better metadata
        const score = (b: BookResult) =>
          (b.imageUrl ? 10 : 0) +
          (b.fallbackImageUrl ? 5 : 0) +
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
