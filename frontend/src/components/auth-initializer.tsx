'use client';

import { useEffect } from 'react';
import { restoreSession } from '@/lib/api/client';

// Runs once when the app loads. Access tokens live only in memory
// (Step 7 — never localStorage, to limit XSS exposure), so every page
// refresh starts with an empty auth store; this silently tries to
// recover it using the httpOnly refresh cookie, which DOES survive a
// refresh. No valid cookie (never logged in, expired, or revoked) just
// means this fails quietly — landing on a logged-out page is the normal
// state, not an error to surface.
export function AuthInitializer() {
  useEffect(() => {
    restoreSession();
  }, []);

  return null;
}
