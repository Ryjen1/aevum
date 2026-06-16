import { useEffect } from 'react';

export function useKeyboardShortcut(
  key: string,
  handler: (e: KeyboardEvent) => void,
  modifiers: { meta?: boolean; ctrl?: boolean; shift?: boolean } = {},
): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const modMatch =
        (modifiers.meta ? e.metaKey : !e.metaKey) &&
        (modifiers.ctrl ? e.ctrlKey : !e.ctrlKey) &&
        (modifiers.shift ? e.shiftKey : !e.shiftKey);
      const keyMatch = e.key.toLowerCase() === key.toLowerCase();
      if (modMatch && keyMatch) {
        e.preventDefault();
        handler(e);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key, handler, modifiers.meta, modifiers.ctrl, modifiers.shift]);
}

export function useCmdK(handler: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handler]);
}
