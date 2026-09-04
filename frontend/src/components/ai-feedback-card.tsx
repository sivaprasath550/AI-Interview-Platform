'use client';

import { useMutation } from '@tanstack/react-query';
import { getSubmissionFeedback, type SubmissionFeedback } from '@/lib/api/ai';
import { ApiError } from '@/lib/api/client';
import { Button, Spinner } from '@/components/ui';

// On-demand AI code review for a graded submission. The backend caches
// the result on the submission row, so re-opening a problem and asking
// again is free — but we still gate it behind a click so we never spend
// a token the user didn't ask for.
export function AiFeedbackCard({ submissionId }: { submissionId: string }) {
  const mutation = useMutation<SubmissionFeedback, unknown, void>({
    mutationFn: () => getSubmissionFeedback(submissionId),
  });

  const fb = mutation.data;

  return (
    <div className="mt-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SparkIcon className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-text">AI code review</h3>
        </div>
        {!fb && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Spinner className="h-3.5 w-3.5" />}
            {mutation.isPending ? 'Reviewing…' : 'Review my solution'}
          </Button>
        )}
      </div>

      {mutation.isError && (
        <p className="mt-3 text-sm text-danger">
          {mutation.error instanceof ApiError &&
          mutation.error.status === 429
            ? 'Too many AI requests — wait a moment and try again.'
            : 'Could not generate feedback. Try again.'}
        </p>
      )}

      {fb && (
        <div className="mt-4 space-y-4 text-sm">
          <Row label="Verdict">{fb.verdict_summary}</Row>
          <Row label="Correctness">{fb.correctness}</Row>
          <Row label="Complexity">
            <span className="font-mono text-[13px] text-text">
              time {fb.complexity.time} · space {fb.complexity.space}
            </span>
            <span className="mt-1 block text-muted">
              {fb.complexity.comment}
            </span>
          </Row>
          <Row label="Style">{fb.style}</Row>
          <Row label="Suggestions">
            <ul className="list-disc space-y-1 pl-4 text-muted">
              {fb.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </Row>
          {fb.improved_approach && (
            <Row label="Better approach">{fb.improved_approach}</Row>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:gap-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-faint">
        {label}
      </span>
      <div className="text-muted">{children}</div>
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
