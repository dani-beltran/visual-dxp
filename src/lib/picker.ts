/** A deliberately small, serializable protocol shared with picker-bridge.js. */
export const PICKER_PROTOCOL = 'mr-dxp:element-picker';

export interface PickedElement {
  selector: string;
  tagName: string;
  text: string;
}

export interface PickerSession {
  select: (selector: string) => boolean;
  destroy: () => void;
}

/** CSS.escape fallback for documents whose Window does not expose CSS. */
export function escapeCss(value: string): string {
  return Array.from(value)
    .map((character, index) => {
      const code = character.charCodeAt(0);
      if (code === 0) return '\uFFFD';
      if (
        (code >= 1 && code <= 31) ||
        code === 127 ||
        (index === 0 && /[0-9]/.test(character)) ||
        (index === 1 && value[0] === '-' && /[0-9]/.test(character))
      )
        return `\\${code.toString(16)} `;
      if (index === 0 && character === '-' && value.length === 1) return '\\-';
      return code >= 128 || /[a-zA-Z0-9_-]/.test(character) ? character : `\\${character}`;
    })
    .join('');
}

export function getElementSelector(element: Element): string {
  const doc = element.ownerDocument;
  const unique = (selector: string) => {
    try {
      return doc.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  };
  const parts: string[] = [];
  let current: Element | null = element;
  while (current) {
    const tag = current.tagName.toLowerCase();
    if (current.id) {
      const id = `#${escapeCss(current.id)}`;
      if (unique(id)) {
        parts.unshift(id);
        break;
      }
    }
    const testId = current.getAttribute('data-testid');
    if (testId) {
      const selector = `[data-testid="${testId.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\a ')}"]`;
      if (unique(selector)) {
        parts.unshift(selector);
        break;
      }
    }
    let part = tag;
    const siblings = current.parentElement
      ? Array.from(current.parentElement.children).filter(
          (child) => child.tagName === current!.tagName,
        )
      : [];
    if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
    parts.unshift(part);
    if (unique(parts.join(' > '))) break;
    current = current.parentElement;
  }
  return parts.join(' > ');
}

export function normalizeWebsiteUrl(value: string, base: string): string {
  if (!value.trim()) throw new Error('Enter a website URL.');
  const parsed = new URL(value.trim(), base);
  if (!['http:', 'https:'].includes(parsed.protocol))
    throw new Error('Enter an http:// or https:// website URL.');
  if (parsed.username || parsed.password)
    throw new Error('Use a website URL without embedded credentials.');
  return parsed.href;
}

/** Attach only after browser same-origin access has succeeded. No proxy is used. */
export function attachElementPicker(
  doc: Document,
  onHover: (element: PickedElement | null) => void,
  onSelect: (element: PickedElement) => void,
): PickerSession {
  const view = doc.defaultView;
  if (!view || !doc.documentElement) throw new Error('The website is not ready yet.');
  const root = doc.createElement('div');
  root.dataset.mrDxpPicker = 'overlay';
  root.setAttribute('aria-hidden', 'true');
  root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
  const makeOutline = (selected: boolean) => {
    const box = doc.createElement('div');
    box.style.cssText = `position:fixed;display:none;pointer-events:none;border:2px ${selected ? 'solid' : 'dashed'} #42966c;box-sizing:border-box;border-radius:3px;background:${selected ? 'rgba(77,157,112,.12)' : 'rgba(77,157,112,.06)'};`;
    const label = doc.createElement('span');
    label.style.cssText =
      'position:absolute;left:-2px;bottom:100%;max-width:330px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:5px 8px;background:#28724b;color:white;border-radius:4px 4px 0 0;font:11px/1.2 ui-monospace,monospace;';
    box.appendChild(label);
    root.appendChild(box);
    return { box, label };
  };
  const hoverOutline = makeOutline(false);
  const selectedOutline = makeOutline(true);
  doc.documentElement.appendChild(root);
  let hovered: Element | null = null;
  let selected: Element | null = null;
  const detail = (element: Element): PickedElement => ({
    selector: getElementSelector(element),
    tagName: element.tagName.toLowerCase(),
    text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100),
  });
  const draw = (
    element: Element | null,
    outline: ReturnType<typeof makeOutline>,
    isSelected: boolean,
  ) => {
    if (!element?.isConnected) {
      outline.box.style.display = 'none';
      return;
    }
    const rect = element.getBoundingClientRect();
    Object.assign(outline.box.style, {
      display: 'block',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    outline.label.textContent = `${isSelected ? 'Selected · ' : ''}${getElementSelector(element)}`;
    outline.label.style.bottom = rect.top < 30 ? 'auto' : '100%';
    outline.label.style.top = rect.top < 30 ? '100%' : 'auto';
  };
  const refresh = () => {
    draw(hovered === selected ? null : hovered, hoverOutline, false);
    draw(selected, selectedOutline, true);
  };
  const validTarget = (target: EventTarget | null): target is Element =>
    !!target &&
    typeof (target as Element).closest === 'function' &&
    !(target as Element).closest('[data-mr-dxp-picker]');
  const move = (event: MouseEvent) => {
    if (!validTarget(event.target) || event.target === hovered) return;
    hovered = event.target;
    refresh();
    onHover(detail(hovered));
  };
  const leave = () => {
    hovered = null;
    refresh();
    onHover(null);
  };
  const click = (event: MouseEvent) => {
    if (!validTarget(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    selected = event.target;
    refresh();
    onSelect(detail(selected));
  };
  doc.addEventListener('mousemove', move, true);
  doc.addEventListener('click', click, true);
  doc.addEventListener('mouseleave', leave, true);
  doc.addEventListener('scroll', refresh, true);
  view.addEventListener('resize', refresh);
  return {
    select(selector) {
      try {
        selected = selector.trim() ? doc.querySelector(selector) : null;
        refresh();
        return !!selected;
      } catch {
        selected = null;
        refresh();
        return false;
      }
    },
    destroy() {
      root.remove();
      doc.removeEventListener('mousemove', move, true);
      doc.removeEventListener('click', click, true);
      doc.removeEventListener('mouseleave', leave, true);
      doc.removeEventListener('scroll', refresh, true);
      view.removeEventListener('resize', refresh);
    },
  };
}
