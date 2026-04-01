import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { RankItem, RankList, RankingSession, MergeSortState, PublicProfile } from '@/types';

// ─── Lists ─────────────────────────────────────────────────────────

const SAVE_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message = 'Request timed out'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export async function saveList(params: {
  title: string;
  description?: string;
  category: string;
  source: string;
  items: RankItem[];
  isPublic?: boolean;
  isCommunity?: boolean;
  coverImageUrl?: string;
  tags?: string[];
}): Promise<{ listId: string } | { error: string }> {
  if (!isSupabaseConfigured()) return { error: 'Database not configured' };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Create the list
  const insertData: Record<string, unknown> = {
    creator_id: user.id,
    title: params.title,
    description: params.description,
    category: params.category,
    source: params.source,
    is_public: params.isPublic ?? false,
    is_community: params.isCommunity ?? false,
    item_count: params.items.length,
    cover_image_url: params.coverImageUrl || params.items[0]?.imageUrl,
  };

  const { data: list, error: listError } = await withTimeout(
    supabase.from('lists').insert(insertData).select('id').single(),
    SAVE_TIMEOUT_MS,
    'Saving list timed out — please check your connection and try again.',
  );

  if (listError || !list) {
    console.error('saveList error:', listError);
    return { error: listError?.message || 'Failed to create list' };
  }

  // Insert all items
  const items = params.items.map((item, index) => ({
    list_id: list.id,
    title: item.title,
    image_url: item.imageUrl,
    subtitle: item.subtitle,
    metadata: item.metadata || {},
    position: index,
  }));

  const { error: itemsError } = await withTimeout(
    supabase.from('list_items').insert(items),
    SAVE_TIMEOUT_MS,
    'Saving list items timed out — please check your connection and try again.',
  );
  if (itemsError) return { error: itemsError.message };

  return { listId: list.id };
}

export async function getUserLists(): Promise<RankList[]> {
  if (!isSupabaseConfigured()) return [];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('lists')
    .select('*, list_items(*)')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((d) => dbListToRankList(d));
}

export async function getCommunityLists(): Promise<RankList[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('lists')
    .select('*, list_items(*)')
    .eq('is_community', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getCommunityLists error:', error);
    return [];
  }

  if (!data) return [];

  // Fetch profiles for all unique creator IDs
  const creatorIds = [...new Set(data.map(d => d.creator_id).filter(Boolean))];
  const profileMap = new Map<string, { username: string | null; display_name: string | null; avatar_url: string | null }>();

  if (creatorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', creatorIds);

    if (profiles) {
      for (const p of profiles) {
        profileMap.set(p.id, p);
      }
    }
  }

  return data.map(d => dbListToRankList(d, profileMap.get(d.creator_id as string)));
}

export async function deleteList(listId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: 'Database not configured' };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Delete list items first (child rows)
  await supabase
    .from('list_items')
    .delete()
    .eq('list_id', listId);

  // Delete the list itself
  const { error } = await supabase
    .from('lists')
    .delete()
    .eq('id', listId)
    .eq('creator_id', user.id);

  if (error) return { error: error.message };
  return {};
}

export async function getListById(listId: string): Promise<RankList | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('lists')
    .select('*, list_items(*)')
    .eq('id', listId)
    .single();

  if (error || !data) return null;

  return dbListToRankList(data);
}

function dbListToRankList(
  data: Record<string, unknown>,
  profile?: { username: string | null; display_name: string | null; avatar_url: string | null } | null,
): RankList {
  const items = ((data.list_items as Record<string, unknown>[]) || [])
    .sort((a, b) => (a.position as number) - (b.position as number))
    .map((item): RankItem => ({
      id: item.id as string,
      title: item.title as string,
      imageUrl: (item.image_url as string) || null,
      subtitle: item.subtitle as string | undefined,
      metadata: item.metadata as Record<string, unknown> | undefined,
    }));

  return {
    id: data.id as string,
    title: data.title as string,
    description: data.description as string | undefined,
    category: data.category as string,
    source: data.source as RankList['source'],
    items,
    coverImageUrl: data.cover_image_url as string | undefined,
    itemCount: data.item_count as number,
    creatorId: data.creator_id as string,
    creatorName: profile?.username || profile?.display_name || undefined,
    isPublic: data.is_public as boolean,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}


// ─── Ranking Sessions ──────────────────────────────────────────────

export async function saveRankingSession(params: {
  listId?: string;
  listTitle: string;
  items: RankItem[];
  sortState: MergeSortState;
  comparisonsMade: number;
  estimatedTotal: number;
}): Promise<{ sessionId: string } | { error: string }> {
  if (!isSupabaseConfigured()) return { error: 'Database not configured' };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('ranking_sessions')
    .insert({
      user_id: user.id,
      list_id: params.listId || null,
      list_title: params.listTitle,
      status: 'in_progress',
      comparisons_made: params.comparisonsMade,
      estimated_total: params.estimatedTotal,
      sort_state: params.sortState,
      items: params.items,
    })
    .select('id')
    .single();

  if (error || !data) return { error: error?.message || 'Failed to save session' };
  return { sessionId: data.id };
}

export async function updateRankingSession(sessionId: string, params: {
  sortState: MergeSortState;
  comparisonsMade: number;
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: 'Database not configured' };

  const { error } = await supabase
    .from('ranking_sessions')
    .update({
      sort_state: params.sortState,
      comparisons_made: params.comparisonsMade,
    })
    .eq('id', sessionId);

  if (error) return { error: error.message };
  return {};
}

export async function completeRankingSession(sessionId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: 'Database not configured' };

  const { error } = await supabase
    .from('ranking_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) return { error: error.message };
  return {};
}

export async function getInProgressSessions(): Promise<RankingSession[]> {
  if (!isSupabaseConfigured()) return [];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('ranking_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'in_progress')
    .order('updated_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row): RankingSession => ({
    id: row.id,
    userId: row.user_id,
    listId: row.list_id,
    listTitle: row.list_title,
    status: row.status,
    comparisonsMade: row.comparisons_made,
    estimatedTotal: row.estimated_total,
    sortState: row.sort_state,
    items: row.items,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }));
}


// ─── Ranking Results ───────────────────────────────────────────────

function generateShareId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export async function saveRankingResult(params: {
  sessionId?: string;
  listTitle: string;
  results: RankItem[];
  comparisonsMade: number;
  isPublic?: boolean;
}): Promise<{ resultId: string; shareId?: string } | { error: string }> {
  if (!isSupabaseConfigured()) return { error: 'Database not configured' };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Ensure we have a valid session_id (foreign key to ranking_sessions)
  let sessionId = params.sessionId;
  if (!sessionId) {
    const { data: sessionData, error: sessionError } = await supabase
      .from('ranking_sessions')
      .insert({
        user_id: user.id,
        list_title: params.listTitle,
        status: 'completed',
        comparisons_made: params.comparisonsMade,
        estimated_total: params.comparisonsMade,
        sort_state: {},
        items: params.results,
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (sessionError || !sessionData) {
      return { error: sessionError?.message || 'Failed to create session' };
    }
    sessionId = sessionData.id;
  }

  const shareId = params.isPublic ? generateShareId() : null;

  const { data, error } = await supabase
    .from('ranking_results')
    .insert({
      session_id: sessionId,
      user_id: user.id,
      list_title: params.listTitle,
      results: params.results,
      comparisons_made: params.comparisonsMade,
      is_public: params.isPublic ?? false,
      share_id: shareId,
    })
    .select('id, share_id')
    .single();

  if (error || !data) return { error: error?.message || 'Failed to save result' };
  return { resultId: data.id, shareId: data.share_id || undefined };
}

export async function getUserResults(): Promise<{
  id: string;
  listTitle: string;
  results: RankItem[];
  comparisonsMade: number;
  shareId?: string;
  createdAt: string;
}[]> {
  if (!isSupabaseConfigured()) return [];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('ranking_results')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    listTitle: row.list_title,
    results: row.results as RankItem[],
    comparisonsMade: row.comparisons_made,
    shareId: row.share_id || undefined,
    createdAt: row.created_at,
  }));
}

export async function getResultById(resultId: string): Promise<{
  id: string;
  listTitle: string;
  results: RankItem[];
  comparisonsMade: number;
  shareId?: string;
  createdAt: string;
} | null> {
  if (!isSupabaseConfigured()) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('ranking_results')
    .select('*')
    .eq('id', resultId)
    .eq('user_id', user.id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    listTitle: data.list_title,
    results: data.results as RankItem[],
    comparisonsMade: data.comparisons_made,
    shareId: data.share_id || undefined,
    createdAt: data.created_at,
  };
}

export async function makeResultPublic(resultId: string): Promise<{ shareId: string } | { error: string }> {
  if (!isSupabaseConfigured()) return { error: 'Database not configured' };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const shareId = generateShareId();

  const { error } = await supabase
    .from('ranking_results')
    .update({ is_public: true, share_id: shareId })
    .eq('id', resultId)
    .eq('user_id', user.id);

  if (error) return { error: error.message };
  return { shareId };
}

export async function deleteResult(resultId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: 'Database not configured' };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // First delete related ranking_sessions to avoid FK constraint issues
  // Get the session_id from the result first
  const { data: resultData } = await supabase
    .from('ranking_results')
    .select('session_id')
    .eq('id', resultId)
    .eq('user_id', user.id)
    .single();

  const { error } = await supabase
    .from('ranking_results')
    .delete()
    .eq('id', resultId)
    .eq('user_id', user.id);

  if (error) return { error: error.message };

  // Also clean up the associated ranking session
  if (resultData?.session_id) {
    await supabase
      .from('ranking_sessions')
      .delete()
      .eq('id', resultData.session_id)
      .eq('user_id', user.id);
  }

  return {};
}

export async function getSharedResult(shareId: string): Promise<{
  listTitle: string;
  results: RankItem[];
  comparisonsMade: number;
  createdAt: string;
} | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('ranking_results')
    .select('*')
    .eq('share_id', shareId)
    .eq('is_public', true)
    .single();

  if (error || !data) return null;

  return {
    listTitle: data.list_title,
    results: data.results as RankItem[],
    comparisonsMade: data.comparisons_made,
    createdAt: data.created_at,
  };
}


// ─── Community Votes ───────────────────────────────────────────────

export async function toggleVote(listId: string): Promise<{ voted: boolean } | { error: string }> {
  if (!isSupabaseConfigured()) return { error: 'Database not configured' };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Check if already voted
  const { data: existing } = await supabase
    .from('community_votes')
    .select('id')
    .eq('user_id', user.id)
    .eq('list_id', listId)
    .single();

  if (existing) {
    // Remove vote
    await supabase.from('community_votes').delete().eq('id', existing.id);
    return { voted: false };
  } else {
    // Add vote
    const { error } = await supabase
      .from('community_votes')
      .insert({ user_id: user.id, list_id: listId });
    if (error) return { error: error.message };
    return { voted: true };
  }
}

export async function getVoteCount(listId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const { count, error } = await supabase
    .from('community_votes')
    .select('*', { count: 'exact', head: true })
    .eq('list_id', listId);

  if (error) return 0;
  return count || 0;
}


// ─── User Stats ────────────────────────────────────────────────────

export async function getUserStats(): Promise<{
  listsCreated: number;
  rankingsCompleted: number;
  comparisonsMade: number;
}> {
  if (!isSupabaseConfigured()) return { listsCreated: 0, rankingsCompleted: 0, comparisonsMade: 0 };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { listsCreated: 0, rankingsCompleted: 0, comparisonsMade: 0 };

  const [listsRes, sessionsRes] = await Promise.all([
    supabase.from('lists').select('*', { count: 'exact', head: true }).eq('creator_id', user.id),
    supabase.from('ranking_sessions').select('comparisons_made, status').eq('user_id', user.id),
  ]);

  const sessions = sessionsRes.data || [];
  const completed = sessions.filter(s => s.status === 'completed').length;
  const totalComparisons = sessions.reduce((sum, s) => sum + (s.comparisons_made || 0), 0);

  return {
    listsCreated: listsRes.count || 0,
    rankingsCompleted: completed,
    comparisonsMade: totalComparisons,
  };
}


// ─── Image Upload ──────────────────────────────────────────────────

export async function uploadListImage(file: File): Promise<{ url: string } | { error: string }> {
  if (!isSupabaseConfigured()) return { error: 'Storage not configured' };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const ext = file.name.split('.').pop();
  const path = `${user.id}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('list-images')
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (error) return { error: error.message };

  const { data: urlData } = supabase.storage
    .from('list-images')
    .getPublicUrl(path);

  return { url: urlData.publicUrl };
}


export async function uploadAvatar(file: File): Promise<{ url: string } | { error: string }> {
  if (!isSupabaseConfigured()) return { error: 'Storage not configured' };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Validate file
  if (!file.type.startsWith('image/')) return { error: 'File must be an image' };
  if (file.size > 2 * 1024 * 1024) return { error: 'Image must be under 2MB' };

  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${user.id}/avatar.${ext}`;

  // Upload (upsert to replace existing)
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { cacheControl: '3600', upsert: true });

  if (error) return { error: error.message };

  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(path);

  // Add cache-bust to URL so browsers pick up the new image
  const url = `${urlData.publicUrl}?t=${Date.now()}`;

  // Also update the profile row
  await supabase
    .from('profiles')
    .update({ avatar_url: url, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  return { url };
}


// ─── Profiles ─────────────────────────────────────────────────────

export async function updateProfile(params: {
  username?: string;
  displayName?: string;
  avatarUrl?: string;
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: 'Database not configured' };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.username !== undefined) updates.username = params.username;
  if (params.displayName !== undefined) updates.display_name = params.displayName;
  if (params.avatarUrl !== undefined) updates.avatar_url = params.avatarUrl;

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id);

  if (error) return { error: error.message };
  return {};
}

export async function isUsernameTaken(username: string, excludeUserId?: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  let query = supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .ilike('username', username);

  if (excludeUserId) {
    query = query.neq('id', excludeUserId);
  }

  const { count } = await query;
  return (count || 0) > 0;
}

export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, created_at')
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    createdAt: data.created_at,
  };
}

export async function getPublicUserLists(userId: string): Promise<RankList[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('lists')
    .select('*, list_items(*)')
    .eq('creator_id', userId)
    .eq('is_community', true)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map(d => dbListToRankList(d));
}

export async function getPublicUserResults(userId: string): Promise<{
  id: string;
  listTitle: string;
  results: RankItem[];
  comparisonsMade: number;
  shareId?: string;
  createdAt: string;
}[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('ranking_results')
    .select('*')
    .eq('user_id', userId)
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    listTitle: row.list_title,
    results: row.results as RankItem[],
    comparisonsMade: row.comparisons_made,
    shareId: row.share_id || undefined,
    createdAt: row.created_at,
  }));
}
