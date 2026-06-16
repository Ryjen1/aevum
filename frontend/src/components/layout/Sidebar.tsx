import { NavLink } from 'react-router-dom';

interface NavItem {
  label: string;
  to: string;
  icon: string;
  description: string;
  shortcut?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'STATUS', to: '/status', icon: '\u25B8', description: 'overview & activity', shortcut: 's' },
  { label: 'ORACLE', to: '/oracle', icon: '\u25A3', description: 'talk to an agent', shortcut: 'o' },
  { label: 'ARCHIVE', to: '/archive', icon: '\u25A4', description: 'browse memories', shortcut: 'a' },
  { label: 'REGISTRY', to: '/registry', icon: '\u25A5', description: 'install agents', shortcut: 'r' },
  { label: 'SYSTEM', to: '/system', icon: '\u25A6', description: 'system & audit', shortcut: 'y' },
];

export function Sidebar(): JSX.Element {
  return (
    <aside
      aria-label="Terminal navigation"
      className="hidden lg:flex w-60 shrink-0 flex-col border-r border-terminal-border bg-terminal-bg"
    >
      <div className="px-3 py-2 text-[10px] term-muted uppercase tracking-widest border-b border-terminal-border">
        ┌─[ navigation ]─
      </div>
      <nav className="flex-1 py-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block px-3 py-2 text-xs transition-colors ${
                isActive
                  ? 'bg-[#0d1a0d] term-green border-l-2 border-terminal-green'
                  : 'term-text hover:bg-[#0d0d0d] hover:term-green border-l-2 border-transparent'
              }`
            }
          >
            {({ isActive }) => (
              <div>
                <div className="flex items-center gap-2">
                  <span className={`${isActive ? 'term-green' : 'term-dim'}`}>
                    {isActive ? '>' : ' '}
                  </span>
                  <span className="term-dim">{item.icon}</span>
                  <span className="font-semibold uppercase tracking-wide">{item.label}</span>
                </div>
                <div className="ml-7 text-[10px] term-muted mt-0.5">
                  // {item.description}
                </div>
              </div>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 py-2 border-t border-terminal-border text-[10px]">
        <div className="term-green mb-1">┌─[ buildathon ]─</div>
        <div className="term-muted">0G Bridge Wave 1</div>
        <div className="term-cyan">deadline: 2026-06-26</div>
      </div>
    </aside>
  );
}
