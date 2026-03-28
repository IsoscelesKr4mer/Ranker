import type { VercelRequest, VercelResponse } from '@vercel/node';

interface LetterboxdFilm {
  slug: string;
  title: string;
  posterUrl: string | null;
  year: string | null;
}

function parseFilmsFromHtml(html: string): LetterboxdFilm[] {
  const films: LetterboxdFilm[] = [];

  // Method 1: Extract from data-film-slug attributes and img alt text
  // Pattern: <div ... data-film-slug="film-name" ... > ... <img ... alt="Film Title" src="poster-url" ...>
  const posterRegex = /data-film-slug="([^"]+)"[^>]*>[\s\S]*?<img[^>]*alt="([^"]*)"[^>]*(?:src|data-src)="([^"]*)"/g;
  let match;
  while ((match = posterRegex.exec(html)) !== null) {
    const slug = match[1];
    const title = match[2];
    let posterUrl: string | null = match[3];

    // Upgrade poster URL to larger size
    if (posterUrl && posterUrl.includes('ltrbxd.com')) {
      posterUrl = posterUrl.replace(/\/[0-9]+x[0-9]+\//, '/500x750/');
    }

    if (title && !films.some(f => f.slug === slug)) {
      films.push({ slug, title, posterUrl: posterUrl || null, year: null });
    }
  }

  // Method 2: data-film-slug with separate image lookup
  if (films.length === 0) {
    const slugRegex = /data-film-slug="([^"]+)"/g;
    const slugs: string[] = [];
    while ((match = slugRegex.exec(html)) !== null) {
      if (!slugs.includes(match[1])) {
        slugs.push(match[1]);
      }
    }

    // Try to find titles from alt attributes or data-film-name
    for (const slug of slugs) {
      // Look for data-film-name attribute
      const nameRegex = new RegExp(`data-film-slug="${slug}"[^>]*data-film-name="([^"]*)"`, 'i');
      const nameMatch = html.match(nameRegex);

      // Also try finding the alt text near this slug
      const contextRegex = new RegExp(`data-film-slug="${slug}"[\\s\\S]{0,500}?alt="([^"]*)"`, 'i');
      const contextMatch = html.match(contextRegex);

      const title = nameMatch?.[1] || contextMatch?.[1] || slug.replace(/-/g, ' ');

      films.push({
        slug,
        title: title.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
        posterUrl: null,
        year: null,
      });
    }
  }

  // Method 3: Parse from list detail/headline structure
  if (films.length === 0) {
    const detailRegex = /<h\d[^>]*>\s*<a[^>]*href="\/film\/([^/"]+)\/"[^>]*>([^<]+)<\/a>/g;
    while ((match = detailRegex.exec(html)) !== null) {
      const slug = match[1];
      const title = match[2].trim();
      if (title && !films.some(f => f.slug === slug)) {
        films.push({ slug, title, posterUrl: null, year: null });
      }
    }
  }

  return films;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // Validate it's a Letterboxd URL
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('letterboxd.com')) {
      return res.status(400).json({ error: 'Not a Letterboxd URL' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const allFilms: LetterboxdFilm[] = [];
    let pageNum = 1;
    const maxPages = 10;

    while (pageNum <= maxPages) {
      // Ensure URL ends with /
      const baseUrl = url.replace(/\/?$/, '/');
      const pageUrl = pageNum === 1
        ? baseUrl
        : `${baseUrl}page/${pageNum}/`;

      const response = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });

      if (!response.ok) {
        if (pageNum === 1) {
          return res.status(response.status).json({
            error: `Failed to fetch Letterboxd page: ${response.status}`,
            debug: `URL: ${pageUrl}`,
          });
        }
        break;
      }

      const html = await response.text();
      const films = parseFilmsFromHtml(html);

      if (films.length === 0 && pageNum > 1) {
        break; // No more films on this page
      }

      allFilms.push(...films);

      // Check if there's a next page
      if (!html.includes('class="next"') && !html.includes('"next"') && !html.includes('paginate-next')) {
        break;
      }

      pageNum++;
    }

    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.status(200).json({
      films: allFilms,
      count: allFilms.length,
      pages: pageNum,
    });
  } catch (err: any) {
    console.error('Letterboxd proxy error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
