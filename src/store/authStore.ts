import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { User, AuthStatus } from '@/types';

interface AuthState {
  user: User | null;
  status: AuthStatus;
  initialize: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'loading',

  initialize: async () => {
    if (!isSupabaseConfigured()) {
      set({ status: 'unauthenticated', user: null });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        set({
          user: {
            id: session.user.id,
            email: session.user.email || '',
            displayName: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
            avatarUrl: session.user.user_metadata?.avatar_url,
          },
          status: 'authenticated',
        });
      } else {
        set({ status: 'unauthenticated', user: null });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          set({
            user: {
              id: session.user.id,
              email: session.user.email || '',
              displayName: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
              avatarUrl: session.user.user_metadata?.avatar_url,
            },
            status: 'authenticated',
          });
        } else {
          set({ user: null, status: 'unauthenticated' });
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
    set({ user: null, status: 'unauthenticated' });
  },
}));
