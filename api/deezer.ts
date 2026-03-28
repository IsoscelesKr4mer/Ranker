import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { q, type = 'track', limit = '20' } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Missing q parameter' });
  }

  // Deezer search endpoints: /search, /search/album, /search/artist
  const endpoint = type === 'album' ? 'search/album'
    : type === 'artist' ? 'search/artist'
    : 'search';

  try {
    const response = await fetch(
      `https://api.deezer.com/${endpoint}?q=${encodeURIComponent(q)}&limit=${limit}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Deezer API error' });
    }

    const data = await response.json();

    // Transform results into a consistent shape
    let results;

    if (type === 'album') {
      results = (data.data || []).map((album: any) => ({
        id: album.id,
        title: album.title,
        artist: album.artist?.name || 'Unknown Artist',
        imageUrl: album.cover_big || album.cover_medium || null,
        year: null, // Deezer album search doesn't return release date directly
        type: 'album' as const,
        trackCount: album.nb_tracks || null,
      }));
    } else if (type === 'artist') {
      results = (data.data || []).map((artist: any) => ({
        id: artist.id,
        title: artist.name,
        artist: null,
        imageUrl: artist.picture_big || artist.picture_medium || null,
        year: null,
        type: 'artist' as const,
        fanCount: artist.nb_fan || null,
      }));
    } else {
      // tracks/songs
      results = (data.data || []).map((track: any) => ({
        id: track.id,
        title: track.title_short || track.title,
        artist: track.artist?.name || 'Unknown Artist',
        imageUrl: track.album?.cover_big || track.album?.cover_medium || null,
        year: null,
        type: 'track' as const,
        duration: track.duration || null,
        albumTitle: track.album?.title || null,
      }));
    }

    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.status(200).json({ results });
  } catch (err: any) {
    console.error('Deezer proxy error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
