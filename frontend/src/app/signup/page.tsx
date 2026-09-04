'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signup } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { Alert, Button, Logo, Spinner } from '@/components/ui';
import { TextField } from '@/components/text-field';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signup({ name, email, password });
      // Signup doesn't log the user in (no tokens issued) — /auth/signup
      // and /auth/login are separate concerns. Send them to log in with
      // their new credentials.
      router.push('/login');
    } catch (err) {
      if (err instanceof ApiError) {
        // class-validator errors arrive as an array of messages (one per
        // failed rule); a ConflictException (duplicate email) arrives as
        // a single string. Handle both shapes.
        const message = Array.isArray(err.body?.message)
          ? err.body.message.join(', ')
          : (err.body?.message ?? 'Signup failed.');
        setError(message);
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
          Create your account
        </h1>
        <p className="mt-2 text-center text-sm text-muted">
          Free, and your first submission takes under a minute.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-4 rounded-xl border border-border bg-surface p-6 shadow-sm"
        >
          {error && <Alert>{error}</Alert>}

          <TextField
            id="name"
            label="Name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
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
            minLength={8}
            autoComplete="new-password"
            hint="At least 8 characters."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" disabled={loading} className="mt-2 w-full">
            {loading && <Spinner className="h-4 w-4" />}
            {loading ? 'Creating account…' : 'Sign up'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
