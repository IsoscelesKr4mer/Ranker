import type { VercelRequest, VercelResponse } from '@vercel/node';

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Twitch credentials not configured');
  }

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) {
    throw new Error(`Token request failed: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  // Expire 100 seconds early to be safe
  tokenExpiry = Date.now() + (data.expires_in - 100) * 1000;
  return cachedToken!;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, query } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  try {
    const token = await getAccessToken();
    const clientId = process.env.TWITCH_CLIENT_ID!;

    let body: string;

    if (action === 'search') {
      // Search games by name, return cover art, release date, platforms
      body = `
        search "${query.replace(/"/g, '\\"')}";
        fields name, cover.image_id, first_release_date, platforms.name, summary, rating, genres.name;
        limit 20;
      `;
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const igdbRes = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body,
    });

    if (!igdbRes.ok) {
      const errText = await igdbRes.text();
      return res.status(igdbRes.status).json({ error: errText });
    }

    const games = await igdbRes.json();

    // Transform to a cleaner format
    const results = games.map((game: any) => ({
      id: game.id,
      name: game.name,
      cover: game.cover?.image_id
        ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
        : null,
      coverSmall: game.cover?.image_id
        ? `https://images.igdb.com/igdb/image/upload/t_cover_small/${game.cover.image_id}.jpg`
        : null,
      releaseDate: game.first_release_date
        ? new Date(game.first_release_date * 1000).getFullYear()
        : null,
      platforms: game.platforms?.map((p: any) => p.name) || [],
      summary: game.summary || null,
      rating: game.rating ? Math.round(game.rating) : null,
      genres: game.genres?.map((g: any) => g.name) || [],
    }));

    return res.status(200).json({ results });
  } catch (err: any) {
    console.error('IGDB error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
