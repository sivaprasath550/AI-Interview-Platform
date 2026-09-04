import Link from 'next/link';
import { Logo } from '@/components/ui';

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-faint sm:flex-row sm:px-8">
        <Logo showWordmark={false} className="opacity-70" />
        <p>
          A portfolio project — auth, sandboxed execution, and async grading,
          built for real.
        </p>
        <div className="flex items-center gap-5">
          <Link href="/problems" className="hover:text-text">
            Problems
          </Link>
          <a
            href="https://github.com/sivaprasath550/AI-Interview-Platform"
            target="_blank"
            rel="noreferrer"
            className="hover:text-text"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
