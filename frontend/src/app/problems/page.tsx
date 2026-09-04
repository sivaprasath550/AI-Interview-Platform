'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listProblems, type Difficulty } from '@/lib/api/problems';
import { generateProblem } from '@/lib/api/ai';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth-store';
import { Alert, Button, DifficultyBadge, Skeleton, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';

const FILTERS: { label: string; value: Difficulty | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Easy', value: 'easy' },
  { label: 'Medium', value: 'medium' },
  { label: 'Hard', value: 'hard' },
];

export default function ProblemsPage() {
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>();

  // queryKey includes `difficulty` — React Query treats each distinct
  // key as its own cache entry, so switching filters is just a different
  // cached (or freshly fetched) result, not a manual refetch.
  const { data, isLoading, error } = useQuery({
    queryKey: ['problems', difficulty],
    queryFn: () => listProblems({ difficulty }),
  });

  const problems = data?.data ?? [];
  const user = useAuthStore((s) => s.user);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">
            Problems
          </h1>
          <p className="mt-1 text-sm text-muted">
            {data
              ? `${data.pagination.total} problem${
                  data.pagination.total === 1 ? '' : 's'
                } available`
              : 'Pick one and start solving.'}
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-border bg-surface p-1 shadow-sm">
          {FILTERS.map((f) => {
            const active = difficulty === f.value;
            return (
              <button
                key={f.label}
                onClick={() => setDifficulty(f.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                  active
                    ? 'bg-accent text-accent-fg shadow-sm'
                    : 'text-muted hover:text-text',
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </header>

      {user && <GenerateProblemPanel />}

      <div className="mt-6">
        {error && (
          <Alert>Couldn&apos;t load problems. Is the API running?</Alert>
        )}

        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-13 w-full" />
            ))}
          </div>
        )}

        {!isLoading && !error && problems.length === 0 && (
          <div className="rounded-xl border border-border bg-surface p-10 text-center">
            <p className="text-sm text-muted">
              No problems match this filter yet.
            </p>
          </div>
        )}

        {!isLoading && problems.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            {problems.map((problem, i) => (
              <li key={problem.id}>
                <Link
                  href={`/problems/${problem.slug}`}
                  className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2"
                >
                  <span className="w-6 shrink-0 text-right font-mono text-xs text-faint">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-sm font-medium text-text">
                    {problem.title}
                  </span>
                  <DifficultyBadge difficulty={problem.difficulty} />
                  <svg
                    className="h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-muted"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="m9 6 6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Collapsible "generate with AI" panel. On success the backend has
// already verified the new problem's reference solution against its own
// tests in the sandbox, so we can safely send the user straight to it.
function GenerateProblemPanel() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [gDifficulty, setGDifficulty] = useState<Difficulty>('easy');
  const [topic, setTopic] = useState('');

  const mutation = useMutation({
    mutationFn: () => generateProblem({ difficulty: gDifficulty, topic: topic || undefined }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['problems'] });
      router.push(`/problems/${created.slug}`);
    },
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-5 inline-flex items-center gap-2 rounded-lg border border-dashed border-border-strong bg-surface px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
      >
        <SparkIcon className="h-4 w-4" />
        Generate a new problem with AI
      </button>
    );
  }

  return (
    <div className="mt-5 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <SparkIcon className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-semibold text-text">Generate a problem</h3>
      </div>
      <p className="mt-1 text-xs text-muted">
        The model writes the problem, a reference solution, and test cases;
        we run the reference solution in the sandbox before saving it.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-muted">
          Difficulty
          <select
            value={gDifficulty}
            onChange={(e) => setGDifficulty(e.target.value as Difficulty)}
            className="mt-1 block h-9 rounded-lg border border-border-strong bg-bg px-2 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label className="flex-1 text-xs font-medium text-muted">
          Topic (optional)
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. hash maps, two pointers, recursion"
            className="mt-1 block h-9 w-full rounded-lg border border-border-strong bg-bg px-3 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </label>
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          {mutation.isPending && <Spinner className="h-4 w-4" />}
          {mutation.isPending ? 'Generating…' : 'Generate'}
        </Button>
        <button
          onClick={() => setOpen(false)}
          disabled={mutation.isPending}
          className="text-sm text-muted hover:text-text"
        >
          Cancel
        </button>
      </div>

      {mutation.isError && (
        <p className="mt-3 text-sm text-danger">
          {mutation.error instanceof ApiError && mutation.error.status === 429
            ? 'Too many AI requests — wait a moment.'
            : mutation.error instanceof ApiError &&
                mutation.error.status === 422
              ? "Couldn't produce a verifiable problem — try again or tweak the topic."
              : 'Generation failed. Try again.'}
        </p>
      )}
    </div>
  );
}

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v4m0 10v4m9-9h-4M7 12H3m14.5-6.5-2.8 2.8M9.3 14.7l-2.8 2.8m11 0-2.8-2.8M9.3 9.3 6.5 6.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
