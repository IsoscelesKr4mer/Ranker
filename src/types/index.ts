// Generic item that can be a movie, game, or anything
export interface RankItem {
  id: string;
  title: string;
  imageUrl: string | null;
  subtitle?: string; // year, platform, etc.
  metadata?: Record<string, unknown>; // tmdb_id, overview, etc.
}

export interface RankList {
  id: string;
  title: string;
  description?: string;
  category: string; // 'movies', 'games', 'tv', 'custom'
  source: 'preset' | 'letterboxd' | 'tmdb' | 'custom' | 'community';
  items: RankItem[];
  coverImageUrl?: string;
  tags?: string[];
  itemCount: number;
  creatorId?: string;
  creatorName?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RankingSession {
  id: string;
  userId?: string;
  listId: string;
  listTitle: string;
  status: 'in_progress' | 'completed';
  comparisonsMade: number;
  estimatedTotal: number;
  sortState: MergeSortState;
  items: RankItem[];
  result?: RankItem[];
  createdAt: string;
  completedAt?: string;
}

// Merge sort internal state (serializable for pause/resume)
export interface MergeSortState {
  lists: RankItem[][];
  listIndex: number;
  leftPointer: number;
  rightPointer: number;
  merged: RankItem[];
  comparisons: number;
  estimatedTotal: number;
  history: MergeSortSnapshot[];
}

export interface MergeSortSnapshot {
  lists: RankItem[][];
  listIndex: number;
  leftPointer: number;
  rightPointer: number;
  merged: RankItem[];
  comparisons: number;
}

export interface ComparisonPair {
  left: RankItem;
  right: RankItem;
}

export interface User {
  id: string;
  email: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
}

export interface PublicProfile {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
