import { apiFetch } from './client';

// Mirrors the backend SubmissionStatus enum. `pending` and `running` are
// the non-terminal states we keep polling through; the other three are
// final.
export type SubmissionStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'error';

export const TERMINAL_STATUSES: SubmissionStatus[] = [
  'passed',
  'failed',
  'error',
];

export interface Submission {
  id: string;
  problemId: string;
  language: 'python';
  status: SubmissionStatus;
  runtimeMs: number | null;
  createdAt: string;
  updatedAt: string;
}

// POST returns 202 with just the id + initial status — the grading
// result isn't ready yet, so the caller polls getSubmission(id) until the
// status is terminal.
export function createSubmission(payload: {
  problemId: string;
  code: string;
  language: 'python';
}) {
  return apiFetch<{ id: string; status: SubmissionStatus }>('/submissions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getSubmission(id: string) {
  return apiFetch<Submission>(`/submissions/${id}`);
}
