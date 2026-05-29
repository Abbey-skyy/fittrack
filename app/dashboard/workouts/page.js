'use client';

import { useState, useRef } from 'react';
import { useWorkouts, useCreateWorkout, useDeleteWorkout } from '@/hooks/useWorkouts';
import { useAuth } from '@/hooks/useAuth';

const WORKOUT_TYPES      = ['strength', 'cardio', 'hiit', 'yoga', 'mixed', 'other'];
const EXERCISE_CATEGORIES = ['strength', 'cardio', 'flexibility', 'balance', 'sports'];

const TYPE_COLORS = {
  strength: { border: 'border-orange-500/40', badge: 'bg-orange-500/15 text-orange-400' },
  cardio:   { border: 'border-cyan-500/40',   badge: 'bg-cyan-500/15   text-cyan-400'   },
  hiit:     { border: 'border-red-500/40',    badge: 'bg-red-500/15    text-red-400'    },
  yoga:     { border: 'border-purple-500/40', badge: 'bg-purple-500/15 text-purple-400' },
  mixed:    { border: 'border-green-500/40',  badge: 'bg-green-500/15  text-green-400'  },
  other:    { border: 'border-slate-500/40',  badge: 'bg-slate-500/15  text-slate-400'  },
};

const MOOD_ICONS = { great: '😄', good: '🙂', okay: '😐', tired: '😴', bad: '😞' };

// ─── Shared AI advice renderer (same format as nutrition/sleep) ───────────────
function AdviceSection({ text }) {
  if (!text) return null;
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {text.split('\n').map((line, i) => {
        const t = line.trim();
        if (!t) return null;
        if (/^(OVERVIEW|STRENGTHS|AREAS TO IMPROVE|NEXT WEEK'S PLAN)$/i.test(t)) {
          return (
            <h4 key={i} className="text-orange-400 font-semibold uppercase tracking-wide text-xs mt-4 first:mt-0">
              {t}
            </h4>
          );
        }
        if (t.startsWith('•')) {
          return (
            <div key={i} className="flex gap-2 text-slate-300">
              <span className="text-orange-500 mt-0.5 shrink-0">•</span>
              <span>{t.slice(1).trim()}</span>
            </div>
          );
        }
        return <p key={i} className="text-slate-300">{t}</p>;
      })}
    </div>
  );
}

// ─── Workout card ─────────────────────────────────────────────────────────────
function WorkoutCard({ workout, onDelete }) {
  const colors = TYPE_COLORS[workout.type] || TYPE_COLORS.other;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`glass rounded-2xl p-5 border-l-2 ${colors.border} hover:bg-white/[0.06] transition-colors`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate mb-1">{workout.title}</h3>
          <p className="text-xs text-slate-500">
            {new Date(workout.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
        </div>
        <button
          onClick={() => onDelete(workout._id)}
          className="text-slate-600 hover:text-red-400 transition-colors ml-2 p-1 shrink-0"
          aria-label="Delete workout"
        >✕</button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${colors.badge}`}>
          {workout.type}
        </span>
        <span className="text-xs text-slate-400">⏱ {workout.duration} min</span>
        {workout.totalCaloriesBurned > 0 && (
          <span className="text-xs text-slate-400">🔥 {workout.totalCaloriesBurned} kcal</span>
        )}
        {workout.mood && (
          <span className="text-xs">{MOOD_ICONS[workout.mood]} {workout.mood}</span>
        )}
      </div>

      {workout.exercises?.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-slate-500 hover:text-cyan-400 transition-colors"
          >
            {expanded ? '▲ Hide' : `▼ ${workout.exercises.length} exercise${workout.exercises.length > 1 ? 's' : ''}`}
          </button>
          {expanded && (
            <div className="mt-2 space-y-1">
              {workout.exercises.map((ex, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-slate-400 py-0.5">
                  <span className="capitalize">{ex.name}</span>
                  {ex.caloriesBurned > 0 && <span>{ex.caloriesBurned} kcal</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {workout.notes && (
        <p className="mt-2 text-xs text-slate-500 italic line-clamp-2">"{workout.notes}"</p>
      )}
    </div>
  );
}

// ─── Log workout modal ────────────────────────────────────────────────────────
function LogWorkoutModal({ onClose }) {
  const createWorkout = useCreateWorkout();
  const { user } = useAuth();

  const [form, setForm] = useState({
    title: '', type: 'strength', duration: '', mood: '', notes: '',
    exercises: [{ name: '', category: 'strength', caloriesBurned: '' }],
  });

  const [isLookingUp, setIsLookingUp]     = useState(false);
  const [lookupError, setLookupError]     = useState('');
  const [estimatedTotal, setEstimatedTotal] = useState(null);

  const setField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const addExercise = () =>
    setForm((f) => ({ ...f, exercises: [...f.exercises, { name: '', category: 'strength', caloriesBurned: '' }] }));
  const removeExercise = (i) =>
    setForm((f) => ({ ...f, exercises: f.exercises.filter((_, idx) => idx !== i) }));
  const setExercise = (i, field) => (e) =>
    setForm((f) => {
      const exs = [...f.exercises];
      exs[i] = { ...exs[i], [field]: e.target.value };
      return { ...f, exercises: exs };
    });

  const handleCalorieLookup = async () => {
    if (!form.duration) { setLookupError('Enter duration first.'); return; }
    setIsLookingUp(true);
    setLookupError('');
    setEstimatedTotal(null);
    try {
      const filtered = form.exercises.filter((ex) => ex.name.trim());
      const { data } = await axios.post('/api/workouts/calories', {
        title:      form.title,
        type:       form.type,
        duration:   Number(form.duration),
        exercises:  filtered.map((ex) => ({ name: ex.name, category: ex.category })),
        userWeight: user?.profile?.weight,
      });
      const result = data.data;
      // Auto-fill each exercise's kcal field
      setForm((f) => ({
        ...f,
        exercises: f.exercises.map((ex) => {
          const match = result.exercises?.find(
            (e) => e.name.toLowerCase().includes(ex.name.toLowerCase()) ||
                   ex.name.toLowerCase().includes(e.name.toLowerCase())
          );
          return match ? { ...ex, caloriesBurned: String(match.calories) } : ex;
        }),
      }));
      setEstimatedTotal(result.totalCalories);
    } catch (err) {
      setLookupError(err.response?.data?.error || 'Could not estimate calories. Try again.');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const filtered = form.exercises.filter((ex) => ex.name.trim());
    if (filtered.length === 0) return alert('Add at least one exercise name.');
    const payload = {
      ...form,
      duration:  Number(form.duration),
      exercises: filtered.map((ex) => ({ ...ex, caloriesBurned: Number(ex.caloriesBurned) || 0 })),
    };
    await createWorkout.mutateAsync(payload);
    onClose();
  };

  const inp = 'w-full px-3 py-2.5 rounded-lg bg-[#1a1a24] border border-white/10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 transition-all';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="glass rounded-2xl p-6 w-full max-w-lg my-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">Log Workout</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input className={inp} placeholder="Workout title (e.g. Morning Run, Push Day)" value={form.title} onChange={setField('title')} required />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Type</label>
              <select className={inp} value={form.type} onChange={setField('type')}>
                {WORKOUT_TYPES.map((t) => <option key={t} value={t} className="bg-[#1a1a24] capitalize">{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Duration (min)</label>
              <input className={inp} type="number" placeholder="45" value={form.duration} onChange={setField('duration')} required min="1" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">How did you feel?</label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(MOOD_ICONS).map(([mood, icon]) => (
                <button
                  key={mood}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, mood: f.mood === mood ? '' : mood }))}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                    form.mood === mood ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300' : 'glass text-slate-400 hover:text-white'
                  }`}
                >
                  {icon} {mood}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-500">Exercises</label>
              <button type="button" onClick={addExercise} className="text-xs text-cyan-400 hover:text-cyan-300">+ Add exercise</button>
            </div>
            <div className="space-y-2">
              {form.exercises.map((ex, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
                  <input className={inp} placeholder="Name" value={ex.name} onChange={setExercise(i, 'name')} />
                  <select className={inp} value={ex.category} onChange={setExercise(i, 'category')}>
                    {EXERCISE_CATEGORIES.map((c) => <option key={c} value={c} className="bg-[#1a1a24] capitalize">{c}</option>)}
                  </select>
                  <input className={`${inp} w-20`} type="number" placeholder="kcal" value={ex.caloriesBurned} onChange={setExercise(i, 'caloriesBurned')} min="0" />
                  {form.exercises.length > 1 && (
                    <button type="button" onClick={() => removeExercise(i)} className="text-slate-600 hover:text-red-400 transition-colors text-sm">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <textarea className={`${inp} resize-none`} rows={2} placeholder="Notes (optional)" value={form.notes} onChange={setField('notes')} />

          {/* ── FitAI Calorie Estimator ── */}
          <div className="rounded-xl bg-orange-500/5 border border-orange-500/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-0.5">✦ FitAI Calorie Estimator</p>
                <p className="text-xs text-slate-500">Let FitAI check calories you burned today</p>
              </div>
              <button
                type="button"
                onClick={handleCalorieLookup}
                disabled={isLookingUp || !form.duration}
                className="shrink-0 px-4 py-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold rounded-lg text-xs transition-all"
              >
                {isLookingUp ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Calculating…
                  </span>
                ) : 'LOOK UP'}
              </button>
            </div>
            {estimatedTotal !== null && (
              <p className="text-xs text-orange-300 mt-3 pt-3 border-t border-orange-500/15">
                ✓ Estimated <span className="font-bold">{estimatedTotal} kcal</span> burned — calories filled in above. You can adjust them manually.
              </p>
            )}
            {lookupError && (
              <p className="text-xs text-red-400 mt-2">{lookupError}</p>
            )}
          </div>

          {createWorkout.isError && (
            <p className="text-xs text-red-400">{createWorkout.error?.response?.data?.error || 'Failed to save'}</p>
          )}

          <button
            type="submit"
            disabled={createWorkout.isPending}
            className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-bold rounded-xl transition-all"
          >
            {createWorkout.isPending ? 'Saving…' : 'Save Workout'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function WorkoutsPage() {
  const { user }                       = useAuth();
  const [showModal, setShowModal]      = useState(false);
  const [typeFilter, setTypeFilter]    = useState('');
  const { data, isLoading }            = useWorkouts(typeFilter ? { type: typeFilter } : {});
  const deleteWorkout                  = useDeleteWorkout();

  // AI advisor state
  const [advice, setAdvice]            = useState('');
  const [isAdvising, setIsAdvising]    = useState(false);
  const [adviceError, setAdviceError]  = useState('');
  const adviceRef                      = useRef(null);

  const workouts = data?.workouts || [];

  // Weekly summary from first page of results
  const last7 = workouts.filter((w) => {
    const d = new Date(w.date);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return d >= cutoff;
  });
  const weekCals = last7.reduce((s, w) => s + (w.totalCaloriesBurned || 0), 0);
  const weekMins = last7.reduce((s, w) => s + (w.duration || 0), 0);

  const handleGetAdvice = async () => {
    setAdvice('');
    setAdviceError('');
    setIsAdvising(true);
    try {
      const res = await fetch('/api/workouts/advice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('fittrack_token')}`,
        },
        body: JSON.stringify({ userProfile: user }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to get advice');
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setAdvice(accumulated);
        adviceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch (err) {
      setAdviceError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsAdvising(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Workouts</h1>
          <p className="text-slate-400 text-sm">{data?.pagination?.total || 0} sessions logged</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all hover:scale-105 text-sm"
        >
          + Log Workout
        </button>
      </div>

      {/* ── This week summary ── */}
      {last7.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Sessions this week', value: last7.length,          unit: '',      color: 'text-cyan-400'   },
            { label: 'Active minutes',     value: weekMins,              unit: 'min',   color: 'text-orange-400' },
            { label: 'Calories burned',    value: weekCals.toLocaleString(), unit: 'kcal', color: 'text-red-400' },
          ].map(({ label, value, unit, color }) => (
            <div key={label} className="glass rounded-2xl p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}<span className="text-xs font-normal text-slate-500 ml-1">{unit}</span></p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Type filter ── */}
      <div className="flex gap-2 flex-wrap">
        {['', ...WORKOUT_TYPES].map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
              typeFilter === t
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'glass text-slate-400 hover:text-white'
            }`}
          >
            {t || 'All'}
          </button>
        ))}
      </div>

      {/* ── Workout list ── */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="glass rounded-2xl h-32 animate-pulse" />)}
        </div>
      ) : workouts.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <span className="text-5xl block mb-4">🏋️</span>
          <p className="text-slate-400 mb-6">No workouts logged yet</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-2.5 bg-cyan-500/15 text-cyan-400 rounded-xl text-sm font-medium hover:bg-cyan-500/25 transition-colors"
          >
            Log your first workout
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {workouts.map((w) => (
            <WorkoutCard key={w._id} workout={w} onDelete={(id) => deleteWorkout.mutate(id)} />
          ))}
        </div>
      )}

      {/* ── FitAI ── */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/30 to-red-500/30 border border-orange-500/20 flex items-center justify-center text-sm">
              ✦
            </div>
            <div>
              <h2 className="font-semibold">FitAI</h2>
            </div>
          </div>
          <button
            onClick={handleGetAdvice}
            disabled={isAdvising}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-400 hover:to-orange-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-xl text-sm transition-all hover:scale-105"
          >
            {isAdvising ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Analysing…
              </span>
            ) : 'Analyse My Training'}
          </button>
        </div>

        {!advice && !isAdvising && !adviceError && (
          <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
            <p className="text-slate-500 text-sm">
              Click <span className="text-orange-400 font-medium">Analyse My Training</span> to get personalised feedback on your workout patterns, recovery, and a plan for next week.
            </p>
          </div>
        )}

        {adviceError && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-red-400 text-sm">
            {adviceError.includes('ANTHROPIC_API_KEY') ? (
              <>
                <p className="font-semibold mb-1">API key not configured</p>
                <p>Add <code className="bg-white/10 px-1 rounded">ANTHROPIC_API_KEY=sk-ant-...</code> to your <code className="bg-white/10 px-1 rounded">.env.local</code> file.</p>
              </>
            ) : adviceError}
          </div>
        )}

        {(advice || isAdvising) && (
          <div className="rounded-xl bg-white/3 border border-white/8 p-5 min-h-[80px]">
            <AdviceSection text={advice} />
            {isAdvising && <span className="inline-block w-1.5 h-4 bg-orange-400 animate-pulse rounded-sm ml-0.5" />}
            <div ref={adviceRef} />
          </div>
        )}
      </div>

      {showModal && <LogWorkoutModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
