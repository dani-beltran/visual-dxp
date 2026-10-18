import { dataTools } from './data';
import { describeElement, type ElementDescription } from './elementDescription';
import { applyPageChange, isPageChange, type PageChange } from './pageChanges';
import { type PageUrlContext, previewPageUrl, websiteUrl } from './pageUrls';
import { getElementSelector, type PickedElement } from './picker';

export interface PageEditingSession {
  detail: (element: Element) => PickedElement;
  select: (element: Element | null) => void;
  isEditing: (element: Element) => boolean;
  focus: () => void;
  update: (changes: unknown) => boolean;
  destroy: () => void;
}

/** Runs only in the website frame. Draft changes are reversible and never leave the frame. */
export function attachPageEditing(
  doc: Document,
  send: (type: string, values?: Record<string, unknown>) => void,
  urlContext: PageUrlContext = {},
): PageEditingSession {
  let selected: Element | null = null;
  let restores: (() => void)[] = [];
  let stopEditing = () => {};
  let inline: HTMLElement | null = null;
  let inlinePath: number[] | undefined;
  let selectedPath: number[] | undefined;
  const descriptions = new WeakMap<Element, ElementDescription>();
  const bySelector = new Map<string, ElementDescription>();
  function remember(element: Element, original?: ElementDescription) {
    const cached = descriptions.get(element);
    if (cached) return cached;
    const description = original ?? describeElement(element);
    descriptions.set(element, description);
    return description;
  }

  function textDetail(element: Element) {
    if (element === selected && selectedPath) {
      let node: Node | undefined = element;
      for (const index of selectedPath) node = node?.childNodes[index];
      if (node?.nodeType === 3) return { text: node.nodeValue ?? '', textPath: selectedPath };
    }
    const walker = doc.createTreeWalker(element, 4);
    let text = walker.nextNode();
    while (
      text &&
      (!text.nodeValue?.trim() || text.parentElement?.closest('script,style,svg,noscript'))
    )
      text = walker.nextNode();
    const textPath: number[] = [];
    let node = text;
    while (node && node !== element) {
      const parent = node.parentNode;
      if (!parent) break;
      textPath.unshift(Array.from(parent.childNodes).indexOf(node as ChildNode));
      node = parent;
    }
    return { text: text?.nodeValue ?? '', textPath: text ? textPath : undefined };
  }

  function detail(element: Element): PickedElement {
    const text = textDetail(element);
    const isText = !element.matches(
      'img,svg,video,audio,iframe,input,textarea,select,script,style,html,body',
    );
    return {
      description: remember(element),
      selector: getElementSelector(element),
      tagName: element.localName,
      text: (element === selected && inline ? (inline.textContent ?? '') : text.text).slice(
        0,
        20000,
      ),
      textPath: element === selected && inline ? inlinePath : text.textPath,
      editableText: isText,
      ...(element.localName === 'a'
        ? {
            href: websiteUrl(element.getAttribute('href') ?? '', urlContext),
            linkTarget: element.getAttribute('target') ?? '',
          }
        : {}),
      ...(element.localName === 'img'
        ? {
            src: websiteUrl(
              (element as HTMLImageElement).currentSrc || element.getAttribute('src') || '',
              urlContext,
            ),
            alt: element.getAttribute('alt') ?? '',
          }
        : {}),
    };
  }

  function snapshot(element: Element, change: PageChange): () => void {
    const action = change.action ?? 'text';
    if (action === 'text' || action === 'html') {
      const children = Array.from(element.childNodes);
      const walker = doc.createTreeWalker(element, 4);
      const texts: [Node, string | null][] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode())
        texts.push([node, node.nodeValue]);
      return () => {
        element.replaceChildren(...children);
        for (const [node, value] of texts) node.nodeValue = value;
      };
    }
    const attributes =
      action === 'replace-image'
        ? ['src', 'srcset', 'sizes', 'alt']
        : action === 'attribute'
          ? [change.attribute ?? '']
          : action === 'hide' || action === 'show'
            ? ['style', 'hidden']
            : ['class'];
    const values: [Element, string, string | null][] = attributes.map((name) => [
      element,
      name,
      element.getAttribute(name),
    ]);
    if (action === 'replace-image' && element.parentElement?.localName === 'picture') {
      for (const source of Array.from(element.parentElement.children))
        if (source.localName === 'source')
          values.push([source, 'srcset', source.getAttribute('srcset')]);
    }
    return () => {
      for (const [target, name, value] of values) {
        if (value === null) target.removeAttribute(name);
        else target.setAttribute(name, value);
      }
    };
  }

  function activate() {
    if (!selected?.isConnected || !detail(selected).editableText || selected.localName === 'a')
      return;
    const target = selected;
    const text = textDetail(target);
    inlinePath = text.textPath;
    let original: Node = target;
    for (const index of inlinePath ?? []) original = original.childNodes[index];
    if (original.nodeType !== 3) {
      if (target.childNodes.length) return;
      original = doc.createTextNode('');
      target.appendChild(original);
    }
    restores.push(snapshot(target, { selector: '', action: 'text' }));
    const element = doc.createElement('visual-dxp-text');
    element.style.cssText = 'display:inline;cursor:text;white-space:pre-wrap;';
    element.setAttribute('contenteditable', 'plaintext-only');
    element.setAttribute('spellcheck', 'true');
    const selector = getElementSelector(target);
    original.parentNode?.replaceChild(element, original);
    element.appendChild(original);
    inline = element;
    const path = inlinePath;
    const input = () =>
      send('page-change', {
        change: {
          selector,
          action: 'text',
          value: element.textContent ?? '',
          textPath: path,
          element: remember(target),
        },
      });
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        element.blur();
      }
    };
    const paste = (event: ClipboardEvent) => {
      event.preventDefault();
      const selection = doc.getSelection();
      if (!selection?.rangeCount) return;
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const text = doc.createTextNode(event.clipboardData?.getData('text/plain') ?? '');
      range.insertNode(text);
      range.setStartAfter(text);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      input();
    };
    element.addEventListener('input', input);
    element.addEventListener('keydown', key);
    element.addEventListener('paste', paste);
    stopEditing = () => {
      original.nodeValue = element.textContent;
      element.replaceWith(original);
      inline = null;
      element.removeEventListener('input', input);
      element.removeEventListener('keydown', key);
      element.removeEventListener('paste', paste);
      stopEditing = () => {};
    };
  }

  return {
    detail,
    isEditing(element) {
      return element === inline || !!inline?.contains(element);
    },
    focus() {
      inline?.focus();
    },
    select(element) {
      stopEditing();
      selected = element;
      selectedPath = undefined;
      if (element) selectedPath = textDetail(element).textPath;
      activate();
    },
    update(changes) {
      if (!Array.isArray(changes) || !changes.every(isPageChange)) return false;
      const active = !!inline && doc.activeElement === inline;
      const selection = doc.getSelection();
      const offset = active ? selection?.anchorOffset : undefined;
      stopEditing();
      for (const restore of restores.reverse()) restore();
      restores = [];
      let valid = true;
      // Capture names from the restored page before any draft changes are applied.
      for (const change of changes) {
        try {
          const element = doc.querySelector(change.selector);
          if (element) bySelector.set(change.selector, remember(element, change.element));
        } catch {
          /* Dynamic or invalid selectors remain editable in Advanced. */
        }
      }
      for (const change of changes) {
        // Variables remain literal while authoring; selectors requiring input are resolved by Test.
        if (dataTools.hasVariables(change.selector)) continue;
        try {
          dataTools.validateElementValue(change);
          const targets = Array.from(doc.querySelectorAll(change.selector));
          if (!targets.length) {
            valid = false;
            continue;
          }
          for (const element of targets) {
            if (element.closest('[data-visual-dxp-picker]')) continue;
            restores.push(snapshot(element, change));
            const urlAttribute =
              change.action === 'replace-image'
                ? 'src'
                : change.action === 'attribute' && ['href', 'src'].includes(change.attribute ?? '')
                  ? change.attribute
                  : undefined;
            const displayed =
              urlAttribute && change.value !== undefined
                ? {
                    ...change,
                    value: previewPageUrl(
                      change.value,
                      [
                        element.getAttribute(urlAttribute) ?? '',
                        ...(urlAttribute === 'src'
                          ? [(element as HTMLImageElement).currentSrc ?? '']
                          : []),
                        doc.baseURI,
                      ],
                      urlContext,
                    ),
                  }
                : change;
            applyPageChange(element, displayed);
          }
        } catch {
          valid = false;
        }
      }
      send('page-descriptions', {
        descriptions: Array.from(bySelector, ([selector, element]) => ({ selector, element })),
      });
      activate();
      if (active && selected?.isConnected) {
        inline?.focus();
        const text = inline?.firstChild;
        if (text?.nodeType === 3 && offset !== undefined && selection) {
          const range = doc.createRange();
          range.setStart(text, Math.min(offset, text.textContent?.length ?? 0));
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      if (selected?.isConnected) send('select', { element: detail(selected) });
      return valid;
    },
    destroy() {
      stopEditing();
      for (const restore of restores.reverse()) restore();
      restores = [];
    },
  };
}
