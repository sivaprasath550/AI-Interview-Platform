'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { listProblems, type Difficulty } from '@/lib/api/problems';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export default function ProblemsPage() {
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>();

  // queryKey includes `difficulty` — React Query treats each distinct
  // key as its own cache entry, so switching filters is just a
  // different cached (or freshly fetched) result, not a manual refetch
  // we have to wire up ourselves.
  const { data, isLoading, error } = useQuery({
    queryKey: ['problems', difficulty],
    queryFn: () => listProblems({ difficulty }),
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Problems</h1>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setDifficulty(undefined)}
          className={`rounded px-3 py-1 text-sm ${
            !difficulty ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          All
        </button>
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            onClick={() => setDifficulty(d)}
            className={`rounded px-3 py-1 text-sm capitalize ${
              difficulty === d
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-gray-500">Loading...</p>}
      {error && <p className="text-red-600">Failed to load problems.</p>}

      <ul className="divide-y divide-gray-200 rounded border border-gray-200 bg-white">
        {data?.data.map((problem) => (
          <li key={problem.id}>
            <Link
              href={`/problems/${problem.slug}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <span className="font-medium text-gray-900">
                {problem.title}
              </span>
              <span className="text-sm capitalize text-gray-500">
                {problem.difficulty}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
