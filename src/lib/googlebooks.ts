import type { RankItem } from '@/types';

export type BookSearchType = 'title' | 'author';

export interface GoogleBookResult {
  id: string;
  title: string;
  author: string | null;
  imageUrl: string | null;
  fallbackImageUrl: string | null;
  year: string | null;
  description: string | null;
  pageCount: number | null;
  categories: string[];
  averageRating: number | null;
}

export async function searchBooks(
  query: string,
  type: BookSearchType = 'title',
  offset = 0,
  limit = 20
): Promise<{ results: GoogleBookResult[]; hasMore: boolean }> {
  const res = await fetch(
    `/api/googlebooks?q=${encodeURIComponent(query)}&type=${type}&startIndex=${offset}&limit=${limit}`
  );

  if (!res.ok) {
    console.error('Google Books search failed:', res.status);
    return { results: [], hasMore: false };
  }

  const data = await res.json();
  return { results: data.results || [], hasMore: data.hasMore ?? false };
}

export function googleBookToRankItem(book: GoogleBookResult): RankItem {
  return {
    id: `gbooks-${book.id}`,
    title: book.title,
    imageUrl: book.imageUrl,
    subtitle: book.author || undefined,
    metadata: {
      googleBooksId: book.id,
      mediaType: 'book',
      author: book.author,
      year: book.year,
      description: book.description,
      pageCount: book.pageCount,
      categories: book.categories,
      averageRating: book.averageRating,
      fallbackImageUrl: book.fallbackImageUrl,
    },
  };
}
