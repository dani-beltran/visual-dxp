import { type ElementDescription, isElementDescription } from './elementDescription';
import type { BuilderTranslator } from './i18n';
import type { StepConfig } from './types';

export interface PageChange {
  /** Stable original identity for summaries; never used to locate or update the element. */
  element?: ElementDescription;
  selector: string;
  action?:
    | 'text'
    | 'html'
    | 'add-class'
    | 'remove-class'
    | 'hide'
    | 'show'
    | 'attribute'
    | 'replace-image';
  value?: string;
  attribute?: string;
  imageAlt?: string;
  /** Child-node indices identify a text segment without replacing its surrounding markup. */
  textPath?: number[];
}

export function isPageChange(value: unknown): value is PageChange {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const change = value as PageChange;
  return (
    Object.keys(change).every((key) =>
      ['selector', 'action', 'value', 'attribute', 'imageAlt', 'textPath', 'element'].includes(key),
    ) &&
    typeof change.selector === 'string' &&
    (change.element === undefined || isElementDescription(change.element)) &&
    (change.action === undefined ||
      [
        'text',
        'html',
        'add-class',
        'remove-class',
        'hide',
        'show',
        'attribute',
        'replace-image',
      ].includes(change.action)) &&
    ['value', 'attribute', 'imageAlt'].every(
      (key) =>
        (change as unknown as Record<string, unknown>)[key] === undefined ||
        typeof (change as unknown as Record<string, unknown>)[key] === 'string',
    ) &&
    (change.textPath === undefined ||
      (Array.isArray(change.textPath) &&
        change.textPath.length > 0 &&
        change.textPath.every((index) => Number.isSafeInteger(index) && index >= 0)))
  );
}

/** An explicit list, including an empty one, takes precedence over historical single edits. */
export function getPageChanges(config: StepConfig): PageChange[] {
  if (config.changes !== undefined) return config.changes;
  if (
    !config.selector &&
    !config.action &&
    config.value === undefined &&
    config.attribute === undefined
  )
    return [];
  const { selector, action, value, attribute, imageAlt, textPath } = config;
  return [{ selector: selector ?? '', action, value, attribute, imageAlt, textPath }];
}

export function pageChangeKey(change: PageChange): string {
  return JSON.stringify([
    change.selector,
    change.action ?? 'text',
    change.attribute ?? '',
    change.textPath ?? null,
  ]);
}

export function pageChangeLabel(change: PageChange, t: BuilderTranslator): string {
  const value = change.value ?? '';
  switch (change.action ?? 'text') {
    case 'text':
      return t('pageChange.text', { value });
    case 'html':
      return t('pageChange.html');
    case 'hide':
      return t('pageChange.hidden');
    case 'show':
      return t('pageChange.shown');
    case 'add-class':
      return t('pageChange.addClass', { value });
    case 'remove-class':
      return t('pageChange.removeClass', { value });
    case 'replace-image':
      return t('pageChange.image', { value });
    case 'attribute':
      if (change.attribute === 'href') return t('pageChange.destination', { value });
      if (change.attribute === 'alt')
        return value ? t('pageChange.alt', { value }) : t('pageChange.altCleared');
      if (change.attribute === 'target' && value === '_blank') return t('pageChange.newTab');
      if (change.attribute === 'target' && ['_self', ''].includes(value))
        return t('pageChange.sameTab');
      return t('pageChange.attribute', { attribute: change.attribute ?? '', value });
  }
}

/** Self-contained: injected into the runtime factory used by both previews and exports. */
export function applyPageChange(element: Element, change: PageChange): void {
  const value = change.value ?? '';
  switch (change.action ?? 'text') {
    case 'text': {
      if (change.textPath) {
        let node: Node | undefined = element;
        for (const index of change.textPath) node = node?.childNodes[index];
        if (node?.nodeType !== 3) throw new Error('The selected text segment no longer exists.');
        node.nodeValue = value;
      } else element.textContent = value;
      break;
    }
    case 'html':
      element.innerHTML = value;
      break;
    case 'add-class':
      element.classList.add(...value.split(/\s+/).filter(Boolean));
      break;
    case 'remove-class':
      element.classList.remove(...value.split(/\s+/).filter(Boolean));
      break;
    case 'hide':
      (element as HTMLElement).style.display = 'none';
      break;
    case 'show': {
      element.removeAttribute('hidden');
      (element as HTMLElement).style.removeProperty('display');
      if (element.ownerDocument.defaultView?.getComputedStyle(element).display === 'none')
        (element as HTMLElement).style.display = 'block';
      break;
    }
    case 'replace-image': {
      if (element.localName !== 'img') throw new Error('Replace image requires an img element.');
      element.removeAttribute('srcset');
      element.removeAttribute('sizes');
      if (element.parentElement?.localName === 'picture') {
        for (const source of Array.from(element.parentElement.children)) {
          if (source.localName === 'source') source.removeAttribute('srcset');
        }
      }
      element.setAttribute('src', value);
      if (change.imageAlt !== undefined) element.setAttribute('alt', change.imageAlt);
      break;
    }
    case 'attribute':
      if (!change.attribute?.trim()) throw new Error('Enter an attribute name.');
      element.setAttribute(change.attribute, value);
      break;
    default:
      throw new Error('Unknown element action.');
  }
}
