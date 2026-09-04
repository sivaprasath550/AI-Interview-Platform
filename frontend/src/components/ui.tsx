import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/* ---------------------------------------------------------------- Button */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50 select-none';

const BUTTON_VARIANT: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-fg shadow-sm hover:bg-accent-hover active:translate-y-px',
  secondary:
    'border border-border-strong bg-surface text-text shadow-sm hover:bg-surface-2 active:translate-y-px',
  ghost: 'text-muted hover:bg-surface-2 hover:text-text',
  danger: 'bg-danger text-white shadow-sm hover:opacity-90 active:translate-y-px',
};

const BUTTON_SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-[15px]',
};

export function buttonClass(opts?: {
  variant?: Variant;
  size?: Size;
  className?: string;
}): string {
  return cn(
    BUTTON_BASE,
    BUTTON_VARIANT[opts?.variant ?? 'primary'],
    BUTTON_SIZE[opts?.size ?? 'md'],
    opts?.className,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return <button className={buttonClass({ variant, size, className })} {...props} />;
}

/* ------------------------------------------------------------------ Logo */

export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight text-text',
        className,
      )}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect width="24" height="24" rx="6.5" fill="var(--accent)" />
        <path
          d="M10 8 6.5 12 10 16M14 8l3.5 4L14 16"
          stroke="#fff"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showWordmark && (
        <span>
          Interview<span className="text-accent">Lab</span>
        </span>
      )}
    </span>
  );
}

/* --------------------------------------------------------------- Spinner */

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ----------------------------------------------------- Difficulty badge */

type Difficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTY_CLASS: Record<Difficulty, string> = {
  easy: 'bg-easy-bg text-easy',
  medium: 'bg-medium-bg text-medium',
  hard: 'bg-hard-bg text-hard',
};

export function DifficultyBadge({
  difficulty,
  className,
}: {
  difficulty: Difficulty;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold capitalize',
        DIFFICULTY_CLASS[difficulty],
        className,
      )}
    >
      {difficulty}
    </span>
  );
}

/* -------------------------------------------------- Submission status pill */

type SubmissionStatus = 'pending' | 'running' | 'passed' | 'failed' | 'error';

const STATUS_META: Record<
  SubmissionStatus,
  { label: string; dot: string; text: string; bg: string }
> = {
  pending: {
    label: 'Queued',
    dot: 'bg-faint',
    text: 'text-muted',
    bg: 'bg-surface-2',
  },
  running: {
    label: 'Running',
    dot: 'bg-accent animate-pulse',
    text: 'text-accent',
    bg: 'bg-accent-subtle',
  },
  passed: {
    label: 'Accepted',
    dot: 'bg-success',
    text: 'text-success',
    bg: 'bg-success-bg',
  },
  failed: {
    label: 'Wrong Answer',
    dot: 'bg-danger',
    text: 'text-danger',
    bg: 'bg-danger-bg',
  },
  error: {
    label: 'Runtime Error',
    dot: 'bg-warning',
    text: 'text-warning',
    bg: 'bg-warning-bg',
  },
};

export function StatusPill({
  status,
  trailing,
  className,
}: {
  status: SubmissionStatus;
  trailing?: ReactNode;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-semibold',
        meta.bg,
        meta.text,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
      {trailing != null && (
        <span className="font-medium opacity-70">· {trailing}</span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ Alert */

export function Alert({
  tone = 'danger',
  children,
  className,
}: {
  tone?: 'danger' | 'info';
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-lg border px-3.5 py-2.5 text-sm',
        tone === 'danger'
          ? 'border-danger/30 bg-danger-bg text-danger'
          : 'border-border bg-surface-2 text-muted',
        className,
      )}
    >
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- Skeleton */

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-surface-2',
        className,
      )}
      {...props}
    />
  );
}
