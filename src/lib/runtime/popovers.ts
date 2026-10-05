import type { WorkflowNode } from '../types';
import type { RuntimeContext } from './context';

/** Shared DOM and styles for runtime popovers and the sandboxed inspector preview. */
export function createPopoverElements(node: WorkflowNode, doc: Document, anchored: boolean) {
  const config = node.data.config;
  const panel = doc.createElement('section');
  panel.dataset.visualDxpPopover = node.id;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', node.data.label || 'Experience');
  const width = Math.max(240, Math.min(960, config.width ?? 360));
  Object.assign(panel.style, {
    position: 'fixed',
    zIndex: '2147483646',
    boxSizing: 'border-box',
    width: `${width}px`,
    maxWidth: 'calc(100vw - 32px)',
    color: '#17262e',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '14px',
  });
  // Keep the arrow outside the scrolling surface so it cannot be clipped.
  const surface = doc.createElement('div');
  Object.assign(surface.style, {
    position: 'relative',
    boxSizing: 'border-box',
    maxHeight: 'calc(100vh - 32px)',
    overflow: 'auto',
    background: '#fff',
    border: '1px solid #e3e8ec',
    borderRadius: '16px',
    boxShadow: '0 18px 70px rgba(20, 35, 45, .24)',
    padding: '28px 24px 24px',
  });
  const arrow = anchored ? doc.createElementNS('http://www.w3.org/2000/svg', 'svg') : null;
  if (arrow) {
    arrow.setAttribute('aria-hidden', 'true');
    arrow.setAttribute('focusable', 'false');
    arrow.setAttribute('width', '20');
    arrow.setAttribute('height', '10');
    arrow.setAttribute('viewBox', '0 0 20 10');
    Object.assign(arrow.style, {
      position: 'absolute',
      width: '20px',
      height: '10px',
      overflow: 'visible',
      pointerEvents: 'none',
    });
    const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M 0 10 L 10 0 L 20 10');
    path.setAttribute('fill', '#fff');
    path.setAttribute('stroke', '#e3e8ec');
    path.setAttribute('stroke-linejoin', 'round');
    arrow.appendChild(path);
  }
  const close = doc.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close experience');
  Object.assign(close.style, {
    position: 'absolute',
    top: '5px',
    right: '8px',
    width: '28px',
    height: '28px',
    border: '0',
    background: 'transparent',
    color: '#64717a',
    cursor: 'pointer',
    fontSize: '24px',
    lineHeight: '24px',
    zIndex: '1',
  });
  const content = doc.createElement('div');
  if (config.contentType === 'iframe') {
    const frame = doc.createElement('iframe');
    if (!config.url?.trim()) throw new Error('Enter a URL for the popover iframe.');
    const url = new URL(config.url);
    if (!['http:', 'https:'].includes(url.protocol))
      throw new Error('Popover frames require an HTTP or HTTPS URL.');
    frame.src = url.href;
    frame.title = node.data.label || 'Embedded experience';
    frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups');
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    Object.assign(frame.style, { width: '100%', height: '320px', border: '0', display: 'block' });
    content.appendChild(frame);
  } else {
    // HTML is deliberately author-controlled. Only import workflows you trust.
    content.innerHTML =
      config.content ?? '<h3>Hello there 👋</h3><p>Welcome to your next experience.</p>';
  }
  surface.append(close, content);
  panel.appendChild(surface);
  if (arrow) panel.appendChild(arrow);
  return { panel, surface, arrow, close };
}

export function showPopover(
  node: WorkflowNode,
  context: RuntimeContext,
  createElements: typeof createPopoverElements,
): void {
  const { doc, win, popovers, selectorElements } = context;
  const config = node.data.config;
  const anchor = config.position === 'anchor' ? selectorElements(config.selector)[0] : null;
  popovers.get(node.id)?.();
  const { panel, arrow, close } = createElements(node, doc, Boolean(anchor));
  (doc.body ?? doc.documentElement).appendChild(panel);

  let directionX = 0;
  let directionY = 1;
  let animation: Animation | undefined;
  function place(): void {
    const viewportWidth = win.innerWidth || doc.documentElement.clientWidth;
    const viewportHeight = win.innerHeight || doc.documentElement.clientHeight;
    panel.style.transform = '';
    panel.style.inset = 'auto';
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      // Layout dimensions remain stable while entrance scale/translation is active.
      const bounds = panel.getBoundingClientRect();
      const panelRect = {
        width: panel.offsetWidth || bounds.width,
        height: panel.offsetHeight || bounds.height,
      };
      const left = Math.max(16, Math.min(rect.left, viewportWidth - panelRect.width - 16));
      const above = rect.bottom + 12 + panelRect.height > viewportHeight - 16;
      directionX = 0;
      directionY = above ? 1 : -1;
      panel.style.transformOrigin = above ? 'center bottom' : 'center top';
      const top = above ? rect.top - panelRect.height - 12 : rect.bottom + 12;
      panel.style.left = `${left}px`;
      // Flipping above an offscreen anchor can still leave the panel below the viewport.
      panel.style.top = `${Math.max(16, Math.min(top, viewportHeight - panelRect.height - 16))}px`;
      if (arrow) {
        // Leave room for the rounded corners when the panel hits a viewport edge.
        const center = Math.max(
          26,
          Math.min(rect.left + rect.width / 2 - left, panelRect.width - 26),
        );
        arrow.style.left = `${center - 10}px`;
        arrow.style.top = above ? 'auto' : '-9px';
        arrow.style.bottom = above ? '-9px' : 'auto';
        arrow.style.transform = above ? 'rotate(180deg)' : '';
      }
    } else {
      const position = config.position ?? 'bottom-right';
      directionX = position === 'center' ? 0 : position.endsWith('left') ? -1 : 1;
      directionY = position.startsWith('top') ? -1 : 1;
      panel.style.transformOrigin =
        position === 'center'
          ? 'center'
          : `${directionX < 0 ? 'left' : 'right'} ${directionY < 0 ? 'top' : 'bottom'}`;
      if (position === 'center') {
        panel.style.left = '50%';
        panel.style.top = '50%';
        panel.style.transform = 'translate(-50%, -50%)';
      } else {
        panel.style[position.startsWith('top') ? 'top' : 'bottom'] = '24px';
        panel.style[position.endsWith('left') ? 'left' : 'right'] = '24px';
      }
    }
  }
  place();
  const effect = config.popoverAnimation ?? 'none';
  function canAnimate(): boolean {
    return (
      effect !== 'none' &&
      typeof panel.animate === 'function' &&
      !win.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    );
  }
  function playAnimation(reverse = false): Animation {
    // Individual transform properties preserve the centering transform and move the arrow too.
    const from = `${directionX * 28}px ${directionY * 28}px`;
    const frames: Keyframe[] =
      effect === 'fade'
        ? [{ opacity: 0 }, { opacity: 1 }]
        : effect === 'zoom'
          ? [
              { opacity: 0, scale: '0.88' },
              { opacity: 1, scale: '1' },
            ]
          : effect === 'bounce'
            ? [
                { opacity: 0, translate: from, scale: '0.94' },
                {
                  opacity: 1,
                  translate: `${directionX * -5}px ${directionY * -5}px`,
                  scale: '1.02',
                  offset: 0.7,
                },
                { opacity: 1, translate: '0px 0px', scale: '1' },
              ]
            : [
                { opacity: 0, translate: from },
                { opacity: 1, translate: '0px 0px' },
              ];
    return panel.animate(frames, {
      duration: effect === 'bounce' ? 480 : 280,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      ...(reverse ? { direction: 'reverse' as const, fill: 'forwards' as const } : {}),
    });
  }
  if (canAnimate()) animation = playAnimation();
  win.addEventListener('resize', place);
  win.addEventListener('scroll', place, true);
  const dispose = () => {
    if (animation) {
      animation.onfinish = null;
      animation.oncancel = null;
      animation.cancel();
    }
    close.removeEventListener('click', dismiss);
    win.removeEventListener('resize', place);
    win.removeEventListener('scroll', place, true);
    panel.remove();
    if (popovers.get(node.id) === dispose) popovers.delete(node.id);
  };
  let closing = false;
  function dismiss(): void {
    if (closing) return;
    closing = true;
    close.disabled = true;
    if (!canAnimate()) {
      dispose();
      return;
    }
    if (animation?.playState === 'running') {
      // Reverse from the current progress when dismissed during the entrance.
      animation.reverse();
    } else {
      animation?.cancel();
      // Rebuild the effect using the current placement if the anchor has flipped.
      animation = playAnimation(true);
    }
    animation.onfinish = dispose;
    animation.oncancel = dispose;
  }
  close.addEventListener('click', dismiss);
  popovers.set(node.id, dispose);
}
