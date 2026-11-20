// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeInspector } from '../src/components/NodeInspector/NodeInspector';
import { PopoverPreview } from '../src/components/PopoverPreview/PopoverPreview';
import { TourPreview } from '../src/components/TourPreview/TourPreview';
import { VisualDXPBuilder } from '../src/components/VisualDXPBuilder/VisualDXPBuilder';
import { createNode } from '../src/lib/catalog';
import type { StepConfig, TourStep, Workflow, WorkflowNode } from '../src/lib/types';
import { connectPreview, mockDemoFetch } from './helpers/preview';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  mockDemoFetch();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const step = (title: string, settings: TourStep = {}): TourStep => ({
  contentType: 'html',
  content: `<h2>${title}</h2>`,
  position: 'center',
  width: 360,
  ...settings,
});
function tour(config: StepConfig = {}): WorkflowNode {
  return {
    id: 'onboarding',
    type: 'workflow',
    position: { x: 0, y: 0 },
    data: {
      kind: 'tour',
      label: 'Onboarding',
      config: { tourSteps: [step('Welcome'), step('Search')], ...config },
    },
  };
}

async function renderTour(node = tour(), onSave = vi.fn(), onClose = vi.fn()) {
  await act(async () =>
    root.render(
      <TourPreview node={node} websiteUrl="/demo-site.html" onClose={onClose} onSave={onSave} />,
    ),
  );
  return { onSave, onClose };
}
async function loadWebsite(html = '<main><h1>Atelier</h1></main>') {
  const frame = host.querySelector<HTMLIFrameElement>('iframe[title="Tour preview website"]');
  if (!frame) throw new Error('Expected the tour preview website.');
  const doc = frame.contentDocument;
  if (!doc) throw new Error('Expected the preview website document.');
  if (!doc.documentElement) doc.appendChild(doc.createElement('html'));
  if (!doc.body) doc.documentElement.appendChild(doc.createElement('body'));
  doc.body.innerHTML = html;
  connectPreview(frame);
  await act(async () => frame.dispatchEvent(new Event('load')));
  return doc;
}
/** The step shown on the website: its heading and progress text. */
function shown(doc: Document) {
  const panel = doc.querySelector('[data-visual-dxp-popover="onboarding"]');
  return `${panel?.querySelector('h2, h3')?.textContent} ${panel?.querySelector('[data-visual-dxp-popover-controls] span')?.textContent}`;
}
function button(name: string) {
  const found = [...host.querySelectorAll('button')].find(
    (candidate) =>
      candidate.textContent?.trim() === name ||
      candidate.getAttribute('aria-label') === name ||
      // Step buttons are named by their number followed by their position.
      (candidate.classList.contains('dxp-tour-step-label') &&
        candidate.querySelector('strong')?.textContent === name),
  );
  if (!found) throw new Error(`Missing button ${name}`);
  return found;
}
async function click(name: string) {
  await act(async () => button(name).click());
}
function field(suffix: string) {
  const found = host.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    `[id$="-${suffix}"]`,
  );
  if (!found) throw new Error(`Missing field ${suffix}`);
  return found;
}
async function edit(suffix: string, value: string) {
  const element = field(suffix);
  await act(async () => {
    const prototype =
      element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : element instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(
      new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }),
    );
  });
}
const stepNames = () =>
  [...host.querySelectorAll('.dxp-tour-step-label strong')].map((entry) => entry.textContent);
const selectedStep = () =>
  host.querySelector('.dxp-tour-step-label[aria-pressed="true"] strong')?.textContent;

describe('Tour inspector', () => {
  it('summarizes the tour and opens the tour editor', async () => {
    const onPreviewContent = vi.fn();
    await act(async () =>
      root.render(
        <NodeInspector
          node={tour({ tourNextLabel: 'Continue' })}
          onChange={vi.fn()}
          onClose={vi.fn()}
          onPickElement={vi.fn()}
          onDelete={vi.fn()}
          onDuplicate={vi.fn()}
          onPreviewContent={onPreviewContent}
        />,
      ),
    );
    expect(host.textContent).toContain('2 steps · Previous · Continue · Done');
    expect(host.querySelector('.dxp-inspector-outputs')?.textContent).toContain(
      'Runs after the visitor finishes or closes the tour',
    );
    await click('Edit tour');
    expect(onPreviewContent).toHaveBeenCalledOnce();
  });
});

describe('Tour editor', () => {
  it('previews the selected step on the website and saves edits only on Save', async () => {
    const node = tour();
    const original = structuredClone(node);
    const { onSave } = await renderTour(node);
    expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Edit tour');
    const doc = await loadWebsite();

    expect(stepNames()).toEqual(['Step 1', 'Step 2']);
    expect(selectedStep()).toBe('Step 1');
    expect(shown(doc)).toBe('Welcome 1 / 2');

    await click('Step 2');
    expect(selectedStep()).toBe('Step 2');
    // The shared popover fields now edit the second step.
    expect(field('content').value).toBe('<h2>Search</h2>');
    expect(shown(doc)).toBe('Search 2 / 2');
    await edit('content', '<h2>Find anything</h2>');
    expect(shown(doc)).toBe('Find anything 2 / 2');
    await edit('tourDoneLabel', 'Got it');
    expect(doc.querySelector('[data-visual-dxp-action="done"]')?.textContent).toBe('Got it');

    expect(onSave).not.toHaveBeenCalled();
    await click('Save changes');
    expect(onSave).toHaveBeenCalledExactlyOnceWith({
      tourSteps: [step('Welcome'), step('Find anything')],
      tourDoneLabel: 'Got it',
    });
    expect(node).toEqual(original);
  });

  it('adds, reorders and deletes steps, keeping the selection on the moved step', async () => {
    const { onSave } = await renderTour();
    const doc = await loadWebsite();

    await click('Add step');
    expect(stepNames()).toEqual(['Step 1', 'Step 2', 'Step 3']);
    // New steps follow the selected step.
    expect(selectedStep()).toBe('Step 2');
    expect(field('content').value).toContain('New step');
    expect(shown(doc)).toBe('New step 2 / 3');

    await click('Move step 2 up');
    expect(selectedStep()).toBe('Step 1');
    expect(field('content').value).toContain('New step');
    expect(button('Move step 1 up').disabled).toBe(true);
    expect(button('Move step 3 down').disabled).toBe(true);

    await click('Step 3');
    await click('Delete step 1');
    expect(stepNames()).toEqual(['Step 1', 'Step 2']);
    expect(selectedStep()).toBe('Step 2');
    expect(field('content').value).toBe('<h2>Search</h2>');

    await click('Delete step 2');
    expect(stepNames()).toEqual(['Step 1']);
    expect(button('Delete step 1').disabled).toBe(true);
    expect(shown(doc)).toBe('Welcome 1 / 1');

    await click('Undo');
    expect(stepNames()).toEqual(['Step 1', 'Step 2']);
    await click('Save changes');
    expect(onSave).toHaveBeenCalledExactlyOnceWith({
      tourSteps: [step('Welcome'), step('Search')],
    });
  });

  it('blocks saving an invalid step and picks its anchor on the website', async () => {
    const { onSave } = await renderTour();
    const doc = await loadWebsite('<button id="search">Search</button>');
    await click('Step 2');
    await edit('position', 'anchor');
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(
      'Step 2: Choose an anchor element for the popover.',
    );
    expect(button('Save changes').disabled).toBe(true);

    await click('Select on website');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => doc.querySelector('#search')?.dispatchEvent(event));
    expect(field('selector').value).toBe('#search');
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(shown(doc)).toBe('Search 2 / 2');
    // The anchor arrow is part of the shared popover structure.
    expect(doc.querySelector('[data-visual-dxp-popover] svg')).not.toBeNull();

    await click('Save changes');
    expect(onSave).toHaveBeenCalledExactlyOnceWith({
      tourSteps: [step('Welcome'), step('Search', { position: 'anchor', selector: '#search' })],
    });
  });

  it('stops picking when another step is selected', async () => {
    await renderTour(
      tour({ tourSteps: [step('A', { position: 'anchor', selector: '#a' }), step('B')] }),
    );
    await loadWebsite('<button id="a">A</button>');
    await click('Select on website');
    expect(button('Select on website').getAttribute('aria-pressed')).toBe('true');
    await click('Step 2');
    expect(host.querySelector('[id$="-selector"]')).toBeNull();
    await click('Step 1');
    expect(button('Select on website').getAttribute('aria-pressed')).toBe('false');
  });

  it('explains that forms in tour steps advance the tour instead of passing data', async () => {
    const form = '<form><input name="email"><button>Join</button></form>';
    await renderTour(tour({ tourSteps: [step('A', { content: form })] }));
    expect(host.textContent).toContain('Tour steps do not collect form data.');
    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () =>
      root.render(
        <PopoverPreview
          node={{
            ...tour(),
            data: { kind: 'popover', label: 'Form', config: step('A', { content: form }) },
          }}
          websiteUrl="/demo-site.html"
          onClose={vi.fn()}
          onSave={vi.fn()}
        />,
      ),
    );
    expect(host.textContent).not.toContain('Tour steps do not collect form data.');
  });
});

it('edits a tour from the canvas as one undoable workflow change', async () => {
  const node = createNode('tour', { x: 0, y: 0 });
  const workflow: Workflow = {
    version: 1,
    name: 'Tours',
    websiteUrl: '/demo-site.html',
    nodes: [node],
    edges: [],
  };
  let latest = workflow;
  await act(async () =>
    root.render(
      <VisualDXPBuilder
        initialWorkflow={workflow}
        onChange={(value) => {
          latest = value;
        }}
      />,
    ),
  );
  expect(host.querySelector(`[data-id="${node.id}"]`)?.textContent).toContain('2 steps');
  await act(async () => host.querySelector<HTMLElement>(`[data-id="${node.id}"]`)?.click());
  await click('Edit tour');
  await click('Add step');
  await click('Save changes');
  expect(host.querySelector('.dxp-popover-preview')).toBeNull();
  expect(latest.nodes[0].data.config.tourSteps).toHaveLength(3);
  expect(host.querySelector(`[data-id="${node.id}"]`)?.textContent).toContain('3 steps');
  await click('Undo');
  expect(latest.nodes[0].data.config).toEqual(node.data.config);
});
