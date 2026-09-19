import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, Check, Globe2, Info, MousePointer2, RefreshCw, X } from 'lucide-react';
import { attachElementPicker, normalizeWebsiteUrl, PICKER_PROTOCOL } from '../lib/picker';
import type { PickedElement, PickerSession } from '../lib/picker';
import '../styles/picker.css';

export interface ElementPickerProps {
  url: string;
  initialSelector?: string;
  onSelect: (selector: string) => void;
  onClose: () => void;
  onUrlChange?: (url: string) => void;
}

type ConnectionStatus = 'loading' | 'connected' | 'bridge' | 'unavailable';

export function ElementPicker({
  url,
  initialSelector = '',
  onSelect,
  onClose,
  onUrlChange,
}: ElementPickerProps) {
  const headingId = useId();
  const selectorId = useId();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<PickerSession | null>(null);
  const initRef = useRef<() => void>(() => undefined);
  const channelRef = useRef('');
  const selectorRef = useRef(initialSelector);
  const [urlInput, setUrlInput] = useState(url || '/demo-site.html');
  const [frameUrl, setFrameUrl] = useState(() => {
    try {
      return normalizeWebsiteUrl(url || '/demo-site.html', window.location.href);
    } catch {
      return '';
    }
  });
  const [reload, setReload] = useState(0);
  const [selector, setSelector] = useState(initialSelector);
  const [hovered, setHovered] = useState<PickedElement | null>(null);
  const [selected, setSelected] = useState<PickedElement | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('loading');
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [selectorHint, setSelectorHint] = useState('');

  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => prior?.focus();
  }, []);

  useEffect(() => {
    if (!frameUrl) {
      setStatus('unavailable');
      return;
    }
    const origin = new URL(frameUrl).origin;
    const channel = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    channelRef.current = channel;
    const frame = frameRef.current;
    let attached = false;
    let finished = false;
    let retry: number | undefined;
    let timeout: number | undefined;
    setStatus('loading');
    setHovered(null);
    setSelected(null);
    setSelectorHint('');
    const pick = (element: PickedElement) => {
      setSelected(element);
      setSelector(element.selector);
      selectorRef.current = element.selector;
      setSelectorHint('');
    };
    const send = (type: string, extra: Record<string, unknown> = {}) =>
      frame?.contentWindow?.postMessage(
        { protocol: PICKER_PROTOCOL, type, channel, ...extra },
        origin,
      );
    const initialize = () => {
      if (attached) return;
      try {
        const doc = frame?.contentDocument;
        if (!doc || !doc.body || frame?.contentWindow?.location.href === 'about:blank')
          throw new Error('Waiting for page');
        sessionRef.current?.destroy();
        sessionRef.current = attachElementPicker(doc, setHovered, pick);
        sessionRef.current.select(selectorRef.current);
        attached = true;
        finished = true;
        setStatus('connected');
      } catch {
        send('init', { selector: selectorRef.current });
      }
    };
    const reconnect = () => {
      attached = false;
      finished = false;
      window.clearInterval(retry);
      window.clearTimeout(timeout);
      sessionRef.current?.destroy();
      sessionRef.current = null;
      setStatus('loading');
      setHovered(null);
      setSelected(null);
      setSelectorHint('');
      retry = window.setInterval(initialize, 1000);
      timeout = window.setTimeout(() => {
        if (!finished) setStatus('unavailable');
        window.clearInterval(retry);
      }, 8000);
      initialize();
    };
    initRef.current = reconnect;
    const isElement = (value: unknown): value is PickedElement =>
      !!value &&
      typeof value === 'object' &&
      typeof (value as PickedElement).selector === 'string' &&
      typeof (value as PickedElement).tagName === 'string' &&
      typeof (value as PickedElement).text === 'string';
    const message = (event: MessageEvent) => {
      if (event.source !== frame?.contentWindow || event.origin !== origin) return;
      const data = event.data;
      if (!data || data.protocol !== PICKER_PROTOCOL || data.channel !== channel) return;
      if (data.type === 'ready') {
        finished = true;
        attached = true;
        setStatus('bridge');
      }
      if (data.type === 'hover' && (data.element === null || isElement(data.element)))
        setHovered(data.element);
      if (data.type === 'select' && isElement(data.element)) pick(data.element);
      if (data.type === 'selector-result')
        setSelectorHint(
          data.found
            ? 'Element found on the page.'
            : 'No matching element found. You can still use this selector.',
        );
    };
    window.addEventListener('message', message);
    reconnect();
    return () => {
      sessionRef.current?.destroy();
      sessionRef.current = null;
      send('stop');
      window.removeEventListener('message', message);
      window.clearInterval(retry);
      window.clearTimeout(timeout);
      if (initRef.current === reconnect) initRef.current = () => undefined;
    };
  }, [frameUrl, reload]);

  const loadUrl = () => {
    try {
      const normalized = normalizeWebsiteUrl(urlInput, window.location.href);
      setError('');
      setFrameUrl(normalized);
      setReload((value) => value + 1);
      onUrlChange?.(normalized);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Enter a valid website URL.');
    }
  };
  const updateSelector = (value: string) => {
    setSelector(value);
    selectorRef.current = value;
    setSelected(null);
    setSelectorHint('');
    if (sessionRef.current) {
      const found = sessionRef.current.select(value);
      if (value.trim())
        setSelectorHint(
          found
            ? 'Element found on the page.'
            : 'No matching element found. You can still use this selector.',
        );
    } else if (frameUrl && status === 'bridge') {
      frameRef.current?.contentWindow?.postMessage(
        {
          protocol: PICKER_PROTOCOL,
          type: 'set-selector',
          channel: channelRef.current,
          selector: value,
        },
        new URL(frameUrl).origin,
      );
    }
  };
  const validSelector = () => {
    if (!selector.trim()) return false;
    try {
      document.querySelector(selector.trim());
      return true;
    } catch {
      return false;
    }
  };
  const isValid = validSelector();
  const bridgeSnippet = `<script src="/picker-bridge.js" data-parent-origin="${typeof window !== 'undefined' ? window.location.origin : 'https://your-editor.example'}"></script>`;

  return (
    <div
      className="dxp-picker-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="dxp-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
          }
          if (event.key === 'Tab') {
            const focusable = Array.from(
              dialogRef.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input, summary, a[href], iframe',
              ) || [],
            );
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            }
            if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header className="dxp-picker-header">
          <div className="dxp-picker-title-icon">
            <MousePointer2 size={19} />
          </div>
          <div>
            <h2 id={headingId}>Select an element</h2>
            <p>Point, click, and connect your experience.</p>
          </div>
          <button
            className="dxp-picker-icon-button"
            aria-label="Close element picker"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <form
          className="dxp-picker-address"
          onSubmit={(event) => {
            event.preventDefault();
            loadUrl();
          }}
        >
          <Globe2 size={16} aria-hidden="true" />
          <input
            aria-label="Website URL"
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            placeholder="https://your-website.com"
          />
          <button type="submit" className="dxp-picker-load">
            <RefreshCw size={14} /> Load website
          </button>
        </form>
        {error && (
          <div className="dxp-picker-error" role="alert">
            {error}
          </div>
        )}
        <div className="dxp-picker-toolbar">
          <span className={`dxp-picker-status dxp-picker-status-${status}`}>
            <i />
            {status === 'connected' || status === 'bridge'
              ? 'Selection mode is on'
              : status === 'loading'
                ? 'Connecting to website…'
                : 'Connection required'}
          </span>
          <span className="dxp-picker-hint">
            {hovered ? <code>{hovered.selector}</code> : 'Hover to inspect · Click to select'}
          </span>
          <button onClick={() => setShowHelp(!showHelp)} aria-expanded={showHelp}>
            <Info size={14} /> Website setup
          </button>
        </div>
        {(showHelp || status === 'unavailable') && (
          <div className="dxp-picker-help">
            <strong>
              {status === 'unavailable'
                ? 'This website has not connected to the picker.'
                : 'Connect your website'}
            </strong>
            <p>
              Same-origin pages work automatically. For another domain, host{' '}
              <code>picker-bridge.js</code> from this package on that site and add this script,
              allowing this editor’s exact origin:
            </p>
            <code className="dxp-picker-snippet">{bridgeSnippet}</code>
            <p>
              The website must also allow embedding via its CSP <code>frame-ancestors</code> and{' '}
              <code>X-Frame-Options</code> settings. Browser restrictions cannot be bypassed. You
              can enter a CSS selector below or try the demo.
            </p>
            <button
              onClick={() => {
                const demo = new URL('/demo-site.html', window.location.href).href;
                setUrlInput(demo);
                setFrameUrl(demo);
                setReload((value) => value + 1);
                onUrlChange?.(demo);
                setShowHelp(false);
              }}
            >
              Open demo website <ArrowRight size={13} />
            </button>
          </div>
        )}
        <div className="dxp-picker-frame-wrap">
          {frameUrl ? (
            <iframe
              key={`${frameUrl}-${reload}`}
              ref={frameRef}
              src={frameUrl}
              title="Website element selection preview"
              className="dxp-picker-frame"
              onLoad={() => initRef.current()}
              sandbox="allow-scripts allow-same-origin"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="dxp-picker-empty">Enter a website URL to get started.</div>
          )}
          {status === 'loading' && (
            <div className="dxp-picker-connecting">
              <span />
              Connecting element picker
            </div>
          )}
        </div>
        <footer className="dxp-picker-footer">
          <div className="dxp-picker-selector-field">
            <label htmlFor={selectorId}>
              {selected ? (
                <>
                  <Check size={13} /> Element selected
                </>
              ) : (
                'CSS selector'
              )}
            </label>
            <input
              id={selectorId}
              value={selector}
              onChange={(event) => updateSelector(event.target.value)}
              placeholder="Click an element or enter a CSS selector"
              spellCheck={false}
              aria-invalid={!!selector && !isValid}
            />
            <span className="dxp-picker-selector-hint" aria-live="polite">
              {selector && !isValid
                ? 'Enter a valid CSS selector.'
                : selectorHint ||
                  (selected?.text
                    ? `“${selected.text.slice(0, 65)}${selected.text.length > 65 ? '…' : ''}”`
                    : 'Your selector will be saved to this step.')}
            </span>
          </div>
          <button className="dxp-picker-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="dxp-picker-confirm"
            disabled={!isValid}
            onClick={() => onSelect(selector.trim())}
          >
            Use element <ArrowRight size={15} />
          </button>
        </footer>
      </div>
    </div>
  );
}

export default ElementPicker;
