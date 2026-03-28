interface ProgressBarProps {
  comparisons: number;
  estimatedTotal: number;
  progress: number;
}

export function ProgressBar({ comparisons, estimatedTotal, progress }: ProgressBarProps) {
  const percentage = Math.round(progress * 100);
  const remaining = Math.max(0, estimatedTotal - comparisons);

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Stats row */}
      <div className="flex justify-between items-baseline mb-2.5">
        <span className="text-xs font-medium text-white/50 tracking-wide">
          {comparisons} of ~{estimatedTotal} comparisons
        </span>
        <span className={`text-xs font-semibold tracking-wide transition-colors duration-300 ${
          percentage >= 75 ? 'text-violet-400' : 'text-white/45'
        }`}>
          {percentage}%
        </span>
      </div>

      {/* Track */}
      <div className="relative w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
        {/* Glow */}
        <div
          className="absolute -top-1 h-3.5 rounded-full bg-gradient-to-r from-violet-500/40 to-purple-400/50 blur-md transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
        {/* Fill */}
        <div
          className="relative h-full rounded-full bg-gradient-to-r from-violet-600 via-violet-500 to-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.45)] transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Remaining */}
      <div className="mt-2 text-center">
        <span className="text-[11px] text-white/38">
          {remaining > 0 ? `~${remaining} choices remaining` : 'Almost there...'}
        </span>
      </div>
    </div>
  );
}
