'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

export default function HomePage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated) router.push('/dashboard');
  }, [isAuthenticated, loading, router]);

  if (loading) return null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4">
      {/* Background orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 text-center max-w-3xl">
        {/* Logo */}
        <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full glass">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-sm text-cyan-400 font-medium tracking-widest uppercase">FitTrack</span>
        </div>

        <h1 className="text-6xl sm:text-7xl font-bold mb-6 leading-tight">
          Build Your
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-200">
            Best Self
          </span>
        </h1>

        <p className="text-lg text-slate-400 mb-12 leading-relaxed max-w-xl mx-auto">
          Track workouts, monitor nutrition, and watch your progress unfold.
          Your fitness journey, beautifully organised.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/auth/register"
            className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all duration-200 hover:scale-105"
          >
            Start for Free
          </Link>
          <Link
            href="/auth/login"
            className="px-8 py-4 glass hover:bg-white/10 font-semibold rounded-xl transition-all duration-200"
          >
            Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}
