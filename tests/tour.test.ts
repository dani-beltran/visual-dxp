// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalog, createNode, stepSummary } from '../src/lib/catalog';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { getNodeDataFlow } from '../src/lib/nodeData';
import { createRuntime } from '../src/lib/runtime';
import { isWorkflow } from '../src/lib/serialization';
import { createTourStep, isTourStep, tourButtonDefaults } from '../src/lib/tour';
import type {
  NodeKind,
  RunLog,
  StepConfig,
  TourStep,
  Workflow,
  WorkflowNode,
} from '../src/lib/types';

function node(id: string, kind: NodeKind, config: StepConfig = {}): WorkflowNode {
  return { id, type: 'workflow', position: { x: 0, y: 0 }, data: { kind, label: id, config } };
}
function workflow(nodes: WorkflowNode[], connections: [string, string][]): Workflow {
  return {
    version: 1,
    name: 'Tour experience',
    websiteUrl: window.location.href,
    nodes,
    edges: connections.map(([source, target], index) => ({ id: `e${index}`, source, target })),
  };
}
const step = (title: string, settings: TourStep = {}): TourStep => ({
  contentType: 'html',
  content: `<h2>${title}</h2>`,
  position: 'center',
  ...settings,
});
/** start → tour → a DOM update that proves when control reaches the next node. */
function tourGraph(config: StepConfig, extra: WorkflowNode[] = [], connections = true) {
  return workflow(
    [
      node('start', 'trigger', { event: 'page-load' }),
      node('tour', 'tour', config),
      node('after', 'dom', { selector: '#result', action: 'text', value: 'After tour' }),
      ...extra,
    ],
    connections
      ? [
          ['start', 'tour'],
          ['tour', 'after'],
        ]
      : [],
  );
}
const threeSteps = { tourSteps: [step('One'), step('Two'), step('Three')] };

type Runtime = ReturnType<typeof createRuntime>;
const runtimes: Runtime[] = [];
function runtime(...args: Parameters<typeof createRuntime>) {
  const instance = createRuntime(...args);
  runtimes.push(instance);
  return instance;
}
afterEach(() => {
  runtimes.splice(0).forEach((instance) => {
    instance.destroy();
  });
  const exported = (window as Window & { visualDXP?: Runtime }).visualDXP;
  exported?.destroy();
  delete (window as Window & { visualDXP?: Runtime }).visualDXP;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const panels = () => document.querySelectorAll('[data-visual-dxp-popover="tour"]');
const title = () => document.querySelector('[data-visual-dxp-popover="tour"] h2')?.textContent;
const progress = () =>
  document.querySelector('[data-visual-dxp-popover-controls] span')?.textContent;
const actions = () =>
  [...document.querySelectorAll<HTMLButtonElement>('[data-visual-dxp-action]')].map(
    (button) => `${button.dataset.visualDxpAction}:${button.textContent}`,
  );
function find<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
}
function press(action: string) {
  const button = document.querySelector<HTMLButtonElement>(`[data-visual-dxp-action="${action}"]`);
  if (!button) throw new Error(`Missing ${action} button`);
  button.click();
}
const result = () => document.querySelector('#result')?.textContent;
/** Let the awaiting tour continue after a click. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Tour runtime', () => {
  it('shows one step at a time and continues only after Done, passing data through', async () => {
    document.body.innerHTML = '<p id="result">Waiting</p>';
    const logs: RunLog[] = [];
    const graph = tourGraph(threeSteps);
    const instance = runtime(graph, { onLog: (entry) => logs.push(entry) });
    const running = instance.run('start');
    await settle();

    expect(panels()).toHaveLength(1);
    expect(title()).toBe('One');
    expect(progress()).toBe('1 / 3');
    // The first step offers no way back.
    expect(actions()).toEqual(['next:Next']);
    expect(result()).toBe('Waiting');

    press('next');
    await settle();
    expect(panels()).toHaveLength(1);
    expect(title()).toBe('Two');
    expect(progress()).toBe('2 / 3');
    expect(actions()).toEqual(['previous:Previous', 'next:Next']);

    press('previous');
    await settle();
    expect(title()).toBe('One');
    press('next');
    await settle();
    press('next');
    await settle();
    expect(title()).toBe('Three');
    expect(actions()).toEqual(['previous:Previous', 'done:Done']);
    expect(result()).toBe('Waiting');

    press('done');
    await running;
    expect(panels()).toHaveLength(0);
    expect(result()).toBe('After tour');
    expect(logs.filter((entry) => entry.nodeId === 'tour').map((entry) => entry.message)).toEqual([
      'Running step',
      'Showing tour step 1 of 3',
      'Showing tour step 2 of 3',
      'Showing tour step 1 of 3',
      'Showing tour step 2 of 3',
      'Showing tour step 3 of 3',
      'Tour completed after 3 steps',
    ]);
  });

  it('continues to the next node when the visitor closes the tour part-way', async () => {
    document.body.innerHTML = '<p id="result">Waiting</p>';
    const logs: RunLog[] = [];
    const instance = runtime(tourGraph(threeSteps), { onLog: (entry) => logs.push(entry) });
    const running = instance.run('start');
    await settle();
    press('next');
    await settle();
    find('[aria-label="Close experience"]').click();
    await running;
    expect(panels()).toHaveLength(0);
    expect(result()).toBe('After tour');
    expect(logs.at(-3)).toMatchObject({
      nodeId: 'tour',
      status: 'success',
      message: 'Tour closed at step 2 of 3',
    });
  });

  it('forwards incoming data unchanged to the next node', async () => {
    document.body.innerHTML = '<p id="result">Waiting</p>';
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response('{"name":"Ada"}', { headers: { 'Content-Type': 'application/json' } }),
      );
    const graph = workflow(
      [
        node('start', 'trigger', { event: 'page-load' }),
        node('request', 'http', { url: 'https://example.com/user' }),
        node('tour', 'tour', { tourSteps: [step('Only')] }),
        node('after', 'dom', { selector: '#result', action: 'text', value: 'Hi {{name}}' }),
      ],
      [
        ['start', 'request'],
        ['request', 'tour'],
        ['tour', 'after'],
      ],
    );
    expect(getNodeDataFlow('tour', graph.nodes, graph.edges)).toBe('forwards');
    const running = runtime(graph, { fetch: fetcher }).run('start');
    await vi.waitFor(() => expect(panels()).toHaveLength(1));
    // A single step needs only Done.
    expect(actions()).toEqual(['done:Done']);
    press('done');
    await running;
    expect(result()).toBe('Hi Ada');
  });

  it('uses custom button labels and falls back to the defaults for blank ones', async () => {
    const instance = runtime(
      tourGraph({
        ...threeSteps,
        tourNextLabel: 'Siguiente',
        tourPreviousLabel: '   ',
        tourDoneLabel: 'Listo',
      }),
    );
    void instance.run('start');
    await settle();
    expect(actions()).toEqual(['next:Siguiente']);
    press('next');
    await settle();
    expect(actions()).toEqual(['previous:Previous', 'next:Siguiente']);
    press('next');
    await settle();
    expect(actions()).toEqual(['previous:Previous', 'done:Listo']);
  });

  it('keeps the runtime fallbacks identical to the labels the editor shows', async () => {
    void runtime(tourGraph({ tourSteps: [step('A'), step('B')] })).run('start');
    await settle();
    press('next');
    await settle();
    expect(actions()).toEqual([
      `previous:${tourButtonDefaults.previous}`,
      `done:${tourButtonDefaults.done}`,
    ]);
    press('previous');
    await settle();
    expect(actions()).toEqual([`next:${tourButtonDefaults.next}`]);
  });

  it('moves keyboard focus to the primary button after navigating, not on first display', async () => {
    document.body.innerHTML = '<button id="outside">Outside</button>';
    find('#outside').focus();
    void runtime(tourGraph(threeSteps)).run('start');
    await settle();
    expect(document.activeElement?.id).toBe('outside');
    press('next');
    await settle();
    expect((document.activeElement as HTMLElement).dataset.visualDxpAction).toBe('next');
    press('previous');
    await settle();
    expect((document.activeElement as HTMLElement).dataset.visualDxpAction).toBe('next');
  });

  it('ends a superseded run without running its next node when the tour is shown again', async () => {
    document.body.innerHTML = '<p id="result">0</p>';
    let count = 0;
    const graph = tourGraph({ tourSteps: [step('A'), step('B')] });
    graph.nodes[2] = node('after', 'dom', { selector: '#result', action: 'text', value: 'x' });
    const logs: RunLog[] = [];
    const instance = runtime(graph, {
      onLog: (entry) => {
        logs.push(entry);
        if (entry.nodeId === 'after' && entry.status === 'success') count += 1;
      },
    });
    const first = instance.run('start');
    await settle();
    press('next');
    await settle();
    const second = instance.run('start');
    await first;
    expect(logs.some((entry) => entry.message === 'Tour was shown again before it ended')).toBe(
      true,
    );
    expect(count).toBe(0);
    // The new run starts from the beginning, with a single panel.
    await settle();
    expect(panels()).toHaveLength(1);
    expect(title()).toBe('A');
    press('next');
    await settle();
    press('done');
    await second;
    expect(count).toBe(1);
  });

  it('removes the tour and skips the next node when the runtime is destroyed', async () => {
    document.body.innerHTML = '<p id="result">Waiting</p>';
    const instance = runtime(tourGraph(threeSteps));
    const running = instance.run('start');
    await settle();
    instance.destroy();
    await running;
    expect(panels()).toHaveLength(0);
    expect(result()).toBe('Waiting');
  });

  it('reuses popover placement, anchors and errors for each step', async () => {
    document.body.innerHTML = '<button id="cta">Buy</button><p id="result">Waiting</p>';
    const logs: RunLog[] = [];
    const instance = runtime(
      tourGraph({
        tourSteps: [
          step('Anchored', { position: 'anchor', selector: '#cta', width: 300 }),
          step('Missing', { position: 'anchor', selector: '#absent' }),
        ],
      }),
      { onLog: (entry) => logs.push(entry) },
    );
    const running = instance.run('start');
    await settle();
    const panel = panels()[0] as HTMLElement;
    expect(panel.style.width).toBe('300px');
    expect(panel.querySelector('svg')).not.toBeNull();
    press('next');
    await expect(running).rejects.toThrow('No elements match “#absent”.');
    expect(logs.at(-1)).toMatchObject({ nodeId: 'tour', status: 'error' });
    expect(result()).toBe('Waiting');
  });

  describe('scrolling to anchors', () => {
    let scroll: ReturnType<typeof vi.fn>;
    beforeEach(() => {
      scroll = vi.fn();
      Object.defineProperty(Element.prototype, 'scrollIntoView', {
        configurable: true,
        value: scroll,
      });
    });
    afterEach(() => {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    });
    /** jsdom has no layout: place an element relative to the 768px-high viewport. */
    function at(selector: string, top: number) {
      vi.spyOn(find(selector), 'getBoundingClientRect').mockReturnValue(
        DOMRect.fromRect({ x: 40, y: top, width: 120, height: 40 }),
      );
    }

    it('scrolls anchored steps into view only when their anchor is not fully visible', async () => {
      document.body.innerHTML = '<button id="top">Top</button><form id="below">Later</form>';
      at('#top', 100);
      at('#below', 1500);
      void runtime(
        tourGraph({
          tourSteps: [
            step('Intro'),
            step('Visible', { position: 'anchor', selector: '#top' }),
            step('Below', { position: 'anchor', selector: '#below' }),
          ],
        }),
      ).run('start');
      await settle();
      press('next');
      await settle();
      expect(title()).toBe('Visible');
      expect(scroll).not.toHaveBeenCalled();
      press('next');
      await settle();
      expect(title()).toBe('Below');
      expect(scroll).toHaveBeenCalledExactlyOnceWith({
        block: 'center',
        inline: 'nearest',
        behavior: 'smooth',
      });
      expect(scroll.mock.contexts[0]).toBe(find('#below'));
      // Partly visible anchors count as out of view, including going back to them.
      at('#top', 750);
      press('previous');
      await settle();
      expect(scroll).toHaveBeenCalledTimes(2);
      expect(scroll.mock.contexts[1]).toBe(find('#top'));
    });

    it('jumps instead of animating for visitors who prefer reduced motion', async () => {
      document.body.innerHTML = '<form id="below">Later</form>';
      at('#below', -300);
      vi.stubGlobal(
        'matchMedia',
        vi.fn((query: string) => ({ matches: query.includes('reduce') })),
      );
      try {
        void runtime(
          tourGraph({ tourSteps: [step('Below', { position: 'anchor', selector: '#below' })] }),
        ).run('start');
        await settle();
        // 'auto' would follow a page's CSS scroll-behavior: smooth.
        expect(scroll).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ behavior: 'instant' }),
        );
        // Browsers that predate 'instant' reject it; the step still scrolls.
        scroll.mockImplementationOnce(() => {
          throw new TypeError('Unsupported scroll behavior');
        });
        runtimes.splice(0).forEach((instance) => {
          instance.destroy();
        });
        void runtime(
          tourGraph({ tourSteps: [step('Again', { position: 'anchor', selector: '#below' })] }),
        ).run('start');
        await settle();
        expect(title()).toBe('Again');
        expect(scroll).toHaveBeenLastCalledWith({ block: 'center', inline: 'nearest' });
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('never scrolls the page for standalone Popover nodes', async () => {
      document.body.innerHTML = '<form id="below">Later</form>';
      at('#below', 1500);
      await runtime(
        workflow(
          [
            node('start', 'trigger', { event: 'page-load' }),
            node('popover', 'popover', { position: 'anchor', selector: '#below' }),
          ],
          [['start', 'popover']],
        ),
      ).run('start');
      expect(document.querySelector('[data-visual-dxp-popover="popover"]')).not.toBeNull();
      expect(scroll).not.toHaveBeenCalled();
    });
  });

  it('never sends a form in a step; submitting it advances the tour without collecting data', async () => {
    document.body.innerHTML = '<p id="result">Waiting</p>';
    const instance = runtime(
      tourGraph({
        tourSteps: [
          step('Form', {
            content:
              '<h2>Form</h2><form action="https://example.com/never"><input name="email" value="a@b.c"><button>Join</button></form>',
          }),
          step('Last'),
        ],
      }),
    );
    const running = instance.run('start');
    await settle();
    const submitted = vi.fn((event: Event) => event.defaultPrevented);
    document.addEventListener('submit', submitted);
    find('[data-visual-dxp-popover] form button').click();
    await settle();
    expect(submitted).toHaveReturnedWith(true);
    expect(title()).toBe('Last');
    press('done');
    await running;
    expect(result()).toBe('After tour');
    document.removeEventListener('submit', submitted);
  });

  it('opens at a requested start step for editor previews, clamped to the tour', async () => {
    void runtime(tourGraph(threeSteps), { tourStartSteps: { tour: 1 } }).run('start');
    await settle();
    expect(title()).toBe('Two');
    expect(actions()).toEqual(['previous:Previous', 'next:Next']);
    runtimes.splice(0).forEach((instance) => {
      instance.destroy();
    });
    void runtime(tourGraph(threeSteps), { tourStartSteps: { tour: 99 } }).run('start');
    await settle();
    expect(title()).toBe('Three');
  });

  it('runs from an exported script, where runtime modules are serialized', async () => {
    document.body.innerHTML = '<p id="result">Waiting</p>';
    new Function('window', 'document', exportWorkflow(tourGraph(threeSteps)))(window, document);
    await settle();
    expect(title()).toBe('One');
    press('next');
    await settle();
    expect(progress()).toBe('2 / 3');
    press('next');
    await settle();
    press('done');
    await vi.waitFor(() => expect(result()).toBe('After tour'));
    expect(panels()).toHaveLength(0);
  });
});

describe('Tour configuration', () => {
  it('creates a valid two-step tour from the catalog', () => {
    const tour = createNode('tour');
    expect(tour.data.config.tourSteps).toHaveLength(2);
    expect(catalog.find((entry) => entry.kind === 'tour')?.config.tourSteps).not.toBe(
      tour.data.config.tourSteps,
    );
    expect(stepSummary('tour', tour.data.config)).toBe('2 steps');
    expect(stepSummary('tour', { tourSteps: [step('A')] })).toBe('1 step');
    const graph = workflow([node('start', 'trigger'), tour], [['start', tour.id]]);
    expect(validateWorkflow(graph)).toEqual([]);
    expect(isWorkflow(JSON.parse(JSON.stringify(graph)))).toBe(true);
  });

  it('reports popover issues per step, using the same checks as Popover nodes', () => {
    const graph = tourGraph({
      tourSteps: [
        step('Fine'),
        { position: 'anchor', width: 100 },
        { contentType: 'iframe', url: 'javascript:alert(1)' },
      ],
    });
    const popover = tourGraph({}, [node('popover', 'popover', { position: 'anchor', width: 100 })]);
    const popoverMessages = validateWorkflow(popover)
      .filter((issue) => issue.nodeId === 'popover')
      .map((issue) => issue.message);
    expect(popoverMessages).toEqual([
      'Choose an anchor element for the popover.',
      'Popover width must be between 240 and 960 pixels.',
    ]);
    expect(
      validateWorkflow(graph)
        .filter((issue) => issue.nodeId === 'tour')
        .map((issue) => issue.message),
    ).toEqual([
      ...popoverMessages.map((message) => `Step 2: ${message}`),
      'Step 3: Enter a valid HTTP or HTTPS URL for the popover iframe.',
    ]);
  });

  it('requires at least one well-formed step', () => {
    const messages = (config: StepConfig) =>
      validateWorkflow(tourGraph(config))
        .filter((issue) => issue.nodeId === 'tour')
        .map((issue) => issue.message);
    expect(messages({})).toEqual(['Add at least one step to the tour.']);
    expect(messages({ tourSteps: [] })).toEqual(['Add at least one step to the tour.']);
    expect(messages({ tourSteps: [{ content: 42 }] as unknown as TourStep[] })).toEqual([
      'Tour steps must be a list of popover settings.',
    ]);
    expect(messages({ ...threeSteps, tourNextLabel: 7 } as unknown as StepConfig)).toEqual([
      'Step text parameters must contain strings.',
    ]);
  });

  it('rejects imported tours whose steps are not plain popover settings', () => {
    const imported = (tourSteps: unknown) =>
      isWorkflow(JSON.parse(JSON.stringify(tourGraph({ tourSteps } as StepConfig))));
    expect(imported([step('A'), { width: 320, popoverAnimation: 'zoom' }])).toBe(true);
    expect(imported('steps')).toBe(false);
    expect(imported([null])).toBe(false);
    expect(imported([{ content: '<p>x</p>', event: 'click' }])).toBe(false);
    expect(imported([{ width: '320' }])).toBe(false);
    expect(isTourStep({ content: '<p>x</p>', selector: undefined })).toBe(true);
  });

  it('creates new steps that keep the previous step’s appearance, but not its anchor', () => {
    expect(
      createTourStep({ position: 'top-left', width: 500, popoverAnimation: 'zoom' }),
    ).toMatchObject({
      position: 'top-left',
      width: 500,
      popoverAnimation: 'zoom',
    });
    const afterAnchor = createTourStep({ position: 'anchor', selector: '#cta' });
    expect(afterAnchor.position).toBe('center');
    expect(afterAnchor).not.toHaveProperty('selector');
    expect(isTourStep(createTourStep())).toBe(true);
  });
});
