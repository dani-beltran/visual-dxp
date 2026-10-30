import type { DefaultTreeAdapterMap } from 'parse5';

/** Nuxt framework detection: keep proxy workarounds off ordinary documents. */
export function isNuxtDocument(elements: DefaultTreeAdapterMap['element'][]): boolean {
  return elements.some(
    (element) =>
      element.tagName === 'script' &&
      element.attrs.some((attr) => attr.name === 'id' && attr.value === '__NUXT_DATA__'),
  );
}
