'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  endInterview,
  getInterview,
  sendInterviewMessage,
  INTERVIEW_TYPE_LABEL,
  type Interview,
  type InterviewMessage,
} from '@/lib/api/interviews';
import { ApiError } from '@/lib/api/client';
import { Alert, Button, Spinner } from '@/components/ui';
import { ChatMessage } from '@/components/chat-message';
import { EvaluationCard } from '@/components/evaluation-card';

export default function InterviewRoomPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const key = ['interview', id];

  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => getInterview(id),
  });

  const [input, setInput] = useState('');
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ended = data?.status === 'ended';
  const isCoding = data?.type === 'coding';

  // Keep the transcript pinned to the latest turn.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [data?.messages.length]);

  const sendMutation = useMutation({
    mutationFn: () =>
      sendInterviewMessage(id, {
        content: input.trim(),
        code: isCoding && showCode && code.trim() ? code : undefined,
      }),
    // Optimistically show the candidate's turn so the UI doesn't feel
    // frozen while the model thinks. Snapshot for rollback on error.
    onMutate: () => {
      const previous = queryClient.getQueryData<Interview>(key);
      const candidateTurn: InterviewMessage = {
        role: 'candidate',
        content:
          isCoding && showCode && code.trim()
            ? `${input.trim()}\n\n\`\`\`python\n${code}\n\`\`\``
            : input.trim(),
        at: new Date().toISOString(),
      };
      queryClient.setQueryData<Interview>(key, (old) =>
        old
          ? { ...old, messages: [...old.messages, candidateTurn] }
          : old,
      );
      setInput('');
      return { previous };
    },
    onSuccess: (res) => {
      queryClient.setQueryData<Interview>(key, (old) =>
        old ? { ...old, messages: [...old.messages, res.message] } : old,
      );
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
  });

  const endMutation = useMutation({
    mutationFn: () => endInterview(id),
    onSuccess: (evaluation) => {
      queryClient.setQueryData<Interview>(key, (old) =>
        old ? { ...old, status: 'ended', evaluation } : old,
      );
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || sendMutation.isPending || ended) return;
    sendMutation.mutate();
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-12 text-sm text-muted sm:px-8">
        Loading interview…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
        <Alert>This interview could not be found.</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-5 py-8 sm:px-8">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/interviews"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="m15 6-6 6 6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          All interviews
        </Link>
        <span className="text-xs font-semibold uppercase tracking-wide text-faint">
          {INTERVIEW_TYPE_LABEL[data.type]}
          {data.problemSlug ? ` · ${data.problemSlug}` : ''}
        </span>
      </div>

      {/* Transcript */}
      <div
        ref={scrollRef}
        className="scroll-thin mt-5 max-h-[58vh] space-y-3 overflow-y-auto rounded-xl border border-border bg-bg p-4"
      >
        {data.messages.map((m, i) => (
          <ChatMessage key={i} role={m.role} content={m.content} />
        ))}
        {sendMutation.isPending && (
          <div className="flex items-center gap-2 px-2 text-xs text-faint">
            <Spinner className="h-3.5 w-3.5" /> interviewer is typing…
          </div>
        )}
      </div>

      {/* Composer or ended state */}
      {ended ? (
        <div className="mt-5 space-y-4">
          {data.evaluation ? (
            <EvaluationCard evaluation={data.evaluation} />
          ) : (
            <Alert tone="info">
              This interview has ended without a stored evaluation.
            </Alert>
          )}
          <Link
            href="/interviews"
            className="inline-block text-sm font-medium text-accent hover:underline"
          >
            Start another →
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4">
          {isCoding && (
            <div className="mb-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCode((v) => !v)}
                className="text-xs font-medium text-accent hover:underline"
              >
                {showCode ? 'Hide code editor' : 'Attach code'}
              </button>
            </div>
          )}
          {isCoding && showCode && (
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              rows={8}
              placeholder="# paste or write your code here — it's sent with your next message"
              className="scroll-thin mb-2 block w-full resize-y rounded-lg border border-border-strong bg-[#0d0d12] p-3 font-mono text-[13px] leading-6 text-zinc-100 outline-none placeholder:text-zinc-600"
            />
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              rows={2}
              placeholder="Type your response…  (Enter to send, Shift+Enter for a new line)"
              className="scroll-thin block flex-1 resize-y rounded-lg border border-border-strong bg-bg p-3 text-sm text-text outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
            <Button type="submit" disabled={sendMutation.isPending || !input.trim()}>
              Send
            </Button>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => endMutation.mutate()}
              disabled={endMutation.isPending}
            >
              {endMutation.isPending && <Spinner className="h-3.5 w-3.5" />}
              {endMutation.isPending ? 'Scoring…' : 'End & get evaluation'}
            </Button>
            {(sendMutation.isError || endMutation.isError) && (
              <span className="text-sm text-danger">
                {sendMutation.error instanceof ApiError &&
                sendMutation.error.status === 429
                  ? 'Rate limit — wait a moment.'
                  : 'Something went wrong. Try again.'}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
