import type { RankItem } from '@/types';

export type BookSearchType = 'title' | 'author';

export interface GoogleBookResult {
  id: string;
  title: string;
  author: string | null;
  imageUrl: string | null;
  year: string | null;
  description: string | null;
  pageCount: number | null;
  categories: string[];
  averageRating: number | null;
}

export async function searchBooks(
  query: string,
  type: BookSearchType = 'title',
  limit = 20
): Promise<{ results: GoogleBookResult[] }> {
  const res = await fetch(
    `/api/googlebooks?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`
  );

  if (!res.ok) {
    console.error('Google Books search failed:', res.status);
    return { results: [] };
  }

  const data = await res.json();
  return { results: data.results || [] };
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
    },
  };
}
