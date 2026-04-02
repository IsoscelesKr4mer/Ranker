import type { VercelRequest, VercelResponse } from '@vercel/node';

const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { q, type = 'title', limit = '20', startIndex = '0' } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Missing q parameter' });
  }

  if (!GOOGLE_BOOKS_API_KEY) {
    return res.status(500).json({ error: 'Google Books API key not configured' });
  }

  const start = parseInt(startIndex as string) || 0;

  const fetchBooks = async (queryStr: string, maxResults: number, offset: number) => {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(queryStr)}&maxResults=${maxResults}&startIndex=${offset}&printType=books&orderBy=relevance&key=${GOOGLE_BOOKS_API_KEY}`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!response.ok) throw new Error(`Google Books API error: ${response.status}`);
    return response.json();
  };

  try {
    const maxResults = Math.min(parseInt(limit as string) || 20, 40);

    let data: any;
    if (type === 'author') {
      // Try strict inauthor: first; fall back to plain search if empty (only on first page)
      data = await fetchBooks(`inauthor:${q}`, maxResults, start);
      if (start === 0 && (!data.items || data.items.length === 0)) {
        data = await fetchBooks(q as string, maxResults, 0);
      }
    } else {
      data = await fetchBooks(`intitle:${q}`, maxResults, start);
    }

    const results = (data.items || []).map((item: any) => {
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

      // Published year
      const year = info.publishedDate ? info.publishedDate.slice(0, 4) : null;

      // Primary author
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

    const totalItems = data.totalItems || 0;
    const hasMore = start + results.length < totalItems;
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.status(200).json({ results, hasMore, totalItems });
  } catch (err: any) {
    console.error('Google Books proxy error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
