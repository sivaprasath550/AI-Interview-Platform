import { apiFetch } from './client';

export type InterviewType = 'coding' | 'behavioral' | 'system_design';
export type InterviewStatus = 'active' | 'ended';

export interface InterviewMessage {
  role: 'interviewer' | 'candidate';
  content: string;
  at: string;
}

export interface InterviewEvaluation {
  summary: string;
  strengths: string[];
  areas_to_improve: string[];
  scores: {
    problem_solving: number;
    communication: number;
    technical_depth: number;
  };
  overall: number;
  recommendation:
    | 'strong_no'
    | 'no'
    | 'lean_no'
    | 'lean_yes'
    | 'yes'
    | 'strong_yes';
}

export interface Interview {
  id: string;
  type: InterviewType;
  status: InterviewStatus;
  problemSlug: string | null;
  messages: InterviewMessage[];
  evaluation: InterviewEvaluation | null;
  createdAt: string;
  endedAt: string | null;
}

export interface InterviewSummary {
  id: string;
  type: InterviewType;
  status: InterviewStatus;
  turns: number;
  hasEvaluation: boolean;
  createdAt: string;
  endedAt: string | null;
}

export function startInterview(payload: {
  type: InterviewType;
  problemId?: string;
}) {
  return apiFetch<Interview>('/interviews', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listInterviews() {
  return apiFetch<InterviewSummary[]>('/interviews');
}

export function getInterview(id: string) {
  return apiFetch<Interview>(`/interviews/${id}`);
}

export function sendInterviewMessage(
  id: string,
  payload: { content: string; code?: string },
) {
  return apiFetch<{ message: InterviewMessage; turns: number }>(
    `/interviews/${id}/messages`,
    { method: 'POST', body: JSON.stringify(payload) },
  );
}

export function endInterview(id: string) {
  return apiFetch<{ evaluation: InterviewEvaluation }>(
    `/interviews/${id}/end`,
    { method: 'POST' },
  ).then((r) => r.evaluation);
}

export const INTERVIEW_TYPE_LABEL: Record<InterviewType, string> = {
  coding: 'Coding',
  behavioral: 'Behavioral',
  system_design: 'System Design',
};

export const RECOMMENDATION_LABEL: Record<
  InterviewEvaluation['recommendation'],
  string
> = {
  strong_no: 'Strong No',
  no: 'No',
  lean_no: 'Lean No',
  lean_yes: 'Lean Yes',
  yes: 'Yes',
  strong_yes: 'Strong Yes',
};
