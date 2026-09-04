'use client';

import { useState } from 'react';
import { getHint } from '@/lib/api/ai';
import { ApiError } from '@/lib/api/client';
import { Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';

const LEVELS = [
  { n: 1 as const, label: 'Nudge', hint: 'A conceptual pointer, no approach' },
  { n: 2 as const, label: 'Approach', hint: 'The data structure / algorithm' },
  { n: 3 as const, label: 'Outline', hint: 'Step-by-step, still not full code' },
];

// Progressive hints. Each level unlocks only after the previous one is
// revealed, so a user has to actually engage before escalating. The
// backend prompt guarantees level 3 still stops short of a full solution.
export function HintsPanel({ slug, code }: { slug: string; code: string }) {
  const [revealed, setRevealed] = useState<Record<1 | 2 | 3, string>>(
    {} as Record<1 | 2 | 3, string>,
  );
  const [loading, setLoading] = useState<1 | 2 | 3 | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reveal(level: 1 | 2 | 3) {
    setError(null);
    setLoading(level);
    try {
      const res = await getHint(slug, level, code);
      setRevealed((r) => ({ ...r, [level]: res.hint }));
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? 'Too many AI requests — wait a moment.'
          : 'Could not fetch a hint. Try again.',
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <SparkIcon className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-semibold text-text">Stuck? Get a hint</h3>
      </div>

      <div className="mt-3 space-y-2">
        {LEVELS.map(({ n, label, hint }) => {
          const unlocked = n === 1 || revealed[(n - 1) as 1 | 2 | 3] != null;
          const shown = revealed[n];
          return (
            <div
              key={n}
              className="rounded-lg border border-border bg-bg p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-medium text-text">
                    {n}. {label}
                  </span>
                  <span className="ml-2 text-xs text-faint">{hint}</span>
                </div>
                {!shown && (
                  <button
                    onClick={() => reveal(n)}
                    disabled={!unlocked || loading != null}
                    className={cn(
                      'shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                      unlocked
                        ? 'bg-accent-subtle text-accent hover:bg-accent hover:text-accent-fg'
                        : 'cursor-not-allowed bg-surface-2 text-faint',
                    )}
                  >
                    {loading === n ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : unlocked ? (
                      'Reveal'
                    ) : (
                      'Locked'
                    )}
                  </button>
                )}
              </div>
              {shown && (
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {shown}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
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
