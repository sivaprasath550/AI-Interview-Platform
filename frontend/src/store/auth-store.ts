import { create } from 'zustand';

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  // Deliberately NOT persisted to localStorage/sessionStorage — an
  // access token sitting in either is directly readable by any XSS
  // payload (Step 7). Keeping it only in memory means a page refresh
  // loses it; the intended recovery path is calling /auth/refresh on
  // app load using the httpOnly refresh cookie (not built yet — flagging
  // this as a known gap, not an oversight).
  accessToken: string | null;
  user: AuthUser | null;
  setAuth: (accessToken: string, user: AuthUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setAuth: (accessToken, user) => set({ accessToken, user }),
  clearAuth: () => set({ accessToken: null, user: null }),
}));
