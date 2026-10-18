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
    try {
      runtime = runtimeFactory(data.workflow as Workflow, {
        document,
        window,
        baseUrl,
        analyticsMode: 'simulate',
        searchParams: typeof data.searchParams === 'string' ? data.searchParams : undefined,
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
