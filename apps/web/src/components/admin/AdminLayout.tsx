'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { useRouter } from 'next/navigation';

type NavItem = { href: string; label: string; icon: string };

const navItems: NavItem[] = [
  { href: '/admin/transactions', label: 'Transactions', icon: '💳' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/compliance', label: 'Compliance', icon: '🛡️' },
  { href: '/admin/fx', label: 'FX Rates', icon: '💱' },
  { href: '/admin/metrics', label: 'Metrics', icon: '📊' },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, user } = useAuthStore();

  async function handleSignOut() {
    await signOut();
    router.push('/auth/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="sticky top-0 z-10 bg-brand-700 text-white">
        <div className="mx-auto max-w-7xl px-4 flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/transactions" className="text-xl font-bold text-white">
              AfriSend
            </Link>
            <span className="text-xs font-semibold bg-gold-400 text-gray-900 rounded px-2 py-0.5">
              ADMIN
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-brand-100 hidden sm:block">
              {user?.firstName} {user?.lastName}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-sm text-brand-200 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl flex">
        {/* Sidebar nav (desktop) */}
        <nav className="hidden md:flex flex-col w-56 min-h-screen pt-6 pr-4 border-r border-gray-200 bg-white">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors mx-2',
                pathname === item.href || pathname.startsWith(item.href + '/')
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-100',
              ].join(' ')}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Main content */}
        <main className="flex-1 px-4 py-6 min-h-screen">{children}</main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={[
              'flex-1 flex flex-col items-center py-2 text-xs transition-colors',
              pathname === item.href || pathname.startsWith(item.href + '/')
                ? 'text-brand-600'
                : 'text-gray-500',
            ].join(' ')}
          >
            <span className="text-xl">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
