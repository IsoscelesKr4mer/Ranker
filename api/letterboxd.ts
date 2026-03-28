import type { VercelRequest, VercelResponse } from '@vercel/node';

interface LetterboxdFilm {
  slug: string;
  title: string;
  posterUrl: string | null;
  year: string | null;
}

function parseFilmsFromHtml(html: string): LetterboxdFilm[] {
  const films: LetterboxdFilm[] = [];

  // Actual Letterboxd structure (verified March 2025):
  // <div class="poster film-poster">
  //   <img src="https://a.ltrbxd.com/..." alt="Poster for Sinners (2025)" ...>
  //   <a href="/film/sinners-2025/" class="frame" ...>
  // </div>

  // Strategy: Find all "Poster for X" alt texts, then find the nearest /film/slug/ link
  const altRegex = /alt="Poster for ([^"]+)"[^>]*src="([^"]*)"/g;
  let match;
  const posterEntries: { altText: string; posterUrl: string; position: number }[] = [];

  while ((match = altRegex.exec(html)) !== null) {
    posterEntries.push({
      altText: match[1],
      posterUrl: match[2],
      position: match.index,
    });
  }

  // Also try src before alt (some variations)
  if (posterEntries.length === 0) {
    const altRegex2 = /src="([^"]*)"[^>]*alt="Poster for ([^"]+)"/g;
    while ((match = altRegex2.exec(html)) !== null) {
      posterEntries.push({
        altText: match[2],
        posterUrl: match[1],
        position: match.index,
      });
    }
  }

  for (const entry of posterEntries) {
    const { altText, posterUrl: rawPosterUrl, position } = entry;

    // Parse title and year from "Sinners (2025)"
    const titleYearMatch = altText.match(/^(.+?)\s*\((\d{4})\)\s*$/);
    const title = titleYearMatch ? titleYearMatch[1].trim() : altText.trim();
    const year = titleYearMatch ? titleYearMatch[2] : null;

    // Find the nearest /film/slug/ link within 500 chars after the img
    const nearby = html.substring(position, position + 500);
    const slugMatch = nearby.match(/href="\/film\/([^"\/]+)\/"/);
    const slug = slugMatch ? slugMatch[1] : title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    // Upgrade poster to larger size
    let posterUrl: string | null = rawPosterUrl || null;
    if (posterUrl && posterUrl.includes('ltrbxd.com')) {
      posterUrl = posterUrl
        .replace(/-0-\d+-0-\d+-crop/, '-0-500-0-750-crop');
    }

    if (title && !films.some(f => f.slug === slug)) {
      films.push({ slug, title, posterUrl, year });
    }
  }

  // Fallback: just extract /film/slug/ links if no poster entries found
  if (films.length === 0) {
    const linkRegex = /href="\/film\/([^"\/]+)\/"/g;
    const seenSlugs = new Set<string>();
    while ((match = linkRegex.exec(html)) !== null) {
      const slug = match[1];
      if (!seenSlugs.has(slug)) {
        seenSlugs.add(slug);
        // Also try to find a data-original-title near this link
        const nearbyContext = html.substring(Math.max(0, match.index - 200), match.index + 200);
        const titleMatch = nearbyContext.match(/data-original-title="([^"]+)"/);
        const rawTitle = titleMatch
          ? titleMatch[1].replace(/\s*★.*$/, '').trim()
          : slug.replace(/-\d{4}$/, '').replace(/-/g, ' ');

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
          hasFilmPoster: html.includes('film-poster'),
          hasPosterFor: html.includes('Poster for'),
          hasFilmLink: html.includes('/film/'),
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
