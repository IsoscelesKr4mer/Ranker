import type { VercelRequest, VercelResponse } from '@vercel/node';

const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY || '';

/**
 * Aggressively normalise a title for dedup.
 * "Harry Potter and the Philosopher's Stone - Gryffindor Edition" → "harry potter and the philosophers stone"
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(.*?\)/g, '')                       // "(Movie Tie-In)", "(Book 1)", etc.
    .replace(/\[.*?\]/g, '')                       // "[Illustrated Edition]"
    .replace(/\s*[-–—]\s*.*/g, '')                 // strip everything after dash
    .replace(/:\s*.*/g, '')                        // strip subtitle after colon
    .replace(/\s+by\s+.*/i, '')                    // "...by J.K. Rowling" → strip author from title
    .replace(/\b(a|the|an)\s+/g, '')               // drop articles for looser matching
    .replace(/\b(edition|reprint|anniversary|illustrated|deluxe|enhanced|abridged|unabridged|vol\.?\s*\d*|volume\s*\d*|book\s*\d+|paperback|hardcover|hardback|mass\s*market|large\s*print|ebook|e-book|audio|audiobook|graphic\s*novel|special|collector'?s?|slipcase|omnibus|complete|uncut)\b/gi, '')
    .replace(/['']/g, '')                          // smart quotes
    .replace(/[^a-z0-9\s]/g, '')                   // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/** Things that are clearly NOT individual books */
const JUNK_PATTERNS = /\b(sparknotes|cliffsnotes|cliff'?s?\s*notes|study\s*guide|reading\s*guide|summary\s*(and|&)?\s*analysis|analysis\s*of|workbook|coloring\s*book|activity\s*book|quiz\s*book|trivia|companion\s*guide|reader'?s?\s*guide|teacher'?s?\s*guide|lesson\s*plan|box\s*set|boxed\s*set|book\s*set|collection\s*set|books?\s*1\s*[-–]\s*\d|volumes?\s*1\s*[-–]\s*\d|complete\s*series|complete\s*collection|pocket\s*potters|unofficial|paper\s*craft|post\s*box|library\s*box|journal|notebook|diary|poster\s*book|pop-?up|sticker|cookbook|recipe|lego|mini\s*fig|magnets|bookmark|trading\s*card|card\s*game|board\s*game|film\s*guide|movie\s*guide|screenplay|screen\s*play|behind\s*the\s*scenes|making\s*of|wizarding\s*world|vault|archive|atlas|encyclopedia|encyclopaedia|dictionary|concordance|a\s*to\s*z|a-z|handbook|field\s*guide|character\s*guide|visual\s*guide|colouring|dot-?to-?dot|puzzle|maze|craft|paper\s*toy|advent\s*calendar|christmas\s*at|hogwarts\s*library|tales\s*of\s*beedle|quidditch\s*through|fantastic\s*beasts\s*and\s*where\s*to\s*find|playbill|a\s*history|biography|interview\s*with|conversations?\s*with|an\s*interview|unauthorized)\b/i;

/** Extra patterns specifically for title-only junk (not combined with author) */
const JUNK_TITLE_EXACT = /^(harry potter|[a-z\s]{1,20})$/i; // bare title with no subtitle = usually a box set

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
      data = await fetchBooks(`inauthor:${q}`, 40, start);
      if (start === 0 && (!data.items || data.items.length === 0)) {
        data = await fetchBooks(q as string, 40, 0);
      }
    } else {
      data = await fetchBooks(`intitle:${q}`, 40, start);
    }

    // ── Map raw items ────────────────────────────────────────────────────
    const rawResults: BookResult[] = (data.items || []).map((item: any) => {
      const info = item.volumeInfo || {};

      // Use Google Books thumbnail directly — zoom=1 is most reliable
      const rawThumb =
        info.imageLinks?.thumbnail ||
        info.imageLinks?.smallThumbnail ||
        null;
      const imageUrl = rawThumb
        ? rawThumb.replace(/^http:/, 'https:').replace('&edge=curl', '')
        : null;

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
      if (!book.title || book.title === 'Unknown Title') return false;
      if (!book.author) return false;
      if (!book.imageUrl) return false;
      if (JUNK_PATTERNS.test(book.title)) return false;

      // Drop non-Latin titles (Russian, Chinese, Arabic, etc.)
      if (/[^\u0000-\u024F\u1E00-\u1EFF]/.test(book.title)) return false;

      // For title searches, query words must appear in the title
      if (type === 'title' && q.length > 3) {
        const queryWords = (q as string).toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const titleLower = book.title.toLowerCase();
        if (!queryWords.some(w => titleLower.includes(w))) return false;
      }

      return true;
    });

    // ── Deduplicate by normalised title + author ─────────────────────────
    // Keep the best version of each unique book
    const seen = new Map<string, BookResult>();
    for (const book of filtered) {
      const normTitle = normalizeTitle(book.title);
      // Normalize author: extract surname for dedup
      // "J. K. Rowling" / "J.K. Rowling" / "Rowling, J. K." / "Rowling Joanne K" → "rowling"
      const authorWords = (book.author || '')
        .toLowerCase()
        .replace(/[.,]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2);  // drop initials like "j", "k", "jk"
      const normAuthor = authorWords[authorWords.length - 1] || '';  // surname is typically last
      const key = `${normTitle}|${normAuthor}`;

      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, book);
      } else {
        // Prefer: has description > has page count > has year > earlier year (original edition)
        const score = (b: BookResult) =>
          (b.description ? 10 : 0) +
          (b.pageCount ? 5 : 0) +
          (b.year ? 2 : 0);
        const bookScore = score(book);
        const existingScore = score(existing);
        if (bookScore > existingScore) {
          seen.set(key, book);
        } else if (bookScore === existingScore && book.year && existing.year && book.year < existing.year) {
          // Prefer the earlier publication (more likely the original edition)
          seen.set(key, book);
        }
      }
    }

    const results = Array.from(seen.values()).slice(0, requestedLimit);

    const totalItems = data.totalItems || 0;
    const hasMore = start + 40 < totalItems;
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.status(200).json({ results, hasMore, totalItems });
  } catch (err: any) {
    console.error('Google Books proxy error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
