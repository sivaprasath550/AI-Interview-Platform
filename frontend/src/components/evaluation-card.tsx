import {
  RECOMMENDATION_LABEL,
  type InterviewEvaluation,
} from '@/lib/api/interviews';
import { cn } from '@/lib/cn';

const POSITIVE: InterviewEvaluation['recommendation'][] = [
  'lean_yes',
  'yes',
  'strong_yes',
];

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted">{label}</span>
        <span className="font-mono text-faint">{value}/5</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${(value / 5) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function EvaluationCard({
  evaluation,
}: {
  evaluation: InterviewEvaluation;
}) {
  const positive = POSITIVE.includes(evaluation.recommendation);
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text">Evaluation</h3>
        <span
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold',
            positive
              ? 'bg-success-bg text-success'
              : 'bg-danger-bg text-danger',
          )}
        >
          {RECOMMENDATION_LABEL[evaluation.recommendation]} · {evaluation.overall}
          /5
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted">
        {evaluation.summary}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <ScoreBar
          label="Problem solving"
          value={evaluation.scores.problem_solving}
        />
        <ScoreBar
          label="Communication"
          value={evaluation.scores.communication}
        />
        <ScoreBar
          label="Technical depth"
          value={evaluation.scores.technical_depth}
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-success">
            Strengths
          </h4>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm text-muted">
            {evaluation.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-warning">
            Areas to improve
          </h4>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm text-muted">
            {evaluation.areas_to_improve.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
