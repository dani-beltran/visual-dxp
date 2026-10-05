// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRuntime, getRuntimeSource } from '../src/lib/runtime/runtime';
import type { StepConfig, Workflow } from '../src/lib/types';

let instance: ReturnType<typeof createRuntime> | undefined;

afterEach(() => {
  instance?.destroy();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe.each(['live', 'exported'] as const)('%s popover arrows', (mode) => {
  async function show(
    position: StepConfig['position'] = 'anchor',
    config: StepConfig = {},
    anchorTop = 140,
  ) {
    document.body.innerHTML = '<button id="target">Target</button>';
    const target = { left: 180, top: anchorTop, width: 100, height: 40 };
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
            config: { position, selector: '#target', content: '<h2>Hello</h2>', ...config },
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

  it.each([
    ['top-left', -28, -28, 140],
    ['top-right', 28, -28, 140],
    ['bottom-left', -28, 28, 140],
    ['bottom-right', 28, 28, 140],
    ['center', 0, 28, 140],
    ['anchor', 0, -28, 140],
    ['anchor', 0, 28, 650],
  ] as const)('slides from the resolved %s position at y=%s', async (position, x, y, top) => {
    const cancel = vi.fn();
    const animate = vi.fn(() => ({ cancel }));
    Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate });
    try {
      const { panel } = await show(position, { popoverAnimation: 'slide' }, top);
      expect(animate.mock.calls[0]).toEqual([
        [
          { opacity: 0, translate: `${x}px ${y}px` },
          { opacity: 1, translate: '0px 0px' },
        ],
        { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      ]);
      if (position === 'center') expect(panel.style.transform).toBe('translate(-50%, -50%)');
      panel.querySelector('button')?.click();
      expect(cancel).toHaveBeenCalledOnce();
    } finally {
      Reflect.deleteProperty(Element.prototype, 'animate');
    }
  });

  it.each(['none', 'fade', 'zoom', 'bounce'] as const)(
    'supports %s and reduced motion',
    async (effect) => {
      const animate = vi.fn(() => ({ cancel: vi.fn() }));
      Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate });
      try {
        await show('center', { popoverAnimation: effect });
        expect(animate).toHaveBeenCalledTimes(effect === 'none' ? 0 : 1);
        instance?.destroy();
        animate.mockClear();
        vi.stubGlobal(
          'matchMedia',
          vi.fn(() => ({ matches: true })),
        );
        const { panel } = await show('center', { popoverAnimation: effect });
        panel.querySelector('button')?.click();
        expect(panel.isConnected).toBe(false);
        expect(animate).not.toHaveBeenCalled();
      } finally {
        Reflect.deleteProperty(Element.prototype, 'animate');
        vi.unstubAllGlobals();
      }
    },
  );

  it.each(['fade', 'slide', 'zoom', 'bounce'] as const)(
    'reverses %s on close and removes the panel only after completion',
    async (effect) => {
      const entrance = { cancel: vi.fn(), playState: 'finished' };
      const exit = {
        cancel: vi.fn(),
        onfinish: null as (() => void) | null,
        oncancel: null as (() => void) | null,
      };
      const animate = vi
        .fn((_frames: Keyframe[], _options: KeyframeAnimationOptions) => exit)
        .mockReturnValueOnce(entrance as unknown as typeof exit);
      Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate });
      try {
        const { panel } = await show('top-left', { popoverAnimation: effect });
        panel.querySelector('button')?.click();
        expect(panel.isConnected).toBe(true);
        expect(animate.mock.calls[1]?.[0]).toEqual(animate.mock.calls[0]?.[0]);
        expect(animate.mock.calls[1]?.[1]).toMatchObject({
          direction: 'reverse',
          fill: 'forwards',
        });
        panel.querySelector('button')?.click();
        expect(animate).toHaveBeenCalledTimes(2);
        exit.onfinish?.();
        expect(panel.isConnected).toBe(false);
        expect(exit.cancel).toHaveBeenCalledOnce();
      } finally {
        Reflect.deleteProperty(Element.prototype, 'animate');
      }
    },
  );

  it('reverses an unfinished entrance in place and cancels it on runtime teardown', async () => {
    const animation = { cancel: vi.fn(), reverse: vi.fn(), playState: 'running', onfinish: null };
    const animate = vi.fn(() => animation);
    Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate });
    try {
      const { panel } = await show('center', { popoverAnimation: 'slide' });
      panel.querySelector('button')?.click();
      expect(animation.reverse).toHaveBeenCalledOnce();
      expect(animate).toHaveBeenCalledOnce();
      expect(panel.isConnected).toBe(true);
      instance?.destroy();
      expect(panel.isConnected).toBe(false);
      expect(animation.cancel).toHaveBeenCalledOnce();
      expect(animation.onfinish).toBeNull();
    } finally {
      Reflect.deleteProperty(Element.prototype, 'animate');
    }
  });

  it('uses the flipped anchor placement for the closing animation', async () => {
    const animate = vi.fn((_frames: Keyframe[], _options: KeyframeAnimationOptions) => ({
      cancel: vi.fn(),
    }));
    Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate });
    try {
      const { panel, target } = await show('anchor', { popoverAnimation: 'slide' });
      target.top = 650;
      window.dispatchEvent(new Event('scroll'));
      panel.querySelector('button')?.click();
      expect(animate.mock.calls[1]?.[0][0]).toMatchObject({ translate: '0px 28px' });
    } finally {
      Reflect.deleteProperty(Element.prototype, 'animate');
    }
  });

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

  it('keeps the panel visible when its anchor scrolls outside either viewport edge', async () => {
    const { target, panel, arrow } = await show();
    target.top = 2000;
    window.dispatchEvent(new Event('scroll'));
    expect(panel.style.top).toBe('552px');
    expect(arrow.style.bottom).toBe('-9px');
    expect(arrow.style.transform).toBe('rotate(180deg)');

    target.top = -500;
    window.dispatchEvent(new Event('scroll'));
    expect(panel.style.top).toBe('16px');
    expect(arrow.style.top).toBe('-9px');
    expect(arrow.style.transform).toBe('');
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
