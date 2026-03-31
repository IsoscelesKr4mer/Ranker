const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p';

export const tmdbImage = (path: string | null, size: 'w200' | 'w300' | 'w500' | 'original' = 'w500') => {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
};

export const isTmdbConfigured = () => TMDB_API_KEY !== '';

interface TMDbMovie {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  overview: string;
  vote_average: number;
  genre_ids: number[];
}

interface TMDbSearchResult {
  results: TMDbMovie[];
  total_results: number;
  total_pages: number;
}

export async function searchMovies(query: string, page = 1): Promise<{ movies: TMDbMovie[]; totalPages: number }> {
  const res = await fetch(
    `${BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}`
  );
  const data: TMDbSearchResult = await res.json();
  return { movies: data.results, totalPages: data.total_pages };
}

export async function discoverMovies(options: {
  year?: number;
  genreId?: number;
  sortBy?: string;
  page?: number;
  theatricalOnly?: boolean;
}): Promise<{ movies: TMDbMovie[]; totalPages: number }> {
  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    sort_by: options.sortBy || 'popularity.desc',
    page: String(options.page || 1),
  });
  if (options.year) params.set('primary_release_year', String(options.year));
  if (options.genreId) params.set('with_genres', String(options.genreId));
  // Release types: 2 = Theatrical Limited, 3 = Theatrical Wide
  if (options.theatricalOnly) params.set('with_release_type', '2|3');

  const res = await fetch(`${BASE_URL}/discover/movie?${params}`);
  const data: TMDbSearchResult = await res.json();
  return { movies: data.results, totalPages: data.total_pages };
}

export async function getMovieDetails(tmdbId: number): Promise<TMDbMovie | null> {
  try {
    const res = await fetch(`${BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export const GENRES = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 14, name: 'Fantasy' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Music' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Sci-Fi' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' },
];

// --- TV Show types & search ---

interface TMDbTVShow {
  id: number;
  name: string;
  first_air_date: string;
  poster_path: string | null;
  overview: string;
  vote_average: number;
  genre_ids: number[];
}

interface TMDbTVSearchResult {
  results: TMDbTVShow[];
  total_results: number;
  total_pages: number;
}

export async function searchTV(query: string, page = 1): Promise<{ shows: TMDbTVShow[]; totalPages: number }> {
  const res = await fetch(
    `${BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}`
  );
  const data: TMDbTVSearchResult = await res.json();
  return { shows: data.results, totalPages: data.total_pages };
}

// Convert TMDb movie to our generic RankItem
export function tmdbToRankItem(movie: TMDbMovie): import('@/types').RankItem {
  return {
    id: `tmdb-${movie.id}`,
    title: movie.title,
    imageUrl: tmdbImage(movie.poster_path),
    subtitle: movie.release_date ? movie.release_date.slice(0, 4) : undefined,
    metadata: {
      tmdbId: movie.id,
      overview: movie.overview,
      voteAverage: movie.vote_average,
      genreIds: movie.genre_ids,
    },
  };
}

// Convert TMDb TV show to our generic RankItem
export function tmdbTVToRankItem(show: TMDbTVShow): import('@/types').RankItem {
  return {
    id: `tmdb-tv-${show.id}`,
    title: show.name,
    imageUrl: tmdbImage(show.poster_path),
    subtitle: show.first_air_date ? show.first_air_date.slice(0, 4) : undefined,
    metadata: {
      tmdbId: show.id,
      mediaType: 'tv',
      overview: show.overview,
      voteAverage: show.vote_average,
      genreIds: show.genre_ids,
    },
  };
}
