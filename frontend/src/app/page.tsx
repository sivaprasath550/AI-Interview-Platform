'use client';

import Link from 'next/link';
import { useAuthStore } from '@/store/auth-store';
import { logout } from '@/lib/api/auth';

export default function Home() {
  const user = useAuthStore((state) => state.user);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4">
      {user ? (
        <>
          <p className="text-gray-900">
            Logged in as <span className="font-semibold">{user.name}</span>{' '}
            ({user.email})
          </p>
          <div className="flex gap-3">
            <Link
              href="/problems"
              className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
            >
              Browse problems
            </Link>
            <button
              onClick={() => logout()}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
            >
              Log out
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-gray-900">Not logged in.</p>
          <div className="flex gap-3">
            <Link href="/login" className="text-sm font-medium underline">
              Log in
            </Link>
            <Link href="/signup" className="text-sm font-medium underline">
              Sign up
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
