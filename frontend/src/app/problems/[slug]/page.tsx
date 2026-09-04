'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getProblem } from '@/lib/api/problems';
import {
  createSubmission,
  getSubmission,
  TERMINAL_STATUSES,
} from '@/lib/api/submissions';
import { useAuthStore } from '@/store/auth-store';
import {
  Alert,
  Button,
  DifficultyBadge,
  Skeleton,
  Spinner,
  StatusPill,
} from '@/components/ui';
import { HintsPanel } from '@/components/hints-panel';
import { AiFeedbackCard } from '@/components/ai-feedback-card';

// Renders plain problem text, styling `backtick`-wrapped spans as inline
// code. Cheap markdown-lite — the seed descriptions only use backticks.
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((part, i) =>
        part.startsWith('`') && part.endsWith('`') ? (
          <code
            key={i}
            className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.85em] text-text"
          >
            {part.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

// A minimal stdin -> stdout starter so a first-time user isn't staring at
// an empty box wondering how input arrives.
const STARTER_CODE = `import sys

data = sys.stdin.read().strip()

# Write your solution here.
print(data)
`;

export default function ProblemDetailPage() {
  // useParams() (a client-side hook from next/navigation) — NOT the same
  // as a Server Component's `params` prop, which Next.js 16 made async.
  // This hook runs in the browser and stays synchronous.
  const { slug } = useParams<{ slug: string }>();
  const user = useAuthStore((state) => state.user);

  const [code, setCode] = useState(STARTER_CODE);
  // The id of the submission we're currently tracking. null = nothing
  // submitted yet this session.
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['problem', slug],
    queryFn: () => getProblem(slug),
  });

  // Polling: once we have a submissionId, refetch on an interval until
  // the status is terminal. `refetchInterval` returning false stops the
  // polling — here, the moment grading finishes.
  const { data: submission } = useQuery({
    queryKey: ['submission', submissionId],
    queryFn: () => getSubmission(submissionId as string),
    enabled: submissionId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && TERMINAL_STATUSES.includes(status)) return false;
      return 1000;
    },
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      createSubmission({ problemId: data!.id, code, language: 'python' }),
    onSuccess: (res) => setSubmissionId(res.id),
  });

  const isGrading =
    submitMutation.isPending ||
    (submission != null && !TERMINAL_STATUSES.includes(submission.status));

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <Link
        href="/problems"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-text"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="m15 6-6 6 6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        All problems
      </Link>

      {isLoading && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      )}

      {(error || (!isLoading && !data)) && (
        <Alert className="mt-6">This problem could not be found.</Alert>
      )}

      {data && (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
          {/* -------------------------------------------- Problem panel */}
          <article className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-text">
                {data.title}
              </h1>
              <DifficultyBadge difficulty={data.difficulty} />
            </div>

            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted">
              <RichText text={data.description} />
            </p>

            <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-faint">
              Examples
            </h2>
            {data.testCases.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                No sample cases provided for this problem.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {data.testCases.map((tc) => (
                  <li
                    key={tc.id}
                    className="rounded-lg border border-border bg-bg p-3.5"
                  >
                    <div className="font-mono text-[13px] leading-6">
                      <div>
                        <span className="text-faint">input </span>
                        <span className="text-text">{tc.input}</span>
                      </div>
                      <div>
                        <span className="text-faint">output</span>{' '}
                        <span className="text-text">{tc.expectedOutput}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>

          {/* --------------------------------------------- Editor panel */}
          <section className="lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-xl border border-border-strong bg-[#0d0d12] shadow-md">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </div>
                <span className="font-mono text-xs text-zinc-500">
                  solution.py · Python 3
                </span>
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
                rows={16}
                aria-label="Solution code"
                className="scroll-thin block w-full resize-y bg-transparent p-4 font-mono text-[13px] leading-6 text-zinc-100 outline-none placeholder:text-zinc-600"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {user ? (
                <Button
                  onClick={() => submitMutation.mutate()}
                  disabled={isGrading}
                >
                  {isGrading && <Spinner className="h-4 w-4" />}
                  {isGrading ? 'Grading…' : 'Submit solution'}
                </Button>
              ) : (
                <p className="text-sm text-muted">
                  <Link
                    href="/login"
                    className="font-medium text-accent hover:underline"
                  >
                    Log in
                  </Link>{' '}
                  to submit a solution.
                </p>
              )}

              {submission && (
                <StatusPill
                  status={submission.status}
                  trailing={
                    submission.status === 'passed' &&
                    submission.runtimeMs != null
                      ? `${submission.runtimeMs} ms`
                      : undefined
                  }
                />
              )}
            </div>

            {submitMutation.isError && (
              <Alert className="mt-3">
                Could not submit. Please try again.
              </Alert>
            )}

            {submission?.status === 'failed' && (
              <p className="mt-3 text-sm text-muted">
                Your output didn&apos;t match on at least one test case
                (including hidden ones).
              </p>
            )}
            {submission?.status === 'error' && (
              <p className="mt-3 text-sm text-muted">
                Your code raised an error or timed out during execution.
              </p>
            )}

            {submission &&
              TERMINAL_STATUSES.includes(submission.status) && (
                <AiFeedbackCard
                  key={submission.id}
                  submissionId={submission.id}
                />
              )}

            <div className="mt-4">
              <HintsPanel slug={slug} code={code} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
