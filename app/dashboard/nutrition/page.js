'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '@/hooks/useAuth';

function today() {
  return new Date().toISOString().split('T')[0];
}

async function fetchNutrition(date) {
  const { data } = await axios.get('/api/nutrition', { params: { date } });
  return data.data;
}

async function saveNutrition(payload) {
  const { data } = await axios.post('/api/nutrition', payload);
  return data.data;
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'];

const EMPTY_FOOD = { name: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', servingSize: 100, quantity: 1 };

// ─── Macro progress bar ──────────────────────────────────────────────────────
function MacroBar({ label, value, goal, colorClass }) {
  const pct = goal ? Math.min((value / goal) * 100, 100) : 0;
  const over = goal && value > goal;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-slate-400 capitalize">{label}</span>
        <span className={`font-medium ${over ? 'text-red-400' : ''}`}>
          {Math.round(value)}g {goal && <span className="text-slate-500">/ {goal}g</span>}
        </span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-red-500' : colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── AI Advice renderer ───────────────────────────────────────────────────────
function AdviceSection({ text }) {
  if (!text) return null;
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {text.split('\n').map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        if (/^(OVERVIEW|WHAT YOU DID WELL|AREAS TO IMPROVE|TOMORROW'S TIPS)$/i.test(trimmed)) {
          return (
            <h4 key={i} className="text-cyan-400 font-semibold uppercase tracking-wide text-xs mt-4 first:mt-0">
              {trimmed}
            </h4>
          );
        }
        if (trimmed.startsWith('•')) {
          return (
            <div key={i} className="flex gap-2 text-slate-300">
              <span className="text-cyan-500 mt-0.5 shrink-0">•</span>
              <span>{trimmed.slice(1).trim()}</span>
            </div>
          );
        }
        return <p key={i} className="text-slate-300">{trimmed}</p>;
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function NutritionPage() {
  const { user } = useAuth();
  const [date, setDate] = useState(today());
  const [showAdd, setShowAdd] = useState(false);
  const [mealType, setMealType] = useState('breakfast');
  const [food, setFood] = useState(EMPTY_FOOD);
  const [lookupQuery, setLookupQuery] = useState('');
  const [isLooking, setIsLooking] = useState(false);
  const [lookupError, setLookupError] = useState('');

  // AI advisor state
  const [advice, setAdvice] = useState('');
  const [isAdvising, setIsAdvising] = useState(false);
  const [adviceError, setAdviceError] = useState('');
  const adviceRef = useRef(null);

  const qc = useQueryClient();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['nutrition', date],
    queryFn: () => fetchNutrition(date),
  });

  const log = logs[0] || null;

  // Daily totals
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  if (log?.meals) {
    log.meals.forEach((meal) =>
      meal.foods.forEach((f) => {
        const q = f.quantity || 1;
        totals.calories += (f.calories || 0) * q;
        totals.protein  += (f.protein  || 0) * q;
        totals.carbs    += (f.carbs    || 0) * q;
        totals.fat      += (f.fat      || 0) * q;
        totals.fiber    += (f.fiber    || 0) * q;
      })
    );
  }

  const mutation = useMutation({
    mutationFn: saveNutrition,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nutrition'] });
      qc.invalidateQueries({ queryKey: ['user-progress'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setShowAdd(false);
      setFood(EMPTY_FOOD);
      setLookupQuery('');
      setLookupError('');
    },
  });

  // ── AI: look up macros for a food ──
  const handleLookup = async () => {
    if (!lookupQuery.trim()) return;
    setIsLooking(true);
    setLookupError('');
    try {
      const { data } = await axios.post('/api/nutrition/lookup', {
        foodName: lookupQuery,
        servingSize: Number(food.servingSize) || 100,
        quantity: Number(food.quantity) || 1,
      });
      const n = data.data;
      setFood((f) => ({
        ...f,
        name: f.name || lookupQuery,
        calories: String(Math.round(n.calories || 0)),
        protein:  String(Math.round(n.protein  || 0)),
        carbs:    String(Math.round(n.carbs    || 0)),
        fat:      String(Math.round(n.fat      || 0)),
        fiber:    String(Math.round(n.fiber    || 0)),
      }));
    } catch (err) {
      setLookupError(err.response?.data?.error || 'Lookup failed — fill in macros manually.');
    } finally {
      setIsLooking(false);
    }
  };

  // ── AI: get nutrition advice ──
  const handleGetAdvice = async () => {
    setAdvice('');
    setAdviceError('');
    setIsAdvising(true);
    try {
      const res = await fetch('/api/nutrition/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('fittrack_token')}` },
        body: JSON.stringify({ totals, meals: log?.meals || [], date, userProfile: user }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to get advice');
      }

      const reader = res.body.getReader();
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

  // ── Add food submit ──
  const handleAddFood = (e) => {
    e.preventDefault();
    const existingMeals = log?.meals || [];
    const idx = existingMeals.findIndex((m) => m.name === mealType);
    const newFood = {
      name:        food.name,
      calories:    Number(food.calories),
      protein:     Number(food.protein),
      carbs:       Number(food.carbs),
      fat:         Number(food.fat),
      fiber:       Number(food.fiber),
      servingSize: Number(food.servingSize),
      quantity:    Number(food.quantity),
    };
    const meals = idx >= 0
      ? existingMeals.map((m, i) => i === idx ? { ...m, foods: [...m.foods, newFood] } : m)
      : [...existingMeals, { name: mealType, foods: [newFood] }];
    mutation.mutate({ date, meals });
  };

  const inp = 'w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-white/10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 transition-all';

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Nutrition</h1>
          <p className="text-slate-400 text-sm">Track your daily intake</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date" value={date}
            onChange={(e) => { setDate(e.target.value); setAdvice(''); }}
            className="px-3 py-2 glass rounded-lg text-sm border border-white/10 text-white bg-transparent focus:outline-none focus:border-cyan-500/60"
          />
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl text-sm transition-all hover:scale-105"
          >
            + Add Food
          </button>
        </div>
      </div>

      {/* ── Daily summary ── */}
      <div className="glass rounded-2xl p-6">
        <h2 className="font-semibold text-xs uppercase tracking-wider text-slate-400 mb-5">Daily Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Calories', value: Math.round(totals.calories), unit: 'kcal', color: 'text-orange-400' },
            { label: 'Protein',  value: Math.round(totals.protein),  unit: 'g',    color: 'text-cyan-400'   },
            { label: 'Carbs',    value: Math.round(totals.carbs),    unit: 'g',    color: 'text-yellow-400' },
            { label: 'Fat',      value: Math.round(totals.fat),      unit: 'g',    color: 'text-purple-400' },
            { label: 'Fiber',    value: Math.round(totals.fiber),    unit: 'g',    color: 'text-green-400'  },
          ].map(({ label, value, unit, color }) => (
            <div key={label} className="text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}<span className="text-xs font-normal text-slate-500 ml-0.5">{unit}</span></p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <MacroBar label="Protein" value={totals.protein} goal={150} colorClass="bg-cyan-500" />
          <MacroBar label="Carbs"   value={totals.carbs}   goal={250} colorClass="bg-yellow-500" />
          <MacroBar label="Fat"     value={totals.fat}     goal={70}  colorClass="bg-purple-500" />
        </div>
      </div>

      {/* ── Meals ── */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="glass rounded-2xl h-20 animate-pulse" />)}
        </div>
      ) : !log || log.meals?.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <span className="text-5xl block mb-4">🥗</span>
          <p className="text-slate-400 mb-4">No meals logged for this day</p>
          <button
            onClick={() => setShowAdd(true)}
            className="px-6 py-2.5 bg-cyan-500/15 text-cyan-400 rounded-xl text-sm font-medium hover:bg-cyan-500/25 transition-colors"
          >
            Log your first meal
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {log.meals.map((meal) => {
            const mealCals = meal.foods.reduce((s, f) => s + (f.calories || 0) * (f.quantity || 1), 0);
            return (
              <div key={meal._id || meal.name} className="glass rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold capitalize">{meal.name.replace('_', ' ')}</h3>
                  <span className="text-xs text-slate-500">{Math.round(mealCals)} kcal</span>
                </div>
                <div className="space-y-2">
                  {meal.foods.map((f, i) => {
                    const q = f.quantity || 1;
                    return (
                      <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-white/5 last:border-0">
                        <span className="text-slate-300">{f.name}</span>
                        <div className="flex gap-3 text-xs text-slate-500">
                          <span className="text-orange-400/80">{Math.round((f.calories || 0) * q)} kcal</span>
                          <span>{Math.round((f.protein || 0) * q)}g P</span>
                          <span>{Math.round((f.carbs || 0) * q)}g C</span>
                          <span>{Math.round((f.fat || 0) * q)}g F</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── FitAI ── */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/30 to-purple-500/30 border border-cyan-500/20 flex items-center justify-center text-sm">
              ✦
            </div>
            <div>
              <h2 className="font-semibold">FitAI</h2>
            </div>
          </div>
          <button
            onClick={handleGetAdvice}
            disabled={isAdvising}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-xl text-sm transition-all hover:scale-105"
          >
            {isAdvising ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Analysing…
              </span>
            ) : 'Analyse Today'}
          </button>
        </div>

        {!advice && !isAdvising && !adviceError && (
          <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
            <p className="text-slate-500 text-sm">
              Log your meals above, then click <span className="text-cyan-400 font-medium">Analyse Today</span> to get
              personalised nutrition advice from Claude AI.
            </p>
          </div>
        )}

        {adviceError && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-red-400 text-sm">
            {adviceError.includes('ANTHROPIC_API_KEY') ? (
              <>
                <p className="font-semibold mb-1">API key not configured</p>
                <p>Add your Anthropic API key to <code className="bg-white/10 px-1 rounded">.env.local</code>:</p>
                <code className="block mt-2 text-xs bg-white/5 p-2 rounded">ANTHROPIC_API_KEY=sk-ant-...</code>
                <p className="mt-2 text-xs text-slate-500">Get a key at console.anthropic.com</p>
              </>
            ) : adviceError}
          </div>
        )}

        {(advice || isAdvising) && (
          <div className="rounded-xl bg-white/3 border border-white/8 p-5 min-h-[80px]">
            <AdviceSection text={advice} />
            {isAdvising && (
              <span className="inline-block w-1.5 h-4 bg-cyan-400 animate-pulse rounded-sm ml-0.5" />
            )}
            <div ref={adviceRef} />
          </div>
        )}
      </div>

      {/* ── Add Food Modal ── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="glass rounded-2xl p-6 w-full max-w-md my-8">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">Add Food</h2>
              <button onClick={() => { setShowAdd(false); setLookupError(''); setLookupQuery(''); }} className="text-slate-500 hover:text-white text-xl leading-none">✕</button>
            </div>

            <form onSubmit={handleAddFood} className="space-y-4">
              {/* Meal selector */}
              <select className={inp} value={mealType} onChange={(e) => setMealType(e.target.value)}>
                {MEAL_TYPES.map((m) => (
                  <option key={m} value={m} className="bg-[#1a1a24]">{m.replace('_', ' ')}</option>
                ))}
              </select>

              {/* AI Lookup */}
              <div className="rounded-xl bg-cyan-500/5 border border-cyan-500/20 p-4 space-y-3">
                <p className="text-xs text-cyan-400 font-medium uppercase tracking-wide">✦ AI Auto-Fill Macros</p>
                <div className="flex gap-2">
                  <input
                    className={`${inp} flex-1`}
                    placeholder='e.g. "2 eggs and toast" or "100g grilled chicken"'
                    value={lookupQuery}
                    onChange={(e) => setLookupQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleLookup())}
                  />
                  <button
                    type="button"
                    onClick={handleLookup}
                    disabled={isLooking || !lookupQuery.trim()}
                    className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black font-bold rounded-lg text-sm transition-all whitespace-nowrap"
                  >
                    {isLooking ? (
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    ) : 'Look up'}
                  </button>
                </div>
                {lookupError && <p className="text-xs text-red-400">{lookupError}</p>}
                <p className="text-xs text-slate-600">Describe the food and Claude will estimate the macros for you.</p>
              </div>

              {/* Food name */}
              <input
                className={inp}
                placeholder="Food name (displayed in log)"
                value={food.name}
                onChange={(e) => setFood((f) => ({ ...f, name: e.target.value }))}
                required
              />

              {/* Macros grid */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Calories (kcal)</label>
                  <input className={inp} type="number" placeholder="0" min="0"
                    value={food.calories} onChange={(e) => setFood((f) => ({ ...f, calories: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Protein (g)</label>
                  <input className={inp} type="number" placeholder="0" min="0"
                    value={food.protein} onChange={(e) => setFood((f) => ({ ...f, protein: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Carbs (g)</label>
                  <input className={inp} type="number" placeholder="0" min="0"
                    value={food.carbs} onChange={(e) => setFood((f) => ({ ...f, carbs: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Fat (g)</label>
                  <input className={inp} type="number" placeholder="0" min="0"
                    value={food.fat} onChange={(e) => setFood((f) => ({ ...f, fat: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Fiber (g)</label>
                  <input className={inp} type="number" placeholder="0" min="0"
                    value={food.fiber} onChange={(e) => setFood((f) => ({ ...f, fiber: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Quantity</label>
                  <input className={inp} type="number" placeholder="1" min="0.1" step="0.1"
                    value={food.quantity} onChange={(e) => setFood((f) => ({ ...f, quantity: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Serving size (g)</label>
                <input className={inp} type="number" placeholder="100" min="1"
                  value={food.servingSize} onChange={(e) => setFood((f) => ({ ...f, servingSize: e.target.value }))} />
              </div>

              {mutation.isError && (
                <p className="text-xs text-red-400">{mutation.error?.response?.data?.error || 'Failed to save'}</p>
              )}

              <button
                type="submit"
                disabled={mutation.isPending}
                className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-bold rounded-xl transition-all"
              >
                {mutation.isPending ? 'Saving…' : 'Add Food'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
