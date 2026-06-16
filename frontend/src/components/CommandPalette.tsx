import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useCmdK } from '@/hooks/useKeyboardShortcut';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
}

interface Command {
  id: string;
  label: string;
  hint: string;
  group: 'NAV' | 'ACTION';
  shortcut?: string;
  action: (helpers: CommandHelpers) => void;
}

interface CommandHelpers {
  navigate: (to: string) => void;
  openConnect: () => void;
  close: () => void;
}

const COMMANDS: Command[] = [
  { id: 'nav.status', label: 'goto: status', hint: 'open system status', group: 'NAV', action: (h) => h.navigate('/status') },
  { id: 'nav.oracle', label: 'goto: oracle', hint: 'chat with an agent', group: 'NAV', action: (h) => h.navigate('/oracle') },
  { id: 'nav.archive', label: 'goto: archive', hint: 'browse memories', group: 'NAV', action: (h) => h.navigate('/archive') },
  { id: 'nav.registry', label: 'goto: registry', hint: 'install agents', group: 'NAV', action: (h) => h.navigate('/registry') },
  { id: 'nav.system', label: 'goto: system', hint: 'system & audit', group: 'NAV', action: (h) => h.navigate('/system') },
  { id: 'action.connect', label: 'connect wallet', hint: 'connect a wallet', group: 'ACTION', action: (h) => h.openConnect() },
  { id: 'action.new-agent', label: 'new agent', hint: 'create a new agent', group: 'ACTION', action: (h) => h.navigate('/oracle') },
  { id: 'action.new-memory', label: 'log memory', hint: 'log a new memory', group: 'ACTION', action: (h) => h.navigate('/archive') },
  { id: 'action.theme', label: 'theme: dark', hint: 'dark is the only theme', group: 'ACTION', action: (h) => h.close() },
];

export function CommandPalette({ open, onClose, onOpen }: CommandPaletteProps): JSX.Element | null {
  const navigate = useNavigate();
  const { openConnectModal } = useConnectModal();
  const { isConnected } = useAccount();
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useCmdK(onOpen);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(0);
      window.setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const filtered = useMemo<Command[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter(
      (c) => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q),
    );
  }, [query]);

  const helpers: CommandHelpers = {
    navigate: (to) => {
      navigate(to);
      onClose();
    },
    openConnect: () => {
      onClose();
      if (!isConnected) openConnectModal?.();
    },
    close: onClose,
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => Math.min(filtered.length - 1, h + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filtered[highlight];
        if (cmd) cmd.action(helpers);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, highlight, helpers, onClose, openConnectModal, isConnected]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4"
      role="dialog"
      aria-label="Command palette"
    >
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl term-panel">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-terminal-border text-xs">
          <span className="term-magenta">{'├─['}</span>
          <span className="term-green">aevum</span>
          <span className="term-muted">::</span>
          <span className="term-cyan">command</span>
          <span className="term-magenta">{']'}</span>
          <span className="term-dim">──</span>
          <span className="term-muted">[esc] close</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-terminal-border">
          <span className="term-green text-sm">aevum</span>
          <span className="term-muted">{'>'}</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            placeholder="type a command..."
            className="flex-1 bg-transparent border-0 outline-none text-sm term-text placeholder:term-dim"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="term-green cursor-blink">_</span>
        </div>
        <ul className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <li className="px-3 py-3 text-xs term-muted">
              {'>'} no commands match "{query}"
            </li>
          )}
          {filtered.map((cmd, i) => (
            <li key={cmd.id}>
              <button
                type="button"
                onClick={() => cmd.action(helpers)}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 ${
                  i === highlight ? 'bg-[#0d1a0d] term-green' : 'term-text hover:bg-[#0d0d0d]'
                }`}
              >
                <span className={`${i === highlight ? 'term-green' : 'term-dim'} w-3`}>
                  {i === highlight ? '>' : ' '}
                </span>
                <span className="term-dim w-10 text-[10px]">[{cmd.group}]</span>
                <span className="flex-1">{cmd.label}</span>
                <span className="term-muted text-[10px]">{cmd.hint}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-terminal-border text-[10px] term-muted">
          <span>[↑↓] navigate</span>
          <span>[enter] execute</span>
          <span>[esc] close</span>
        </div>
      </div>
    </div>
  );
}
