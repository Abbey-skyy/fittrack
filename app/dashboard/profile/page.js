'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '@/hooks/useAuth';
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line,
  PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

const FITNESS_GOALS   = ['weight_loss', 'muscle_gain', 'endurance', 'maintenance', 'general_fitness'];
const ACTIVITY_LEVELS = ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active'];

const GOAL_LABELS = {
  weight_loss:     'Weight Loss',
  muscle_gain:     'Muscle Gain',
  endurance:       'Endurance',
  maintenance:     'Maintenance',
  general_fitness: 'General Fitness',
};

const STATUS_STYLES = {
  good:    { bg: 'bg-green-500/10',  border: 'border-green-500/30',  text: 'text-green-400',  dot: 'bg-green-400'  },
  warning: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  alert:   { bg: 'bg-red-500/10',    border: 'border-red-500/30',    text: 'text-red-400',    dot: 'bg-red-400'    },
};

const TYPE_COLORS = ['#f97316', '#22d3ee', '#ef4444', '#a855f7', '#22c55e', '#64748b'];

// ─── Circular progress ring ────────────────────────────────────────────────
function Ring({ value = 0, color, size = 96, stroke = 9, label, sublabel }) {
  const r   = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const off  = circ - (Math.min(value, 100) / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
            strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={off}
            style={{ transition: 'stroke-dashoffset 1.2s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold leading-none" style={{ color }}>{value}%</span>
        </div>
      </div>
      <p className="text-xs font-medium text-slate-300 text-center">{label}</p>
      {sublabel && <p className="text-xs text-slate-600 text-center -mt-1">{sublabel}</p>}
    </div>
  );
}

// ─── Section card ──────────────────────────────────────────────────────────
function Card({ children, className = '' }) {
  return <div className={`glass rounded-2xl p-5 ${className}`}>{children}</div>;
}
function CardTitle({ children }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">{children}</h3>;
}

// ─── Custom tooltip ────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs border border-white/10 shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <span className="font-semibold">{p.value}{p.unit || ''}</span></p>
      ))}
    </div>
  );
}

// ─── Empty chart placeholder ───────────────────────────────────────────────
function EmptyChart({ message }) {
  return (
    <div className="flex items-center justify-center h-[180px] rounded-xl border border-dashed border-white/10">
      <p className="text-xs text-slate-600 text-center px-4">{message}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard tab
// ═══════════════════════════════════════════════════════════════════════════
function DashboardTab({ user }) {
  const { data, isLoading } = useQuery({
    queryKey: ['user-progress'],
    queryFn:  () => axios.get('/api/user/progress').then((r) => r.data.data),
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="glass rounded-2xl h-40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { last7days, avgMacros, weekSummary, scores, currentState } = data;
  // Assign fill colours here (UI concern) so no Cell children needed
  const workoutTypes = (data.workoutTypes || []).map((t, i) => ({ ...t, fill: TYPE_COLORS[i % TYPE_COLORS.length] }));
  const liveUser = data.user;
  const status   = STATUS_STYLES[currentState.status] || STATUS_STYLES.warning;

  // Has any logged data?
  const hasWorkoutData  = last7days.some((d) => d.hasWorkout);
  const hasNutritionData = last7days.some((d) => d.hasNutrition);
  const hasSleepData    = last7days.some((d) => d.hasSleep);

  // Macro pie data
  const macroPie = [
    { name: 'Protein', value: avgMacros.protein, fill: '#22d3ee' },
    { name: 'Carbs',   value: avgMacros.carbs,   fill: '#eab308' },
    { name: 'Fat',     value: avgMacros.fat,      fill: '#a855f7' },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-5">

      {/* ── Current State hero ── */}
      <div className={`rounded-2xl p-5 border ${status.bg} ${status.border}`}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center text-xl font-bold text-black flex-shrink-0">
            {(liveUser?.name || user?.name || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="font-bold text-lg leading-tight">{liveUser?.name || user?.name}</p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                {GOAL_LABELS[liveUser?.profile?.fitnessGoal] || 'General Fitness'}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status.dot}`} />
              <span className={`text-sm font-semibold ${status.text}`}>{currentState.label}</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{currentState.description}</p>
          </div>
        </div>
      </div>

      {/* ── Week summary stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Workouts',       value: weekSummary.workouts,          unit: 'this week', color: 'text-cyan-400'   },
          { label: 'Calories Burned',value: weekSummary.caloriesBurned.toLocaleString(), unit: 'kcal',      color: 'text-orange-400' },
          { label: 'Avg Sleep',      value: `${weekSummary.avgSleep}h`,    unit: 'per night', color: 'text-purple-400' },
          { label: 'Avg Calories',   value: weekSummary.avgCalories || '—', unit: 'kcal/day', color: 'text-yellow-400' },
        ].map(({ label, value, unit, color }) => (
          <Card key={label} className="text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            <p className="text-xs text-slate-700">{unit}</p>
          </Card>
        ))}
      </div>

      {/* ── Progress toward goal (rings) ── */}
      <Card>
        <CardTitle>Progress Towards Goal · This Week</CardTitle>
        <div className="flex flex-wrap justify-around gap-6 py-2">
          <Ring value={scores.activity}  color="#22d3ee" label="Activity"  sublabel={`${weekSummary.workouts} workout${weekSummary.workouts !== 1 ? 's' : ''}`} />
          <Ring value={scores.nutrition} color="#f97316" label="Nutrition" sublabel={hasNutritionData ? 'Logged' : 'Not tracked'} />
          <Ring value={scores.recovery}  color="#a855f7" label="Recovery"  sublabel={`${weekSummary.avgSleep}h avg sleep`} />
          <Ring value={scores.overall}   color="#22c55e" size={104} stroke={10} label="Overall Score" sublabel="Weighted" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: 'Activity',  score: scores.activity,  hint: 'Based on workouts logged vs weekly target' },
            { label: 'Nutrition', score: scores.nutrition, hint: 'Protein/deficit based on your goal' },
            { label: 'Recovery',  score: scores.recovery,  hint: 'Average sleep hours vs 8h target' },
          ].map(({ label, score, hint }) => (
            <div key={label} className="bg-white/3 rounded-xl p-3">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-slate-400">{label}</span>
                <span className="text-xs font-bold">{score}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-1.5">
                <div className="h-full bg-cyan-500 rounded-full transition-all duration-700" style={{ width: `${score}%` }} />
              </div>
              <p className="text-xs text-slate-600 leading-tight">{hint}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Calories burned chart ── */}
      <Card>
        <CardTitle>Calories Burned · Last 7 Days</CardTitle>
        {hasWorkoutData ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={last7days} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: 8 }} />
              <Bar dataKey="caloriesBurned" name="Calories Burned" fill="#f97316" radius={[4, 4, 0, 0]} unit=" kcal" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="No workouts logged this week. Start logging to see your calories burned chart." />
        )}
      </Card>

      {/* ── Calorie intake vs burned ── */}
      <Card>
        <CardTitle>Calorie Balance · Last 7 Days</CardTitle>
        {(hasWorkoutData || hasNutritionData) ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={last7days} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gConsumed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22d3ee" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}   />
                </linearGradient>
                <linearGradient id="gBurned" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ stroke: 'rgba(255,255,255,0.08)' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: 8 }} />
              <Area type="monotone" dataKey="caloriesConsumed" name="Calories Consumed" stroke="#22d3ee" fill="url(#gConsumed)" strokeWidth={2} dot={false} unit=" kcal" />
              <Area type="monotone" dataKey="caloriesBurned"   name="Calories Burned"   stroke="#f97316" fill="url(#gBurned)"   strokeWidth={2} dot={false} unit=" kcal" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="Log workouts and nutrition to see your calorie balance chart." />
        )}
      </Card>

      {/* ── Sleep chart ── */}
      <Card>
        <CardTitle>Sleep Hours · Last 7 Days</CardTitle>
        {hasSleepData ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={last7days.map((d) => ({
                ...d,
                fill: d.sleepHours >= 7 && d.sleepHours <= 9 ? '#a855f7'
                    : d.sleepHours >= 6 ? '#f97316'
                    : d.sleepHours > 0  ? '#ef4444'
                    : '#1e293b',
              }))}
              margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 12]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: 8 }} />
              <ReferenceLine y={8} stroke="#22c55e" strokeDasharray="4 4" label={{ value: '8h goal', fill: '#22c55e', fontSize: 10, position: 'insideTopRight' }} />
              <Bar dataKey="sleepHours" name="Sleep Hours" radius={[4, 4, 0, 0]} unit="h" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="No sleep logged this week. Use the Sleep section to track your rest." />
        )}
      </Card>

      {/* ── Macros + Workout types row ── */}
      <div className="grid md:grid-cols-2 gap-5">

        {/* Macro distribution */}
        <Card>
          <CardTitle>Macro Distribution · 7-Day Avg</CardTitle>
          {macroPie.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={macroPie} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                    paddingAngle={3} dataKey="value" nameKey="name" stroke="none">
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v}g`, n]} contentStyle={{ background: '#0d0d14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 flex-1">
                {macroPie.map(({ name, value, fill }) => (
                  <div key={name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">{name}</span>
                      <span className="font-semibold" style={{ color: fill }}>{value}g/day</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / Math.max(...macroPie.map(m => m.value))) * 100)}%`, background: fill }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyChart message="Log your meals in the Nutrition section to see your macro breakdown." />
          )}
        </Card>

        {/* Workout type breakdown */}
        <Card>
          <CardTitle>Workout Types · This Week</CardTitle>
          {workoutTypes.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={workoutTypes} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                    paddingAngle={3} dataKey="value" nameKey="name" stroke="none">
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v} session${v > 1 ? 's' : ''}`, n]} contentStyle={{ background: '#0d0d14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2.5 flex-1">
                {workoutTypes.map(({ name, value, fill }) => (
                  <div key={name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: fill }} />
                    <span className="text-xs text-slate-300 flex-1">{name}</span>
                    <span className="text-xs font-semibold" style={{ color: fill }}>{value}×</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyChart message="No workouts logged this week. Start training to see your type breakdown." />
          )}
        </Card>
      </div>

      {/* ── Workout duration trend ── */}
      {hasWorkoutData && (
        <Card>
          <CardTitle>Workout Duration · Last 7 Days (minutes)</CardTitle>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={last7days} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: 8 }} />
              <Line type="monotone" dataKey="workoutMinutes" name="Minutes" stroke="#22d3ee" strokeWidth={2}
                dot={{ fill: '#22d3ee', strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} unit=" min" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ── All-time stats ── */}
      <Card>
        <CardTitle>All-Time Stats</CardTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Workouts',   value: liveUser?.stats?.totalWorkouts || 0,                                    unit: 'sessions', color: 'text-cyan-400'   },
            { label: 'Calories Burned',  value: Math.round(liveUser?.stats?.totalCaloriesBurned || 0).toLocaleString(), unit: 'kcal',     color: 'text-orange-400' },
            { label: 'Best Streak',      value: `${liveUser?.stats?.longestStreak || 0}`,                               unit: 'days',     color: 'text-green-400'  },
            { label: 'Current Streak',   value: `${liveUser?.stats?.currentStreak || 0}`,                               unit: 'days',     color: 'text-yellow-400' },
          ].map(({ label, value, unit, color }) => (
            <div key={label} className="text-center py-2">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-xs text-slate-700">{unit}</p>
            </div>
          ))}
        </div>
      </Card>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Edit Profile tab (existing form, unchanged logic)
// ═══════════════════════════════════════════════════════════════════════════
function EditProfileTab({ user, updateUser }) {
  const [form, setForm] = useState({
    name: user?.name || '',
    profile: {
      age:           user?.profile?.age           || '',
      weight:        user?.profile?.weight        || '',
      height:        user?.profile?.height        || '',
      fitnessGoal:   user?.profile?.fitnessGoal   || 'general_fitness',
      activityLevel: user?.profile?.activityLevel || 'moderately_active',
    },
  });
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await axios.put('/api/user', payload);
      return data.data;
    },
    onSuccess: (updated) => {
      updateUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const setProfile = (field) => (e) =>
    setForm((f) => ({ ...f, profile: { ...f.profile, [field]: e.target.value } }));

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate({
      name: form.name,
      profile: {
        ...form.profile,
        age:    Number(form.profile.age)    || undefined,
        weight: Number(form.profile.weight) || undefined,
        height: Number(form.profile.height) || undefined,
      },
    });
  };

  const inp = 'w-full px-4 py-2.5 rounded-xl bg-[#1a1a24] border border-white/10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 transition-all';

  return (
    <div className="glass rounded-2xl p-6">
      <h2 className="font-semibold mb-5">Edit Profile</h2>

      {mutation.isError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {mutation.error?.response?.data?.error || 'Something went wrong'}
        </div>
      )}
      {saved && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
          Profile updated successfully ✓
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">Full Name</label>
          <input className={inp} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Age',         field: 'age',    placeholder: '25'  },
            { label: 'Weight (kg)', field: 'weight', placeholder: '70'  },
            { label: 'Height (cm)', field: 'height', placeholder: '175' },
          ].map(({ label, field, placeholder }) => (
            <div key={field}>
              <label className="block text-sm text-slate-400 mb-1.5">{label}</label>
              <input className={inp} type="number" placeholder={placeholder}
                value={form.profile[field]} onChange={setProfile(field)} min="1" />
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1.5">Fitness Goal</label>
          <select className={inp} value={form.profile.fitnessGoal} onChange={setProfile('fitnessGoal')}>
            {FITNESS_GOALS.map((g) => (
              <option key={g} value={g} className="bg-[#1a1a24]">{GOAL_LABELS[g]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1.5">Activity Level</label>
          <select className={inp} value={form.profile.activityLevel} onChange={setProfile('activityLevel')}>
            {ACTIVITY_LEVELS.map((l) => (
              <option key={l} value={l} className="bg-[#1a1a24]">{l.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={mutation.isPending}
          className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-bold rounded-xl transition-all">
          {mutation.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Page root
// ═══════════════════════════════════════════════════════════════════════════
export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const [tab, setTab] = useState('dashboard');

  // Always fetch fresh user data on mount
  const { data: freshUser } = useQuery({
    queryKey: ['user'],
    queryFn:  () => axios.get('/api/user').then((r) => r.data.data),
    staleTime: 0,
  });
  useEffect(() => { if (freshUser) updateUser(freshUser); }, [freshUser, updateUser]);

  const liveUser = freshUser || user;

  return (
    <div className="max-w-3xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center text-xl font-bold text-black flex-shrink-0">
          {liveUser?.name?.[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-xl truncate">{liveUser?.name}</p>
          <p className="text-slate-400 text-sm">{liveUser?.email}</p>
          <p className="text-xs text-slate-600 capitalize mt-0.5">
            {GOAL_LABELS[liveUser?.profile?.fitnessGoal] || 'General Fitness'}
            {liveUser?.profile?.weight ? ` · ${liveUser.profile.weight}kg` : ''}
            {liveUser?.profile?.height ? ` · ${liveUser.profile.height}cm` : ''}
          </p>
        </div>
        <button onClick={logout}
          className="px-4 py-2 border border-red-500/30 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/10 transition-colors">
          Sign Out
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 glass rounded-xl mb-6">
        {[
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'edit',      label: 'Edit Profile' },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'dashboard'
        ? <DashboardTab user={liveUser} />
        : <EditProfileTab user={liveUser} updateUser={updateUser} />
      }
    </div>
  );
}
