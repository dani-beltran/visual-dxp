import '../../styles/base.css';
import '../../styles/shared.css';
import {
  ArrowRight,
  Check,
  Command,
  Globe2,
  Info,
  Maximize2,
  Minimize2,
  Monitor,
  MousePointer2,
  Redo2,
  RefreshCw,
  Smartphone,
  Undo2,
  X,
} from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useBuilderI18n } from '../../lib/i18nContext';
import type { PickedElement, PickerSession } from '../../lib/picker';
import { normalizeWebsiteUrl, PICKER_PROTOCOL } from '../../lib/picker';
import { type PreviewTransport, usePreviewUrl } from '../../lib/previewTransport';
import { WebsiteSetup } from '../WebsiteSetup/WebsiteSetup';
import './ElementPicker.css';
import { dataTools } from '../../lib/data';
import { isElementDescription } from '../../lib/elementDescription';
import { isPageChange, type PageChange, pageChangeKey } from '../../lib/pageChanges';
import { normalizePageChangeUrls, type PageUrlContext } from '../../lib/pageUrls';
import { PageEditorPanel } from './PageEditorPanel';

export interface ElementPickerProps {
  previewTransport?: PreviewTransport;
  /** Optional host guidance inside the dialog focus context. */
  guidance?: ReactNode;
  url: string;
  initialSelector?: string;
  initialChanges?: PageChange[];
  onSaveChanges?: (changes: PageChange[]) => void;
  onSelect: (selector: string) => void;
  onClose: () => void;
}

type ConnectionStatus = 'loading' | 'connected' | 'bridge' | 'unavailable';

export function ElementPicker({
  url,
  initialSelector = '',
  onSelect,
  onClose,
  guidance,
  previewTransport,
  initialChanges = [],
  onSaveChanges,
}: ElementPickerProps) {
  const { t } = useBuilderI18n();
  const editing = !!onSaveChanges;
  const [draft, setDraft] = useState<PageChange[]>(() => structuredClone(initialChanges));
  const draftRef = useRef(draft);
  const urlContextRef = useRef<PageUrlContext>({});
  const selectedRef = useRef<PickedElement | null>(null);
  const [history, setHistory] = useState<{ past: PageChange[][]; future: PageChange[][] }>({
    past: [],
    future: [],
  });
  const historyRef = useRef(history);
  const [focusedChange, setFocusedChange] = useState<PageChange | null>(null);
  const [discard, setDiscard] = useState(false);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [editorReady, setEditorReady] = useState(false);
  const [editorError, setEditorError] = useState('');
  const requestClose = () => {
    const operations = (changes: PageChange[]) =>
      changes.map(({ element: _element, ...change }) =>
        normalizePageChangeUrls(change, urlContextRef.current),
      );
    if (
      editing &&
      JSON.stringify(operations(draftRef.current)) !== JSON.stringify(operations(initialChanges))
    )
      setDiscard(true);
    else onClose();
  };
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  const headingId = useId();
  const discardHeadingId = useId();
  const discardDialogRef = useRef<HTMLDialogElement>(null);
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
  const preview = usePreviewUrl(frameUrl, previewTransport, reload);
  urlContextRef.current = { baseUrl: frameUrl };
  if (preview.proxied && preview.url) {
    try {
      urlContextRef.current.proxyOrigin = new URL(preview.url, window.location.href).origin;
    } catch {
      /* Reported by the connection UI. */
    }
  }
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
  const [isFullscreen, setIsFullscreen] = useState(editing);
  const [selectorHint, setSelectorHint] = useState('');
  const unavailable = status === 'unavailable';
  const sendEditor = useCallback((type: string, values: Record<string, unknown> = {}) => {
    frameRef.current?.contentWindow?.postMessage(
      { protocol: PICKER_PROTOCOL, channel: channelRef.current, type, ...values },
      '*',
    );
  }, []);
  const replaceDraft = useCallback(
    (changes: PageChange[], record = true) => {
      const previous = draftRef.current;
      if (record) {
        historyRef.current = { past: [...historyRef.current.past, previous], future: [] };
        setHistory(historyRef.current);
      }
      const normalized = changes.map((change) =>
        normalizePageChangeUrls(change, urlContextRef.current),
      );
      draftRef.current = normalized;
      setDraft(normalized);
      sendEditor('set-changes', { changes: normalized });
    },
    [sendEditor],
  );
  const undo = useCallback(() => {
    const { past, future } = historyRef.current;
    if (!past.length) return;
    historyRef.current = {
      past: past.slice(0, -1),
      future: [...future, draftRef.current],
    };
    setHistory(historyRef.current);
    replaceDraft(past[past.length - 1], false);
  }, [replaceDraft]);
  const redo = useCallback(() => {
    const { past, future } = historyRef.current;
    if (!future.length) return;
    historyRef.current = {
      past: [...past, draftRef.current],
      future: future.slice(0, -1),
    };
    setHistory(historyRef.current);
    replaceDraft(future[future.length - 1], false);
  }, [replaceDraft]);
  const discardRef = useRef(discard);
  discardRef.current = discard;
  const editChange = useCallback(
    (change: PageChange) => {
      const current = draftRef.current;
      const index = current.findIndex(
        (item) =>
          pageChangeKey(item) === pageChangeKey(change) ||
          (item.selector === change.selector &&
            (item.action ?? 'text') === 'text' &&
            change.action === 'text' &&
            item.textPath === undefined),
      );
      const next = [...current];
      const element =
        current[index]?.element ??
        change.element ??
        (selectedRef.current?.selector === change.selector
          ? selectedRef.current.description
          : undefined);
      const described = element ? { ...change, element } : change;
      if (index < 0) next.push(described);
      else {
        const previous = current[index];
        next[index] = { ...previous, ...described };
        // A whole-element replacement creates the preview's text node; its path
        // does not necessarily identify a text node in the original website.
        if (
          (previous.action ?? 'text') === 'text' &&
          (change.action ?? 'text') === 'text' &&
          previous.textPath === undefined
        )
          delete next[index].textPath;
      }
      if (JSON.stringify(next) !== JSON.stringify(current)) replaceDraft(next);
    },
    [replaceDraft],
  );
  let draftError = '';
  if (editing)
    try {
      dataTools.validateElementValue({ changes: draft });
      for (const change of draft) {
        if (!dataTools.hasVariables(change.selector)) document.querySelector(change.selector);
        if (!change.selector.trim() || (change.action === 'attribute' && !change.attribute?.trim()))
          throw new Error(t('pageEditor.invalidChange'));
        if (
          change.action === 'attribute' &&
          change.attribute === 'href' &&
          !dataTools.hasVariables(change.value)
        ) {
          const url = new URL(change.value ?? '', 'https://preview.invalid');
          if (
            !['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ||
            url.username ||
            url.password
          )
            throw new Error(t('pageEditor.invalidLink'));
        }
      }
    } catch (error) {
      draftError = (error as Error).message;
    }

  // A new target must be able to reconnect after the previous target failed.
  useEffect(() => {
    setStatus(frameUrl ? 'loading' : 'unavailable');
  }, [frameUrl]);

  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('input,button')?.focus();
    return () => prior?.focus();
  }, []);

  useEffect(() => {
    if (!discard) return;
    const dialog = discardDialogRef.current;
    if (!dialog) return;
    const prior = document.activeElement as HTMLElement | null;
    dialog.showModal?.();
    dialog.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      dialog.close?.();
      prior?.focus();
    };
  }, [discard]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reload replaces the iframe even when its URL stays unchanged, so its picker session must reconnect.
  useEffect(() => {
    if (unavailable) return;
    if (!frameUrl || preview.error) {
      setStatus('unavailable');
      return;
    }
    if (!preview.url) return;
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
      selectedRef.current = element;
      setSelected(element);
      setFocusedChange((current) => (current?.selector === element.selector ? current : null));
      setSelector(element.selector);
      selectorRef.current = element.selector;
      setSelectorHint('');
    };
    const send = (type: string, extra: Record<string, unknown> = {}) =>
      frameWindow?.postMessage({ protocol: PICKER_PROTOCOL, type, channel, ...extra }, origin);
    const initialize = () => {
      if (attached) return;
      send('init', { selector: selectorRef.current, editing, changes: draftRef.current });
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
      setEditorReady(false);
      setHovered(null);
      setSelected(null);
      selectedRef.current = null;
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
      typeof (value as PickedElement).text === 'string' &&
      ((value as PickedElement).description === undefined ||
        isElementDescription((value as PickedElement).description));
    const message = (event: MessageEvent) => {
      if (event.source !== frameWindow || event.origin !== 'null') return;
      const data = event.data;
      if (!data || data.protocol !== PICKER_PROTOCOL || data.channel !== channel) return;
      if (data.type === 'ready') {
        finished = true;
        attached = true;
        setStatus('bridge');
        setEditorReady(data.editing === true);
        if (editing && data.editing !== true) setEditorError(t('pageEditor.unsupportedBridge'));
        else setEditorError('');
        if (editing) {
          const normalized = draftRef.current.map((change) =>
            normalizePageChangeUrls(change, urlContextRef.current),
          );
          if (normalized.some((change, index) => change !== draftRef.current[index]))
            replaceDraft(normalized, false);
        }
      }
      if (data.type === 'hover' && (data.element === null || isElement(data.element)))
        setHovered(data.element);
      if (data.type === 'select' && isElement(data.element)) pick(data.element);
      if (editing && data.type === 'page-descriptions' && Array.isArray(data.descriptions)) {
        const descriptions = new Map<string, NonNullable<PageChange['element']>>();
        for (const item of data.descriptions) {
          if (item && typeof item.selector === 'string' && isElementDescription(item.element))
            descriptions.set(item.selector, item.element);
        }
        const described = draftRef.current.map((change) =>
          !change.element && descriptions.has(change.selector)
            ? { ...change, element: descriptions.get(change.selector) }
            : change,
        );
        if (described.some((change, index) => change !== draftRef.current[index])) {
          draftRef.current = described;
          setDraft(described);
        }
      }
      if (editing && data.type === 'page-change' && isPageChange(data.change))
        editChange(data.change);
      if (editing && data.type === 'changes-result')
        setEditorError(data.valid ? '' : t('pageEditor.previewError'));
      if (editing && data.type === 'request-close') requestCloseRef.current();
      if (editing && !discardRef.current && data.type === 'request-undo') undo();
      if (editing && !discardRef.current && data.type === 'request-redo') redo();
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
  }, [
    frameUrl,
    preview.url,
    preview.error,
    reload,
    unavailable,
    editing,
    editChange,
    replaceDraft,
    undo,
    redo,
  ]);

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
          {preview.error ||
            t(
              editing
                ? 'pageEditor.connectionError'
                : 'elementPicker.thisWebsiteCouldnTConnectToThePickerCheckTheSetupBelow',
            )}
        </p>
      )}
      {!editing && <WebsiteSetup proxied={preview.proxied} />}
    </div>
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: The backdrop offers pointer dismissal; dialog controls and Escape provide keyboard dismissal.
    <div
      className={`dxp-picker-backdrop${editing || isFullscreen ? ' dxp-picker-backdrop-fullscreen' : ''}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        ref={dialogRef}
        className="dxp-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onKeyDownCapture={(event) => {
          if (!editing || !(event.metaKey || event.ctrlKey) || event.altKey) return;
          const key = event.key.toLowerCase();
          if (key !== 'z' && !(event.ctrlKey && key === 'y')) return;
          event.preventDefault();
          event.stopPropagation();
          if (discard) return;
          if (event.shiftKey || key === 'y') redo();
          else undo();
        }}
        onKeyDown={(event) => {
          if (discard) {
            event.stopPropagation();
            return;
          }
          if (event.key === 'Escape') {
            event.stopPropagation();
            requestClose();
          }
          if (event.key === 'Tab') {
            const focusable = Array.from(
              dialogRef.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input, select, textarea, summary, a[href], iframe, [tabindex="0"]',
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
            <h2 id={headingId}>
              {t(editing ? 'pageEditor.editPage' : 'elementPicker.selectAnElement')}
            </h2>
            <p>
              {t(
                editing
                  ? 'pageEditor.description'
                  : 'elementPicker.pointClickAndConnectYourExperience',
              )}
            </p>
          </div>
          <div className="dxp-picker-header-actions">
            {!editing && (
              <button
                type="button"
                className="dxp-picker-icon-button"
                aria-label={t(isFullscreen ? 'common.exitFullscreen' : 'common.enterFullscreen')}
                title={t(isFullscreen ? 'common.exitFullscreen' : 'common.enterFullscreen')}
                onClick={() => setIsFullscreen((value) => !value)}
              >
                {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
            )}
            <button
              type="button"
              className="dxp-picker-icon-button"
              aria-label={t(editing ? 'common.cancel' : 'elementPicker.closeElementPicker')}
              onClick={requestClose}
            >
              <X size={20} />
            </button>
          </div>
        </header>
        {guidance}
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
              ? t(editing ? 'pageEditor.editMode' : 'elementPicker.selectionModeIsOn')
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
          {!editing && !unavailable && (
            <button type="button" onClick={() => setShowHelp(!showHelp)} aria-expanded={showHelp}>
              <Info size={14} /> {t('elementPicker.websiteSetup')}
            </button>
          )}
          {editing && (
            <>
              <fieldset
                className="dxp-picker-device-toggle"
                aria-label={t('pageEditor.previewDevice')}
              >
                {(['desktop', 'mobile'] as const).map((option) => {
                  const Icon = option === 'desktop' ? Monitor : Smartphone;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={device === option}
                      onClick={() => setDevice(option)}
                    >
                      <Icon size={14} aria-hidden="true" />
                      {t(option === 'desktop' ? 'nodeInspector.desktop' : 'nodeInspector.mobile')}
                    </button>
                  );
                })}
              </fieldset>
              <span className="dxp-toolbar-divider" aria-hidden="true" />
              <div className="dxp-page-editor-history">
                <button
                  type="button"
                  onClick={undo}
                  disabled={!history.past.length}
                  title={t('builder.undoZ')}
                  aria-keyshortcuts="Meta+Z Control+Z"
                >
                  <Undo2 size={14} aria-hidden="true" />
                  {t('common.undo')}
                </button>
                <button
                  type="button"
                  onClick={redo}
                  disabled={!history.future.length}
                  title={t('builder.redoZ')}
                  aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z Control+Y"
                >
                  <Redo2 size={14} aria-hidden="true" />
                  {t('common.redo')}
                </button>
              </div>
            </>
          )}
        </div>
        {!editing && showHelp && !unavailable && setup}
        <div className={editing ? 'dxp-page-editor-layout' : 'dxp-picker-standard-layout'}>
          <div
            className={`dxp-picker-frame-wrap${editing && device === 'mobile' ? ' dxp-picker-frame-wrap-mobile' : ''}`}
          >
            {unavailable ? (
              setup
            ) : frameUrl && preview.url ? (
              <iframe
                key={`${frameUrl}-${reload}`}
                ref={frameRef}
                src={isDemo ? undefined : preview.url}
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
          {editing && (
            <PageEditorPanel
              urlContext={urlContextRef.current}
              selected={selected}
              changes={draft}
              onEdit={editChange}
              focusedChange={focusedChange}
              onRemove={(index) =>
                replaceDraft(draftRef.current.filter((_, current) => current !== index))
              }
              onSelect={(change) => {
                setFocusedChange(change);
                sendEditor('set-selector', { selector: change.selector });
              }}
            />
          )}
        </div>
        {editing ? (
          <>
            {(draftError || editorError) && (
              <div className="dxp-page-editor-error" role="alert">
                {draftError || editorError}
              </div>
            )}
            <footer className="dxp-page-editor-footer">
              <span>
                {t('pageEditor.changeCount', {
                  count: draft.length,
                  elements: new Set(draft.map((change) => change.selector)).size,
                })}
              </span>
              <span className="dxp-footer-shortcut">
                <Command size={11} aria-hidden="true" /> {t('builder.zToUndo')}
              </span>
              <button type="button" className="dxp-picker-cancel" onClick={requestClose}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="dxp-picker-confirm"
                disabled={!!draftError || !editorReady || status !== 'bridge'}
                onClick={() => onSaveChanges?.(draftRef.current)}
              >
                {t('pageEditor.saveChanges')}
              </button>
            </footer>
            {discard && (
              <dialog
                ref={discardDialogRef}
                className="dxp-page-editor-discard"
                aria-labelledby={discardHeadingId}
                aria-modal="true"
                onCancel={(event) => {
                  event.preventDefault();
                  setDiscard(false);
                }}
              >
                <h2 id={discardHeadingId}>{t('pageEditor.cancelTitle')}</h2>
                <div className="dxp-page-editor-discard-actions">
                  <button
                    type="button"
                    className="dxp-picker-cancel"
                    onClick={() => setDiscard(false)}
                  >
                    {t('pageEditor.keepEditing')}
                  </button>
                  <button type="button" className="dxp-picker-confirm" onClick={onClose}>
                    {t('pageEditor.discard')}
                  </button>
                </div>
              </dialog>
            )}
          </>
        ) : (
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
        )}
      </div>
    </div>
  );
}

export default ElementPicker;
