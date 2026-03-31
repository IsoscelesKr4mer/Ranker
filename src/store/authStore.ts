import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { User, AuthStatus } from '@/types';

interface AuthState {
  user: User | null;
  status: AuthStatus;
  needsUsername: boolean;
  initialize: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  setUser: (user: User) => void;
  setNeedsUsername: (needs: boolean) => void;
}

async function fetchProfile(userId: string): Promise<{ username?: string; displayName?: string; avatarUrl?: string }> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('username, display_name, avatar_url')
      .eq('id', userId)
      .single();
    return {
      username: data?.username || undefined,
      displayName: data?.display_name || undefined,
      avatarUrl: data?.avatar_url || undefined,
    };
  } catch {
    return {};
  }
}

function buildUser(sessionUser: { id: string; email?: string; user_metadata?: Record<string, unknown> }, profile: { username?: string; displayName?: string; avatarUrl?: string }): User {
  return {
    id: sessionUser.id,
    email: sessionUser.email || '',
    displayName: profile.displayName || (sessionUser.user_metadata?.full_name as string) || (sessionUser.user_metadata?.name as string) || undefined,
    username: profile.username || undefined,
    avatarUrl: profile.avatarUrl || (sessionUser.user_metadata?.avatar_url as string) || undefined,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'loading',
  needsUsername: false,

  initialize: async () => {
    if (!isSupabaseConfigured()) {
      set({ status: 'unauthenticated', user: null });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        const user = buildUser(session.user, profile);
        set({
          user,
          status: 'authenticated',
          needsUsername: !profile.username,
        });
      } else {
        set({ status: 'unauthenticated', user: null });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          const user = buildUser(session.user, profile);
          set({
            user,
            status: 'authenticated',
            needsUsername: !profile.username,
          });
        } else {
          set({ user: null, status: 'unauthenticated', needsUsername: false });
        }
      });
    } catch {
      set({ status: 'unauthenticated', user: null });
    }
  },

  signInWithGoogle: async () => {
    if (!isSupabaseConfigured()) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
  },

  signInWithMagicLink: async (email: string) => {
    if (!isSupabaseConfigured()) {
      return { error: 'Authentication not configured' };
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) return { error: error.message };
    return {};
  },

  signOut: async () => {
    if (!isSupabaseConfigured()) return;
    await supabase.auth.signOut();
    set({ user: null, status: 'unauthenticated', needsUsername: false });
  },

  setUser: (user: User) => set({ user }),
  setNeedsUsername: (needs: boolean) => set({ needsUsername: needs }),
}));
