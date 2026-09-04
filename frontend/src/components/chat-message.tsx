import { cn } from '@/lib/cn';

// Splits a message on triple-backtick fences and renders code blocks in a
// monospace panel, prose as paragraphs. Deliberately tiny — the
// interviewer model is told to keep turns short, so we don't need a full
// markdown engine.
function renderContent(text: string) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const body = part.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '');
      return (
        <pre
          key={i}
          className="scroll-thin my-2 overflow-x-auto rounded-lg bg-[#0d0d12] p-3 font-mono text-[12.5px] leading-6 text-zinc-100"
        >
          <code>{body}</code>
        </pre>
      );
    }
    return (
      <span key={i} className="whitespace-pre-wrap">
        {part}
      </span>
    );
  });
}

export function ChatMessage({
  role,
  content,
}: {
  role: 'interviewer' | 'candidate';
  content: string;
}) {
  const isInterviewer = role === 'interviewer';
  return (
    <div
      className={cn(
        'flex',
        isInterviewer ? 'justify-start' : 'justify-end',
      )}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isInterviewer
            ? 'rounded-tl-sm bg-surface-2 text-text'
            : 'rounded-tr-sm bg-accent text-accent-fg',
        )}
      >
        <span
          className={cn(
            'mb-1 block text-[11px] font-semibold uppercase tracking-wide',
            isInterviewer ? 'text-faint' : 'text-accent-fg/70',
          )}
        >
          {isInterviewer ? 'Interviewer' : 'You'}
        </span>
        {renderContent(content)}
      </div>
    </div>
  );
}
