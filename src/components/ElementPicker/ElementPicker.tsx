import '../../styles/base.css';
import '../../styles/shared.css';
import { ArrowRight, Check, Command, MousePointer2, Paintbrush, Redo2, Undo2 } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useBuilderI18n } from '../../lib/i18nContext';
import type { PickedElement, PickerSession } from '../../lib/picker';
import { normalizeWebsiteUrl, PICKER_PROTOCOL } from '../../lib/picker';
import { type PreviewTransport, usePreviewUrl } from '../../lib/previewTransport';
import {
  EditorDiscardDialog,
  WebsitePreviewHeader,
  WebsitePreviewToolbar,
} from '../WebsiteEditor/WebsiteEditor';
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
  const changeIds = useRef(new WeakMap<PageChange, string>());
  const getChangeId = useCallback((change: PageChange, previous?: PageChange) => {
    const source = previous ?? change;
    const id = changeIds.current.get(source) ?? crypto.randomUUID();
    changeIds.current.set(source, id);
    changeIds.current.set(change, id);
    return id;
  }, []);
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
        if (!controller.signal.aborted) setDemoHtml(html);
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('unavailable');
      });
    return () => controller.abort();
  }, [isDemo, reload]);
  const [selector, setSelector] = useState(initialSelector);
  const [selected, setSelected] = useState<PickedElement | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('loading');
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
      const normalized = changes.map((change) => {
        const normalized = normalizePageChangeUrls(change, urlContextRef.current);
        getChangeId(normalized, change);
        return normalized;
      });
      draftRef.current = normalized;
      setDraft(normalized);
      sendEditor('set-changes', { changes: normalized });
    },
    [sendEditor, getChangeId],
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
    (change: PageChange, previousChange?: PageChange) => {
      const current = draftRef.current;
      const previousIndex = previousChange
        ? current.findIndex((item) => pageChangeKey(item) === pageChangeKey(previousChange))
        : -1;
      const index =
        previousIndex >= 0
          ? previousIndex
          : current.findIndex(
              (item) =>
                pageChangeKey(item) === pageChangeKey(change) ||
                (item.selector === change.selector &&
                  (item.action ?? 'text') === 'text' &&
                  change.action === 'text' &&
                  item.textPath === undefined),
            );
      const next = [...current];
      const element =
        (current[index]?.selector === change.selector ? current[index]?.element : undefined) ??
        change.element ??
        (selectedRef.current?.selector === change.selector
          ? selectedRef.current.description
          : undefined);
      const described = element ? { ...change, element } : change;
      if (index < 0) next.push(described);
      else {
        const previous = current[index];
        next[index] = { ...previous, ...described };
        if (previousChange) {
          for (const key of ['attribute', 'imageAlt', 'textPath', 'element'] as const)
            if (!(key in described)) delete next[index][key];
        }
        // A whole-element replacement creates the preview's text node; its path
        // does not necessarily identify a text node in the original website.
        if (
          (previous.action ?? 'text') === 'text' &&
          (change.action ?? 'text') === 'text' &&
          previous.textPath === undefined
        )
          delete next[index].textPath;
      }
      const editedIndex = index < 0 ? next.length - 1 : index;
      const edited = next[editedIndex];
      const deduplicated = previousChange
        ? next.filter(
            (item, position) =>
              position === editedIndex || pageChangeKey(item) !== pageChangeKey(change),
          )
        : next;
      const id = getChangeId(edited, current[index]);
      if (JSON.stringify(deduplicated) !== JSON.stringify(current)) replaceDraft(deduplicated);
      return id;
    },
    [replaceDraft, getChangeId],
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
          const normalized = draftRef.current.map((change) => {
            const normalized = normalizePageChangeUrls(change, urlContextRef.current);
            getChangeId(normalized, change);
            return normalized;
          });
          if (normalized.some((change, index) => change !== draftRef.current[index]))
            replaceDraft(normalized, false);
        }
      }
      if (data.type === 'select' && isElement(data.element)) pick(data.element);
      if (editing && data.type === 'page-descriptions' && Array.isArray(data.descriptions)) {
        const descriptions = new Map<string, NonNullable<PageChange['element']>>();
        for (const item of data.descriptions) {
          if (item && typeof item.selector === 'string' && isElementDescription(item.element))
            descriptions.set(item.selector, item.element);
        }
        const described = draftRef.current.map((change) => {
          const described =
            !change.element && descriptions.has(change.selector)
              ? { ...change, element: descriptions.get(change.selector) }
              : change;
          getChangeId(described, change);
          return described;
        });
        if (described.some((change, index) => change !== draftRef.current[index])) {
          draftRef.current = described;
          setDraft(described);
        }
      }
      if (editing && data.type === 'page-change' && isPageChange(data.change))
        editChange(data.change);
      if (editing && data.type === 'changes-result')
        setEditorError(data.valid ? '' : t('pageEditor.previewError'));
      if (data.type === 'request-close') requestCloseRef.current();
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
    getChangeId,
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
      className="dxp-picker-backdrop dxp-picker-backdrop-fullscreen"
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
        <WebsitePreviewHeader
          icon={editing ? <Paintbrush size={19} /> : <MousePointer2 size={19} />}
          titleId={headingId}
          title={t(editing ? 'pageEditor.editPage' : 'elementPicker.selectAnElement')}
          description={t(
            editing ? 'pageEditor.description' : 'elementPicker.pointClickAndConnectYourExperience',
          )}
          closeLabel={t(editing ? 'common.cancel' : 'elementPicker.closeElementPicker')}
          onClose={requestClose}
        />
        <WebsitePreviewToolbar
          url={url || '/demo-site.html'}
          device={device}
          onDeviceChange={setDevice}
          onReload={() => {
            setStatus('loading');
            setReload((value) => value + 1);
          }}
          actions={
            editing && (
              <>
                <button
                  type="button"
                  className="dxp-button"
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
                  className="dxp-button"
                  onClick={redo}
                  disabled={!history.future.length}
                  title={t('builder.redoZ')}
                  aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z Control+Y"
                >
                  <Redo2 size={14} aria-hidden="true" />
                  {t('common.redo')}
                </button>
              </>
            )
          }
        />
        {guidance}
        <div className={editing ? 'dxp-website-editor-layout' : 'dxp-picker-standard-layout'}>
          <div
            className={`dxp-editor-viewport dxp-picker-frame-wrap${device === 'mobile' ? ' dxp-picker-frame-wrap-mobile' : ''}`}
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
              getChangeId={getChangeId}
              focusedChange={
                focusedChange
                  ? (draft.find((change) => getChangeId(change) === getChangeId(focusedChange)) ??
                    null)
                  : null
              }
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
            <footer className="dxp-website-editor-footer">
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
              <EditorDiscardDialog
                title={t('pageEditor.cancelTitle')}
                onKeepEditing={() => setDiscard(false)}
                onDiscard={onClose}
              />
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
