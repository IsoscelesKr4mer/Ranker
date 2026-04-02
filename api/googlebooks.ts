import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Book search API — uses Open Library Search for discovery (one result per work,
 * high-quality covers) with Google Books as a fallback.
 */

/** Junk patterns to filter from Open Library results */
const JUNK_PATTERNS = /\b(sparknotes|cliffsnotes|study\s*guide|reading\s*guide|teaching\s*guide|teaching\s*discussion|summary\s*(and|&)?\s*analysis|workbook|coloring|activity\s*book|activity\s*guide|quiz\s*book|trivia|companion\s*guide|box\s*set|boxed\s*set|book\s*set|books?\s*1\s*[-–]\s*\d|volumes?\s*1\s*[-–]\s*\d|complete\s*series|series\)\s*1|unofficial|paper\s*craft|poster\s*book|postcard\s*book|postcard\s*set|pop-?up|sticker|lego|magnets|bookmark|trading\s*card|card\s*game|board\s*game|screenplay|behind\s*the\s*scenes|making\s*of|vault|archive|atlas|encyclopedia|encyclopaedia|dictionary|concordance|handbook|visual\s*guide|colouring|puzzle|maze|paper\s*toy|advent\s*calendar|playbill|a\s*history|biography|interview\s*with|conversations?\s*with|graphic\s*novel\s*edition|teacher'?s?\s*guide|lesson\s*plan|sheet\s*music|themes?\s*from|wonders\s*of\s*the\s*world)\b/i;

/** Drop non-Latin script titles */
function isLatinTitle(title: string): boolean {
  return !/[^\u0000-\u024F\u1E00-\u1EFF]/.test(title);
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

  const requestedLimit = Math.min(parseInt(limit as string) || 20, 40);
  const start = parseInt(startIndex as string) || 0;
  // Open Library uses 'offset' and 'limit'
  const fetchLimit = Math.min(requestedLimit + 10, 40); // over-fetch for filtering

  try {
    // ── Build Open Library search URL ────────────────────────────────────
    let searchUrl: string;
    if (type === 'author') {
      searchUrl = `https://openlibrary.org/search.json?author=${encodeURIComponent(q)}&offset=${start}&limit=${fetchLimit}&sort=rating&language=eng&fields=key,title,author_name,first_publish_year,cover_i,number_of_pages_median,subject,edition_count,ratings_average`;
    } else {
      searchUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(q)}&offset=${start}&limit=${fetchLimit}&sort=rating&language=eng&fields=key,title,author_name,first_publish_year,cover_i,number_of_pages_median,subject,edition_count,ratings_average`;
    }

    const response = await fetch(searchUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'RankerApp/1.0 (ranking app)' },
    });
    if (!response.ok) throw new Error(`Open Library API error: ${response.status}`);
    const data = await response.json();

    // ── Map and filter results ───────────────────────────────────────────
    const results: BookResult[] = [];
    const seenTitles = new Set<string>();

    for (const doc of (data.docs || [])) {
      const title = doc.title;
      if (!title) continue;

      // Must have a cover image
      const coverId = doc.cover_i;
      if (!coverId) continue;

      // Must have an author
      const author = doc.author_name?.[0] || null;
      if (!author) continue;

      // Filter non-Latin titles
      if (!isLatinTitle(title)) continue;

      // Filter junk
      if (JUNK_PATTERNS.test(title)) continue;

      // Filter series box sets like "Harry Potter (series) 1-7"
      if (/\(series\)/i.test(title)) continue;

      // Dedup by normalised title
      const normTitle = title.toLowerCase()
        .replace(/\(.*?\)/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/:\s*.*/g, '')
        .replace(/\s*[-–—]\s*.*/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (seenTitles.has(normTitle)) continue;
      seenTitles.add(normTitle);

      const imageUrl = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
      const year = doc.first_publish_year ? String(doc.first_publish_year) : null;

      results.push({
        id: doc.key || `ol-${coverId}`,
        title,
        author,
        imageUrl,
        year,
        description: null,  // OL search doesn't return descriptions
        pageCount: doc.number_of_pages_median || null,
        categories: doc.subject?.slice(0, 3) || [],
        averageRating: doc.ratings_average || null,
      });

      if (results.length >= requestedLimit) break;
    }

    const totalItems = data.numFound || 0;
    const hasMore = start + fetchLimit < totalItems;
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.status(200).json({ results, hasMore, totalItems });
  } catch (err: any) {
    console.error('Book search error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
