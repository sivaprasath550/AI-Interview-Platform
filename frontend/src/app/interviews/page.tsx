'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  listInterviews,
  startInterview,
  INTERVIEW_TYPE_LABEL,
  type InterviewType,
} from '@/lib/api/interviews';
import { listProblems } from '@/lib/api/problems';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth-store';
import { Alert, Button, Skeleton, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';

const TYPES: { value: InterviewType; blurb: string }[] = [
  { value: 'coding', blurb: 'Solve a problem while explaining your approach.' },
  { value: 'behavioral', blurb: 'STAR-method questions about past experience.' },
  {
    value: 'system_design',
    blurb: 'Design a system end to end, discuss trade-offs.',
  },
];

export default function InterviewsPage() {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading, error } = useQuery({
    queryKey: ['interviews'],
    queryFn: listInterviews,
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center sm:px-8">
        <h1 className="text-2xl font-semibold tracking-tight text-text">
          Mock interviews
        </h1>
        <p className="mt-2 text-sm text-muted">
          <Link href="/login" className="font-medium text-accent hover:underline">
            Log in
          </Link>{' '}
          to run an AI-led mock interview.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
      <h1 className="text-2xl font-semibold tracking-tight text-text">
        Mock interviews
      </h1>
      <p className="mt-1 text-sm text-muted">
        An AI interviewer runs the session live, then scores you at the end.
      </p>

      <StartPanel />

      <h2 className="mt-10 text-sm font-semibold text-text">Past sessions</h2>
      <div className="mt-3">
        {error && <Alert>Couldn&apos;t load your interviews.</Alert>}
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}
        {data && data.length === 0 && (
          <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted">
            No sessions yet — start one above.
          </div>
        )}
        {data && data.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            {data.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/interviews/${s.id}`}
                  className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2"
                >
                  <span className="flex-1">
                    <span className="text-sm font-medium text-text">
                      {INTERVIEW_TYPE_LABEL[s.type]} interview
                    </span>
                    <span className="mt-0.5 block text-xs text-faint">
                      {new Date(s.createdAt).toLocaleString()} · {s.turns} turns
                    </span>
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      s.status === 'ended'
                        ? 'bg-surface-2 text-muted'
                        : 'bg-accent-subtle text-accent',
                    )}
                  >
                    {s.status === 'ended' ? 'Ended' : 'Active'}
                  </span>
                  {s.hasEvaluation && (
                    <span className="rounded-full bg-success-bg px-2 py-0.5 text-xs font-semibold text-success">
                      Scored
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StartPanel() {
  const router = useRouter();
  const [type, setType] = useState<InterviewType>('coding');
  const [problemId, setProblemId] = useState<string>('');

  // Only needed to populate the coding-problem dropdown.
  const { data: problems } = useQuery({
    queryKey: ['problems', undefined],
    queryFn: () => listProblems({}),
  });

  const mutation = useMutation({
    mutationFn: () =>
      startInterview({
        type,
        problemId: type === 'coding' && problemId ? problemId : undefined,
      }),
    onSuccess: (interview) => router.push(`/interviews/${interview.id}`),
  });

  return (
    <div className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-text">Start a new session</h2>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            className={cn(
              'rounded-lg border p-3 text-left transition-colors',
              type === t.value
                ? 'border-accent bg-accent-subtle'
                : 'border-border hover:border-border-strong',
            )}
          >
            <span className="block text-sm font-medium text-text">
              {INTERVIEW_TYPE_LABEL[t.value]}
            </span>
            <span className="mt-0.5 block text-xs text-muted">{t.blurb}</span>
          </button>
        ))}
      </div>

      {type === 'coding' && (
        <label className="mt-4 block text-xs font-medium text-muted">
          Problem (optional — the interviewer picks one if you don&apos;t)
          <select
            value={problemId}
            onChange={(e) => setProblemId(e.target.value)}
            className="mt-1 block h-9 w-full rounded-lg border border-border-strong bg-bg px-2 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          >
            <option value="">Let the interviewer choose</option>
            {problems?.data.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.difficulty})
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending && <Spinner className="h-4 w-4" />}
          {mutation.isPending ? 'Starting…' : 'Start interview'}
        </Button>
        {mutation.isError && (
          <span className="text-sm text-danger">
            {mutation.error instanceof ApiError &&
            mutation.error.status === 429
              ? 'Too many AI requests — wait a moment.'
              : 'Could not start. Try again.'}
          </span>
        )}
      </div>
    </div>
  );
}
