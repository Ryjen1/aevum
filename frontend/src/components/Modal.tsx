import type { ReactNode } from 'react';
import { useEffect } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-black/85"
        onClick={onClose}
      />
      <div className={`relative w-full ${SIZE[size]} term-panel`}>
        <div className="flex items-center justify-between gap-2 border-b border-terminal-border px-4 py-2">
          <div className="text-xs term-green truncate">
            ┌─[ {title} ]─
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-xs term-muted hover:term-red transition-colors"
          >
            [X]
          </button>
        </div>
        {description && (
          <div className="px-4 pt-3 text-xs term-muted">{description}</div>
        )}
        <div className="px-4 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-terminal-border px-4 py-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
