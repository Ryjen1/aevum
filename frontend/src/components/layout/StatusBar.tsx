import { useStatusBar } from '@/hooks/useStatusBar';

export function StatusBar(): JSX.Element {
  const { connected, memoryCount, agentCount, version, time } = useStatusBar();

  return (
    <footer
      aria-label="System status bar"
      className="sticky bottom-0 z-30 w-full border-t border-terminal-border bg-terminal-bg"
    >
      <div className="mx-auto max-w-[1600px] px-2 sm:px-4">
        <div className="flex items-center gap-2 py-1 text-[10px] overflow-x-auto whitespace-nowrap">
          <span className="term-muted">[</span>
          <span className="term-green">aevum</span>
          <span className="term-muted">.</span>
          <span className={connected ? 'term-green' : 'term-red'}>
            {connected ? 'connected' : 'disconnected'}
          </span>
          <span className="term-muted">]</span>
          <span className="term-dim">|</span>
          <span className="term-muted">[mem:</span>
          <span className="term-cyan tabular-nums">{memoryCount}</span>
          <span className="term-muted">]</span>
          <span className="term-dim">|</span>
          <span className="term-muted">[agents:</span>
          <span className="term-amber tabular-nums">{agentCount}</span>
          <span className="term-muted">]</span>
          <span className="term-dim">|</span>
          <span className="term-muted">[</span>
          <span className="term-magenta">{version}</span>
          <span className="term-muted">]</span>
          <div className="flex-1 min-w-2" />
          <span className="term-muted">[</span>
          <span className="term-cyan tabular-nums">{time}</span>
          <span className="term-muted">]</span>
          <span className="term-dim">|</span>
          <span className="term-dim">press [ctrl+k] for commands</span>
        </div>
      </div>
    </footer>
  );
}
