'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getProblem } from '@/lib/api/problems';

export default function ProblemDetailPage() {
  // useParams() (a client-side hook from next/navigation) — NOT the
  // same as a Server Component's `params` prop, which Next.js 16 made
  // async (must be awaited). This hook runs in the browser and stays
  // synchronous; the async-params change only affects Server
  // Components reading route params directly.
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['problem', slug],
    queryFn: () => getProblem(slug),
  });

  if (isLoading) {
    return <main className="p-12 text-gray-500">Loading...</main>;
  }

  if (error || !data) {
    return <main className="p-12 text-red-600">Problem not found.</main>;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-2 flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">
          {data.title}
        </h1>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-sm capitalize text-gray-600">
          {data.difficulty}
        </span>
      </div>
      <p className="mb-6 whitespace-pre-wrap text-gray-700">
        {data.description}
      </p>

      <h2 className="mb-2 text-lg font-medium text-gray-900">Examples</h2>
      <ul className="space-y-3">
        {data.testCases.map((tc) => (
          <li
            key={tc.id}
            className="rounded border border-gray-200 bg-white p-3 text-sm"
          >
            <div>
              <span className="font-medium">Input:</span> {tc.input}
            </div>
            <div>
              <span className="font-medium">Output:</span>{' '}
              {tc.expectedOutput}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
