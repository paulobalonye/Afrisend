import { create } from 'zustand';
import { clearAuthTokens, getAccessToken } from '@/lib/auth/cookies';
import type { User } from '@/types';

export type AuthStatus =
  | 'unknown'
  | 'unauthenticated'
  | 'authenticating'
  | 'authenticated'
  | 'profile_incomplete';

type AuthState = {
  status: AuthStatus;
  user: User | null;
  temporaryToken: string | null;
  pendingPhone: string | null;
};

type AuthActions = {
  setStatus: (status: AuthStatus) => void;
  setUser: (user: User) => void;
  setTemporaryToken: (token: string) => void;
  setPendingPhone: (phone: string) => void;
  hydrateFromStorage: () => Promise<void>;
  signOut: () => Promise<void>;
  reset: () => void;
};

const initialState: AuthState = {
  status: 'unknown',
  user: null,
  temporaryToken: null,
  pendingPhone: null,
};

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  ...initialState,

  setStatus: (status) => set({ status }),

  setUser: (user) => set({ user, status: 'authenticated' }),

  setTemporaryToken: (temporaryToken) => set({ temporaryToken }),

  setPendingPhone: (pendingPhone) => set({ pendingPhone }),

  hydrateFromStorage: async () => {
    const token = getAccessToken();
    if (!token) {
      set({ status: 'unauthenticated' });
      return;
    }
    set({ status: 'authenticated' });
  },

  signOut: async () => {
    clearAuthTokens();
    set({ ...initialState, status: 'unauthenticated' });
  },

  reset: () => set({ ...initialState }),
}));
