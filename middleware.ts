/**
 * Vercel Edge Middleware — OG meta tag injection for social crawlers.
 *
 * When a social crawler (Twitterbot, Discordbot, etc.) visits a /shared/:shareId
 * URL, it cannot execute JavaScript, so React never runs and the SPA's dynamic
 * content is invisible. This middleware intercepts those requests and returns a
 * lightweight HTML page containing proper Open Graph / Twitter Card meta tags
 * (including an og:image pointing at /api/og/:shareId) so the link unfurl shows
 * a rich preview. Regular users are passed through to the normal SPA.
 */

export const config = {
  matcher: ['/shared/:shareId*'],
};

const SOCIAL_BOTS = [
  'twitterbot',
  'facebookexternalhit',
  'linkedinbot',
  'slackbot',
  'slack-imgproxy',
  'discordbot',
  'whatsapp',
  'telegrambot',
  'googlebot',
  'bingbot',
];

function escape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  const ua = request.headers.get('user-agent')?.toLowerCase() ?? '';
  const isCrawler = SOCIAL_BOTS.some((bot) => ua.includes(bot));

  // Regular users — pass through to the SPA
  if (!isCrawler) return undefined;

  const url     = new URL(request.url);
  const shareId = url.pathname.split('/').filter(Boolean).pop() ?? '';

  // Defaults in case the DB fetch fails
  let title       = 'My Ranking on Ranker';
  let description = 'Check out this ranked list on Ranker.';

  // Fetch just enough data to build meaningful title/description
  const supabaseUrl     = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey && shareId) {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/ranking_results?share_id=eq.${encodeURIComponent(shareId)}&is_public=eq.true&select=list_title,results`,
        {
          headers: {
            apikey:        supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
        }
      );
      const rows = await res.json() as Array<{ list_title: string; results: Array<{ title: string }> }>;
      const row  = rows[0];

      if (row) {
        title = `My ${row.list_title} Ranking`;
        const first = row.results?.[0];
        const count = row.results?.length ?? 0;
        description = first
          ? `#1: ${first.title} · ${count} item${count !== 1 ? 's' : ''} ranked`
          : `${count} item${count !== 1 ? 's' : ''} ranked`;
      }
    } catch {
      // Use defaults
    }
  }

  const ogImage  = `${url.origin}/api/og/${shareId}`;
  const pageUrl  = url.href;
  const safeTitle = escape(title);
  const safeDesc  = escape(description);
  const safeImg   = escape(ogImage);
  const safePage  = escape(pageUrl);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}">

  <!-- Open Graph -->
  <meta property="og:type"        content="website">
  <meta property="og:url"         content="${safePage}">
  <meta property="og:title"       content="${safeTitle}">
  <meta property="og:description" content="${safeDesc}">
  <meta property="og:image"       content="${safeImg}">
  <meta property="og:image:width"  content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name"   content="Ranker">

  <!-- Twitter / X Card -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="${safeTitle}">
  <meta name="twitter:description" content="${safeDesc}">
  <meta name="twitter:image"       content="${safeImg}">
</head>
<body>
  <h1>${safeTitle}</h1>
  <p>${safeDesc}</p>
  <a href="${safePage}">View full ranking →</a>
  <!-- Redirect real users who land here (bots ignore JS) -->
  <script>window.location.replace("${safePage}");</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type':  'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
