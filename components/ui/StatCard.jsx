export default function StatCard({ label, value, unit, icon, color = 'cyan', trend }) {
  const colorMap = {
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    green: 'text-green-400 bg-green-500/10 border-green-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  };

  return (
    <div className="glass rounded-2xl p-5 hover:bg-white/[0.06] transition-colors">
      <div className="flex items-start justify-between mb-4">
        <span className={`text-xl p-2 rounded-lg border ${colorMap[color]}`}>{icon}</span>
        {trend !== undefined && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${trend >= 0 ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-3xl font-bold mb-1">
        {value ?? '—'}
        {unit && <span className="text-lg font-normal text-slate-500 ml-1">{unit}</span>}
      </p>
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  );
}
