'use client';

import Link from 'next/link';
import { useAuthStore } from '@/store/auth-store';
import { buttonClass } from '@/components/ui';

export default function Home() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="overflow-hidden">
      {/* ---------------------------------------------------------- Hero */}
      <section className="relative">
        <div
          aria-hidden
          className="bg-grid mask-fade pointer-events-none absolute inset-0 -z-10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-10rem] -z-10 h-[26rem] w-[46rem] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
          style={{
            background:
              'radial-gradient(closest-side, var(--accent), transparent)',
          }}
        />

        <div className="mx-auto max-w-4xl px-5 pb-16 pt-20 text-center sm:px-8 sm:pb-24 sm:pt-28">
          <span className="animate-rise inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Sandboxed Python execution · async grading
          </span>

          <h1
            className="animate-rise mt-6 text-4xl font-semibold leading-[1.08] tracking-tight text-balance text-text sm:text-[3.5rem]"
            style={{ animationDelay: '40ms' }}
          >
            Practice coding interviews that actually{' '}
            <span className="text-accent">run your code</span>.
          </h1>

          <p
            className="animate-rise mx-auto mt-5 max-w-xl text-base text-pretty text-muted sm:text-lg"
            style={{ animationDelay: '80ms' }}
          >
            Curated problems, hidden test cases, and a real execution
            sandbox. Submit a solution and get a verdict in seconds — no
            hand-waving.
          </p>

          <div
            className="animate-rise mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: '120ms' }}
          >
            {user ? (
              <Link
                href="/problems"
                className={buttonClass({ size: 'lg', className: 'w-full sm:w-auto' })}
              >
                Continue practicing
              </Link>
            ) : (
              <>
                <Link
                  href="/signup"
                  className={buttonClass({
                    size: 'lg',
                    className: 'w-full sm:w-auto',
                  })}
                >
                  Get started — it&apos;s free
                </Link>
                <Link
                  href="/problems"
                  className={buttonClass({
                    variant: 'secondary',
                    size: 'lg',
                    className: 'w-full sm:w-auto',
                  })}
                >
                  Browse problems
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Faux editor window */}
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <div
            className="animate-rise overflow-hidden rounded-xl border border-border-strong bg-[#0d0d12] shadow-lg"
            style={{ animationDelay: '160ms' }}
          >
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
              <span className="ml-3 font-mono text-xs text-zinc-500">
                sum_of_two_integers.py
              </span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-6 text-zinc-300">
              <code>
                <span className="text-zinc-600">1  </span>
                <span className="text-violet-400">import</span> sys{'\n'}
                <span className="text-zinc-600">2  </span>
                {'\n'}
                <span className="text-zinc-600">3  </span>a, b ={' '}
                <span className="text-sky-300">map</span>(
                <span className="text-sky-300">int</span>, sys.stdin.read().
                <span className="text-sky-300">split</span>()){'\n'}
                <span className="text-zinc-600">4  </span>
                <span className="text-sky-300">print</span>(a + b){'\n'}
              </code>
            </pre>
            <div className="flex items-center gap-2 border-t border-white/10 px-5 py-3 font-mono text-[13px]">
              <span className="h-2 w-2 rounded-full bg-[#28c840]" />
              <span className="text-[#28c840]">Accepted</span>
              <span className="text-zinc-500">· 4 / 4 tests passed · 41 ms</span>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ Features */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              title: 'Runs for real',
              body: 'Each submission executes in an isolated, network-disabled container with CPU, memory, and time limits — graded against tests you never see.',
            },
            {
              title: 'Curated problems',
              body: 'A hand-picked set, tagged by difficulty, with worked examples so you always know the expected input and output shape.',
            },
            {
              title: 'Instant verdicts',
              body: 'Submissions are queued and graded out of band; the UI polls live and shows Accepted, Wrong Answer, or Runtime Error with timing.',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border bg-surface p-5 shadow-sm"
            >
              <h3 className="text-[15px] font-semibold text-text">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- How it works */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-text">
            Three steps to a verdict
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              ['01', 'Pick a problem', 'Filter by difficulty and open one that looks worth your time.'],
              ['02', 'Write your solution', 'Read from stdin, print to stdout, in the in-browser editor.'],
              ['03', 'Submit & watch', 'The worker grades every test case and the result streams back.'],
            ].map(([n, title, body]) => (
              <div key={n} className="text-center">
                <span className="font-mono text-sm font-semibold text-accent">
                  {n}
                </span>
                <h3 className="mt-2 text-[15px] font-semibold text-text">
                  {title}
                </h3>
                <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- Final CTA */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-border-strong bg-surface px-6 py-12 text-center shadow-md sm:py-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 opacity-30 blur-2xl"
            style={{
              background:
                'radial-gradient(closest-side, var(--accent), transparent)',
            }}
          />
          <h2 className="text-2xl font-semibold tracking-tight text-balance text-text sm:text-3xl">
            Ready to stop guessing whether your code works?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted sm:text-base">
            Create an account and make your first submission in under a minute.
          </p>
          <div className="mt-7 flex justify-center">
            <Link
              href={user ? '/problems' : '/signup'}
              className={buttonClass({ size: 'lg' })}
            >
              {user ? 'Go to problems' : 'Create your account'}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
