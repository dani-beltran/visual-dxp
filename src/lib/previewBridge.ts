import { attachElementPicker, escapeCss, getElementSelector, type PickerSession } from './picker';
import type { WorkflowRuntime } from './runtime';
import { createRuntime, getRuntimeSource } from './runtime';
import type { Workflow } from './types';

export const PREVIEW_PROTOCOL = 'visual-dxp:preview';
/** Runs only inside an isolated preview. Never receives builder settings. */
export function installPreviewBridge(
  parentOrigin: string,
  runtimeFactory: typeof createRuntime = createRuntime,
  baseUrl?: string,
  pickerFactory: typeof attachElementPicker = attachElementPicker,
) {
  if (
    window.parent === window ||
    !/^https?:$/.test(new URL(parentOrigin).protocol) ||
    new URL(parentOrigin).origin !== parentOrigin
  )
    return;
  // The preview sandbox allows forms so submit events reach workflow triggers and form
  // popovers, but the tested website must never really submit. Cancel every native
  // submission first (capture on window), while still dispatching the event to page scripts
  // and the workflow. Programmatic submit() skips submit events, so it becomes a no-op.
  window.addEventListener('submit', (event) => event.preventDefault(), true);
  try {
    Object.defineProperty(window.HTMLFormElement.prototype, 'submit', {
      configurable: true,
      writable: true,
      value() {
        window.console.info('[Visual DXP preview]', 'Form submission is disabled in previews.');
      },
    });
  } catch {
    /* A frozen prototype keeps the browser's behavior. */
  }
  // Sandboxed previews have an opaque origin, so document.cookie throws. Keep cookies in
  // memory for this document instead, so cookie steps and conditions can be previewed.
  // Each run starts empty (see "run" below); real cookies and exports are unaffected.
  let clearPreviewCookies = () => {};
  try {
    void document.cookie;
  } catch (error) {
    if ((error as { name?: unknown } | null)?.name === 'SecurityError') {
      const jar = new Map<string, { value: string; expires: number }>();
      const live = () => {
        const now = Date.now();
        for (const [name, cookie] of jar) if (cookie.expires <= now) jar.delete(name);
        return [...jar];
      };
      Object.defineProperty(document, 'cookie', {
        configurable: true,
        enumerable: true,
        get: () =>
          live()
            .map(([name, cookie]) => (name ? `${name}=${cookie.value}` : cookie.value))
            .join('; '),
        set(text: unknown) {
          const [pair, ...attributes] = String(text).split(';');
          const separator = pair.indexOf('=');
          const name = separator < 0 ? '' : pair.slice(0, separator).trim();
          const value = (separator < 0 ? pair : pair.slice(separator + 1)).trim();
          if (!name && !value) return;
          // Like browsers: Max-Age wins over Expires; zero, negative or past values delete.
          // Path, Domain, SameSite and Secure do not apply within a single document.
          let expires = Number.POSITIVE_INFINITY;
          let maxAge: number | undefined;
          for (const attribute of attributes) {
            const split = attribute.indexOf('=');
            const key = (split < 0 ? attribute : attribute.slice(0, split)).trim().toLowerCase();
            const option = split < 0 ? '' : attribute.slice(split + 1).trim();
            if (key === 'max-age' && /^-?\d+$/.test(option)) maxAge = Number(option);
            else if (key === 'expires' && !Number.isNaN(Date.parse(option)))
              expires = Date.parse(option);
          }
          if (maxAge !== undefined) expires = maxAge <= 0 ? 0 : Date.now() + maxAge * 1000;
          // Updating keeps a cookie's original position, as browsers keep its creation time.
          if (expires <= Date.now()) jar.delete(name);
          else jar.set(name, { value, expires });
        },
      });
      clearPreviewCookies = () => jar.clear();
    }
  }
  let runtime: WorkflowRuntime | undefined;
  let channel = '';
  let picker: PickerSession | undefined;
  const stopPicking = () => {
    picker?.destroy();
    picker = undefined;
  };
  const send = (type: string, detail: Record<string, unknown> = {}) =>
    window.parent.postMessage(
      { protocol: 'visual-dxp:preview', type, channel, ...detail },
      parentOrigin,
    );
  // Keep only node IDs mapped to step indices; the bridge is serialized, so this stays local.
  const startSteps = (value: unknown): Record<string, number> | undefined => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return Object.fromEntries(
      Object.entries(value).filter(
        ([, index]) => Number.isSafeInteger(index) && (index as number) >= 0,
      ),
    ) as Record<string, number>;
  };
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.origin !== parentOrigin) return;
    const data = event.data;
    if (!data || data.protocol !== 'visual-dxp:preview' || typeof data.channel !== 'string') return;
    if (data.type === 'init') {
      runtime?.destroy();
      runtime = undefined;
      stopPicking();
      channel = data.channel;
      send('ready', { elementPicking: true });
      return;
    }
    if (data.channel !== channel) return;
    if (data.type === 'pick-start') {
      stopPicking();
      runtime?.destroy();
      runtime = undefined;
      picker = pickerFactory(
        document,
        () => {},
        (element) => {
          stopPicking();
          send('pick-element', { selector: element.selector });
        },
      );
      return;
    }
    if (data.type === 'pick-stop') {
      stopPicking();
      return;
    }
    if (data.type === 'stop') {
      runtime?.destroy();
      runtime = undefined;
      return;
    }
    if (data.type !== 'run') return;
    runtime?.destroy();
    // Every run, including a restart, starts without cookies from earlier runs.
    clearPreviewCookies();
    try {
      runtime = runtimeFactory(data.workflow as Workflow, {
        document,
        window,
        baseUrl,
        analyticsMode: 'simulate',
        searchParams: typeof data.searchParams === 'string' ? data.searchParams : undefined,
        tourStartSteps: startSteps(data.tourStartSteps),
        onLog: (log) => send('log', { log, runId: data.runId }),
        onConnectionPreview: (edgeId, preview) => {
          // Bound transport and keep samples out of saved workflow/log objects.
          if (JSON.stringify(preview).length <= 32768)
            send('connection-preview', { edgeId, preview, runId: data.runId });
        },
      });
      runtime.start();
    } catch {
      send('error', { runId: data.runId });
    }
  });
  window.addEventListener('pagehide', () => {
    stopPicking();
    runtime?.destroy();
    send('unavailable');
  });
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    if (picker) {
      stopPicking();
      send('pick-cancel');
    } else send('close');
  });
}
export function previewBridgeSource(parentOrigin: string): string {
  // These helpers are serialized together so selector escaping and highlighting
  // behave identically in demo srcdoc and on websites using the bundled bridge.
  return `(() => {
    const escapeCss = ${escapeCss.toString()};
    const selectorFor = ${getElementSelector.toString()};
    const attach = ${attachElementPicker.toString()};
    const pickerFactory = (doc, hover, select) => attach(doc, hover, select, (element) => selectorFor(element, escapeCss));
    (${installPreviewBridge.toString()})(${JSON.stringify(parentOrigin)}, ${getRuntimeSource()}, undefined, pickerFactory);
  })();`;
}
