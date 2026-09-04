'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { logout } from '@/lib/api/auth';
import { buttonClass, Logo } from '@/components/ui';
import { cn } from '@/lib/cn';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const navLinks = [
    { href: '/problems', label: 'Problems' },
    { href: '/interviews', label: 'Mock Interview' },
  ];

  async function handleLogout() {
    await logout();
    router.push('/');
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <div className="flex items-center gap-7">
          <Link href="/" className="shrink-0" aria-label="InterviewLab home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {navLinks.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-surface-2 text-text'
                      : 'text-muted hover:bg-surface-2 hover:text-text',
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {user ? (
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2.5 sm:flex">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-fg">
                {initials(user.name)}
              </span>
              <span className="max-w-[12ch] truncate text-sm font-medium text-text">
                {user.name}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className={buttonClass({ variant: 'secondary', size: 'sm' })}
            >
              Log out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className={buttonClass({ variant: 'ghost', size: 'sm' })}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className={buttonClass({ variant: 'primary', size: 'sm' })}
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
