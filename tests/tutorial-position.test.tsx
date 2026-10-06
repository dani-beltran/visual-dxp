// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { placePopover } from '../src/lib/popoverPosition';
import { useTutorialPopover } from '../src/tutorial/useTutorialPopover';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function rect(x: number, y: number, width: number, height: number) {
  return {
    x,
    y,
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
    width,
    height,
    toJSON() {},
  };
}
it('places unanchored guidance bottom right and uses side space to avoid tall controls', () => {
  const panel = document.createElement('section');
  const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const anchor = document.createElement('aside');
  vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 360, 240));
  vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue(rect(800, 50, 200, 650));
  placePopover(panel, arrow);
  expect(panel.style.right).toBe('24px');
  expect(panel.style.bottom).toBe('24px');
  placePopover(panel, arrow, { anchor, avoidAnchor: true });
  expect(panel.style.left).toBe('428px');
  expect(panel.style.top).toBe('50px');
  expect(arrow.style.transform).toBe('rotate(90deg)');
});

it('tracks a visible target and falls back when it disappears without highlighting behind a modal', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.append(host);
  const target = document.createElement('button');
  target.dataset.tutorial = 'test';
  host.append(target);
  let bounds = rect(100, 100, 100, 30);
  vi.spyOn(target, 'getBoundingClientRect').mockImplementation(() => bounds);
  vi.spyOn(target, 'getClientRects').mockImplementation(() => [bounds] as unknown as DOMRectList);
  const mount = document.createElement('div');
  host.append(mount);
  const root = createRoot(mount);
  function Guide({ modal = false }) {
    const { panel, arrow } = useTutorialPopover(host, 'test');
    return (
      <div role={modal ? 'dialog' : undefined}>
        <section ref={panel}>
          <svg ref={arrow} />
        </section>
      </div>
    );
  }
  try {
    await act(async () => root.render(<Guide />));
    const panel = mount.querySelector('section') as HTMLElement;
    expect(panel.dataset.anchored).toBe('true');
    expect(panel.style.top).toBe('142px');
    bounds = rect(140, 200, 100, 30);
    window.dispatchEvent(new Event('scroll'));
    expect(panel.style.top).toBe('242px');
    expect(panel.style.left).toBe('140px');
    await act(async () => root.render(<Guide modal />));
    window.dispatchEvent(new Event('resize'));
    expect(panel.dataset.anchored).toBe('false');
    expect(target.classList.contains('dxp-tutorial-target')).toBe(false);
    expect(panel.style.bottom).toBe('24px');
    expect(panel.style.right).toBe('24px');
  } finally {
    await act(async () => root.unmount());
  }
});
