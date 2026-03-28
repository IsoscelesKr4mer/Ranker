import type { VercelRequest, VercelResponse } from '@vercel/node';

interface LetterboxdFilm {
  slug: string;
  title: string;
  posterUrl: string | null;
  year: string | null;
}

function parseFilmsFromHtml(html: string): LetterboxdFilm[] {
  const films: LetterboxdFilm[] = [];
  let match;

  // Letterboxd server-side HTML uses React lazy-loading divs with data attributes:
  // <div class="react-component" data-component-class="LazyPoster"
  //   data-item-name="Sinners (2025)"
  //   data-item-slug="sinners-2025"
  //   data-item-link="/film/sinners-2025/"
  //   data-film-id="1116600"
  //   ...>
  // Poster images are NOT in the server HTML — they're loaded client-side by JS.

  // Primary: extract data-item-name and data-item-slug from LazyPoster divs
  const lazyPosterRegex = /data-component-class="LazyPoster"[^>]*data-item-name="([^"]+)"[^>]*data-item-slug="([^"]+)"/g;
  while ((match = lazyPosterRegex.exec(html)) !== null) {
    const itemName = match[1];
    const slug = match[2];

    const titleYearMatch = itemName.match(/^(.+?)\s*\((\d{4})\)\s*$/);
    const title = titleYearMatch ? titleYearMatch[1].trim() : itemName.trim();
    const year = titleYearMatch ? titleYearMatch[2] : null;

    if (title && !films.some(f => f.slug === slug)) {
      films.push({ slug, title, posterUrl: null, year });
    }
  }

  // Fallback: try data-item-slug before data-item-name (attribute order may vary)
  if (films.length === 0) {
    const altOrderRegex = /data-item-slug="([^"]+)"[^>]*data-item-name="([^"]+)"/g;
    while ((match = altOrderRegex.exec(html)) !== null) {
      const slug = match[1];
      const itemName = match[2];

      const titleYearMatch = itemName.match(/^(.+?)\s*\((\d{4})\)\s*$/);
      const title = titleYearMatch ? titleYearMatch[1].trim() : itemName.trim();
      const year = titleYearMatch ? titleYearMatch[2] : null;

      if (title && !films.some(f => f.slug === slug)) {
        films.push({ slug, title, posterUrl: null, year });
      }
    }
  }

  // Fallback 2: extract from poster img alt + data-target-link
  if (films.length === 0) {
    const targetLinkRegex = /data-target-link="\/film\/([^"\/]+)\/"/g;
    const seenSlugs = new Set<string>();
    while ((match = targetLinkRegex.exec(html)) !== null) {
      const slug = match[1];
      if (!seenSlugs.has(slug)) {
        seenSlugs.add(slug);
        // Look for data-item-name or alt text nearby
        const nearby = html.substring(Math.max(0, match.index - 500), match.index + 200);
        const nameMatch = nearby.match(/data-item-name="([^"]+)"/);
        const altMatch = nearby.match(/alt="([^"]+)"/);
        const rawTitle = nameMatch ? nameMatch[1] : altMatch ? altMatch[1] : slug.replace(/-\d{4}$/, '').replace(/-/g, ' ');

        const titleYearMatch = rawTitle.match(/^(.+?)\s*\((\d{4})\)\s*$/);
        const title = titleYearMatch
          ? titleYearMatch[1].trim()
          : rawTitle.split(/\s+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const year = titleYearMatch ? titleYearMatch[2] : null;

        films.push({ slug, title, posterUrl: null, year });
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
          });
        }
        break;
      }

      const html = await response.text();
      const films = parseFilmsFromHtml(html);

      if (films.length === 0 && pageNum > 1) {
        break;
      }

      allFilms.push(...films);

      // Check for next page
      if (!html.includes('class="next"') && !html.includes('paginate-next')) {
        break;
      }

      pageNum++;
    }

    // If still nothing, return debug info
    if (allFilms.length === 0) {
      const baseUrl = url.replace(/\/?$/, '/');
      const response = await fetch(baseUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      const html = await response.text();
      const htmlSnippet = html.substring(0, 2000);
      return res.status(200).json({
        films: [],
        count: 0,
        debug: {
          htmlLength: html.length,
          hasLazyPoster: html.includes('LazyPoster'),
          hasDataItemName: html.includes('data-item-name'),
          hasDataTargetLink: html.includes('data-target-link'),
          hasFilmPoster: html.includes('film-poster'),
          snippet: htmlSnippet,
        },
      });
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
