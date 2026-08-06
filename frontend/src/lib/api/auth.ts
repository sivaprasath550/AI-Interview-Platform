import { apiFetch } from './client';
import { useAuthStore } from '@/store/auth-store';

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export function signup(payload: {
  email: string;
  password: string;
  name: string;
}) {
  return apiFetch<AuthUser>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function login(payload: { email: string; password: string }) {
  return apiFetch<{ accessToken: string; user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function logout() {
  try {
    // <void> — the backend returns 204 No Content, no body to parse.
    await apiFetch<void>('/auth/logout', { method: 'POST' });
  } finally {
    // Clear client state regardless of whether the network call
    // succeeded — from this device's perspective the user is logged
    // out either way; server-side revocation is a bonus, not a
    // precondition for the UI to reflect logged-out state.
    useAuthStore.getState().clearAuth();
  }
}
