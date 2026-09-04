import { apiFetch } from './client';
import type { Difficulty } from './problems';

// Shape of the cached AI code-review stored on a submission.
export interface SubmissionFeedback {
  verdict_summary: string;
  correctness: string;
  complexity: { time: string; space: string; comment: string };
  style: string;
  suggestions: string[];
  improved_approach: string;
}

export function getSubmissionFeedback(submissionId: string) {
  return apiFetch<{ feedback: SubmissionFeedback }>(
    `/submissions/${submissionId}/feedback`,
    { method: 'POST' },
  ).then((r) => r.feedback);
}

export function getHint(
  slug: string,
  level: 1 | 2 | 3,
  code?: string,
) {
  return apiFetch<{ level: number; hint: string }>(
    `/problems/${slug}/hint`,
    { method: 'POST', body: JSON.stringify({ level, code }) },
  );
}

export function generateProblem(payload: {
  difficulty: Difficulty;
  topic?: string;
}) {
  return apiFetch<{
    id: string;
    slug: string;
    title: string;
    difficulty: Difficulty;
  }>('/problems/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
