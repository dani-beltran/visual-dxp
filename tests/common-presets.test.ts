// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalog } from '../src/lib/catalog';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { absolutePosition, FRAME_HEADER_HEIGHT, nodeSize } from '../src/lib/frames';
import { createRuntime, type WorkflowRuntime } from '../src/lib/runtime';
import { isWorkflow } from '../src/lib/serialization';
import type { RunLog, WorkflowNode, WorkflowPreset } from '../src/lib/types';
import {
  blankPreset,
  boundedCtaAttentionPreset,
  campaignUrlPersonalizationPreset,
  commonDXPPresets,
  contextualSupportPreset,
  delayedWelcomePreset,
  drawAttentionToNewsletterPreset,
  engagedReaderInvitationPreset,
  exitIntentOfferPreset,
  frustrationRecoveryPreset,
  guidedWebsiteTourPreset,
  headlineExperimentPreset,
  inactivityAssistancePreset,
  mobileSpecificMessagingPreset,
  satisfactionSurveyPreset,
  segmentedOnboardingPreset,
  welcomeJourneyPreset,
} from '../src/presets';

const demoHtml = readFileSync('public/demo-site.html', 'utf8');
const runtimes: WorkflowRuntime[] = [];
let request: ReturnType<typeof vi.fn<typeof fetch>>;
let logs: RunLog[];
function runtime(preset: WorkflowPreset) {
  const instance = createRuntime(preset.workflow, {
    fetch: request,
    onLog: (log) => logs.push(log),
  });
  runtimes.push(instance);
  return instance;
}
function successful() {
  return logs.filter((log) => log.status === 'success').map((log) => log.nodeId);
}
function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Missing test fixture value');
  return value;
}
function element<T extends Element = HTMLElement>(selector: string): T {
  return required(document.querySelector<T>(selector));
}
function popover(id: string) {
  return document.querySelector(`[data-visual-dxp-popover="${id}"]`);
}
function resetCookies() {
  for (const pair of document.cookie.split(';')) {
    // biome-ignore lint/suspicious/noDocumentCookie: Reset the same jsdom cookie jar used by the runtime.
    document.cookie = `${pair.split('=')[0].trim()}=; Max-Age=0; Path=/`;
  }
}
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = new DOMParser().parseFromString(demoHtml, 'text/html').body.innerHTML;
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  request = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', request);
  logs = [];
  resetCookies();
  localStorage.clear();
  sessionStorage.clear();
  history.replaceState(null, '', '/demo-site.html');
});
afterEach(() => {
  for (const instance of runtimes.splice(0)) instance.destroy();
  resetCookies();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('common DXP preset contracts and layout', () => {
  it('ships a serializable empty Blank preset that must be completed before export', () => {
    expect(JSON.parse(JSON.stringify(blankPreset))).toEqual(blankPreset);
    expect(isWorkflow(blankPreset.workflow)).toBe(true);
    expect(blankPreset.workflow.nodes).toEqual([]);
    expect(blankPreset.workflow.edges).toEqual([]);
    expect(validateWorkflow(blankPreset.workflow).length).toBeGreaterThan(0);
    expect(() =>
      exportWorkflow({ ...blankPreset.workflow, websiteUrl: 'https://example.com' }),
    ).toThrow();
  });

  it('has at least thirteen unique, deliberately ordered presets covering the existing preset node kinds', () => {
    expect(commonDXPPresets[0]).toBe(blankPreset);
    expect(commonDXPPresets.length).toBeGreaterThanOrEqual(13);
    expect(new Set(commonDXPPresets.map((p) => p.id)).size).toBe(commonDXPPresets.length);
    const order = commonDXPPresets.map((p) => p.order);
    expect(new Set(order).size).toBe(order.length);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    const levels = { beginner: 0, intermediate: 1, advanced: 2 };
    const complexity = commonDXPPresets.map((p) => levels[p.complexity]);
    expect(complexity).toEqual([...complexity].sort());
    expect(
      new Set(commonDXPPresets.flatMap((p) => p.workflow.nodes.map((n) => n.data.kind))),
    ).toEqual(
      new Set(catalog.filter((entry) => entry.kind !== 'track-event').map((entry) => entry.kind)),
    );
  });

  it.each(commonDXPPresets.filter((preset) => preset !== blankPreset))(
    '$name serializes, validates, exports, and has reachable executable nodes',
    (preset) => {
      expect(JSON.parse(JSON.stringify(preset))).toEqual(preset);
      expect(isWorkflow(preset.workflow)).toBe(true);
      expect(validateWorkflow(preset.workflow)).toEqual([]);
      expect(preset.setupInstructions).toBeUndefined();
      const notes = preset.workflow.nodes.filter((node) => node.data.kind === 'note');
      const overview = notes.filter((node) => node.data.label === 'Preset overview');
      expect(overview).toHaveLength(1);
      expect(overview[0].data.config).toEqual({
        noteText: preset.description,
        noteColor: '#def0d8',
      });
      const setupNotes = notes.filter((node) => node.id !== overview[0].id);
      expect(setupNotes.length).toBeGreaterThan(0);
      for (const note of setupNotes) {
        expect(note.data.label).toMatch(/^Setup:/);
        expect(note.data.config.noteText?.trim().length).toBeGreaterThan(0);
      }
      for (const note of notes) {
        expect(
          preset.workflow.edges.some((edge) => edge.source === note.id || edge.target === note.id),
        ).toBe(false);
      }
      expect(() => exportWorkflow(preset.workflow)).toThrow('demo website');
      expect(
        exportWorkflow({ ...preset.workflow, websiteUrl: 'https://shop.example/collection' }),
      ).toContain('workflow');
      const { nodes, edges } = preset.workflow;
      const executable = nodes.filter((n) => !['note', 'frame'].includes(n.data.kind));
      const ids = new Set(executable.map((n) => n.id));
      const visited = new Set(nodes.filter((n) => n.data.kind === 'trigger').map((n) => n.id));
      const pending = [...visited];
      for (const id of pending) {
        for (const edge of edges.filter((edge) => edge.source === id)) {
          expect(ids.has(edge.source) && ids.has(edge.target)).toBe(true);
          if (!visited.has(edge.target)) {
            visited.add(edge.target);
            pending.push(edge.target);
          }
        }
      }
      expect(visited).toEqual(ids);
      for (const node of nodes) {
        const { selector, condition, content } = node.data.config;
        for (const target of [selector, condition].filter((value): value is string =>
          Boolean(value),
        )) {
          expect(document.querySelector(target), target).not.toBeNull();
        }
        if (content) {
          const fragment = new DOMParser().parseFromString(content, 'text/html');
          for (const link of fragment.querySelectorAll('a[href^="#"]')) {
            expect(document.querySelector(required(link.getAttribute('href')))).not.toBeNull();
          }
        }
      }
    },
  );

  it.each(commonDXPPresets)(
    '$name separates cards and keeps frame children inside their parents',
    ({ workflow }) => {
      function bounds(node: WorkflowNode) {
        return {
          ...absolutePosition(node, workflow.nodes),
          ...nodeSize(node),
          // Allow the note editor's full 320px text area plus header and padding.
          ...(node.data.kind === 'note' ? { height: 380 } : {}),
        };
      }
      for (const node of workflow.nodes) {
        const box = bounds(node);
        if (node.parentId) {
          const parent = required(workflow.nodes.find((entry) => entry.id === node.parentId));
          expect(parent.data.kind).toBe('frame');
          expect(workflow.nodes.indexOf(parent)).toBeLessThan(workflow.nodes.indexOf(node));
          expect(node.position.x).toBeGreaterThanOrEqual(20);
          expect(node.position.y).toBeGreaterThanOrEqual(FRAME_HEADER_HEIGHT + 20);
          expect(node.position.x + box.width).toBeLessThanOrEqual(required(parent.width) - 20);
          expect(node.position.y + box.height).toBeLessThanOrEqual(required(parent.height) - 20);
        }
        for (const other of workflow.nodes) {
          if (node.id === other.id || node.parentId === other.id || other.parentId === node.id)
            continue;
          const next = bounds(other);
          const overlaps =
            box.x < next.x + next.width &&
            box.x + box.width > next.x &&
            box.y < next.y + next.height &&
            box.y + box.height > next.y;
          expect(overlaps, `${node.id} overlaps ${other.id}`).toBe(false);
        }
      }
    },
  );
});

describe('preset execution with a mocked browser and network', () => {
  it.each([
    [0.1, 'a', 'Everyday essentials, made extraordinary.'],
    [0.9, 'b', 'Thoughtful design for the way you live.'],
  ] as const)('assigns and remembers headline variant %s / %s', async (roll, variant, headline) => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(roll);
    const first = runtime(headlineExperimentPreset);
    await first.run();
    expect(element('.hero h1').textContent).toBe(headline);
    expect(successful()).toEqual(['experiment-load', 'headline-split', `headline-${variant}`]);
    expect(localStorage.getItem('visual-dxp-experiment-v1:dxp_headline_experiment')).toBe(variant);
    first.destroy();
    logs = [];
    element('.hero h1').textContent = 'Original headline';
    random.mockReturnValue(1 - roll);
    await runtime(headlineExperimentPreset).run();
    expect(element('.hero h1').textContent).toBe(headline);
    expect(successful()).toEqual(['experiment-load', 'headline-split', `headline-${variant}`]);
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'never shows the guided tour again once finished', ending: 'done', shownAgain: false },
    { name: 'never shows the guided tour again once closed', ending: 'close', shownAgain: false },
    {
      name: 'shows the guided tour again after leaving mid-tour',
      ending: 'leave',
      shownAgain: true,
    },
  ] as const)('$name', async ({ ending, shownAgain }) => {
    const tourPanel = () => popover('guided-tour');
    const first = runtime(guidedWebsiteTourPreset);
    first.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(tourPanel()?.querySelector('h2')?.textContent).toBe('Welcome to Atelier');
    expect(tourPanel()?.textContent).toContain('1 / 5');
    element('[data-visual-dxp-action="next"]').click();
    await vi.advanceTimersByTimeAsync(0);
    expect(tourPanel()?.textContent).toContain('2 / 5');
    // Anchored steps point at elements that exist on the page.
    expect(tourPanel()?.querySelector('svg')).not.toBeNull();
    // Nothing is remembered while the tour is still open.
    expect(document.cookie).not.toContain('dxp_guided_tour');
    if (ending === 'done') {
      for (const _ of [3, 4, 5]) {
        element('[data-visual-dxp-action="next"]').click();
        await vi.advanceTimersByTimeAsync(0);
      }
      expect(tourPanel()?.textContent).toContain('5 / 5');
      expect(element('[data-visual-dxp-action="done"]').textContent).toBe('Start browsing');
      element('[data-visual-dxp-action="done"]').click();
    } else if (ending === 'close') {
      element(
        '[data-visual-dxp-popover="guided-tour"] button[aria-label="Close experience"]',
      ).click();
    }
    await vi.advanceTimersByTimeAsync(0);
    if (ending === 'leave') {
      expect(successful()).toEqual(['tour-trigger', 'tour-check']);
    } else {
      expect(tourPanel()).toBeNull();
      expect(successful()).toEqual(['tour-trigger', 'tour-check', 'guided-tour', 'tour-cookie']);
    }
    first.destroy();
    expect(tourPanel()).toBeNull();
    expect(document.cookie.includes('dxp_guided_tour=seen')).toBe(!shownAgain);

    logs = [];
    runtime(guidedWebsiteTourPreset).start();
    await vi.advanceTimersByTimeAsync(0);
    expect(tourPanel() !== null).toBe(shownAgain);
    expect(successful()).toEqual(['tour-trigger', 'tour-check']);
  });

  it('anchors guided tour steps to elements on the demo website', () => {
    const tour = guidedWebsiteTourPreset.workflow.nodes.find((node) => node.id === 'guided-tour');
    const steps = required(tour?.data.config.tourSteps);
    expect(steps).toHaveLength(5);
    for (const step of steps) {
      if (step.position === 'anchor')
        expect(document.querySelector(required(step.selector)), step.selector).not.toBeNull();
      // Each step is styled by selectors scoped to the tour node ID.
      expect(step.content).toContain('[data-visual-dxp-popover="guided-tour"]');
    }
  });

  it('scrolls the guided tour down to the newsletter form, which starts out of view', async () => {
    const scroll = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scroll,
    });
    try {
      // jsdom has no layout: place the form below its 768px viewport, like the demo website.
      vi.spyOn(element('#newsletter form'), 'getBoundingClientRect').mockReturnValue(
        DOMRect.fromRect({ x: 40, y: 1100, width: 600, height: 40 }),
      );
      runtime(guidedWebsiteTourPreset).start();
      await vi.advanceTimersByTimeAsync(0);
      for (const _ of [2, 3]) {
        element('[data-visual-dxp-action="next"]').click();
        await vi.advanceTimersByTimeAsync(0);
      }
      expect(scroll).not.toHaveBeenCalled();
      element('[data-visual-dxp-action="next"]').click();
      await vi.advanceTimersByTimeAsync(0);
      expect(popover('guided-tour')?.textContent).toContain('4 / 5');
      expect(popover('guided-tour')?.textContent).toContain('Join the newsletter');
      expect(scroll).toHaveBeenCalledOnce();
      expect(scroll.mock.contexts[0]).toBe(element('#newsletter form'));
    } finally {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    }
  });

  it('shows the welcome gift once and welcomes the visitor back on the next load', async () => {
    const heading = element('#newsletter h2').textContent;
    const first = runtime(welcomeJourneyPreset);
    first.start();
    await vi.advanceTimersByTimeAsync(1499);
    expect(popover('offer')).toBeNull();
    expect(document.cookie).not.toContain('dxp_welcome_gift');
    await vi.advanceTimersByTimeAsync(1);
    expect(popover('offer')).not.toBeNull();
    expect(document.cookie).toContain('dxp_welcome_gift=shown');
    expect(element('#newsletter h2').textContent).toBe(heading);
    expect(successful()).toEqual(['welcome', 'check', 'pause', 'offer', 'gift-cookie']);
    first.destroy();
    logs = [];
    runtime(welcomeJourneyPreset).start();
    await vi.advanceTimersByTimeAsync(0);
    expect(popover('offer')).toBeNull();
    expect(element('#newsletter h2').textContent).toBe(
      'Welcome back! It’s lovely to see you again.',
    );
    expect(successful()).toEqual(['welcome', 'check', 'update']);
  });

  it.each([
    ['2026-10-01T08:59:59Z', false],
    ['2026-10-01T09:00:00Z', true],
    ['2026-10-01T16:59:59Z', true],
    ['2026-10-01T17:00:00Z', false],
    ['2026-10-02T12:00:00Z', true],
    ['2026-10-03T12:00:00Z', false],
    ['2026-10-04T12:00:00Z', false],
    ['2026-10-05T12:00:00Z', true],
  ])(
    'opens contextual support only on hover and checks UTC weekdays and opening hours at %s',
    async (time, open) => {
      vi.setSystemTime(new Date(time));
      runtime(contextualSupportPreset).start();
      await vi.advanceTimersByTimeAsync(0);
      expect(successful()).toEqual([]);
      element('#shop-now').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await vi.advanceTimersByTimeAsync(0);
      expect(successful()).toEqual([]);

      element('#support-help').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await vi.advanceTimersByTimeAsync(0);
      expect(successful()).toEqual([
        'support-hover',
        'support-weekdays',
        ...([0, 6].includes(new Date(time).getUTCDay()) ? [] : ['support-hours']),
        open ? 'support-online' : 'support-offline',
      ]);
      expect(popover(open ? 'support-offline' : 'support-online')).toBeNull();
      expect(element('#support-chat').classList.contains('dxp-support-visible')).toBe(open);
      expect(popover('support-online')).toBeNull();
      expect(document.querySelector('iframe')).toBeNull();
      if (!open) {
        expect(popover('support-offline')?.textContent).toContain('09:00–17:00 UTC, Monday–Friday');
      }
      expect(request).not.toHaveBeenCalled();
    },
  );

  it('rechecks support hours on a later hover after dismissing the previous message', async () => {
    vi.setSystemTime(new Date('2026-10-01T08:59:00Z'));
    runtime(contextualSupportPreset).start();
    element('#support-help').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(0);
    required(popover('support-offline')?.querySelector('button')).click();
    expect(popover('support-offline')).toBeNull();
    vi.setSystemTime(new Date('2026-10-01T09:00:00Z'));
    element('#support-help').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(0);
    expect(element('#support-chat').classList.contains('dxp-support-visible')).toBe(true);
    expect(popover('support-offline')).toBeNull();
  });

  it.each([
    ['2026-09-30T12:00:00Z', '2026-09-28', '2026-10-04'],
    ['2027-01-03T23:59:59Z', '2026-12-28', '2027-01-03'],
    ['2027-01-04T00:00:00Z', '2027-01-04', '2027-01-10'],
    ['2028-02-29T12:00:00Z', '2028-02-28', '2028-03-05'],
  ])(
    'calculates the current UTC week at %s and includes both boundaries',
    async (time, start, end) => {
      vi.setSystemTime(new Date(time));
      vi.resetModules();
      const { campaignHeadlinePreset } = await import('../src/presets/campaign-headline');
      const condition = required(
        campaignHeadlinePreset.workflow.nodes.find((node) => node.data.kind === 'fork'),
      );
      expect(condition.data.config).toMatchObject({
        conditionStartDate: start,
        conditionEndDate: end,
        conditionTimeZone: 'utc',
      });
      const first = Date.parse(`${start}T00:00:00Z`);
      const last = Date.parse(`${end}T23:59:59.999Z`);
      for (const [instant, matches] of [
        [first - 1, false],
        [first, true],
        [Date.parse(time), true],
        [last, true],
        [last + 1, false],
      ] as const) {
        vi.setSystemTime(instant);
        element('.hero h1').textContent = 'Original headline';
        await runtime(campaignHeadlinePreset).run();
        expect(element('.hero h1').textContent === 'Original headline').toBe(!matches);
      }
      // Advancing the runtime clock does not rewrite a saved preset's week.
      expect(condition.data.config.conditionStartDate).toBe(start);
      expect(condition.data.config.conditionEndDate).toBe(end);
      expect(JSON.parse(JSON.stringify(campaignHeadlinePreset))).toEqual(campaignHeadlinePreset);
    },
  );
  it.each([true, false])(
    'checks the newsletter form on page load before showing help (form exists: %s)',
    async (formExists) => {
      if (!formExists) element('#newsletter form').remove();
      runtime(drawAttentionToNewsletterPreset).start();
      await vi.advanceTimersByTimeAsync(0);
      expect(successful()).toContain('help-check');
      expect(popover('help-popover') !== null).toBe(formExists);
      expect(successful().includes('help-popover')).toBe(formExists);
    },
  );
  it('waits two seconds before rendering the welcome', async () => {
    const running = runtime(delayedWelcomePreset).run();
    await vi.advanceTimersByTimeAsync(1999);
    expect(popover('welcome-popover')).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    await running;
    expect(popover('welcome-popover')).not.toBeNull();
  });
  it('records a reader invitation only after downward scrolling reaches the threshold', async () => {
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(2000);
    vi.stubGlobal('innerHeight', 1000);
    vi.stubGlobal('scrollY', 0);
    runtime(engagedReaderInvitationPreset).start();
    vi.stubGlobal('scrollY', 699);
    document.dispatchEvent(new Event('scroll'));
    await vi.advanceTimersByTimeAsync(0);
    expect(document.cookie).not.toContain('dxp_reader_invitation');
    vi.stubGlobal('scrollY', 700);
    document.dispatchEvent(new Event('scroll'));
    await vi.advanceTimersByTimeAsync(0);
    expect(popover('reader-popover')).not.toBeNull();
    expect(document.cookie).toContain('dxp_reader_invitation=shown');
  });
  it.each([true, false])('selects distinct mobile/desktop messages (mobile=%s)', async (mobile) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(mobile ? 'iPhone Mobile' : 'Desktop');
    await runtime(mobileSpecificMessagingPreset).run();
    expect(successful()).toContain(mobile ? 'device-mobile' : 'device-desktop');
    expect(successful()).not.toContain(mobile ? 'device-desktop' : 'device-mobile');
    expect(element('.hero .description').textContent).toContain(
      mobile ? 'on the go' : 'closer look',
    );
  });
  it.each(['summer-sale', 'SUMMER-SALE', ''])(
    'matches campaign URL values exactly (%s)',
    async (campaign) => {
      history.replaceState(null, '', `/demo-site.html?utm_campaign=${campaign}`);
      await runtime(campaignUrlPersonalizationPreset).run();
      expect(successful()).toContain(
        campaign === 'summer-sale' ? 'campaign-matched' : 'campaign-default',
      );
      expect(successful()).not.toContain(
        campaign === 'summer-sale' ? 'campaign-default' : 'campaign-matched',
      );
    },
  );
  it('suppresses an exit offer across runtime installations after writing a session cookie', async () => {
    const writes = vi.spyOn(document, 'cookie', 'set');
    const first = runtime(exitIntentOfferPreset);
    first.start();
    document.dispatchEvent(new MouseEvent('mouseout', { clientY: 0, relatedTarget: null }));
    await vi.advanceTimersByTimeAsync(0);
    expect(popover('exit-popover')).not.toBeNull();
    expect(writes.mock.calls[0][0]).not.toMatch(/Max-Age|Expires/i);
    first.destroy();
    runtime(exitIntentOfferPreset).start();
    document.dispatchEvent(new MouseEvent('mouseout', { clientY: 0, relatedTarget: null }));
    await vi.advanceTimersByTimeAsync(0);
    expect(popover('exit-popover')).toBeNull();
    expect(writes).toHaveBeenCalledTimes(1);
  });
  it.each([true, false])(
    'offers anchored inactivity help or its absent-element fallback (%s)',
    async (present) => {
      if (!present) element('#newsletter form').remove();
      runtime(inactivityAssistancePreset).start();
      await vi.advanceTimersByTimeAsync(30000);
      expect(popover('idle-help')).toBeNull();
      if (present) await vi.advanceTimersByTimeAsync(1000);
      expect(popover(present ? 'idle-help' : 'idle-fallback')).not.toBeNull();
      expect(successful()).not.toContain(present ? 'idle-fallback' : 'idle-delay');
    },
  );
  it.each(['rage-click', 'scroll-thrashing'] as const)(
    'starts recovery from %s and suppresses later prompts from either trigger',
    async (event) => {
      vi.stubGlobal('scrollY', 0);
      vi.stubGlobal('innerHeight', 500);
      vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(2000);
      runtime(frustrationRecoveryPreset).start();
      const rage = () => {
        for (let i = 0; i < 3; i++)
          document.body.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              detail: 1,
              clientX: 100,
              clientY: 100,
            }),
          );
      };
      const thrash = () => {
        for (const y of [100, 0, 100, 0, 100]) {
          vi.stubGlobal('scrollY', y);
          document.dispatchEvent(new Event('scroll'));
        }
      };
      expect(popover('recovery-help')).toBeNull();
      if (event === 'rage-click') rage();
      else thrash();
      await vi.advanceTimersByTimeAsync(0);
      expect(popover('recovery-help')).not.toBeNull();
      expect(request).toHaveBeenCalledExactlyOnceWith(
        'https://events.example.invalid/dxp-events',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"event":"assistance_shown"}',
        }),
      );
      expect(document.cookie).toContain('dxp_assistance_shown=shown');
      element<HTMLButtonElement>('[data-visual-dxp-popover="recovery-help"] button').click();
      rage();
      thrash();
      await vi.advanceTimersByTimeAsync(0);
      expect(popover('recovery-help')).toBeNull();
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it.each([frustrationRecoveryPreset, segmentedOnboardingPreset])(
    '$name continues after failed HTTP and records that guidance was displayed',
    async (preset) => {
      request.mockResolvedValue(new Response('Unavailable', { status: 503 }));
      const completed = expect(runtime(preset).run()).resolves.toBeUndefined();
      await vi.advanceTimersByTimeAsync(2000);
      await completed;
      expect(document.cookie).toContain(
        preset === frustrationRecoveryPreset
          ? 'dxp_assistance_shown=shown'
          : 'dxp_onboarding_delivered=yes',
      );
      expect(successful()).toContain(
        preset === frustrationRecoveryPreset ? 'recovery-cookie' : 'onboarding-cookie',
      );
    },
  );
  it('runs the complete loop body three times and done once, without a cyclic connection', async () => {
    runtime(boundedCtaAttentionPreset).start();
    element<HTMLButtonElement>('#shop-now').click();
    await vi.advanceTimersByTimeAsync(0);
    const target = element('#collection > div:nth-of-type(2)');
    expect(target.classList.contains('dxp-cta-attention')).toBe(true);
    expect(popover('attention-done')).toBeNull();
    await vi.advanceTimersByTimeAsync(600);
    expect(target.classList.contains('dxp-cta-attention')).toBe(false);
    await vi.advanceTimersByTimeAsync(600);
    expect(target.classList.contains('dxp-cta-attention')).toBe(true);
    await vi.advanceTimersByTimeAsync(600);
    expect(target.classList.contains('dxp-cta-attention')).toBe(false);
    await vi.advanceTimersByTimeAsync(600);
    expect(target.classList.contains('dxp-cta-attention')).toBe(true);
    expect(popover('attention-done')).toBeNull();
    await vi.advanceTimersByTimeAsync(600);
    expect(target.classList.contains('dxp-cta-attention')).toBe(false);
    await vi.advanceTimersByTimeAsync(599);
    expect(popover('attention-done')).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(successful()).toEqual([
      'attention-click',
      'attention-loop',
      'attention-add',
      'attention-on',
      'attention-remove',
      'attention-off',
      'attention-add',
      'attention-on',
      'attention-remove',
      'attention-off',
      'attention-add',
      'attention-on',
      'attention-remove',
      'attention-off',
      'attention-done',
    ]);
    expect(popover('attention-done')).not.toBeNull();
    expect(demoHtml).toContain('.dxp-cta-attention');
    expect(request).not.toHaveBeenCalled();
  });
  it.each([true, false])(
    'delivers only the chosen onboarding path and skips it on return (campaign=%s)',
    async (campaign) => {
      history.replaceState(
        null,
        '',
        `/demo-site.html${campaign ? '?utm_campaign=onboarding' : ''}`,
      );
      const first = runtime(segmentedOnboardingPreset);
      const running = first.run();
      await vi.advanceTimersByTimeAsync(2000);
      await running;
      expect(successful()).toContain(
        campaign ? 'onboarding-campaign-help' : 'onboarding-default-help',
      );
      expect(successful()).not.toContain(
        campaign ? 'onboarding-default-copy' : 'onboarding-campaign-copy',
      );
      expect(request).toHaveBeenCalledTimes(1);
      expect(request.mock.calls[0][1]?.body).toBe('{"event":"onboarding_guidance_displayed"}');
      expect(document.cookie).toContain('dxp_onboarding_delivered=yes');
      first.destroy();
      logs = [];
      await runtime(segmentedOnboardingPreset).run();
      expect(successful()).toEqual(['onboarding-load', 'onboarding-seen', 'onboarding-return']);
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it('also honors matching storage markers, as required by the current cookie condition', async () => {
    localStorage.setItem('dxp_exit_offer', 'shown');
    await runtime(exitIntentOfferPreset).run();
    expect(popover('exit-popover')).toBeNull();
    expect(document.cookie).toBe('');
  });
});

describe('satisfaction survey preset', () => {
  function survey() {
    return required(popover('survey-popover')?.querySelector('form'));
  }
  async function answer(value: 'positive' | 'negative', comment = '') {
    runtime(satisfactionSurveyPreset).start();
    await vi.advanceTimersByTimeAsync(2999);
    expect(popover('survey-popover')).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    const form = survey();
    required(
      form.querySelector<HTMLInputElement>(`input[name="satisfaction"][value="${value}"]`),
    ).checked = true;
    required(form.querySelector('textarea')).value = comment;
    required(form.querySelector('button')).click();
    await vi.advanceTimersByTimeAsync(0);
  }

  it('sends positive feedback to the API and thanks the visitor', async () => {
    await answer('positive', 'Lovely shop');
    expect(popover('survey-popover')).toBeNull();
    expect(popover('survey-thanks')?.textContent).toContain('Thank you! We got your feedback');
    expect(popover('survey-support')).toBeNull();
    expect(request).toHaveBeenCalledExactlyOnceWith(
      'https://feedback.example.invalid/satisfaction',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"satisfaction": "positive", "comment": "Lovely shop"}',
      }),
    );
    // The reply path is connected first, so it does not wait for the request.
    expect(successful()).toEqual([
      'survey-trigger',
      'survey-seen-check',
      'survey-delay',
      'survey-seen-cookie',
      'survey-popover',
      'survey-select',
      'survey-check',
      'survey-thanks',
      'survey-send',
    ]);
  });

  it('sends negative feedback to the API and points the visitor to support', async () => {
    await answer('negative');
    const support = required(popover('survey-support'));
    expect(support.textContent).toContain('Let us know what went wrong at support@example.test');
    expect(support.querySelector('a[href="mailto:support@example.test"]')).not.toBeNull();
    expect(popover('survey-thanks')).toBeNull();
    expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual({
      satisfaction: 'negative',
      comment: '',
    });
    expect(successful()).toContain('survey-support');
  });

  it('still replies to the visitor when the feedback API fails', async () => {
    request.mockRejectedValue(new TypeError('Failed to fetch'));
    await answer('positive');
    expect(popover('survey-thanks')).not.toBeNull();
    expect(
      logs.find((log) => log.nodeId === 'survey-send' && log.status === 'error')?.message,
    ).toBe('Failed to fetch');
  });

  it('remembers the survey as seen for 365 days as soon as it appears, before any answer', async () => {
    const written: string[] = [];
    const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    vi.spyOn(document, 'cookie', 'set').mockImplementation((value) => {
      written.push(value);
      cookie?.set?.call(document, value);
    });
    runtime(satisfactionSurveyPreset).start();
    await vi.advanceTimersByTimeAsync(2999);
    expect(document.cookie).not.toContain('dxp_survey_seen');
    await vi.advanceTimersByTimeAsync(1);
    expect(popover('survey-popover')).not.toBeNull();
    expect(document.cookie).toContain('dxp_survey_seen=seen');
    expect(written).toEqual(['dxp_survey_seen=seen; Path=/; SameSite=Lax; Max-Age=31536000']);
  });

  it.each([
    ['after answering', true],
    ['after ignoring it', false],
  ])('does not show the survey again to a returning visitor %s', async (_case, answered) => {
    if (answered) await answer('positive');
    else {
      runtime(satisfactionSurveyPreset).start();
      await vi.advanceTimersByTimeAsync(3000);
      expect(popover('survey-popover')).not.toBeNull();
    }
    // A later page load: a new runtime on a fresh page with the same cookie jar.
    for (const instance of runtimes.splice(0)) instance.destroy();
    logs = [];
    request.mockClear();
    runtime(satisfactionSurveyPreset).start();
    await vi.advanceTimersByTimeAsync(5000);
    expect(popover('survey-popover')).toBeNull();
    expect(successful()).toEqual(['survey-trigger', 'survey-seen-check']);
    expect(request).not.toHaveBeenCalled();
  });

  it('does not show the survey when the seen cookie cannot be saved', async () => {
    // Restore here: the shared cleanup writes cookies before restoring mocks.
    const blocked = vi.spyOn(document, 'cookie', 'set').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    try {
      runtime(satisfactionSurveyPreset).start();
      await vi.advanceTimersByTimeAsync(3000);
      expect(popover('survey-popover')).toBeNull();
      expect(logs.find((log) => log.nodeId === 'survey-seen-cookie')).toMatchObject({
        status: 'running',
      });
      expect(logs.at(-1)).toMatchObject({ nodeId: 'survey-seen-cookie', status: 'error' });
      expect(request).not.toHaveBeenCalled();
    } finally {
      blocked.mockRestore();
    }
  });

  it('requires an answer and sends nothing when the survey is closed', async () => {
    runtime(satisfactionSurveyPreset).start();
    await vi.advanceTimersByTimeAsync(3000);
    required(survey().querySelector('button')).click();
    await vi.advanceTimersByTimeAsync(0);
    // Native validation keeps the survey open until an answer is chosen.
    expect(popover('survey-popover')).not.toBeNull();
    required(
      popover('survey-popover')?.querySelector<HTMLButtonElement>('button[aria-label]'),
    ).click();
    await vi.advanceTimersByTimeAsync(0);
    expect(popover('survey-popover')).toBeNull();
    expect(popover('survey-thanks')).toBeNull();
    expect(popover('survey-support')).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });
});
