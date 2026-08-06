import { apiFetch } from './client';

export type Difficulty = 'easy' | 'medium' | 'hard';

interface ProblemSummary {
  id: string;
  title: string;
  slug: string;
  difficulty: Difficulty;
  createdAt: string;
}

interface ProblemDetail extends ProblemSummary {
  description: string;
  testCases: { id: string; input: string; expectedOutput: string }[];
}

interface ListProblemsResponse {
  data: ProblemSummary[];
  pagination: { page: number; limit: number; total: number };
}

export function listProblems(params: { difficulty?: Difficulty } = {}) {
  const search = new URLSearchParams();
  if (params.difficulty) search.set('difficulty', params.difficulty);
  const query = search.toString();
  return apiFetch<ListProblemsResponse>(`/problems${query ? `?${query}` : ''}`);
}

export function getProblem(slug: string) {
  return apiFetch<ProblemDetail>(`/problems/${slug}`);
}
