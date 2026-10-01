import { ArrowRight, Check, Globe2, Info, MousePointer2, RefreshCw, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useBuilderI18n } from '../lib/i18nContext';
import type { PickedElement, PickerSession } from '../lib/picker';
import { normalizeWebsiteUrl, PICKER_PROTOCOL } from '../lib/picker';
import { WebsiteSetup } from './WebsiteSetup';
import '../styles/picker.css';

export interface ElementPickerProps {
  url: string;
  initialSelector?: string;
  onSelect: (selector: string) => void;
  onClose: () => void;
}

type ConnectionStatus = 'loading' | 'connected' | 'bridge' | 'unavailable';

export function ElementPicker({
  url,
  initialSelector = '',
  onSelect,
  onClose,
}: ElementPickerProps) {
  const { t } = useBuilderI18n();
  const headingId = useId();
  const selectorId = useId();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<PickerSession | null>(null);
  const initRef = useRef<() => void>(() => undefined);
  const channelRef = useRef('');
  const selectorRef = useRef(initialSelector);
  const frameUrl = useMemo(() => {
    try {
      return normalizeWebsiteUrl(url.trim() || '/demo-site.html', window.location.href);
    } catch {
      return '';
    }
  }, [url]);
  const [demoHtml, setDemoHtml] = useState<string>();
  const [reload, setReload] = useState(0);
  const isDemo = frameUrl === new URL('/demo-site.html', window.location.origin).href;
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retrying the demo must also retry a failed HTML fetch.
  useEffect(() => {
    if (!isDemo) return;
    setDemoHtml(undefined);
    const controller = new AbortController();
    void fetch('/demo-site.html', {
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const html = await response.text();
        if (!controller.signal.aborted)
          setDemoHtml(
            `${html}<script src="${window.location.origin}/bridge.js" data-parent-origin="${window.location.origin}"></script>`,
          );
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('unavailable');
      });
    return () => controller.abort();
  }, [isDemo, reload]);
  const [selector, setSelector] = useState(initialSelector);
  const [hovered, setHovered] = useState<PickedElement | null>(null);
  const [selected, setSelected] = useState<PickedElement | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('loading');
  const [showHelp, setShowHelp] = useState(false);
  const [selectorHint, setSelectorHint] = useState('');
  const unavailable = status === 'unavailable';

  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => prior?.focus();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reload replaces the iframe even when its URL stays unchanged, so its picker session must reconnect.
  useEffect(() => {
    if (unavailable) return;
    if (!frameUrl) {
      setStatus('unavailable');
      return;
    }
    const origin = '*';
    let channel = crypto.randomUUID();
    channelRef.current = channel;
    const frame = frameRef.current;
    const frameWindow = frame?.contentWindow;
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
      frameWindow?.postMessage({ protocol: PICKER_PROTOCOL, type, channel, ...extra }, origin);
    const initialize = () => {
      if (attached) return;
      send('init', { selector: selectorRef.current });
    };
    const reconnect = () => {
      channel = crypto.randomUUID();
      channelRef.current = channel;
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
        if (!finished) {
          console.warn(
            '[Visual DXP picker bridge]',
            'Iframe did not connect. Check the bridge installation and host CSP frame-ancestors / X-Frame-Options headers; a timeout alone does not confirm embedding is blocked.',
          );
          setStatus('unavailable');
        }
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
      if (event.source !== frameWindow || event.origin !== 'null') return;
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
            ? t('elementPicker.elementFoundOnThePage')
            : t('elementPicker.noMatchingElementFoundYouCanStillUseThisSelector'),
        );
    };
    const failed = () => {
      console.warn(
        '[Visual DXP picker bridge]',
        'Iframe failed to load. Check the network and browser console for CSP frame-ancestors or X-Frame-Options violations.',
      );
      setStatus('unavailable');
    };
    frame?.addEventListener('error', failed);
    window.addEventListener('message', message);
    reconnect();
    return () => {
      sessionRef.current?.destroy();
      sessionRef.current = null;
      send('stop');
      frame?.removeEventListener('error', failed);
      window.removeEventListener('message', message);
      window.clearInterval(retry);
      window.clearTimeout(timeout);
      if (initRef.current === reconnect) initRef.current = () => undefined;
    };
  }, [frameUrl, reload, unavailable]);

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
            ? t('elementPicker.elementFoundOnThePage')
            : t('elementPicker.noMatchingElementFoundYouCanStillUseThisSelector'),
        );
    } else if (frameUrl && status === 'bridge') {
      frameRef.current?.contentWindow?.postMessage(
        {
          protocol: PICKER_PROTOCOL,
          type: 'set-selector',
          channel: channelRef.current,
          selector: value,
        },
        '*',
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
  const setup = (
    <div className={`dxp-picker-help${unavailable ? ' dxp-picker-help-unavailable' : ''}`}>
      {unavailable && (
        <p role="status">
          {t('elementPicker.thisWebsiteCouldnTConnectToThePickerCheckTheSetupBelow')}
        </p>
      )}
      <WebsiteSetup />
    </div>
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: The backdrop offers pointer dismissal; dialog controls and Escape provide keyboard dismissal.
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
            <h2 id={headingId}>{t('elementPicker.selectAnElement')}</h2>
            <p>{t('elementPicker.pointClickAndConnectYourExperience')}</p>
          </div>
          <button
            type="button"
            className="dxp-picker-icon-button"
            aria-label={t('elementPicker.closeElementPicker')}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className="dxp-picker-address">
          <Globe2 size={16} aria-hidden="true" />
          <span className="dxp-picker-url" title={url || '/demo-site.html'}>
            {url || '/demo-site.html'}
          </span>
          <button
            type="button"
            className="dxp-picker-load"
            title={t('preview.reloadWebsite')}
            aria-label={t('preview.reloadWebsite')}
            onClick={() => {
              setStatus('loading');
              setReload((value) => value + 1);
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="dxp-picker-toolbar">
          <span className={`dxp-picker-status dxp-picker-status-${status}`}>
            <i />
            {status === 'connected' || status === 'bridge'
              ? t('elementPicker.selectionModeIsOn')
              : status === 'loading'
                ? t('elementPicker.connectingToWebsite')
                : t('elementPicker.connectionRequired')}
          </span>
          <span className="dxp-picker-hint">
            {hovered ? (
              <code>{hovered.selector}</code>
            ) : (
              t('elementPicker.hoverToInspectClickToSelect')
            )}
          </span>
          {!unavailable && (
            <button type="button" onClick={() => setShowHelp(!showHelp)} aria-expanded={showHelp}>
              <Info size={14} /> {t('elementPicker.websiteSetup')}
            </button>
          )}
        </div>
        {showHelp && !unavailable && setup}
        <div className="dxp-picker-frame-wrap">
          {unavailable ? (
            setup
          ) : frameUrl ? (
            <iframe
              key={`${frameUrl}-${reload}`}
              ref={frameRef}
              src={isDemo ? undefined : frameUrl}
              srcDoc={isDemo ? demoHtml : undefined}
              title={t('elementPicker.websiteElementSelectionPreview')}
              className="dxp-picker-frame"
              onLoad={() => initRef.current()}
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="dxp-picker-empty">
              {t('elementPicker.enterAWebsiteUrlToGetStarted')}
            </div>
          )}
          {status === 'loading' && (
            <div className="dxp-picker-connecting">
              <span />
              {t('elementPicker.connectingElementPicker')}
            </div>
          )}
        </div>
        <footer className="dxp-picker-footer">
          <div className="dxp-picker-selector-field">
            <label htmlFor={selectorId}>
              {selected ? (
                <>
                  <Check size={13} /> {t('elementPicker.elementSelected')}
                </>
              ) : (
                t('elementPicker.cssSelector')
              )}
            </label>
            <input
              id={selectorId}
              value={selector}
              onChange={(event) => updateSelector(event.target.value)}
              placeholder={t('elementPicker.clickAnElementOrEnterACssSelector')}
              spellCheck={false}
              aria-invalid={!!selector && !isValid}
            />
            <span className="dxp-picker-selector-hint" aria-live="polite">
              {selector && !isValid
                ? t('elementPicker.enterAValidCssSelector')
                : selectorHint ||
                  (selected?.text
                    ? `“${selected.text.slice(0, 65)}${selected.text.length > 65 ? '…' : ''}”`
                    : t('elementPicker.yourSelectorWillBeSavedToThisStep'))}
            </span>
          </div>
          <button type="button" className="dxp-picker-cancel" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="dxp-picker-confirm"
            disabled={!isValid}
            onClick={() => onSelect(selector.trim())}
          >
            {t('elementPicker.useElement')} <ArrowRight size={15} />
          </button>
        </footer>
      </div>
    </div>
  );
}

export default ElementPicker;
