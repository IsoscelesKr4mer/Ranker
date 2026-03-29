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

  const { action, query, gameId } = req.body;

  if (!query && !gameId) {
    return res.status(400).json({ error: 'Missing query or gameId parameter' });
  }

  try {
    const token = await getAccessToken();
    const clientId = process.env.TWITCH_CLIENT_ID!;

    let endpoint: string;
    let body: string;

    if (action === 'search') {
      // Search games by name
      if (!query) return res.status(400).json({ error: 'Missing query' });
      endpoint = 'games';
      body = `
        search "${query.replace(/"/g, '\\"')}";
        fields name, cover.image_id, first_release_date, platforms.name, summary, rating, genres.name;
        limit 20;
      `;
    } else if (action === 'characters') {
      // Get characters for a specific game by game ID
      if (!gameId) return res.status(400).json({ error: 'Missing gameId' });
      endpoint = 'characters';
      body = `
        fields name, mug_shot.image_id, description, games;
        where games = (${Number(gameId)});
        limit 50;
      `;
    } else if (action === 'search_characters') {
      // Search characters by name
      if (!query) return res.status(400).json({ error: 'Missing query' });
      endpoint = 'characters';
      body = `
        search "${query.replace(/"/g, '\\"')}";
        fields name, mug_shot.image_id, description, games.name;
        limit 30;
      `;
    } else if (action === 'game_lookup') {
      // Look up a game by name to get its ID (for character fetching)
      if (!query) return res.status(400).json({ error: 'Missing query' });
      endpoint = 'games';
      body = `
        search "${query.replace(/"/g, '\\"')}";
        fields name, cover.image_id, first_release_date;
        limit 10;
      `;
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const igdbRes = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
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

    const rawData = await igdbRes.json();

    if (action === 'search' || action === 'game_lookup') {
      const results = rawData.map((game: any) => ({
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
    }

    if (action === 'characters' || action === 'search_characters') {
      const results = rawData.map((char: any) => ({
        id: char.id,
        name: char.name,
        mugShot: char.mug_shot?.image_id
          ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${char.mug_shot.image_id}.jpg`
          : null,
        mugShotSmall: char.mug_shot?.image_id
          ? `https://images.igdb.com/igdb/image/upload/t_thumb/${char.mug_shot.image_id}.jpg`
          : null,
        description: char.description || null,
        games: char.games?.map((g: any) => (typeof g === 'object' ? g.name : g)) || [],
      }));
      return res.status(200).json({ results });
    }

    return res.status(200).json({ results: rawData });
  } catch (err: any) {
    console.error('IGDB error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
