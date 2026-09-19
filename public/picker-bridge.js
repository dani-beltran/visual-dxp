/**
 * Forma DXP element-picker bridge. Host this file on the website being inspected.
 * <script src="/picker-bridge.js" data-parent-origin="https://your-editor.example"></script>
 * The exact parent origin is mandatory. The site must separately permit framing.
 * This bridge never executes code received through postMessage.
 */
(() => {
  // biome-ignore lint/suspicious/noRedundantUseStrict: This bridge is loaded as a classic script by external sites.
  'use strict';
  const script = document.currentScript;
  const configuredOrigin = script && script.getAttribute('data-parent-origin');
  if (!configuredOrigin || window.parent === window) return;
  let parentOrigin;
  try {
    const parsedOrigin = new URL(configuredOrigin);
    if (!/^https?:$/.test(parsedOrigin.protocol) || parsedOrigin.origin !== configuredOrigin)
      return;
    parentOrigin = parsedOrigin.origin;
  } catch (_) {
    return;
  }

  const protocol = 'forma:element-picker';
  let activeChannel = null;
  let session = null;
  function send(type, values) {
    window.parent.postMessage(
      Object.assign({ protocol: protocol, channel: activeChannel, type: type }, values || {}),
      parentOrigin,
    );
  }
  function escapeSelector(value) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(value);
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
          return '\\' + code.toString(16) + ' ';
        if (index === 0 && character === '-' && value.length === 1) return '\\-';
        return code >= 128 || /[a-zA-Z0-9_-]/.test(character) ? character : '\\' + character;
      })
      .join('');
  }
  function selectorFor(element) {
    function unique(selector) {
      try {
        return document.querySelectorAll(selector).length === 1;
      } catch (_) {
        return false;
      }
    }
    const parts = [];
    let current = element;
    while (current) {
      const tag = current.tagName.toLowerCase();
      if (current.id && unique('#' + escapeSelector(current.id))) {
        parts.unshift('#' + escapeSelector(current.id));
        break;
      }
      const testId = current.getAttribute('data-testid');
      if (testId) {
        const stable =
          '[data-testid="' +
          testId.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\a ') +
          '"]';
        if (unique(stable)) {
          parts.unshift(stable);
          break;
        }
      }
      let part = tag;
      const siblings = current.parentElement
        ? Array.from(current.parentElement.children).filter(
            (child) => child.tagName === current.tagName,
          )
        : [];
      if (siblings.length > 1) part += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
      parts.unshift(part);
      if (unique(parts.join(' > '))) break;
      current = current.parentElement;
    }
    return parts.join(' > ');
  }
  function attach() {
    const root = document.createElement('div');
    root.setAttribute('data-forma-picker', 'overlay');
    root.setAttribute('aria-hidden', 'true');
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
    function outline(selected) {
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
    let hovered = null;
    let selected = null;
    function detail(element) {
      return {
        selector: selectorFor(element),
        tagName: element.tagName.toLowerCase(),
        text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100),
      };
    }
    function draw(element, highlight, isSelected) {
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
      highlight.label.textContent = (isSelected ? 'Selected · ' : '') + selectorFor(element);
      highlight.label.style.bottom = rect.top < 30 ? 'auto' : '100%';
      highlight.label.style.top = rect.top < 30 ? '100%' : 'auto';
    }
    function refresh() {
      draw(hovered === selected ? null : hovered, hoveredOutline, false);
      draw(selected, selectedOutline, true);
    }
    function valid(target) {
      return (
        target && typeof target.closest === 'function' && !target.closest('[data-forma-picker]')
      );
    }
    function move(event) {
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
    function click(event) {
      if (!valid(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      selected = event.target;
      refresh();
      send('select', { element: detail(selected) });
    }
    document.addEventListener('mousemove', move, true);
    document.addEventListener('click', click, true);
    document.addEventListener('mouseleave', leave, true);
    document.addEventListener('scroll', refresh, true);
    window.addEventListener('resize', refresh);
    return {
      select: (selector) => {
        try {
          selected = selector.trim() ? document.querySelector(selector) : null;
          refresh();
          return !!selected;
        } catch (_) {
          selected = null;
          refresh();
          return false;
        }
      },
      destroy: () => {
        root.remove();
        document.removeEventListener('mousemove', move, true);
        document.removeEventListener('click', click, true);
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
      if (!document.documentElement) return;
      if (session) session.destroy();
      activeChannel = data.channel;
      session = attach();
      if (typeof data.selector === 'string' && data.selector.length <= 4000)
        session.select(data.selector);
      send('ready');
      return;
    }
    if (!session || data.channel !== activeChannel) return;
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
    }
  });
})();
