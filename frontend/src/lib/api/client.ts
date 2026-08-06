import { useAuthStore } from '@/store/auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: { message?: string | string[]; error?: string } | null,
  ) {
    super(`Request failed with status ${status}`);
  }
}

async function rawFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = useAuthStore.getState().accessToken;
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    // credentials: 'include' — sends/receives the httpOnly refreshToken
    // cookie cross-origin (frontend :3001, backend :3000); both sides
    // have to opt in (backend's CORS config is the other half).
    credentials: 'include',
  });
}

// Paths that must NEVER trigger the auto-refresh-and-retry below:
// /auth/refresh obviously can't retry-via-refresh-itself (infinite loop),
// and a 401 from /auth/login or /auth/signup means "wrong credentials,"
// not "expired session" — retrying those makes no sense.
const NO_RETRY_PATHS = ['/auth/login', '/auth/signup', '/auth/refresh'];

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let res = await rawFetch(path, options);

  if (res.status === 401 && !NO_RETRY_PATHS.includes(path)) {
    // Step 6's design: on a 401, try refreshing once, then retry the
    // ORIGINAL request with the new token — the caller never needs to
    // know an access token silently expired mid-session.
    const refreshed = await restoreSession();
    if (refreshed) {
      res = await rawFetch(path, options);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (res.status === 401) {
      // Whatever we tried above didn't recover the session — it's
      // genuinely gone (expired refresh token, revoked, or reuse
      // detected server-side). Clear the store so the rest of the app
      // (e.g. a header showing the logged-in user) reflects that
      // immediately instead of showing stale logged-in UI.
      useAuthStore.getState().clearAuth();
    }
    throw new ApiError(res.status, body);
  }

  // 204 No Content has NO body by HTTP spec (our /auth/logout returns
  // this) — calling res.json() on an empty body throws a SyntaxError
  // ("Unexpected end of JSON input"), not a graceful null/undefined.
  // Callers expecting no data (like logout) get `undefined`, correctly
  // typed as T here only because those call sites use apiFetch<void>.
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// Exported separately (not just used internally by apiFetch above) so an
// AuthInitializer component can call this once on app load — access
// tokens live only in memory (Step 7), so every page refresh starts
// with an empty store; this is what silently recovers it from the
// httpOnly refresh cookie, which DOES survive a refresh.
export async function restoreSession(): Promise<boolean> {
  try {
    const res = await rawFetch('/auth/refresh', { method: 'POST' });
    if (!res.ok) return false;
    const data = await res.json();
    useAuthStore.getState().setAuth(data.accessToken, data.user);
    return true;
  } catch {
    // Network failure, backend down, etc. — treat the same as "no
    // session to restore" rather than surfacing an error for something
    // the user didn't explicitly ask for.
    return false;
  }
}
