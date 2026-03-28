# Ranker

Rank anything using head-to-head comparisons. Pick two, choose your favorite, and Ranker uses a merge sort algorithm to build your definitive ranking — no agonizing over numbered lists.

**Live at [ranker-mu.vercel.app](https://ranker-mu.vercel.app)**

## How It Works

1. **Pick a list** — choose from presets (MCU, Star Wars, Pixar, Harry Potter, etc.), search for movies/TV/games/music, import from Letterboxd, or create your own
2. **Compare** — Ranker shows you two items at a time. Pick your favorite.
3. **Get your ranking** — after a minimal number of comparisons, you get a complete ranked list with a podium for your top 3
4. **Share it** — save to your profile or generate a shareable link

The merge sort algorithm means you make far fewer comparisons than ranking items manually — typically O(n log n) instead of evaluating every possible pair.

## Features

- **Movie search** via TMDb — posters, release years, metadata
- **TV show search** via TMDb
- **Game search** via IGDB — cover art, platforms, genres
- **Music search** via Deezer — songs, albums, or artists with artwork
- **Letterboxd import** — paste a public list URL and rank it
- **Custom lists** — add anything manually with optional images and tags
- **Preset lists** — curated lists ready to rank (MCU, Star Wars, Pixar, Harry Potter, Studio Ghibli, and more)
- **Google OAuth** — sign in to save rankings and track stats
- **Dashboard** — view your completed rankings, in-progress sessions, and stats
- **Community** — browse and vote on other users' lists
- **Shareable results** — generate a link to your ranked list with a podium display
- **Responsive** — works on desktop and mobile

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, Zustand
- **Backend**: Supabase (Postgres + Auth + RLS), Vercel serverless functions
- **APIs**: TMDb (movies/TV), IGDB via Twitch (games), Deezer (music), Letterboxd (list import)

## Project Structure

```
src/
├── pages/          Landing, Auth, Browse, CreateList, Ranking, Results, Dashboard, Community, SharedResult
├── components/     UI primitives (Button, Card, Input, Modal), layout (Navbar, PageLayout), ranking UI
├── hooks/          useRanking — manages merge sort state and comparison flow
├── lib/            API clients (tmdb, igdb, deezer, letterboxd), database queries, merge sort algorithm
├── store/          Zustand auth store
├── data/           Preset lists with poster art
└── types/          TypeScript interfaces

api/                Vercel serverless functions
├── igdb.ts         IGDB proxy (Twitch OAuth)
├── deezer.ts       Deezer proxy (CORS)
└── letterboxd.ts   Letterboxd HTML scraper
```

## Setup

```bash
npm install

# Set up environment variables
cp .env.example .env
# Fill in:
#   VITE_SUPABASE_URL
#   VITE_SUPABASE_ANON_KEY
#   VITE_TMDB_API_KEY
#   TWITCH_CLIENT_ID
#   TWITCH_CLIENT_SECRET

npm run dev
```

## Deploy

Configured for Vercel — push to `main` and it auto-deploys. The `api/` directory contains the serverless functions, and `vercel.json` handles SPA routing.

Environment variables needed in Vercel:
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — Supabase project credentials
- `VITE_TMDB_API_KEY` — TMDb API key for movie/TV search
- `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` — Twitch app credentials for IGDB game search
