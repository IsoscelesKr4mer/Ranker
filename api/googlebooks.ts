import type { VercelRequest, VercelResponse } from '@vercel/node';

const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { q, type = 'title', limit = '20' } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Missing q parameter' });
  }

  if (!GOOGLE_BOOKS_API_KEY) {
    return res.status(500).json({ error: 'Google Books API key not configured' });
  }

  const fetchBooks = async (queryStr: string, maxResults: number) => {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(queryStr)}&maxResults=${maxResults}&printType=books&orderBy=relevance&key=${GOOGLE_BOOKS_API_KEY}`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!response.ok) throw new Error(`Google Books API error: ${response.status}`);
    return response.json();
  };

  try {
    const maxResults = Math.min(parseInt(limit as string) || 20, 40);

    let data: any;
    if (type === 'author') {
      // Try strict inauthor: first; fall back to plain search if empty
      data = await fetchBooks(`inauthor:${q}`, maxResults);
      if (!data.items || data.items.length === 0) {
        data = await fetchBooks(q as string, maxResults);
      }
    } else {
      data = await fetchBooks(`intitle:${q}`, maxResults);
    }

    const results = (data.items || []).map((item: any) => {
      const info = item.volumeInfo || {};

      // Prefer the largest available thumbnail; upgrade http → https
      const rawThumb =
        info.imageLinks?.extraLarge ||
        info.imageLinks?.large ||
        info.imageLinks?.medium ||
        info.imageLinks?.thumbnail ||
        info.imageLinks?.smallThumbnail ||
        null;
      const imageUrl = rawThumb
        ? rawThumb.replace(/^http:/, 'https:').replace('&edge=curl', '')
        : null;

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

    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.status(200).json({ results });
  } catch (err: any) {
    console.error('Google Books proxy error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
