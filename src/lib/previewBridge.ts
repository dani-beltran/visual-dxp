import type { WorkflowRuntime } from './runtime';
import { createRuntime, getRuntimeSource } from './runtime';
import type { Workflow } from './types';

export const PREVIEW_PROTOCOL = 'visual-dxp:preview';
/** Runs only inside an isolated preview. Never receives builder settings. */
export function installPreviewBridge(
  parentOrigin: string,
  runtimeFactory: typeof createRuntime = createRuntime,
) {
  if (
    window.parent === window ||
    !/^https?:$/.test(new URL(parentOrigin).protocol) ||
    new URL(parentOrigin).origin !== parentOrigin
  )
    return;
  let runtime: WorkflowRuntime | undefined;
  let channel = '';
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
      channel = data.channel;
      send('ready');
      return;
    }
    if (data.channel !== channel) return;
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
        analyticsMode: 'simulate',
        onLog: (log) => send('log', { log }),
        onConnectionPreview: (edgeId, preview) => {
          // Bound transport and keep samples out of saved workflow/log objects.
          if (JSON.stringify(preview).length <= 32768)
            send('connection-preview', { edgeId, preview, runId: data.runId });
        },
      });
      runtime.start();
    } catch {
      send('error');
    }
  });
  window.addEventListener('pagehide', () => {
    runtime?.destroy();
    send('unavailable');
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') send('close');
  });
}
export function previewBridgeSource(parentOrigin: string): string {
  return `(${installPreviewBridge.toString()})(${JSON.stringify(parentOrigin)}, ${getRuntimeSource()});`;
}
