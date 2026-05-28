'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

const NAV = [
  { href: '/dashboard',            label: 'Overview',  icon: '⬡' },
  { href: '/dashboard/workouts',   label: 'Workouts',  icon: '⚡' },
  { href: '/dashboard/nutrition',  label: 'Nutrition', icon: '◈' },
  { href: '/dashboard/sleep',      label: 'Sleep',     icon: '🌙' },
  { href: '/dashboard/profile',    label: 'Profile',   icon: '◎' },
];

export default function DashboardLayout({ children }) {
  const { isAuthenticated, loading, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login');
  }, [isAuthenticated, loading, router]);

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 hidden md:flex flex-col border-r border-white/8 bg-[#0d0d14] p-6">
        <div className="flex items-center gap-2 mb-10">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-sm text-cyan-400 font-medium tracking-widest uppercase">FitTrack</span>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV.map(({ href, label, icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="text-base">{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/8 pt-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center text-xs font-bold text-black">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full text-left text-xs text-slate-500 hover:text-red-400 transition-colors py-1 px-1"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/8 bg-[#0d0d14]">
          <span className="text-sm text-cyan-400 font-medium tracking-widest uppercase">FitTrack</span>
          <button onClick={logout} className="text-xs text-slate-500">Sign out</button>
        </div>

        <main className="flex-1 overflow-auto p-6 md:p-8">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden flex border-t border-white/8 bg-[#0d0d14]">
          {NAV.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center py-3 text-xs gap-1 transition-colors ${
                pathname === href ? 'text-cyan-400' : 'text-slate-500'
              }`}
            >
              <span className="text-lg leading-none">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
