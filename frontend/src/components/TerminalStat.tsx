interface TerminalStatProps {
  label: string;
  value: string | number;
  percent?: number;
  hint?: string;
  barWidth?: number;
  className?: string;
}

export function TerminalStat({
  label,
  value,
  percent,
  hint,
  barWidth = 20,
  className,
}: TerminalStatProps): JSX.Element {
  const pct = percent ?? 0;
  return (
    <div className={`term-panel p-3 ${className ?? ''}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-widest term-muted">{label}</span>
        {hint && <span className="text-[10px] term-dim">{hint}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="text-2xl font-semibold term-green tabular-nums">{value}</span>
        {typeof percent === 'number' && (
          <span className="text-[10px] term-muted">{pct.toFixed(0)}%</span>
        )}
      </div>
      {typeof percent === 'number' && (
        <pre className="mt-2 text-[10px] term-green leading-none whitespace-pre overflow-hidden">
          {fillBar(pct, barWidth)}
        </pre>
      )}
    </div>
  );
}

function fillBar(percent: number, width: number): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  const empty = Math.max(0, width - filled);
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
}
