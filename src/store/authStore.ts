import { create } from 'zustand';
import type { User } from '@/api/endpoints/auth';
import { getAccessToken, clearAuthTokens, appStorage } from '@/utils/storage';

export type AuthStatus =
  | 'unknown'
  | 'unauthenticated'
  | 'authenticating'
  | 'authenticated'
  | 'profile_incomplete';

type AuthState = {
  status: AuthStatus;
  user: User | null;
  sessionId: string | null;
  temporaryToken: string | null;
  pendingPhone: string | null;
};

type AuthActions = {
  setStatus: (status: AuthStatus) => void;
  setUser: (user: User) => void;
  setSessionId: (sessionId: string) => void;
  setTemporaryToken: (token: string) => void;
  setPendingPhone: (phone: string) => void;
  hydrateFromStorage: () => Promise<void>;
  signOut: () => Promise<void>;
  reset: () => void;
};

const initialState: AuthState = {
  status: 'unknown',
  user: null,
  sessionId: null,
  temporaryToken: null,
  pendingPhone: null,
};

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  ...initialState,

  setStatus: (status) => set({ status }),

  setUser: (user) => set({ user, status: 'authenticated' }),

  setSessionId: (sessionId) => set({ sessionId }),

  setTemporaryToken: (temporaryToken) => set({ temporaryToken }),

  setPendingPhone: (pendingPhone) => set({ pendingPhone }),

  hydrateFromStorage: async () => {
    const token = await getAccessToken();
    if (!token) {
      set({ status: 'unauthenticated' });
      return;
    }
    // Token exists — mark as authenticated and let the app fetch the user profile
    set({ status: 'authenticated' });
  },

  signOut: async () => {
    await clearAuthTokens();
    appStorage.clearAll();
    set({ ...initialState, status: 'unauthenticated' });
  },

  reset: () => set({ ...initialState }),
}));
