import type { WorkflowNode } from '../types';
import type { RuntimeContext } from './context';

export function showPopover(node: WorkflowNode, context: RuntimeContext): void {
  const { doc, win, popovers, selectorElements } = context;
  const config = node.data.config;
  const anchor = config.position === 'anchor' ? selectorElements(config.selector)[0] : null;
  popovers.get(node.id)?.();
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
    maxHeight: 'calc(100vh - 32px)',
    overflow: 'auto',
    background: '#fff',
    color: '#17262e',
    border: '1px solid #e3e8ec',
    borderRadius: '16px',
    boxShadow: '0 18px 70px rgba(20, 35, 45, .24)',
    padding: '28px 24px 24px',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '14px',
  });
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
  panel.append(close, content);
  (doc.body ?? doc.documentElement).appendChild(panel);

  function place(): void {
    const viewportWidth = win.innerWidth || doc.documentElement.clientWidth;
    const viewportHeight = win.innerHeight || doc.documentElement.clientHeight;
    panel.style.transform = '';
    panel.style.inset = 'auto';
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const left = Math.max(16, Math.min(rect.left, viewportWidth - panelRect.width - 16));
      let top = rect.bottom + 12;
      if (top + panelRect.height > viewportHeight - 16) top = rect.top - panelRect.height - 12;
      panel.style.left = `${left}px`;
      panel.style.top = `${Math.max(16, top)}px`;
    } else {
      const position = config.position ?? 'bottom-right';
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
  win.addEventListener('resize', place);
  win.addEventListener('scroll', place, true);
  const dispose = () => {
    close.removeEventListener('click', dispose);
    win.removeEventListener('resize', place);
    win.removeEventListener('scroll', place, true);
    panel.remove();
    if (popovers.get(node.id) === dispose) popovers.delete(node.id);
  };
  close.addEventListener('click', dispose);
  popovers.set(node.id, dispose);
}
