'use client';

import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '@/hooks/useAuth';

function today() {
  return new Date().toISOString().split('T')[0];
}

function sevenDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().split('T')[0];
}

// Calculate duration in hours from HH:MM bedtime → HH:MM waketime
function calcDuration(bed, wake) {
  if (!bed || !wake) return null;
  const [bh, bm] = bed.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  let mins = (wh * 60 + wm) - (bh * 60 + bm);
  if (mins <= 0) mins += 24 * 60; // crossed midnight
  return +(mins / 60).toFixed(1);
}

const EMPTY_FORM = {
  bedtime: '22:30', wakeTime: '06:30', quality: 4,
  deepSleep: '', remSleep: '', interruptions: 0, tags: [], notes: '',
};

const SLEEP_TAGS = [
  { id: 'stress',      label: 'Stressed'    },
  { id: 'caffeine',    label: 'Caffeine'    },
  { id: 'alcohol',     label: 'Alcohol'     },
  { id: 'exercised',   label: 'Exercised'   },
  { id: 'late_meal',   label: 'Late meal'   },
  { id: 'screen_time', label: 'Screens'     },
  { id: 'nap',         label: 'Napped'      },
  { id: 'medication',  label: 'Medication'  },
];

const QUALITY_LABELS = ['', 'Very Poor', 'Poor', 'Fair', 'Good', 'Excellent'];
const QUALITY_COLORS = ['', 'text-red-400', 'text-orange-400', 'text-yellow-400', 'text-green-400', 'text-cyan-400'];

function durationColor(h) {
  if (h < 6)  return 'bg-red-500';
  if (h < 7)  return 'bg-orange-500';
  if (h <= 9) return 'bg-green-500';
  return 'bg-cyan-500';
}

function durationTextColor(h) {
  if (h < 6)  return 'text-red-400';
  if (h < 7)  return 'text-orange-400';
  if (h <= 9) return 'text-green-400';
  return 'text-cyan-400';
}

// ─── AI advice renderer ───────────────────────────────────────────────────────
function AdviceSection({ text }) {
  if (!text) return null;
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {text.split('\n').map((line, i) => {
        const t = line.trim();
        if (!t) return null;
        if (/^(OVERVIEW|WHAT'S WORKING|AREAS TO IMPROVE|TONIGHT'S TIPS)$/i.test(t)) {
          return (
            <h4 key={i} className="text-purple-400 font-semibold uppercase tracking-wide text-xs mt-4 first:mt-0">
              {t}
            </h4>
          );
        }
        if (t.startsWith('•')) {
          return (
            <div key={i} className="flex gap-2 text-slate-300">
              <span className="text-purple-400 mt-0.5 shrink-0">•</span>
              <span>{t.slice(1).trim()}</span>
            </div>
          );
        }
        return <p key={i} className="text-slate-300">{t}</p>;
      })}
    </div>
  );
}

// ─── Weekly bar chart ─────────────────────────────────────────────────────────
function WeeklyChart({ logs }) {
  const days = useMemo(() => {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const log = logs.find((l) => l.date.split('T')[0] === key);
      result.push({
        key,
        label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        dayNum: d.getDate(),
        log,
        hours: log?.duration || 0,
      });
    }
    return result;
  }, [logs]);

  const maxH = Math.max(10, ...days.map((d) => d.hours));

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold text-xs uppercase tracking-wider text-slate-400">Last 7 Nights</h2>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" /> 7–9h optimal</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-500 inline-block" /> 6–7h low</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" /> &lt;6h poor</span>
        </div>
      </div>

      {/* 8h reference line label */}
      <div className="relative">
        <div className="flex items-end justify-between gap-2 h-32">
          {/* 8h goal line */}
          <div className="absolute inset-x-0 border-t border-dashed border-white/20 pointer-events-none"
            style={{ bottom: `${(8 / maxH) * 100}%` }}
          >
            <span className="absolute right-0 -top-4 text-xs text-slate-600">8h goal</span>
          </div>

          {days.map(({ key, label, dayNum, hours, log }) => (
            <div key={key} className="flex-1 flex flex-col items-center gap-1">
              <span className={`text-xs font-medium ${hours > 0 ? durationTextColor(hours) : 'text-slate-600'}`}>
                {hours > 0 ? `${hours}h` : '–'}
              </span>
              <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                <div
                  className={`w-full rounded-t-md transition-all duration-500 ${hours > 0 ? durationColor(hours) : 'bg-white/8'}`}
                  style={{ height: hours > 0 ? `${Math.max(4, (hours / maxH) * 80)}px` : '4px', opacity: hours > 0 ? 1 : 0.4 }}
                  title={log ? `${hours}h — Quality: ${QUALITY_LABELS[log.quality] || 'not rated'}` : 'Not logged'}
                />
              </div>
              <span className="text-xs text-slate-500">{label}</span>
              <span className="text-xs text-slate-600">{dayNum}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Log form modal ───────────────────────────────────────────────────────────
function LogSleepModal({ date, existing, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    ...(existing ? {
      bedtime:      existing.bedtime || '22:30',
      wakeTime:     existing.wakeTime || '06:30',
      quality:      existing.quality || 4,
      deepSleep:    existing.deepSleep ?? '',
      remSleep:     existing.remSleep  ?? '',
      interruptions: existing.interruptions || 0,
      tags:         existing.tags || [],
      notes:        existing.notes || '',
    } : {}),
  }));

  const duration = calcDuration(form.bedtime, form.wakeTime);
  const inp = 'w-full px-3 py-2.5 rounded-lg bg-[#1a1a24] border border-white/10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 transition-all';

  const toggleTag = (id) =>
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(id) ? f.tags.filter((t) => t !== id) : [...f.tags, id],
    }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (duration === null || duration <= 0) return alert('Invalid bedtime / wake time.');
    onSave({ ...form, date, duration, deepSleep: form.deepSleep ? Number(form.deepSleep) : undefined, remSleep: form.remSleep ? Number(form.remSleep) : undefined });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="glass rounded-2xl p-6 w-full max-w-md my-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-bold text-lg">Log Sleep</h2>
            <p className="text-xs text-slate-500">{new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Bedtime</label>
              <input className={inp} type="time" value={form.bedtime} onChange={(e) => setForm((f) => ({ ...f, bedtime: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Wake up</label>
              <input className={inp} type="time" value={form.wakeTime} onChange={(e) => setForm((f) => ({ ...f, wakeTime: e.target.value }))} required />
            </div>
          </div>

          {/* Auto-calculated duration */}
          {duration !== null && (
            <div className={`text-center py-2 rounded-lg bg-white/5 text-sm font-semibold ${durationTextColor(duration)}`}>
              {duration}h sleep {duration < 6 ? '😴 Too little' : duration > 9 ? '😴 Too much' : '✓ Good range'}
            </div>
          )}

          {/* Quality */}
          <div>
            <label className="block text-xs text-slate-500 mb-2">Sleep Quality</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, quality: q }))}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                    form.quality === q
                      ? `${QUALITY_COLORS[q]} bg-white/10 border border-white/20`
                      : 'glass text-slate-500 hover:text-white'
                  }`}
                >
                  {'★'.repeat(q)}
                </button>
              ))}
            </div>
            <p className={`text-center text-xs mt-1 ${QUALITY_COLORS[form.quality]}`}>
              {QUALITY_LABELS[form.quality]}
            </p>
          </div>

          {/* Optional detail */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Deep sleep (h)</label>
              <input className={inp} type="number" placeholder="–" min="0" max="12" step="0.5"
                value={form.deepSleep} onChange={(e) => setForm((f) => ({ ...f, deepSleep: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">REM sleep (h)</label>
              <input className={inp} type="number" placeholder="–" min="0" max="12" step="0.5"
                value={form.remSleep} onChange={(e) => setForm((f) => ({ ...f, remSleep: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Wake-ups</label>
              <input className={inp} type="number" placeholder="0" min="0" max="20"
                value={form.interruptions} onChange={(e) => setForm((f) => ({ ...f, interruptions: Number(e.target.value) }))} />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs text-slate-500 mb-2">Factors (select all that apply)</label>
            <div className="flex flex-wrap gap-2">
              {SLEEP_TAGS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleTag(id)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                    form.tags.includes(id)
                      ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300'
                      : 'glass text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <textarea
            className={`${inp} resize-none`}
            rows={2}
            placeholder="Notes — dreams, anything unusual… (optional)"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />

          <button
            type="submit"
            className="w-full py-3 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-xl transition-all"
          >
            Save Sleep Log
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Sleep log card ───────────────────────────────────────────────────────────
function SleepCard({ log }) {
  const d = new Date(log.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <div className="glass rounded-2xl p-5 border-l-2 border-purple-500/30">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className={`text-2xl font-bold ${durationTextColor(log.duration)}`}>
            {log.duration}h
          </p>
          <p className="text-xs text-slate-500">{d}</p>
        </div>
        <div className="text-right">
          {log.quality && (
            <p className={`text-sm font-medium ${QUALITY_COLORS[log.quality]}`}>
              {'★'.repeat(log.quality)}{'☆'.repeat(5 - log.quality)}
            </p>
          )}
          {log.quality && <p className={`text-xs ${QUALITY_COLORS[log.quality]}`}>{QUALITY_LABELS[log.quality]}</p>}
        </div>
      </div>

      {(log.bedtime || log.wakeTime) && (
        <p className="text-xs text-slate-500 mb-2">
          {log.bedtime && `Bed: ${log.bedtime}`}
          {log.bedtime && log.wakeTime && ' → '}
          {log.wakeTime && `Wake: ${log.wakeTime}`}
          {log.interruptions > 0 && ` · ${log.interruptions} interruption${log.interruptions > 1 ? 's' : ''}`}
        </p>
      )}

      {log.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {log.tags.map((t) => (
            <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 capitalize">
              {t.replace('_', ' ')}
            </span>
          ))}
        </div>
      )}

      {log.notes && <p className="text-xs text-slate-500 italic line-clamp-2">"{log.notes}"</p>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SleepPage() {
  const { user }                       = useAuth();
  const [selectedDate, setSelectedDate] = useState(today());
  const [showModal, setShowModal]       = useState(false);
  const qc                             = useQueryClient();

  // AI advisor
  const [advice, setAdvice]            = useState('');
  const [isAdvising, setIsAdvising]    = useState(false);
  const [adviceError, setAdviceError]  = useState('');
  const adviceRef                      = useRef(null);

  // Fetch last 7 days for the chart
  const { data: weekLogs = [] } = useQuery({
    queryKey: ['sleep', 'week'],
    queryFn: async () => {
      const { data } = await axios.get('/api/sleep', {
        params: { startDate: sevenDaysAgo(), endDate: today() },
      });
      return data.data;
    },
  });

  // Fetch specific day
  const { data: dayLogs = [], isLoading: dayLoading } = useQuery({
    queryKey: ['sleep', 'day', selectedDate],
    queryFn: async () => {
      const { data } = await axios.get('/api/sleep', { params: { date: selectedDate } });
      return data.data;
    },
  });

  const todayLog = dayLogs[0] || null;

  const saveMutation = useMutation({
    mutationFn: (payload) => axios.post('/api/sleep', payload).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sleep'] });
      setShowModal(false);
    },
  });

  // Weekly stats
  const weekStats = useMemo(() => {
    if (!weekLogs.length) return null;
    const avg   = weekLogs.reduce((s, l) => s + l.duration, 0) / weekLogs.length;
    const best  = Math.max(...weekLogs.map((l) => l.duration));
    const worst = Math.min(...weekLogs.map((l) => l.duration));
    const debt  = Math.max(0, +(8 * 7 - weekLogs.reduce((s, l) => s + l.duration, 0)).toFixed(1));
    return { avg: +avg.toFixed(1), best, worst, debt, count: weekLogs.length };
  }, [weekLogs]);

  const handleGetAdvice = async () => {
    setAdvice('');
    setAdviceError('');
    setIsAdvising(true);
    try {
      const res = await fetch('/api/sleep/advice', {
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
          <h1 className="text-2xl font-bold mb-1">Sleep</h1>
          <p className="text-slate-400 text-sm">Track your rest and recovery</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date" value={selectedDate}
            onChange={(e) => { setSelectedDate(e.target.value); setAdvice(''); }}
            className="px-3 py-2 glass rounded-lg text-sm border border-white/10 text-white bg-transparent focus:outline-none focus:border-purple-500/60"
          />
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-xl text-sm transition-all hover:scale-105"
          >
            + Log Sleep
          </button>
        </div>
      </div>

      {/* ── Weekly stats ── */}
      {weekStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Avg duration',   value: `${weekStats.avg}h`,    color: durationTextColor(weekStats.avg) },
            { label: 'Best night',     value: `${weekStats.best}h`,   color: 'text-green-400' },
            { label: 'Worst night',    value: `${weekStats.worst}h`,  color: 'text-red-400'   },
            { label: 'Sleep debt',     value: `${weekStats.debt}h`,   color: weekStats.debt > 5 ? 'text-red-400' : weekStats.debt > 2 ? 'text-orange-400' : 'text-slate-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass rounded-2xl p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Weekly chart ── */}
      <WeeklyChart logs={weekLogs} />

      {/* ── Selected day detail ── */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-xs uppercase tracking-wider text-slate-400">
            {selectedDate === today() ? "Tonight / Last Night" : new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h2>
          {todayLog && (
            <button
              onClick={() => setShowModal(true)}
              className="text-xs text-slate-500 hover:text-purple-400 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {dayLoading ? (
          <div className="h-20 animate-pulse bg-white/5 rounded-xl" />
        ) : !todayLog ? (
          <div className="text-center py-8">
            <span className="text-4xl block mb-3">🌙</span>
            <p className="text-slate-400 text-sm mb-4">No sleep logged for this night</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-5 py-2 bg-purple-500/15 text-purple-400 rounded-xl text-sm hover:bg-purple-500/25 transition-colors"
            >
              Log sleep now
            </button>
          </div>
        ) : (
          <SleepCard log={todayLog} />
        )}
      </div>

      {/* ── Recent logs ── */}
      {weekLogs.length > 1 && (
        <div>
          <h2 className="font-semibold text-xs uppercase tracking-wider text-slate-400 mb-3">Recent Nights</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {weekLogs.slice(0, 6).map((log) => (
              <SleepCard key={log._id} log={log} />
            ))}
          </div>
        </div>
      )}

      {/* ── FitAI ── */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/30 to-indigo-500/30 border border-purple-500/20 flex items-center justify-center text-sm">
              ✦
            </div>
            <div>
              <h2 className="font-semibold">FitAI</h2>
            </div>
          </div>
          <button
            onClick={handleGetAdvice}
            disabled={isAdvising}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-400 hover:from-purple-400 hover:to-purple-300 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-all hover:scale-105"
          >
            {isAdvising ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Analysing…
              </span>
            ) : 'Analyse My Sleep'}
          </button>
        </div>

        {!advice && !isAdvising && !adviceError && (
          <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
            <p className="text-slate-500 text-sm">
              Log a few nights of sleep, then click <span className="text-purple-400 font-medium">Analyse My Sleep</span> to get personalised advice on sleep quality, duration, and recovery optimisation.
            </p>
          </div>
        )}

        {adviceError && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-red-400 text-sm">
            {adviceError.includes('ANTHROPIC_API_KEY') ? (
              <>
                <p className="font-semibold mb-1">API key not configured</p>
                <p>Add <code className="bg-white/10 px-1 rounded">ANTHROPIC_API_KEY=sk-ant-...</code> to <code className="bg-white/10 px-1 rounded">.env.local</code>.</p>
              </>
            ) : adviceError}
          </div>
        )}

        {(advice || isAdvising) && (
          <div className="rounded-xl bg-white/3 border border-white/8 p-5 min-h-[80px]">
            <AdviceSection text={advice} />
            {isAdvising && <span className="inline-block w-1.5 h-4 bg-purple-400 animate-pulse rounded-sm ml-0.5" />}
            <div ref={adviceRef} />
          </div>
        )}
      </div>

      {showModal && (
        <LogSleepModal
          date={selectedDate}
          existing={todayLog}
          onClose={() => setShowModal(false)}
          onSave={(payload) => saveMutation.mutate(payload)}
        />
      )}
    </div>
  );
}
