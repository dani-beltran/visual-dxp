import type { BuilderTranslator } from './i18n';
import { getElementSelector } from './picker';

/** Presentation-only metadata captured before an element is customized. */
export interface ElementDescription {
  kind: 'heading' | 'image' | 'link' | 'button' | 'field' | 'text' | 'element';
  name?: string;
  context?: 'header' | 'footer' | 'navigation' | 'main';
}

export function isElementDescription(value: unknown): value is ElementDescription {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const description = value as ElementDescription;
  return (
    Object.keys(description).every((key) => ['kind', 'name', 'context'].includes(key)) &&
    ['heading', 'image', 'link', 'button', 'field', 'text', 'element'].includes(description.kind) &&
    (description.name === undefined ||
      (typeof description.name === 'string' && description.name.length <= 200)) &&
    (description.context === undefined ||
      ['header', 'footer', 'navigation', 'main'].includes(description.context))
  );
}

/** Describe semantic type and original content; CSS classes are never translated or guessed. */
export function describeElement(element: Element): ElementDescription {
  const shorten = (value: string) => {
    const normalized = value.trim().replace(/\s+/g, ' ');
    const characters = Array.from(normalized);
    return characters.length > 80 ? `${characters.slice(0, 79).join('')}…` : normalized;
  };
  const visibleText = (target: Element): string => {
    if (target.matches('script,style,noscript,svg,[hidden],[aria-hidden="true"]')) return '';
    const copy = target.cloneNode(true) as Element;
    for (const hidden of copy.querySelectorAll(
      'script,style,noscript,svg,[hidden],[aria-hidden="true"]',
    ))
      hidden.remove();
    for (const br of copy.querySelectorAll('br')) br.replaceWith(' ');
    return shorten(copy.textContent ?? '');
  };
  const labelledBy = (element.getAttribute('aria-labelledby') ?? '')
    .split(/\s+/)
    .map((id) => element.ownerDocument.getElementById(id))
    .filter((label): label is HTMLElement => !!label)
    .map(visibleText)
    .join(' ');
  const labels =
    'labels' in element
      ? Array.from((element as HTMLInputElement).labels ?? [])
          .map(visibleText)
          .join(' ')
      : '';
  const accessible =
    labelledBy || element.getAttribute('aria-label') || element.getAttribute('alt') || labels;
  const buttonValue = element.matches(
    'input[type="button"],input[type="submit"],input[type="reset"]',
  )
    ? element.getAttribute('value')
    : '';
  const name = shorten(
    element.getAttribute('data-dxp-label') ||
      element.getAttribute('data-visual-dxp-label') ||
      accessible ||
      buttonValue ||
      visibleText(element) ||
      element.getAttribute('title') ||
      element.getAttribute('placeholder') ||
      '',
  );
  const kind: ElementDescription['kind'] = element.matches('h1,h2,h3,h4,h5,h6,[role="heading"]')
    ? 'heading'
    : element.matches('img,[role="img"]')
      ? 'image'
      : element.matches('a,[role="link"]')
        ? 'link'
        : element.matches(
              'button,input[type="button"],input[type="submit"],input[type="reset"],[role="button"]',
            )
          ? 'button'
          : element.matches('input,textarea,select,[role="textbox"],[role="combobox"]')
            ? 'field'
            : element.matches('p,span,em,strong,b,i,label,small,li,blockquote')
              ? 'text'
              : 'element';
  const region =
    element.closest('header,footer,[role="banner"],[role="contentinfo"]') ??
    element.closest('nav,main,[role="navigation"],[role="main"]');
  const regionKind: ElementDescription['context'] = region?.matches('header,[role="banner"]')
    ? 'header'
    : region?.matches('footer,[role="contentinfo"]')
      ? 'footer'
      : region?.matches('nav,[role="navigation"]')
        ? 'navigation'
        : region
          ? 'main'
          : undefined;
  // Context distinguishes repeated labels, and gives unlabeled images a useful location.
  const repeated =
    !!name &&
    Array.from(element.ownerDocument.querySelectorAll(element.localName)).some(
      (other) =>
        other !== element &&
        shorten(
          other.getAttribute('aria-label') || other.getAttribute('alt') || visibleText(other),
        ) === name,
    );
  return {
    kind,
    ...(name
      ? { name }
      : kind === 'element' && !regionKind
        ? { name: shorten(getElementSelector(element)) }
        : {}),
    ...((repeated || !name) && regionKind ? { context: regionKind } : {}),
  };
}

export function formatElementDescription(
  description: ElementDescription,
  t: BuilderTranslator,
): string {
  const type = t(`pageElement.${description.kind}`);
  const label = description.name ? `${type} · “${description.name}”` : type;
  return description.context ? `${t(`pageContext.${description.context}`)} · ${label}` : label;
}
