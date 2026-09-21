import type { RunLog, StepConfig, Workflow } from './types';

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

  function matchesCondition(config: StepConfig): boolean {
    const type = config.conditionType ?? 'selector';
    if (type === 'selector') {
      if (!config.condition?.trim())
        throw new Error('Enter a CSS selector for the branch condition.');
      return !!doc.querySelector(config.condition);
    }
    const expected = config.conditionValue;
    if (typeof expected !== 'string') throw new Error('Enter an expected condition value.');
    switch (type) {
      case 'device': {
        if (expected !== 'desktop' && expected !== 'mobile')
          throw new Error('Choose desktop or mobile for the device condition.');
        const navigator = win.navigator as Navigator & { userAgentData?: { mobile?: boolean } };
        const mobile =
          navigator.userAgentData?.mobile ??
          (/Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
        return expected === (mobile ? 'mobile' : 'desktop');
      }
      case 'language': {
        let language: string;
        try {
          language = Intl.getCanonicalLocales(expected.trim())[0]?.toLowerCase();
          if (!language) throw new Error();
        } catch {
          throw new Error('Enter a language code such as en, es, or en-US.');
        }
        const actual = win.navigator.language?.toLowerCase() ?? '';
        return (
          actual === language || (!language.includes('-') && actual.startsWith(`${language}-`))
        );
      }
      case 'referrer': {
        let domain: string;
        try {
          const value = expected.trim();
          const isUrl = /^https?:\/\//i.test(value);
          if (!value || (!isUrl && /[\s/\\?#@:]/.test(value))) throw new Error();
          // Accept saved URL conditions, comparing only their hostname.
          const parsed = new URL(isUrl ? value : `https://${value}`);
          domain = parsed.hostname.replace(/\.$/, '');
          if (
            parsed.username ||
            parsed.password ||
            !domain ||
            domain.length > 253 ||
            domain
              .split('.')
              .some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
          )
            throw new Error();
        } catch {
          throw new Error('Enter a valid referrer domain such as example.com.');
        }
        try {
          return !!doc.referrer && new URL(doc.referrer).hostname.replace(/\.$/, '') === domain;
        } catch {
          return false;
        }
      }
      case 'query-param':
      case 'cookie': {
        const key = config.conditionKey;
        if (!key?.trim()) throw new Error('Enter a name for the condition variable.');
        if (type === 'query-param') {
          try {
            return new URL(win.location.href).searchParams.getAll(key).includes(expected);
          } catch {
            return false;
          }
        }
        // Access may be denied by browser privacy settings or an opaque preview origin.
        try {
          const decode = (value: string) => {
            try {
              return decodeURIComponent(value);
            } catch {
              return value;
            }
          };
          const cookieMatches = doc.cookie.split(';').some((entry) => {
            const cookie = entry.trim();
            const separator = cookie.indexOf('=');
            return (
              separator >= 0 &&
              decode(cookie.slice(0, separator)) === key &&
              decode(cookie.slice(separator + 1)) === expected
            );
          });
          if (cookieMatches) return true;
        } catch {
          // A blocked cookie read must not prevent a browser storage match.
        }
        for (const storage of ['localStorage', 'sessionStorage'] as const) {
          try {
            if (win[storage].getItem(key) === expected) return true;
          } catch {
            // Check each source independently when access to another is blocked.
          }
        }
        return false;
      }
      default:
        throw new Error('Choose a supported condition type.');
    }
  }

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
    // Imported graphs can bypass validation. An annotation never executes or
    // acts as a bridge to downstream steps, even if it has malformed connections.
    if (node.data.kind === 'note') return;
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
            selectedHandle = matchesCondition(config) ? 'true' : 'false';
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

  function listen(
    target: EventTarget,
    event: string,
    listener: (event: Event) => void,
    capture = false,
  ): void {
    target.addEventListener(event, listener, { passive: true, capture });
    cleanups.add(() => target.removeEventListener(event, listener, capture));
  }

  function startBehaviorTrigger(nodeId: string, config: StepConfig): void {
    const fire = () => {
      void run(nodeId).catch(reportFailure);
    };
    // Keep these defaults and bounds aligned with triggers.ts. This function must
    // remain self-contained so the exported script has no module dependencies.
    const setting = (key: keyof StepConfig, fallback: number, min: number, max: number) => {
      const value = config[key] === undefined ? fallback : config[key];
      if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max)
        throw new Error(`${key} must be a whole number between ${min} and ${max}.`);
      return value;
    };
    if (config.event === 'exit-intent') {
      let fired = false;
      listen(doc, 'mouseout', (event) => {
        const mouse = event as MouseEvent;
        if (!fired && !doc.hidden && mouse.relatedTarget === null && mouse.clientY <= 0) {
          fired = true;
          fire();
        }
      });
      return;
    }
    if (config.event === 'rage-click') {
      const count = setting('rageClickCount', 3, 2, 100);
      const windowMs = setting('rageClickWindow', 1000, 100, 60000);
      const radius = setting('rageClickRadius', 50, 1, 1000);
      let clicks: { time: number; x: number; y: number }[] = [];
      listen(
        doc,
        'click',
        (event) => {
          const mouse = event as MouseEvent;
          // Keyboard activation has detail=0 and must not count as rage clicking.
          if (doc.hidden || mouse.button !== 0 || mouse.detail === 0) return;
          const now = Date.now();
          clicks = clicks.filter((click) => now - click.time <= windowMs);
          const first = clicks[0];
          if (first && Math.hypot(mouse.clientX - first.x, mouse.clientY - first.y) > radius)
            clicks = [];
          clicks.push({ time: now, x: mouse.clientX, y: mouse.clientY });
          if (clicks.length >= count) {
            clicks = [];
            fire();
          }
        },
        true,
      );
      listen(doc, 'visibilitychange', () => {
        clicks = [];
      });
      return;
    }
    if (config.event === 'inactivity') {
      const duration = setting('duration', 30000, 1000, 86400000);
      let timer: number | undefined;
      const reset = () => {
        win.clearTimeout(timer);
        timer = undefined;
        if (!doc.hidden && !destroyed) {
          timer = win.setTimeout(() => {
            timer = undefined;
            if (!doc.hidden) fire();
          }, duration);
        }
      };
      for (const event of [
        'pointermove',
        'pointerdown',
        'mousemove',
        'mousedown',
        'keydown',
        'touchstart',
        'touchmove',
        'wheel',
        'scroll',
        'click',
      ])
        listen(doc, event, reset, true);
      listen(win, 'scroll', reset);
      listen(doc, 'visibilitychange', reset);
      cleanups.add(() => win.clearTimeout(timer));
      reset();
      return;
    }

    const pageScroll = () => {
      const root = doc.documentElement;
      const height = Math.max(root.scrollHeight, doc.body?.scrollHeight ?? 0);
      const maximum = Math.max(0, height - (win.innerHeight || root.clientHeight));
      const offset = win.scrollY || doc.scrollingElement?.scrollTop || root.scrollTop || 0;
      return { maximum, position: Math.max(0, Math.min(maximum, offset)) };
    };
    const isPageScroll = (event: Event) =>
      event.target === doc ||
      event.target === win ||
      event.target === doc.documentElement ||
      event.target === doc.body;
    if (config.event === 'scroll-depth') {
      const threshold = setting('scrollThreshold', 75, 1, 100);
      let previous = pageScroll().position;
      let fired = false;
      listen(
        win,
        'scroll',
        (event) => {
          if (!isPageScroll(event)) return;
          const { position, maximum } = pageScroll();
          const downward = position > previous;
          previous = position;
          if (
            !fired &&
            !doc.hidden &&
            downward &&
            maximum > 0 &&
            (position / maximum) * 100 >= threshold
          ) {
            fired = true;
            fire();
          }
        },
        true,
      );
      listen(doc, 'visibilitychange', () => {
        previous = pageScroll().position;
      });
      return;
    }
    if (config.event === 'scroll-thrashing') {
      const count = setting('scrollDirectionChanges', 4, 2, 100);
      const windowMs = setting('scrollThrashWindow', 2000, 100, 60000);
      const distance = setting('scrollMinDistance', 50, 1, 1000);
      let previous = pageScroll().position;
      let extreme = previous;
      let direction = 0;
      let lastMovement = Date.now();
      let reversals: number[] = [];
      const reset = () => {
        previous = pageScroll().position;
        extreme = previous;
        direction = 0;
        reversals = [];
      };
      listen(
        win,
        'scroll',
        (event) => {
          if (!isPageScroll(event)) return;
          if (doc.hidden) {
            reset();
            return;
          }
          const current = pageScroll().position;
          if (current === previous) return;
          const now = Date.now();
          if (now - lastMovement > windowMs) {
            direction = 0;
            extreme = previous;
            reversals = [];
          }
          previous = current;
          lastMovement = now;
          reversals = reversals.filter((time) => now - time <= windowMs);
          const delta = current - extreme;
          if (direction && Math.sign(delta) === direction) {
            extreme = current;
          } else if (Math.abs(delta) >= distance) {
            if (direction) reversals.push(now);
            direction = Math.sign(delta);
            extreme = current;
            if (reversals.length >= count) {
              reset();
              fire();
            }
          }
        },
        true,
      );
      listen(doc, 'visibilitychange', reset);
    }
  }

  function startZoomTrigger(nodeId: string, selector: string): void {
    // Observe gestures without consuming them or changing the site's zoom behavior.
    // A small pinch dead zone avoids firing on two-finger scrolling or touch jitter.
    const pinchRatio = 1.05;
    const wheelGap = 300;
    type ZoomSession = {
      source: 'touch' | 'gesture' | 'wheel' | 'viewport';
      element: Element;
      baseline: number;
      viewportScale: number;
      fired: boolean;
      touchIds?: number[];
    };
    let session: ZoomSession | undefined;
    let lastWheel = 0;
    let suppressWheelUntil = 0;
    let pendingPinch: number | undefined;
    const viewport = win.visualViewport;
    const selected = (target: EventTarget | null) =>
      (target as Element | null)?.closest?.(selector) ?? null;
    const reset = () => {
      win.clearTimeout(pendingPinch);
      session = undefined;
      lastWheel = 0;
      suppressWheelUntil = 0;
    };
    const begin = (source: ZoomSession['source'], element: Element, baseline: number) => {
      win.clearTimeout(pendingPinch);
      // Safari can describe the same trackpad pinch with wheel and gesture events.
      const fired =
        session?.element === element &&
        session.fired &&
        (session.source !== 'wheel' || Date.now() - lastWheel < wheelGap);
      session = {
        source,
        element,
        baseline,
        viewportScale: viewport?.scale || 1,
        fired: !!fired,
      };
      return session;
    };
    const fire = () => {
      if (
        !session ||
        session.fired ||
        doc.hidden ||
        destroyed ||
        !session.element.isConnected ||
        !session.element.matches(selector)
      )
        return;
      session.fired = true;
      void run(nodeId).catch(reportFailure);
    };
    const end = () => {
      win.clearTimeout(pendingPinch);
      if (session?.fired) suppressWheelUntil = Date.now() + wheelGap;
      session = undefined;
    };

    listen(
      doc,
      'wheel',
      (event) => {
        const wheel = event as WheelEvent;
        if (doc.hidden || !wheel.ctrlKey || !Number.isFinite(wheel.deltaY) || !wheel.deltaY) return;
        if (session && session.source !== 'wheel') return;
        const now = Date.now();
        if (now < suppressWheelUntil) return;
        const element = selected(wheel.target);
        if (!element) {
          session = undefined;
          return;
        }
        if (session?.element !== element || now - lastWheel >= wheelGap) begin('wheel', element, 1);
        lastWheel = now;
        // Ctrl+wheel is also emitted for trackpad pinch in supporting browsers.
        // Its delta signals direction, not a reliable percentage of magnification.
        if (wheel.deltaY < 0) fire();
      },
      true,
    );

    listen(
      doc,
      'touchstart',
      (event) => {
        const touches = Array.from((event as TouchEvent).touches);
        if (doc.hidden || touches.length !== 2) {
          end();
          return;
        }
        const [first, second] = touches;
        const midpoint = doc.elementFromPoint?.(
          (first.clientX + second.clientX) / 2,
          (first.clientY + second.clientY) / 2,
        );
        const firstTarget = selected(first.target);
        const element =
          typeof doc.elementFromPoint === 'function'
            ? selected(midpoint ?? null)
            : firstTarget === selected(second.target)
              ? firstTarget
              : null;
        const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
        if (!element || !Number.isFinite(distance) || distance <= 0) {
          end();
          return;
        }
        begin('touch', element, distance).touchIds = [first.identifier, second.identifier];
      },
      true,
    );
    listen(
      doc,
      'touchmove',
      (event) => {
        if (doc.hidden || session?.source !== 'touch') return;
        const touches = Array.from((event as TouchEvent).touches);
        if (
          touches.length !== 2 ||
          touches.some((touch) => !session?.touchIds?.includes(touch.identifier))
        ) {
          end();
          return;
        }
        const [first, second] = touches;
        const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
        if (Number.isFinite(distance) && distance >= session.baseline * pinchRatio) fire();
      },
      true,
    );
    listen(doc, 'touchend', () => session?.source === 'touch' && end(), true);
    listen(
      doc,
      'touchcancel',
      () => {
        if (session?.source !== 'touch') return;
        if (!viewport || doc.hidden) {
          end();
          return;
        }
        // The browser can cancel touch delivery as it takes over native pinch
        // zoom. Briefly retain its target for the following viewport resize.
        session.source = 'viewport';
        pendingPinch = win.setTimeout(end, 500);
      },
      true,
    );
    cleanups.add(() => win.clearTimeout(pendingPinch));

    listen(
      doc,
      'gesturestart',
      (event) => {
        if (doc.hidden || session?.source === 'touch') return;
        const element = selected(event.target);
        if (!element) {
          end();
          return;
        }
        begin('gesture', element, 1);
      },
      true,
    );
    listen(
      doc,
      'gesturechange',
      (event) => {
        if (doc.hidden || !session || session.source === 'wheel') return;
        const scale = (event as Event & { scale: number }).scale;
        if (Number.isFinite(scale) && scale >= pinchRatio) fire();
      },
      true,
    );
    listen(doc, 'gestureend', () => session?.source === 'gesture' && end(), true);
    if (viewport)
      listen(viewport, 'resize', () => {
        // Native pinch zoom may stop delivering touchmove once the browser takes
        // over. Only attribute scale changes to a gesture started on this target.
        if (
          session &&
          session.source !== 'wheel' &&
          viewport.scale >= session.viewportScale * pinchRatio
        )
          fire();
      });
    listen(doc, 'visibilitychange', reset);
  }

  function startSwipeTrigger(nodeId: string, selector: string): void {
    type Swipe = {
      source: 'touch' | 'pointer';
      id: number;
      element: Element;
      x: number;
      y: number;
      time: number;
    };
    let swipe: Swipe | undefined;
    const pointers = new Set<number>();
    const reset = () => {
      swipe = undefined;
      pointers.clear();
    };
    const begin = (
      source: Swipe['source'],
      id: number,
      target: EventTarget | null,
      x: number,
      y: number,
    ) => {
      swipe = undefined;
      const element = (target as Element | null)?.closest?.(selector);
      if (doc.hidden || !element || !Number.isFinite(x) || !Number.isFinite(y)) return;
      swipe = { source, id, element, x, y, time: Date.now() };
    };
    const finish = (x: number, y: number) => {
      const started = swipe;
      swipe = undefined;
      if (!started || doc.hidden || destroyed) return;
      const elapsed = Date.now() - started.time;
      const distance = Math.hypot(x - started.x, y - started.y);
      if (
        elapsed >= 0 &&
        elapsed <= 1000 &&
        Number.isFinite(distance) &&
        distance >= 50 &&
        started.element.isConnected &&
        started.element.matches(selector)
      )
        void run(nodeId).catch(reportFailure);
    };

    // Prefer the touch stream when both APIs describe the same contact. Native
    // scrolling may cancel pointer delivery while touch events still complete.
    listen(
      doc,
      'touchstart',
      (event) => {
        const touches = (event as TouchEvent).touches;
        if (touches.length !== 1 || pointers.size > 1) {
          swipe = undefined;
          return;
        }
        const touch = touches[0];
        begin('touch', touch.identifier, touch.target, touch.clientX, touch.clientY);
      },
      true,
    );
    listen(
      doc,
      'touchmove',
      (event) => {
        if (swipe?.source !== 'touch') return;
        const touches = (event as TouchEvent).touches;
        if (touches.length !== 1 || touches[0].identifier !== swipe.id) swipe = undefined;
      },
      true,
    );
    listen(
      doc,
      'touchend',
      (event) => {
        if (swipe?.source !== 'touch') return;
        const touchEvent = event as TouchEvent;
        const touch = Array.from(touchEvent.changedTouches).find(
          (touch) => touch.identifier === swipe?.id,
        );
        if (touchEvent.touches.length || !touch) {
          swipe = undefined;
          return;
        }
        finish(touch.clientX, touch.clientY);
      },
      true,
    );
    listen(
      doc,
      'touchcancel',
      () => {
        swipe = undefined;
      },
      true,
    );

    listen(
      doc,
      'pointerdown',
      (event) => {
        const pointer = event as PointerEvent;
        if (pointer.pointerType !== 'touch' && pointer.pointerType !== 'pen') return;
        pointers.add(pointer.pointerId);
        if (!pointer.isPrimary || pointer.button !== 0 || pointers.size !== 1) {
          swipe = undefined;
          return;
        }
        begin('pointer', pointer.pointerId, pointer.target, pointer.clientX, pointer.clientY);
      },
      true,
    );
    listen(
      doc,
      'pointerup',
      (event) => {
        const pointer = event as PointerEvent;
        pointers.delete(pointer.pointerId);
        if (swipe?.source === 'pointer' && swipe.id === pointer.pointerId)
          finish(pointer.clientX, pointer.clientY);
      },
      true,
    );
    listen(
      doc,
      'pointercancel',
      (event) => {
        const pointer = event as PointerEvent;
        pointers.delete(pointer.pointerId);
        if (swipe?.source === 'pointer' && swipe.id === pointer.pointerId) swipe = undefined;
      },
      true,
    );
    listen(doc, 'visibilitychange', reset);
    listen(win, 'blur', reset);
    cleanups.add(reset);
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
      } else if (
        ['exit-intent', 'rage-click', 'inactivity', 'scroll-thrashing', 'scroll-depth'].includes(
          config.event,
        )
      ) {
        try {
          startBehaviorTrigger(node.id, config);
        } catch (error) {
          log(
            node.id,
            'error',
            error instanceof Error ? error.message : 'Invalid trigger settings.',
          );
        }
      } else if (
        ['click', 'mouseover', 'submit', 'change', 'zoom-in', 'swipe'].includes(config.event)
      ) {
        if (typeof config.selector !== 'string' || !config.selector.trim()) {
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
        if (event === 'zoom-in') {
          startZoomTrigger(node.id, selector);
          continue;
        }
        if (event === 'swipe') {
          startSwipeTrigger(node.id, selector);
          continue;
        }
        const listener = (incoming: Event) => {
          const target = incoming.target as Element | null;
          if (target?.closest?.(selector)) void run(node.id).catch(reportFailure);
        };
        doc.addEventListener(event, listener);
        cleanups.add(() => doc.removeEventListener(event, listener));
      } else {
        log(node.id, 'error', 'Choose a supported trigger event.');
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
