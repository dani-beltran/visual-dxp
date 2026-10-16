import 'server-only';
import { type DefaultTreeAdapterMap, parse, parseFragment, serialize } from 'parse5';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import { parseSrcset, stringifySrcset } from 'srcset';
import { type PreviewConfig, PreviewError } from './config';
import { type PreviewSession, proxyUrl, targetUrl } from './tokens';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];

const resourceDirectives = new Set([
  'default-src',
  'script-src',
  'script-src-elem',
  'style-src',
  'style-src-elem',
  'img-src',
  'font-src',
  'media-src',
  'connect-src',
  'frame-src',
  'child-src',
  'worker-src',
  'manifest-src',
]);

/** A nonce would disable an existing unsafe-inline policy, so use a URL unless nonces/hashes already apply. */
function bridgeSources(sources: string[], nonce: string, config: PreviewConfig): string {
  const restricted = sources.some(
    (source) => source === "'strict-dynamic'" || /^'(?:nonce-|sha(?:256|384|512)-)/i.test(source),
  );
  return [
    ...sources.filter((source) => source !== "'none'"),
    restricted ? `'nonce-${nonce}'` : `${config.proxyOrigin}/bridge.js`,
  ].join(' ');
}

/** Adapt resource delivery to the proxy, authorize the bridge, and replace framing rules. */
export function rewriteCsp(value: string, nonce: string, config: PreviewConfig): string {
  return value
    .split(',')
    .map((policy) => {
      const directives = policy
        .split(';')
        .map((item) => item.trim())
        .filter(Boolean);
      const result: string[] = [];
      let script: string | undefined;
      let fallback: string | undefined;
      for (const directive of directives) {
        const [rawName, ...sources] = directive.split(/\s+/);
        const name = rawName.toLowerCase();
        // Reporting the preview's signed URL to the target would disclose its capability.
        if (['frame-ancestors', 'sandbox', 'report-uri', 'report-to'].includes(name)) continue;
        if (
          config.proxyOrigin.startsWith('http:') &&
          ['upgrade-insecure-requests', 'block-all-mixed-content'].includes(name)
        )
          continue;
        if (name === 'script-src' && script === undefined) script = sources.join(' ');
        const allowsBridge = name === 'script-src' || name === 'script-src-elem';
        // Explicit proxy origin also works for documents with an opaque sandbox origin.
        const adjusted = sources.flatMap((source) =>
          source === "'self'" ? [source, config.proxyOrigin] : [source],
        );
        if (
          resourceDirectives.has(name) &&
          sources.some((source) => !source.startsWith("'")) &&
          !adjusted.includes(config.proxyOrigin)
        )
          adjusted.push(config.proxyOrigin);
        if (name === 'default-src' && fallback === undefined) fallback = adjusted.join(' ');
        if (allowsBridge) {
          result.push(`${name} ${bridgeSources(adjusted, nonce, config)}`);
        } else result.push(`${name} ${adjusted.join(' ')}`.trim());
      }
      if (script === undefined && fallback !== undefined)
        result.push(`script-src ${bridgeSources(fallback.split(/\s+/), nonce, config)}`);
      return result.join('; ');
    })
    .filter(Boolean)
    .join(', ');
}

export function previewCsp(config: PreviewConfig): string {
  return `frame-ancestors 'self' ${config.editorOrigin}; sandbox allow-scripts; object-src 'none'`;
}

export function rewriteCss(source: string, rewrite: (value: string) => string): string {
  const root = postcss.parse(source);
  let references = 0;
  const resource = (value: string) => {
    if (++references > 5000) throw new PreviewError('Too many preview resource references.', 413);
    return rewrite(value);
  };
  const values = (value: string, imports = false) => {
    const parsed = valueParser(value);
    parsed.walk((node) => {
      if (node.type === 'function' && node.value.toLowerCase() === 'url') {
        const first = node.nodes.find(
          (child) => child.type !== 'space' && child.type !== 'comment',
        );
        if (first && (first.type === 'string' || first.type === 'word'))
          first.value = resource(first.value);
        return false;
      }
      if (imports && node.type === 'string') {
        node.value = resource(node.value);
        imports = false;
      }
      return undefined;
    });
    return parsed.toString();
  };
  root.walkDecls((declaration) => {
    declaration.value = values(declaration.value);
  });
  root.walkAtRules('import', (rule) => {
    rule.params = values(rule.params, true);
  });
  return root.toString();
}

/**
 * Adapts upstream HTML for loading from the proxy origin. Walks elements to rewrite
 * asset/navigation URLs and inline CSS, adjust CSP metadata, and remove conflicting
 * attributes. Injects a proxy-aware base and the preview bridge, then serializes HTML.
 * Changes only the preview response; arbitrary JavaScript URLs are not rewritten.
 */
export function rewriteHtml(
  source: string,
  page: URL,
  session: PreviewSession,
  config: PreviewConfig,
  nonce: string,
): string {
  const document = parse(source);
  const elements: Element[] = [];
  const visit = (node: Node) => {
    if ('tagName' in node) elements.push(node);
    if ('childNodes' in node) for (const child of node.childNodes) visit(child);
    if ('tagName' in node && node.tagName === 'template')
      visit((node as DefaultTreeAdapterMap['template']).content);
  };
  visit(document);
  const attr = (element: Element, name: string) => element.attrs.find((item) => item.name === name);
  let base = page.href;
  const originalBase = elements.find(
    (element) => element.tagName === 'base' && attr(element, 'href'),
  );
  const baseHref = originalBase && attr(originalBase, 'href')?.value;
  if (baseHref) {
    try {
      base = targetUrl(baseHref, page.href).href;
    } catch {
      /* Use the page URL. */
    }
  }
  let references = 0;
  const rewrite = (value: string, kind: PreviewSession['kind'] = 'asset') => {
    if (++references > 5000) throw new PreviewError('Too many preview resource references.', 413);
    if (value.trim().startsWith('#') || /^(?:data:|blob:|mailto:|tel:)/i.test(value.trim()))
      return value;
    try {
      return proxyUrl(targetUrl(value, base), session, config, kind);
    } catch {
      return 'about:blank';
    }
  };
  for (const element of elements) {
    const tag = element.tagName;
    const remove = () => {
      const parent = element.parentNode;
      if (parent && 'childNodes' in parent)
        parent.childNodes = parent.childNodes.filter((child) => child !== element);
    };
    // Replace existing bases and installed bridges; each document gets one trusted bootstrap.
    if (tag === 'base' || (tag === 'script' && attr(element, 'data-parent-origin'))) {
      remove();
      continue;
    }
    if (tag === 'meta') {
      const equivalent = attr(element, 'http-equiv')?.value.toLowerCase();
      if (equivalent === 'refresh' || equivalent === 'content-security-policy-report-only') {
        remove();
        continue;
      }
      if (equivalent === 'content-security-policy') {
        const content = attr(element, 'content');
        if (content) content.value = rewriteCsp(content.value, nonce, config);
      }
    }
    // Proxied CSS is transformed and cannot retain its original integrity hash.
    // Remove crossorigin so classic scripts do not require credentialed CORS from an opaque origin.
    element.attrs = element.attrs.filter(
      (item) => !['integrity', 'crossorigin', 'ping', 'srcdoc'].includes(item.name),
    );
    if (tag === 'a' || tag === 'area' || tag === 'form') {
      element.attrs = element.attrs.filter((item) => item.name !== 'target');
      element.attrs.push({ name: 'target', value: '_self' });
    }
    for (const item of element.attrs) {
      if (item.name === 'srcset' || item.name === 'imagesrcset') {
        item.value = stringifySrcset(
          parseSrcset(item.value).map((entry) => ({ ...entry, url: rewrite(entry.url) })),
        );
      } else if (item.name === 'style') {
        item.value = rewriteCss(`a{${item.value}}`, rewrite).slice(2, -1);
      } else if (
        ['href', 'src', 'poster', 'action', 'formaction', 'background'].includes(item.name) ||
        (tag === 'object' && item.name === 'data')
      ) {
        // SVG fragments stay local, while navigable HTML documents get a document capability.
        const navigation =
          (item.name === 'href' && ['a', 'area'].includes(tag)) ||
          ['action', 'formaction'].includes(item.name) ||
          (item.name === 'src' && ['iframe', 'frame'].includes(tag));
        item.value = rewrite(item.value, navigation ? 'document' : 'asset');
      }
    }
    if (tag === 'style')
      for (const child of element.childNodes) {
        if (child.nodeName === '#text') {
          const text = child as DefaultTreeAdapterMap['textNode'];
          text.value = rewriteCss(text.value, rewrite);
        }
      }
  }
  const head = elements.find((element) => element.tagName === 'head');
  if (!head) throw new Error('The website has no HTML document head.');
  const bootstrap = parseFragment('<base><script></script>');
  const baseElement = bootstrap.childNodes[0] as Element;
  baseElement.attrs = [{ name: 'href', value: proxyUrl(targetUrl(base), session, config) }];
  const script = bootstrap.childNodes[1] as Element;
  script.attrs = [
    { name: 'src', value: `${config.proxyOrigin}/bridge.js` },
    { name: 'nonce', value: nonce },
    { name: 'data-parent-origin', value: config.editorOrigin },
    { name: 'data-target-url', value: page.href },
    { name: 'data-target-base-url', value: base },
  ];
  for (const node of bootstrap.childNodes) node.parentNode = head;
  head.childNodes.unshift(...bootstrap.childNodes);
  return serialize(document);
}
