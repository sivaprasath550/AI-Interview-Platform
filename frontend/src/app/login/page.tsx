'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth-store';
import { Alert, Button, Logo, Spinner } from '@/components/ui';
import { TextField } from '@/components/text-field';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { accessToken, user } = await login({ email, password });
      setAuth(accessToken, user);
      router.push('/problems');
    } catch (err) {
      // Deliberately generic on the frontend too, mirroring the backend's
      // single "Invalid email or password" message — we don't want the UI
      // to leak anything more specific than the API already refuses to.
      if (err instanceof ApiError && err.status === 401) {
        setError('Invalid email or password.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-sm flex-col justify-center px-5 py-12">
      <div className="animate-rise">
        <Link href="/" className="mx-auto block w-fit">
          <Logo />
        </Link>
        <h1 className="mt-8 text-center text-2xl font-semibold tracking-tight text-text">
          Welcome back
        </h1>
        <p className="mt-2 text-center text-sm text-muted">
          Log in to keep practicing and track your submissions.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-4 rounded-xl border border-border bg-surface p-6 shadow-sm"
        >
          {error && <Alert>{error}</Alert>}

          <TextField
            id="email"
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            id="password"
            label="Password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" disabled={loading} className="mt-2 w-full">
            {loading && <Spinner className="h-4 w-4" />}
            {loading ? 'Logging in…' : 'Log in'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-medium text-accent hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
