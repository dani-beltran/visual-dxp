import type { PageChange } from './pageChanges';

export interface PageUrlContext {
  proxyOrigin?: string;
  baseUrl?: string;
}

/** Decode routing metadata for presentation only. The proxy server still verifies every capability. */
function readPreviewUrl(value: string, context: PageUrlContext) {
  if (!context.proxyOrigin) return undefined;
  try {
    const proxy = new URL(value, context.proxyOrigin);
    if (proxy.origin !== new URL(context.proxyOrigin).origin) return undefined;
    const match = /^\/api\/preview\/content\/([\w-]+\.[\w-]+)(\/.*)?$/.exec(proxy.pathname);
    if (!match) return undefined;
    const payload = match[1].split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(payload), (character) => character.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof claims.origin !== 'string') return undefined;
    const target = new URL(claims.origin);
    if (!['http:', 'https:'].includes(target.protocol) || target.origin !== claims.origin)
      return undefined;
    target.pathname = match[2] || '/';
    target.search = proxy.search;
    target.hash = proxy.hash;
    return { proxy, token: match[1], target };
  } catch {
    return undefined;
  }
}

/** Keep real and relative website URLs as authored; unwrap only this preview proxy's URLs. */
export function websiteUrl(value: string, context: PageUrlContext): string {
  return readPreviewUrl(value, context)?.target.href ?? value;
}

/** Reuse existing preview routing to display edits without putting capabilities in saved changes. */
export function previewPageUrl(
  value: string,
  references: string[],
  context: PageUrlContext,
): string {
  if (!context.proxyOrigin || !value || value.trim().startsWith('#')) return value;
  try {
    const target = new URL(websiteUrl(value, context), context.baseUrl);
    for (const reference of references) {
      const route = readPreviewUrl(reference, context);
      if (!route || route.target.origin !== target.origin) continue;
      const preview = new URL(route.proxy.origin);
      preview.pathname = `/api/preview/content/${route.token}${target.pathname}`;
      preview.search = target.search;
      preview.hash = target.hash;
      return preview.href;
    }
  } catch {
    /* Leave incomplete inputs editable. */
  }
  return value;
}

export function normalizePageChangeUrls(change: PageChange, context: PageUrlContext): PageChange {
  if (
    change.value === undefined ||
    !(
      change.action === 'replace-image' ||
      (change.action === 'attribute' && ['href', 'src'].includes(change.attribute ?? ''))
    )
  )
    return change;
  const value = websiteUrl(change.value, context);
  return value === change.value ? change : { ...change, value };
}
