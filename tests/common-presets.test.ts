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
  boundedCtaAttentionPreset,
  campaignUrlPersonalizationPreset,
  clickToOpenHelpPreset,
  commonDXPPresets,
  delayedWelcomePreset,
  engagedReaderInvitationPreset,
  exitIntentOfferPreset,
  frustrationRecoveryPreset,
  inactivityAssistancePreset,
  mobileSpecificMessagingPreset,
  returningVisitorExperiencePreset,
  segmentedOnboardingPreset,
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
  it('has at least twelve unique, deliberately ordered presets covering the complete catalog', () => {
    expect(commonDXPPresets.length).toBeGreaterThanOrEqual(12);
    expect(new Set(commonDXPPresets.map((p) => p.id)).size).toBe(commonDXPPresets.length);
    const order = commonDXPPresets.map((p) => p.order);
    expect(new Set(order).size).toBe(order.length);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    const levels = { beginner: 0, intermediate: 1, advanced: 2 };
    const complexity = commonDXPPresets.map((p) => levels[p.complexity]);
    expect(complexity).toEqual([...complexity].sort());
    expect(
      new Set(commonDXPPresets.flatMap((p) => p.workflow.nodes.map((n) => n.data.kind))),
    ).toEqual(new Set(catalog.map((entry) => entry.kind)));
  });

  it.each(commonDXPPresets)(
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
        noteText: `${preset.name}\n\n${preset.description}`,
        noteColor: '#def0d8',
        noteMarks: [{ start: 0, end: preset.name.length, bold: true }],
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
  it('opens anchored help from a real delegated click', async () => {
    runtime(clickToOpenHelpPreset).start();
    element('#collection .section-heading a').dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(popover('help-popover')).not.toBeNull();
  });
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
  it.each(['everyday-edit', 'EVERYDAY-EDIT', ''])(
    'matches campaign URL values exactly (%s)',
    async (campaign) => {
      history.replaceState(null, '', `/demo-site.html?utm_campaign=${campaign}`);
      await runtime(campaignUrlPersonalizationPreset).run();
      expect(successful()).toContain(
        campaign === 'everyday-edit' ? 'campaign-matched' : 'campaign-default',
      );
      expect(successful()).not.toContain(
        campaign === 'everyday-edit' ? 'campaign-default' : 'campaign-matched',
      );
    },
  );
  it('welcomes a new visitor and takes the returning branch on the next load', async () => {
    const first = runtime(returningVisitorExperiencePreset);
    await first.run();
    expect(popover('visitor-welcome')).not.toBeNull();
    expect(document.cookie).toContain('dxp_visitor_welcome=shown');
    first.destroy();
    logs = [];
    await runtime(returningVisitorExperiencePreset).run();
    expect(popover('visitor-welcome')).toBeNull();
    expect(successful()).toContain('visitor-returning');
  });
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
  it('detects rage clicks and suppresses later prompts after the generic request succeeds', async () => {
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
    rage();
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
    await vi.advanceTimersByTimeAsync(0);
    expect(popover('recovery-help')).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each([frustrationRecoveryPreset, segmentedOnboardingPreset])(
    '$name stops on failed HTTP without claiming completion',
    async (preset) => {
      request.mockResolvedValue(new Response('Unavailable', { status: 503 }));
      const failed = expect(runtime(preset).run()).rejects.toThrow('HTTP 503');
      await vi.advanceTimersByTimeAsync(2000);
      await failed;
      expect(document.cookie).toBe('');
      expect(successful()).not.toContain(
        preset === frustrationRecoveryPreset ? 'recovery-cookie' : 'onboarding-cookie',
      );
    },
  );
  it('runs the complete loop body twice and done once, without a cyclic connection', async () => {
    runtime(boundedCtaAttentionPreset).start();
    element<HTMLButtonElement>('#shop-now').click();
    await vi.advanceTimersByTimeAsync(0);
    const target = element('#collection h2');
    expect(target.classList.contains('dxp-cta-attention')).toBe(true);
    expect(popover('attention-done')).toBeNull();
    await vi.advanceTimersByTimeAsync(600);
    expect(target.classList.contains('dxp-cta-attention')).toBe(false);
    await vi.advanceTimersByTimeAsync(600);
    expect(target.classList.contains('dxp-cta-attention')).toBe(true);
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
        `/demo-site.html${campaign ? '?utm_campaign=everyday-edit' : ''}`,
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
