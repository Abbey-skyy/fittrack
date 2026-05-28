'use client';

import { useAuth } from '@/hooks/useAuth';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import StatCard from '@/components/ui/StatCard';
import Link from 'next/link';

function WorkoutBadge({ type }) {
  const map = {
    strength: 'bg-orange-500/15 text-orange-400',
    cardio: 'bg-cyan-500/15 text-cyan-400',
    hiit: 'bg-red-500/15 text-red-400',
    yoga: 'bg-purple-500/15 text-purple-400',
    mixed: 'bg-green-500/15 text-green-400',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[type] || 'bg-slate-500/15 text-slate-400'}`}>
      {type}
    </span>
  );
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useDashboardStats();

  const stats = data?.stats || {};
  const weekly = data?.weekly || {};
  const recentWorkouts = data?.recentWorkouts || [];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">
          {greeting}, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-400 text-sm">Here's your fitness overview</p>
      </div>

      {/* Stats grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass rounded-2xl p-5 h-32 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Workouts" value={stats.totalWorkouts || 0} icon="⚡" color="cyan" />
          <StatCard label="Calories Burned" value={stats.totalCaloriesBurned ? Math.round(stats.totalCaloriesBurned).toLocaleString() : 0} unit="kcal" icon="🔥" color="orange" />
          <StatCard label="Current Streak" value={stats.currentStreak || 0} unit="days" icon="🎯" color="green" />
          <StatCard label="This Week" value={weekly.workouts || 0} unit="sessions" icon="📅" color="purple" />
        </div>
      )}

      {/* Weekly summary + Recent workouts */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Weekly summary card */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold mb-4 text-sm uppercase tracking-wider text-slate-400">This Week</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400">Workouts</span>
                <span className="font-medium">{weekly.workouts || 0} / 5</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 rounded-full transition-all"
                  style={{ width: `${Math.min(((weekly.workouts || 0) / 5) * 100, 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400">Duration</span>
                <span className="font-medium">{weekly.duration || 0} min</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full transition-all"
                  style={{ width: `${Math.min(((weekly.duration || 0) / 300) * 100, 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400">Calories</span>
                <span className="font-medium">{weekly.calories || 0} kcal</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${Math.min(((weekly.calories || 0) / 2000) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Recent workouts */}
        <div className="glass rounded-2xl p-6 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm uppercase tracking-wider text-slate-400">Recent Workouts</h2>
            <Link href="/dashboard/workouts" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
              View all →
            </Link>
          </div>

          {recentWorkouts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="text-3xl mb-3">🏋️</span>
              <p className="text-slate-400 text-sm mb-4">No workouts yet</p>
              <Link
                href="/dashboard/workouts"
                className="px-4 py-2 bg-cyan-500/15 text-cyan-400 rounded-lg text-sm font-medium hover:bg-cyan-500/25 transition-colors"
              >
                Log your first workout
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentWorkouts.map((w) => (
                <div key={w._id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-lg flex-shrink-0">
                    {w.type === 'cardio' ? '🏃' : w.type === 'strength' ? '🏋️' : '⚡'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{w.title}</p>
                    <p className="text-xs text-slate-500">{formatDate(w.date)} · {w.duration} min</p>
                  </div>
                  <WorkoutBadge type={w.type} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
