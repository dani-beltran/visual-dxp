import { useLayoutEffect, useRef } from 'react';
import { placePopover } from '../lib/popoverPosition';

/** Follow real controls through panel switches, scrolling, and canvas movement. */
export function useTutorialPopover(scope: HTMLElement | null | undefined, target: string) {
  const panel = useRef<HTMLElement>(null);
  const arrow = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    const surface = panel.current;
    if (!surface) return;
    const win = surface.ownerDocument.defaultView;
    if (!win) return;
    let anchor: HTMLElement | undefined;
    let previous = '';
    let frame = 0;
    const place = () => {
      // A dialog must not point at controls behind its backdrop.
      const root = surface.closest('[role="dialog"]') ?? scope;
      const next = target
        ? [...(root?.querySelectorAll<HTMLElement>(`[data-tutorial="${target}"]`) ?? [])].find(
            (el) => {
              const rect = el.getBoundingClientRect();
              return (
                !surface.contains(el) &&
                el.getClientRects().length > 0 &&
                rect.bottom > 0 &&
                rect.right > 0 &&
                rect.top < win.innerHeight &&
                rect.left < win.innerWidth
              );
            },
          )
        : undefined;
      if (next !== anchor) {
        anchor?.classList.remove('dxp-tutorial-target');
        anchor = next;
        anchor?.classList.add('dxp-tutorial-target');
        previous = '';
      }
      const rect = anchor?.getBoundingClientRect();
      const libraryTarget = !!anchor && target.startsWith('add-');
      surface.style.maxWidth =
        libraryTarget && rect ? `${Math.max(0, win.innerWidth - rect.right - 28)}px` : '';
      const signature = [
        rect?.left,
        rect?.top,
        rect?.width,
        rect?.height,
        surface.offsetWidth,
        surface.offsetHeight,
        win.innerWidth,
        win.innerHeight,
      ].join(',');
      if (signature !== previous) {
        previous = signature;
        if (arrow.current) arrow.current.style.display = anchor ? '' : 'none';
        placePopover(surface, arrow.current, {
          anchor,
          avoidAnchor: true,
          side: libraryTarget ? 'right' : undefined,
        });
        surface.dataset.anchored = String(!!anchor);
      }
    };
    const follow = () => {
      place();
      frame = win.requestAnimationFrame(follow);
    };
    place();
    if (win.requestAnimationFrame) frame = win.requestAnimationFrame(follow);
    win.addEventListener('scroll', place, true);
    win.addEventListener('resize', place);
    return () => {
      if (frame) win.cancelAnimationFrame(frame);
      win.removeEventListener('scroll', place, true);
      win.removeEventListener('resize', place);
      anchor?.classList.remove('dxp-tutorial-target');
    };
  }, [scope, target]);
  return { panel, arrow };
}
