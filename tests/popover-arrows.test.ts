// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRuntime, getRuntimeSource } from '../src/lib/runtime/runtime';
import type { Workflow } from '../src/lib/types';

let instance: ReturnType<typeof createRuntime> | undefined;

afterEach(() => {
  instance?.destroy();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe.each(['live', 'exported'] as const)('%s popover arrows', (mode) => {
  async function show(position: 'anchor' | 'center' = 'anchor') {
    document.body.innerHTML = '<button id="target">Target</button>';
    const target = { left: 180, top: 140, width: 100, height: 40 };
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1024);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(768);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const rect = this.id === 'target' ? target : { left: 0, top: 0, width: 360, height: 200 };
      return {
        ...rect,
        x: rect.left,
        y: rect.top,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height,
        toJSON: () => ({}),
      };
    });
    const workflow: Workflow = {
      version: 1,
      name: 'Arrow test',
      websiteUrl: window.location.href,
      nodes: [
        {
          id: 'start',
          type: 'workflow',
          position: { x: 0, y: 0 },
          data: { kind: 'trigger', label: 'Start', config: {} },
        },
        {
          id: 'popover',
          type: 'workflow',
          position: { x: 0, y: 0 },
          data: {
            kind: 'popover',
            label: 'Anchored content',
            config: { position, selector: '#target', content: '<h2>Hello</h2>' },
          },
        },
      ],
      edges: [{ id: 'edge', source: 'start', target: 'popover' }],
    };
    let factory = createRuntime;
    if (mode === 'exported') {
      // biome-ignore lint/security/noGlobalEval: Verify the locally generated standalone runtime.
      factory = window.eval(getRuntimeSource());
    }
    instance = factory(workflow);
    await instance.run();
    const panel = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!panel) throw new Error('Expected a popover.');
    return {
      target,
      panel,
      get arrow() {
        const arrow = panel.querySelector<SVGSVGElement>('svg');
        if (!arrow) throw new Error('Expected a popover arrow.');
        return arrow;
      },
    };
  }

  it('points to the target center and stays outside the scrolling content', async () => {
    const { panel, arrow } = await show();
    expect(panel.style.top).toBe('192px');
    expect(Number.parseFloat(panel.style.left) + Number.parseFloat(arrow.style.left) + 10).toBe(
      230,
    );
    expect(arrow.style.top).toBe('-9px');
    expect(arrow.getAttribute('aria-hidden')).toBe('true');
    expect(arrow.parentElement).toBe(panel);
    expect((panel.firstElementChild as HTMLElement).style.overflow).toBe('auto');
    expect(panel.style.overflow).not.toBe('auto');
  });

  it('tracks the target when scrolling flips the popover above and back below', async () => {
    const { target, panel, arrow } = await show();
    target.top = 650;
    window.dispatchEvent(new Event('scroll'));
    expect(panel.style.top).toBe('438px');
    expect(arrow.style.top).toBe('auto');
    expect(arrow.style.bottom).toBe('-9px');
    expect(arrow.style.transform).toBe('rotate(180deg)');

    target.top = 80;
    window.dispatchEvent(new Event('scroll'));
    expect(panel.style.top).toBe('132px');
    expect(arrow.style.top).toBe('-9px');
    expect(arrow.style.bottom).toBe('auto');
    expect(arrow.style.transform).toBe('');
  });

  it('offsets the arrow toward the target when the viewport clamps the panel', async () => {
    const { target, panel, arrow } = await show();
    target.left = 900;
    window.dispatchEvent(new Event('resize'));
    expect(panel.style.left).toBe('648px');
    expect(Number.parseFloat(panel.style.left) + Number.parseFloat(arrow.style.left) + 10).toBe(
      950,
    );

    target.left = 1000;
    window.dispatchEvent(new Event('resize'));
    expect(Number.parseFloat(arrow.style.left) + 20).toBeLessThanOrEqual(360 - 16);
  });

  it('removes the arrow with the popover and detaches positioning listeners', async () => {
    const { target, panel, arrow } = await show();
    panel.querySelector('button')?.click();
    expect(arrow.isConnected).toBe(false);
    target.top = 650;
    window.dispatchEvent(new Event('scroll'));
    expect(panel.style.top).toBe('192px');
  });

  it('does not add an arrow to a popover without an anchor', async () => {
    const { panel } = await show('center');
    expect(panel.querySelector('svg')).toBeNull();
  });
});
