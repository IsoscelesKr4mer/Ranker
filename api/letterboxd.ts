import type { VercelRequest, VercelResponse } from '@vercel/node';

interface LetterboxdFilm {
  slug: string;
  title: string;
  posterUrl: string | null;
  year: string | null;
}

function parseFilmsFromHtml(html: string): LetterboxdFilm[] {
  const films: LetterboxdFilm[] = [];

  // Current Letterboxd structure (2025):
  // <li class="posteritem ...">
  //   <div class="poster film-poster">
  //     <a href="/film/sinners-2025/">
  //       <img alt="Poster for Sinners (2025)" src="https://a.ltrbxd.com/resized/film-poster/..." />
  //     </a>
  //   </div>
  // </li>

  // Method 1: Extract from img alt="Poster for Title (Year)" + link href="/film/slug/"
  const posterRegex = /href="\/film\/([^"\/]+)\/"[^>]*>[\s\S]*?<img[^>]*alt="(?:Poster for )?([^"]+)"[^>]*src="([^"]+)"/g;
  let match;
  while ((match = posterRegex.exec(html)) !== null) {
    const slug = match[1];
    const altText = match[2];
    let posterUrl: string | null = match[3];

    // Parse title and year from alt text like "Sinners (2025)"
    const titleYearMatch = altText.match(/^(.+?)\s*\((\d{4})\)\s*$/);
    const title = titleYearMatch ? titleYearMatch[1].trim() : altText.trim();
    const year = titleYearMatch ? titleYearMatch[2] : null;

    // Upgrade poster to larger size
    if (posterUrl && posterUrl.includes('ltrbxd.com')) {
      posterUrl = posterUrl
        .replace(/-0-\d+-0-\d+-crop/, '-0-500-0-750-crop')
        .replace(/\/\d+x\d+\//, '/500x750/');
    }

    if (title && !films.some(f => f.slug === slug)) {
      films.push({ slug, title, posterUrl, year });
    }
  }

  // Method 2: Try reverse order (img before link) - some page layouts differ
  if (films.length === 0) {
    const altRegex = /<img[^>]*alt="(?:Poster for )?([^"]+)"[^>]*src="([^"]+)"[\s\S]*?href="\/film\/([^"\/]+)\/"/g;
    while ((match = altRegex.exec(html)) !== null) {
      const altText = match[1];
      let posterUrl: string | null = match[2];
      const slug = match[3];

      const titleYearMatch = altText.match(/^(.+?)\s*\((\d{4})\)\s*$/);
      const title = titleYearMatch ? titleYearMatch[1].trim() : altText.trim();
      const year = titleYearMatch ? titleYearMatch[2] : null;

      if (posterUrl && posterUrl.includes('ltrbxd.com')) {
        posterUrl = posterUrl
          .replace(/-0-\d+-0-\d+-crop/, '-0-500-0-750-crop')
          .replace(/\/\d+x\d+\//, '/500x750/');
      }

      if (title && !films.some(f => f.slug === slug)) {
        films.push({ slug, title, posterUrl, year });
      }
    }
  }

  // Method 3: Just get all "Poster for X" alt texts as a fallback
  if (films.length === 0) {
    const simpleAltRegex = /alt="Poster for ([^"]+)"/g;
    let idx = 0;
    while ((match = simpleAltRegex.exec(html)) !== null) {
      const altText = match[1];
      const titleYearMatch = altText.match(/^(.+?)\s*\((\d{4})\)\s*$/);
      const title = titleYearMatch ? titleYearMatch[1].trim() : altText.trim();
      const year = titleYearMatch ? titleYearMatch[2] : null;

      films.push({
        slug: `film-${idx++}`,
        title,
        posterUrl: null,
        year,
      });
    }
  }

  // Method 4: Parse from href="/film/slug/" links as absolute fallback
  if (films.length === 0) {
    const linkRegex = /href="\/film\/([^"\/]+)\/"/g;
    const seenSlugs = new Set<string>();
    while ((match = linkRegex.exec(html)) !== null) {
      const slug = match[1];
      if (!seenSlugs.has(slug)) {
        seenSlugs.add(slug);
        const title = slug.replace(/-\d{4}$/, '').replace(/-/g, ' ')
          .split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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

      // Check for next page link
      if (!html.includes('class="next"') && !html.includes('paginate-next')) {
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
