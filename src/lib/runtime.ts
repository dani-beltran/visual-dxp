import type { RunLog, Workflow } from './types';

export interface RuntimeOptions {
  document?: Document;
  window?: Window;
  fetch?: typeof fetch;
  onLog?: (entry: RunLog) => void;
  signal?: AbortSignal;
  /** Maximum executed steps for one trigger invocation. Defaults to 10,000. */
  maxSteps?: number;
}

export interface WorkflowRuntime {
  /** Install event listeners and run page-load triggers. Calling twice is safe. */
  start(): void;
  /** Run a trigger immediately, or all triggers when the ID is omitted. */
  run(triggerId?: string): Promise<void>;
  /** Abort requests and delays, remove listeners and close runtime popovers. */
  destroy(): void;
}

/**
 * This function is deliberately self-contained: the JavaScript exporter embeds
 * its compiled source, so exported workflows need no library or React runtime.
 */
export function createRuntime(workflow: Workflow, options: RuntimeOptions = {}): WorkflowRuntime {
  const doc = options.document ?? globalThis.document;
  const win = options.window ?? doc?.defaultView ?? globalThis.window;
  if (!doc || !win) throw new Error('A browser document is required to run this workflow.');
  const controller = new AbortController();
  const signal = controller.signal;
  const cleanups = new Set<() => void>();
  const popovers = new Map<string, () => void>();
  const nodes = new Map(workflow.nodes.map((node) => [node.id, node]));
  const fetcher = options.fetch ?? win.fetch?.bind(win) ?? globalThis.fetch?.bind(globalThis);
  const maxSteps = Math.max(1, Math.min(100000, options.maxSteps ?? 10000));
  type RunState = { steps: number; active: Set<string> };
  let started = false;
  let destroyed = false;

  function aborted(): void {
    if (signal.aborted) {
      const error = new Error('Workflow stopped.');
      error.name = 'AbortError';
      throw error;
    }
  }

  function log(nodeId: string, status: RunLog['status'], message: string): void {
    const node = nodes.get(nodeId);
    try {
      options.onLog?.({
        nodeId,
        label: node?.data.label ?? nodeId,
        status,
        message,
        timestamp: Date.now(),
      });
    } catch {
      /* A consumer's log callback must not interrupt the workflow. */
    }
  }

  function wait(milliseconds: number): Promise<void> {
    return new Promise((resolve, reject) => {
      aborted();
      const stop = () => {
        win.clearTimeout(timer);
        signal.removeEventListener('abort', stop);
        const error = new Error('Workflow stopped.');
        error.name = 'AbortError';
        reject(error);
      };
      const timer = win.setTimeout(() => {
        signal.removeEventListener('abort', stop);
        resolve();
      }, milliseconds);
      signal.addEventListener('abort', stop, { once: true });
    });
  }

  function selectorElements(selector: string | undefined): Element[] {
    if (!selector?.trim()) throw new Error('Choose a target element first.');
    const elements = Array.from(doc.querySelectorAll(selector));
    if (!elements.length) throw new Error(`No elements match “${selector}”.`);
    return elements;
  }

  function showPopover(node: Workflow['nodes'][number]): void {
    const config = node.data.config;
    const anchor = config.position === 'anchor' ? selectorElements(config.selector)[0] : null;
    popovers.get(node.id)?.();
    const panel = doc.createElement('section');
    panel.dataset.formaPopover = node.id;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', node.data.label || 'Experience');
    const width = Math.max(240, Math.min(960, config.width ?? 360));
    Object.assign(panel.style, {
      position: 'fixed',
      zIndex: '2147483646',
      boxSizing: 'border-box',
      width: `${width}px`,
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100vh - 32px)',
      overflow: 'auto',
      background: '#fff',
      color: '#17262e',
      border: '1px solid #e3e8ec',
      borderRadius: '16px',
      boxShadow: '0 18px 70px rgba(20, 35, 45, .24)',
      padding: '28px 24px 24px',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
    });
    const close = doc.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close experience');
    Object.assign(close.style, {
      position: 'absolute',
      top: '5px',
      right: '8px',
      width: '28px',
      height: '28px',
      border: '0',
      background: 'transparent',
      color: '#64717a',
      cursor: 'pointer',
      fontSize: '24px',
      lineHeight: '24px',
      zIndex: '1',
    });
    const content = doc.createElement('div');
    if (config.contentType === 'iframe') {
      const frame = doc.createElement('iframe');
      if (!config.url?.trim()) throw new Error('Enter a URL for the popover iframe.');
      const url = new URL(config.url);
      if (!['http:', 'https:'].includes(url.protocol))
        throw new Error('Popover frames require an HTTP or HTTPS URL.');
      frame.src = url.href;
      frame.title = node.data.label || 'Embedded experience';
      frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups');
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      Object.assign(frame.style, { width: '100%', height: '320px', border: '0', display: 'block' });
      content.appendChild(frame);
    } else {
      // HTML is deliberately author-controlled. Only import workflows you trust.
      content.innerHTML =
        config.content ?? '<h3>Hello there 👋</h3><p>Welcome to your next experience.</p>';
    }
    panel.append(close, content);
    (doc.body ?? doc.documentElement).appendChild(panel);

    function place(): void {
      const viewportWidth = win.innerWidth || doc.documentElement.clientWidth;
      const viewportHeight = win.innerHeight || doc.documentElement.clientHeight;
      panel.style.transform = '';
      panel.style.inset = 'auto';
      if (anchor) {
        const rect = anchor.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const left = Math.max(16, Math.min(rect.left, viewportWidth - panelRect.width - 16));
        let top = rect.bottom + 12;
        if (top + panelRect.height > viewportHeight - 16) top = rect.top - panelRect.height - 12;
        panel.style.left = `${left}px`;
        panel.style.top = `${Math.max(16, top)}px`;
      } else {
        const position = config.position ?? 'bottom-right';
        if (position === 'center') {
          panel.style.left = '50%';
          panel.style.top = '50%';
          panel.style.transform = 'translate(-50%, -50%)';
        } else {
          panel.style[position.startsWith('top') ? 'top' : 'bottom'] = '24px';
          panel.style[position.endsWith('left') ? 'left' : 'right'] = '24px';
        }
      }
    }
    place();
    win.addEventListener('resize', place);
    win.addEventListener('scroll', place, true);
    const dispose = () => {
      close.removeEventListener('click', dispose);
      win.removeEventListener('resize', place);
      win.removeEventListener('scroll', place, true);
      panel.remove();
      if (popovers.get(node.id) === dispose) popovers.delete(node.id);
    };
    close.addEventListener('click', dispose);
    popovers.set(node.id, dispose);
  }

  async function next(nodeId: string, state: RunState, handle?: string): Promise<void> {
    const edges = workflow.edges.filter(
      (edge) => edge.source === nodeId && (handle === undefined || edge.sourceHandle === handle),
    );
    for (const edge of edges) await execute(edge.target, state);
  }

  async function execute(nodeId: string, state: RunState): Promise<void> {
    aborted();
    const node = nodes.get(nodeId);
    if (!node) throw new Error(`Step “${nodeId}” does not exist.`);
    if (state.active.has(nodeId)) {
      const message = 'Circular connections are not supported. Use a Repeat step instead.';
      log(nodeId, 'error', message);
      throw new Error(message);
    }
    state.steps += 1;
    if (state.steps > maxSteps) {
      const message = `Execution stopped after ${maxSteps} steps. Check for cycles or excessive loops.`;
      log(nodeId, 'error', message);
      throw new Error(message);
    }
    state.active.add(nodeId);
    try {
      const config = node.data.config;
      let selectedHandle: string | undefined;
      let loopIterations = 0;
      log(nodeId, 'running', 'Running step');
      try {
        switch (node.data.kind) {
          case 'trigger':
            break;
          case 'delay': {
            const duration = config.duration ?? 1000;
            if (!Number.isFinite(duration) || duration < 0 || duration > 86400000)
              throw new Error('Delay must be between 0 and 86,400,000 milliseconds.');
            await wait(duration);
            break;
          }
          case 'http': {
            if (!fetcher) throw new Error('This browser does not support fetch.');
            if (!config.url?.trim()) throw new Error('Enter a request URL.');
            const url = new URL(config.url, doc.baseURI);
            if (!['http:', 'https:'].includes(url.protocol))
              throw new Error('Requests require an HTTP or HTTPS URL.');
            const headers = config.headers?.trim()
              ? (JSON.parse(config.headers) as Record<string, string>)
              : {};
            if (
              !headers ||
              typeof headers !== 'object' ||
              Array.isArray(headers) ||
              Object.values(headers).some((value) => typeof value !== 'string')
            ) {
              throw new Error('Request headers must be a JSON object with string values.');
            }
            const method = (config.method ?? 'GET').toUpperCase();
            const response = await fetcher(url.href, {
              method,
              headers,
              signal,
              ...(method === 'GET' || method === 'HEAD' || !config.body
                ? {}
                : { body: config.body }),
            });
            if (!response.ok)
              throw new Error(
                `Request failed: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}.`,
              );
            break;
          }
          case 'dom': {
            const targets = selectorElements(config.selector);
            for (const element of targets) {
              const value = config.value ?? '';
              switch (config.action ?? 'text') {
                case 'text':
                  element.textContent = value;
                  break;
                case 'html':
                  element.innerHTML = value;
                  break;
                case 'add-class':
                  element.classList.add(...value.split(/\s+/).filter(Boolean));
                  break;
                case 'remove-class':
                  element.classList.remove(...value.split(/\s+/).filter(Boolean));
                  break;
                case 'hide':
                  (element as HTMLElement).style.display = 'none';
                  break;
                case 'show': {
                  element.removeAttribute('hidden');
                  (element as HTMLElement).style.removeProperty('display');
                  if (win.getComputedStyle(element).display === 'none')
                    (element as HTMLElement).style.display = 'block';
                  break;
                }
                case 'attribute':
                  if (!config.attribute?.trim()) throw new Error('Enter an attribute name.');
                  element.setAttribute(config.attribute, value);
                  break;
                default:
                  throw new Error('Unknown element action.');
              }
            }
            break;
          }
          case 'fork':
            if (!config.condition?.trim())
              throw new Error('Enter a CSS selector for the branch condition.');
            selectedHandle = doc.querySelector(config.condition) ? 'true' : 'false';
            break;
          case 'loop':
            loopIterations = config.iterations ?? 3;
            if (!Number.isInteger(loopIterations) || loopIterations < 1 || loopIterations > 1000)
              throw new Error('Repeat count must be an integer from 1 to 1,000.');
            break;
          case 'popover':
            showPopover(node);
            break;
          default:
            throw new Error(`Unknown step type: ${String(node.data.kind)}.`);
        }
        aborted();
        log(
          nodeId,
          'success',
          selectedHandle
            ? `Condition is ${selectedHandle}`
            : loopIterations
              ? `Repeating ${loopIterations} times`
              : 'Step completed',
        );
      } catch (error) {
        if (!signal.aborted)
          log(nodeId, 'error', error instanceof Error ? error.message : String(error));
        throw error;
      }
      if (loopIterations) {
        for (let index = 0; index < loopIterations; index += 1) {
          aborted();
          await next(nodeId, state, 'body');
        }
        await next(nodeId, state, 'done');
      } else {
        await next(nodeId, state, selectedHandle);
      }
    } finally {
      state.active.delete(nodeId);
    }
  }

  async function run(triggerId?: string): Promise<void> {
    if (destroyed) return;
    const triggers = triggerId
      ? [nodes.get(triggerId)]
      : workflow.nodes.filter((node) => node.data.kind === 'trigger');
    if (!triggers.length) throw new Error('Add a trigger to run this workflow.');
    try {
      for (const trigger of triggers) {
        if (!trigger || trigger.data.kind !== 'trigger')
          throw new Error('Choose a valid trigger to run this workflow.');
        await execute(trigger.id, { steps: 0, active: new Set() });
      }
    } catch (error) {
      if (!signal.aborted) throw error;
    }
  }

  function reportFailure(error: unknown): void {
    if (!signal.aborted) console.error('[Forma DXP]', error);
  }

  function start(): void {
    if (started || destroyed) return;
    started = true;
    for (const node of workflow.nodes.filter((entry) => entry.data.kind === 'trigger')) {
      const config = node.data.config;
      if (!config.event || config.event === 'page-load') {
        const ready = () => {
          void run(node.id).catch(reportFailure);
        };
        if (doc.readyState === 'loading') {
          doc.addEventListener('DOMContentLoaded', ready, { once: true });
          cleanups.add(() => doc.removeEventListener('DOMContentLoaded', ready));
        } else {
          void Promise.resolve().then(ready);
        }
      } else {
        if (!config.selector?.trim()) {
          log(node.id, 'error', 'Choose an element for this event trigger.');
          continue;
        }
        try {
          doc.querySelector(config.selector);
        } catch {
          log(node.id, 'error', 'The trigger CSS selector is invalid.');
          continue;
        }
        const selector = config.selector;
        const event = config.event;
        const listener = (incoming: Event) => {
          const target = incoming.target as Element | null;
          if (target?.closest?.(selector)) void run(node.id).catch(reportFailure);
        };
        doc.addEventListener(event, listener);
        cleanups.add(() => doc.removeEventListener(event, listener));
      }
    }
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    controller.abort();
    cleanups.forEach((cleanup) => {
      cleanup();
    });
    cleanups.clear();
    popovers.forEach((dispose) => {
      dispose();
    });
    popovers.clear();
    options.signal?.removeEventListener('abort', destroy);
  }

  if (options.signal?.aborted) destroy();
  else options.signal?.addEventListener('abort', destroy, { once: true });
  return { start, run, destroy };
}

export const executeWorkflow = createRuntime;
