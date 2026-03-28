import type { VercelRequest, VercelResponse } from '@vercel/node';

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
    // Letterboxd list pages can be paginated. Fetch page 1 first.
    const pages: string[] = [];
    let pageNum = 1;
    const maxPages = 10; // Safety limit

    while (pageNum <= maxPages) {
      const pageUrl = pageNum === 1
        ? url
        : url.replace(/\/?$/, `/page/${pageNum}/`);

      const response = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RankerApp/1.0)',
          'Accept': 'text/html',
        },
      });

      if (!response.ok) {
        if (pageNum === 1) {
          return res.status(response.status).json({ error: `Failed to fetch: ${response.status}` });
        }
        break; // No more pages
      }

      const html = await response.text();
      pages.push(html);

      // Check if there's a next page
      if (!html.includes('class="next"') && !html.includes('data-page-next')) {
        break;
      }

      pageNum++;
    }

    // Combine all pages
    const combinedHtml = pages.join('\n<!-- PAGE_BREAK -->\n');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.status(200).send(combinedHtml);
  } catch (err: any) {
    console.error('Letterboxd proxy error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
