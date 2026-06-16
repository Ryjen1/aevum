import { useEffect, useState } from 'react';

interface LoadingSpinnerProps {
  label?: string;
  className?: string;
}

const FRAMES = ['|', '/', '-', '\\'];

export function LoadingSpinner({ label, className }: LoadingSpinnerProps): JSX.Element {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length);
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  const current = FRAMES[frame] ?? '|';
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${className ?? ''}`} role="status" aria-live="polite">
      <span className="term-green inline-block w-3 text-center">{current}</span>
      {label && <span className="term-muted">{label}</span>}
    </span>
  );
}
