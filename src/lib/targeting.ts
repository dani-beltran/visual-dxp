import type { Workflow } from './types';

export const EXPORT_TARGET_MESSAGE =
  'Configure your website URL before exporting. The demo website is for preview only.';

export interface ExportOptions {
  /** Editor URL/origin. Defaults to window.location.origin; required for relative URLs in Node. */
  baseUrl?: string;
}

/** Resolve target scope from the editor origin, never its current route or document base. */
export function resolveWebsiteUrl(value: string, baseUrl?: string): URL {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Enter a website URL.');
  const input = value.trim();
  if (/\s/.test(input)) throw new Error('Encode spaces in the website URL.');
  const base = baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : undefined);
  let url: URL;
  try {
    url = new URL(input, base ? `${new URL(base).origin}/` : undefined);
  } catch {
    throw new Error(
      'Enter a valid HTTP or HTTPS URL. For a relative path, provide the editor baseUrl.',
    );
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Enter an HTTP or HTTPS website URL without embedded credentials.');
  // Queries and fragments do not define scope; trailing slashes are equivalent.
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  url.search = '';
  url.hash = '';
  return url;
}

/** Export eligibility is deliberately separate from editable/preview graph validation. */
export function validateExportTarget(workflow: Workflow, options: ExportOptions = {}): URL {
  try {
    const target = resolveWebsiteUrl(workflow?.websiteUrl, options.baseUrl);
    const base =
      options.baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : undefined);
    // Static servers may decode percent-encoded filenames before serving the demo.
    const demoPath =
      target.pathname
        .replace(/%([0-9a-f]{2})/gi, (_, hex: string) =>
          String.fromCharCode(Number.parseInt(hex, 16)),
        )
        .replace(/\/+$/, '') || '/';
    if (base && target.origin === new URL(base).origin && demoPath === '/demo-site.html')
      throw new Error('Choose your own website instead of the built-in demo.');
    if (workflow.includeSubpages !== undefined && typeof workflow.includeSubpages !== 'boolean')
      throw new Error('Include subpages must be a boolean.');
    return target;
  } catch (error) {
    throw new Error(`${EXPORT_TARGET_MESSAGE} ${(error as Error).message}`);
  }
}

/**
 * Self-contained: serialized verbatim into standalone scripts, including minified builds.
 * Targets must already be absolute. Never resolve them against the executing page.
 */
export function matchesTargetUrl(
  targetUrl: string,
  pageUrl: string,
  includeSubpages = false,
): boolean {
  try {
    const target = new URL(targetUrl);
    const page = new URL(pageUrl);
    if (!['http:', 'https:'].includes(target.protocol) || target.origin !== page.origin)
      return false;
    const targetPath = target.pathname.replace(/\/+$/, '') || '/';
    const pagePath = page.pathname.replace(/\/+$/, '') || '/';
    return (
      pagePath === targetPath ||
      (includeSubpages === true && (targetPath === '/' || pagePath.startsWith(`${targetPath}/`)))
    );
  } catch {
    return false;
  }
}
