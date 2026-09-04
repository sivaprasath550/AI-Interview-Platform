import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function TextField({
  id,
  label,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      <input
        id={id}
        className={cn(
          'h-10 w-full rounded-lg border border-border-strong bg-bg px-3 text-sm text-text outline-none transition-shadow placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/30',
          className,
        )}
        {...props}
      />
      {hint && <p className="text-xs text-faint">{hint}</p>}
    </div>
  );
}
