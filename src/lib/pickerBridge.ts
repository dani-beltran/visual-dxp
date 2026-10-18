import { attachPageEditing, type PageEditingSession } from './pageEditing';
import { getElementSelector, PICKER_PROTOCOL, type PickerSession } from './picker';

/**
 * Visual DXP element-picker bridge. Bundled with the preview bridge for external websites.
 * <script src="https://your-editor.example/bridge.js" data-parent-origin="https://your-editor.example"></script>
 * The exact parent origin is mandatory. The site must separately permit framing.
 * This bridge never executes code received through postMessage.
 */
export function installPickerBridge(configuredOrigin: string, targetBaseUrl?: string) {
  const logPrefix = '[Visual DXP picker bridge]';
  console.info(logPrefix, 'Script loaded.');
  if (!configuredOrigin) {
    console.warn(logPrefix, 'Inactive: add data-parent-origin with the exact editor origin.');
    return;
  }
  let parentOrigin: string;
  try {
    const parsedOrigin = new URL(configuredOrigin);
    if (!/^https?:$/.test(parsedOrigin.protocol) || parsedOrigin.origin !== configuredOrigin) {
      console.warn(
        logPrefix,
        'Inactive: data-parent-origin must be an exact HTTP(S) origin without a trailing slash.',
      );
      return;
    }
    parentOrigin = parsedOrigin.origin;
  } catch (_) {
    console.warn(logPrefix, 'Inactive: data-parent-origin is not a valid URL.');
    return;
  }
  // Check from a direct visit: a blocked iframe cannot execute this script, and
  // the editor's opaque sandbox origin cannot reliably fetch the host's headers.
  async function checkEmbedding() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const page = new URL(window.location.href);
      if (!/^https?:$/.test(page.protocol)) throw new Error();
      const response = await window.fetch(page.href, {
        method: 'HEAD',
        mode: 'same-origin',
        credentials: 'same-origin',
        redirect: 'error',
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error();
      const editor = new URL(parentOrigin);
      // null means a source needs browser/manual verification, not that it blocks.
      function matches(source: string): boolean | null {
        if (source === '*') return true;
        if (source.toLowerCase() === "'none'") return false;
        if (source.toLowerCase() === "'self'") {
          if (page.origin === editor.origin) return true;
          // CSP can allow secure upgrades for 'self'. Leave these to the browser.
          if (page.protocol === 'http:' && editor.protocol === 'https:') return null;
          return false;
        }
        if (/^https?:$/i.test(source))
          return source.toLowerCase() === editor.protocol || source.toLowerCase() === 'http:';
        const host = source.match(
          /^(?:(https?):\/\/)?(\*|(?:\*\.)?[a-z0-9.-]+)(?::(\*|[0-9]+))?\/?$/i,
        );
        if (!host) return null;
        const scheme = host[1] ? host[1].toLowerCase() + ':' : page.protocol;
        const hostname = host[2].toLowerCase();
        const port = host[3];
        const schemeMatches =
          scheme === editor.protocol || (scheme === 'http:' && editor.protocol === 'https:');
        const hostMatches =
          hostname === '*' ||
          (hostname.startsWith('*.')
            ? editor.hostname.endsWith(hostname.slice(1))
            : hostname === editor.hostname);
        const editorPort = editor.port || (editor.protocol === 'https:' ? '443' : '80');
        const portMatches =
          port === '*' ||
          (!port && !editor.port) ||
          (port !== undefined && Number(port) === Number(editorPort));
        return schemeMatches && hostMatches && portMatches;
      }
      const policies = (response.headers.get('content-security-policy') || '').split(',');
      const ancestors = policies
        .map((policy) =>
          policy
            .split(';')
            .map((value) => value.trim())
            .find((value) => /^frame-ancestors(?:\s|$)/i.test(value)),
        )
        .filter((value) => value !== undefined);
      let blocked = false;
      let uncertain = false;
      if (ancestors.length) {
        // Every enforced policy must allow the parent; only the first duplicate
        // directive in each policy applies. Enforced frame-ancestors overrides XFO.
        for (const directive of ancestors) {
          const results = directive.split(/\s+/).slice(1).map(matches);
          if (!results.includes(true)) {
            if (results.includes(null)) uncertain = true;
            else blocked = true;
          }
        }
      } else {
        const options = (response.headers.get('x-frame-options') || '')
          .split(',')
          .map((value) => value.trim().toUpperCase())
          .filter(Boolean);
        blocked =
          options.includes('DENY') ||
          (options.includes('SAMEORIGIN') && page.origin !== editor.origin);
        uncertain = options.some((value) => value !== 'DENY' && value !== 'SAMEORIGIN');
      }
      if (blocked) {
        console.warn(
          logPrefix,
          'Iframe embedding appears blocked for the configured editor. Update the host response headers: CSP frame-ancestors or X-Frame-Options.',
          { parentOrigin: parentOrigin },
        );
      } else if (uncertain) {
        console.warn(
          logPrefix,
          'Unable to verify iframe embedding: review the response framing policy in browser DevTools.',
        );
      } else {
        console.info(
          logPrefix,
          'Header check found no restriction blocking the configured editor. Confirm by opening the picker; navigation headers and other ancestors may differ.',
        );
      }
    } catch (_) {
      console.warn(
        logPrefix,
        'Unable to verify iframe embedding: the HEAD request failed, redirected, timed out, or was blocked. Inspect CSP frame-ancestors and X-Frame-Options in browser DevTools.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
  if (window.parent === window) {
    void checkEmbedding();
    console.info(logPrefix, 'Inactive: open this website in the editor picker iframe to connect.');
    return;
  }

  const protocol = PICKER_PROTOCOL;
  let activeChannel: string | null = null;
  let session: PickerSession | null = null;
  let editor: PageEditingSession | null = null;
  function send(type: string, values: Record<string, unknown> = {}) {
    window.parent.postMessage(
      Object.assign({ protocol: protocol, channel: activeChannel, type: type }, values || {}),
      parentOrigin,
    );
  }
  function attach() {
    const root = document.createElement('div');
    root.setAttribute('data-visual-dxp-picker', 'overlay');
    root.setAttribute('aria-hidden', 'true');
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
    function outline(selected: boolean) {
      const box = document.createElement('div');
      box.style.cssText =
        'position:fixed;display:none;pointer-events:none;border:2px ' +
        (selected ? 'solid' : 'dashed') +
        ' #42966c;box-sizing:border-box;border-radius:3px;background:rgba(77,157,112,.09);';
      const label = document.createElement('span');
      label.style.cssText =
        'position:absolute;left:-2px;bottom:100%;max-width:330px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:5px 8px;background:#28724b;color:white;border-radius:4px 4px 0 0;font:11px/1.2 ui-monospace,monospace;';
      box.appendChild(label);
      root.appendChild(box);
      return { box: box, label: label };
    }
    const hoveredOutline = outline(false);
    const selectedOutline = outline(true);
    document.documentElement.appendChild(root);
    let hovered: Element | null = null;
    let selected: Element | null = null;
    function detail(element: Element) {
      if (editor) return editor.detail(element);
      return {
        selector: getElementSelector(element),
        tagName: element.tagName.toLowerCase(),
        text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100),
      };
    }
    function draw(
      element: Element | null,
      highlight: ReturnType<typeof outline>,
      isSelected: boolean,
    ) {
      if (!element || !element.isConnected) {
        highlight.box.style.display = 'none';
        return;
      }
      const rect = element.getBoundingClientRect();
      Object.assign(highlight.box.style, {
        display: 'block',
        left: rect.left + 'px',
        top: rect.top + 'px',
        width: rect.width + 'px',
        height: rect.height + 'px',
      });
      highlight.label.textContent = (isSelected ? 'Selected · ' : '') + getElementSelector(element);
      highlight.label.style.bottom = rect.top < 30 ? 'auto' : '100%';
      highlight.label.style.top = rect.top < 30 ? '100%' : 'auto';
    }
    function refresh() {
      draw(hovered === selected ? null : hovered, hoveredOutline, false);
      draw(selected, selectedOutline, true);
    }
    function valid(target: EventTarget | null): target is Element {
      return (
        !!target &&
        typeof (target as Element).closest === 'function' &&
        !(target as Element).closest('[data-visual-dxp-picker]')
      );
    }
    function move(event: MouseEvent) {
      if (valid(event.target) && editor?.isEditing(event.target)) return;
      if (!valid(event.target) || event.target === hovered) return;
      hovered = event.target;
      refresh();
      send('hover', { element: detail(hovered) });
    }
    function leave() {
      hovered = null;
      refresh();
      send('hover', { element: null });
    }
    function click(event: MouseEvent) {
      if (!valid(event.target)) return;
      if (editor?.isEditing(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      selected = editor
        ? event.target.closest('img') || event.target.closest('a') || event.target
        : event.target;
      editor?.select(selected);
      editor?.focus();
      refresh();
      send('select', { element: detail(selected) });
      console.info(logPrefix, 'Element selected and sent to the editor.');
    }
    function submit(event: Event) {
      if (!editor) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    function keydown(event: KeyboardEvent) {
      if (!editor) return;
      const key = event.key.toLowerCase();
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        (key === 'z' || (event.ctrlKey && key === 'y'))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        send(event.shiftKey || key === 'y' ? 'request-redo' : 'request-undo');
        return;
      }
      if (event.key !== 'Escape') return;
      if (valid(event.target) && editor.isEditing(event.target)) return;
      event.preventDefault();
      send('request-close');
    }
    document.addEventListener('mousemove', move, true);
    document.addEventListener('click', click, true);
    document.addEventListener('submit', submit, true);
    document.addEventListener('keydown', keydown, true);
    document.addEventListener('mouseleave', leave, true);
    document.addEventListener('scroll', refresh, true);
    window.addEventListener('resize', refresh);
    return {
      select: (selector: string) => {
        try {
          selected = selector.trim() ? document.querySelector(selector) : null;
          editor?.select(selected);
          if (editor && selected) send('select', { element: detail(selected) });
          refresh();
          console.info(logPrefix, 'Selector lookup completed.', { found: !!selected });
          return !!selected;
        } catch (_) {
          selected = null;
          refresh();
          console.warn(logPrefix, 'Selector lookup failed: invalid CSS selector.');
          return false;
        }
      },
      destroy: () => {
        editor?.destroy();
        editor = null;
        root.remove();
        document.removeEventListener('mousemove', move, true);
        document.removeEventListener('click', click, true);
        document.removeEventListener('submit', submit, true);
        document.removeEventListener('keydown', keydown, true);
        document.removeEventListener('mouseleave', leave, true);
        document.removeEventListener('scroll', refresh, true);
        window.removeEventListener('resize', refresh);
      },
    };
  }
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.origin !== parentOrigin) return;
    const data = event.data;
    if (
      !data ||
      data.protocol !== protocol ||
      typeof data.channel !== 'string' ||
      data.channel.length > 200
    )
      return;
    if (data.type === 'init') {
      if (!document.documentElement) {
        console.warn(logPrefix, 'Initialization deferred: the document root is not available yet.');
        return;
      }
      console.info(logPrefix, session ? 'Restarting picker session.' : 'Starting picker session.');
      if (session) session.destroy();
      activeChannel = data.channel;
      session = attach();
      if (data.editing === true) {
        editor = attachPageEditing(document, send, {
          baseUrl: targetBaseUrl,
          proxyOrigin: targetBaseUrl ? window.location.origin : undefined,
        });
        editor.update(data.changes ?? []);
      }
      if (typeof data.selector === 'string' && data.selector.length <= 4000)
        session.select(data.selector);
      send('ready', editor ? { editing: true } : {});
      console.info(logPrefix, 'Picker ready; acknowledgment sent to the editor.');
      return;
    }
    if (!session || data.channel !== activeChannel) return;
    if (data.type === 'set-changes' && editor)
      send('changes-result', { valid: editor.update(data.changes) });
    if (
      data.type === 'set-selector' &&
      typeof data.selector === 'string' &&
      data.selector.length <= 4000
    )
      send('selector-result', { found: session.select(data.selector) });
    if (data.type === 'stop') {
      session.destroy();
      session = null;
      activeChannel = null;
      console.info(logPrefix, 'Picker stopped; overlays and selection listeners removed.');
    }
  });
  console.info(logPrefix, 'Listening for editor initialization.', { parentOrigin: parentOrigin });
}
