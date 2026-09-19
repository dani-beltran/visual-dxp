import { useEffect, useRef } from 'react';
export function useDialogFocus(active: boolean) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!active || !ref.current) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    const focusable = () =>
      [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select, textarea, iframe, [tabindex="0"]',
        ),
      ].filter((el) => el.getClientRects().length > 0);
    (dialog.querySelector<HTMLElement>('[autofocus]') || focusable()[0])?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener('keydown', handle);
    return () => {
      dialog.removeEventListener('keydown', handle);
      if (previous?.isConnected) previous.focus();
    };
  }, [active]);
  return ref;
}
