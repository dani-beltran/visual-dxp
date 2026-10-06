// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../src/app';
import { VisualDXPBuilder } from '../src/components/VisualDXPBuilder';
import { catalog, createNode, defaultWorkflow } from '../src/lib/catalog';
import { validateWorkflow } from '../src/lib/export';
import type { Workflow } from '../src/lib/types';
import { commonDXPPresets } from '../src/presets';
import { newTutorial, tutorialFingerprint } from '../src/tutorial/model';
import { connectPreview, mockDemoFetch } from './helpers/preview';

let host: HTMLDivElement, root: Root, latest: Workflow;
const key = 'tutorial-ui-workflow';
const progressKey = `${key}:tutorial:v1`;
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
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  for (const k of [key, progressKey, 'visual-dxp-language', 'visual-dxp-theme'])
    localStorage.removeItem(k);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function render(initial?: Workflow) {
  await act(async () =>
    root.render(
      <App
        initialWorkflow={initial}
        tutorial={{ websiteUrl: '/demo-site.html' }}
        persistenceKey={key}
        presets={commonDXPPresets}
        ai={{ endpoint: '/api/ai/chat' }}
        onChange={(w) => {
          latest = w;
        }}
      />,
    ),
  );
}
function el<T extends HTMLElement>(selector: string) {
  const result = host.querySelector<T>(selector);
  if (!result) throw new Error(`Missing ${selector}`);
  return result;
}
function button(name: string) {
  const found = [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent?.trim() === name || b.getAttribute('aria-label') === name,
  );
  if (!found) throw new Error(`Missing button ${name}`);
  return found;
}
async function click(name: string) {
  await act(async () => button(name).click());
}
async function input(selector: string, value: string) {
  await act(async () => {
    const field = el<HTMLInputElement>(selector);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function choose(selector: string, value: string) {
  await act(async () => {
    const field = el<HTMLSelectElement>(selector);
    field.value = value;
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
async function selectNode(id: string) {
  await act(async () =>
    el(`[data-id="${id}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true })),
  );
}
async function launch() {
  await click('Canvas help');
  expect(el('.dxp-canvas-help-tutorial').previousElementSibling?.textContent).toContain(
    'Use variables',
  );
  expect(
    button('Start interactive tutorial').compareDocumentPosition(el('.dxp-canvas-help-shortcuts')) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  await click('Start interactive tutorial');
}
function step() {
  return el('.dxp-tutorial-heading h2').textContent;
}

it('keeps the empty state unchanged, and the reusable builder tutorial is opt-in', async () => {
  await act(async () =>
    root.render(
      <VisualDXPBuilder
        onChange={(w) => {
          latest = w;
        }}
      />,
    ),
  );
  expect(latest.nodes).toEqual([]);
  expect(latest.edges).toEqual([]);
  expect(latest.websiteUrl).toBe('');
  expect(el('.dxp-empty-canvas').textContent).toBe(
    'Every experience starts somewhere.Add a trigger from the library to begin your journey.Add your first trigger',
  );
  await click('Canvas help');
  expect(host.textContent).not.toContain('Start interactive tutorial');
});

it('builds and tests through the real editor, then visits every feature without modifying the workflow', async () => {
  await render();
  expect(step()).toBe('Build your first digital experience.');
  expect(button('Continue').disabled).toBe(false);
  await launch();
  expect(step()).toBe('Build your first digital experience.');
  await click('Continue');
  expect(step()).toBe('Name your workflow');
  expect(button('Continue').disabled).toBe(true);
  await input('[aria-label="Workflow name"]', 'Autumn announcement');
  await click('Continue');
  await click('Change target website');
  expect(el('[role="dialog"] .dxp-tutorial')).toBeTruthy();
  await click('Save website');
  await click('Continue');
  await click('Add Trigger');
  const trigger = latest.nodes[0];
  await click('Continue');
  expect(step()).toBe('Confirm page load');
  await click('Confirm page load');
  await click('Add Delay');
  const delay = latest.nodes[1];
  await input('input[type="number"]', '1000');
  await click('Continue');
  await click('Add Popover');
  const popover = latest.nodes[2];
  expect(popover.data.config.content).toBe(
    catalog.find((n) => n.kind === 'popover')!.config.content,
  );
  await click('Open fullscreen content preview');
  expect(el('.dxp-popover-preview .dxp-tutorial')).toBeTruthy();
  expect(step()).toBe('Add a popover');
  await click('Return to editor');
  expect(host.querySelector('.dxp-popover-preview')).toBeNull();

  await click('Continue');
  expect(button('Continue').disabled).toBe(true);
  await selectNode(trigger.id);
  await choose('.dxp-node-connections select', delay.id);
  await click('Connect nodes');
  await selectNode(delay.id);
  await choose('.dxp-node-connections select', popover.id);
  await click('Connect nodes');
  expect(validateWorkflow(latest)).toEqual([]);
  await click('Continue');
  await click('Test workflow');
  expect(step()).toBe('Test your workflow');
  const frame = el<HTMLIFrameElement>('iframe[title="Workflow preview website"]');
  connectPreview(frame);
  await act(async () => frame.dispatchEvent(new Event('load')));
  vi.useFakeTimers();
  await click('Run workflow');
  expect(step()).toBe('Test your workflow');
  await act(async () => vi.advanceTimersByTimeAsync(999));
  expect(step()).toBe('Test your workflow');
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(step()).toBe('Your popover worked');
  expect(frame.contentDocument!.body.textContent).toContain('Good things start here.');
  await click('Return to editor');
  await click('Continue');
  vi.useRealTimers();
  const completed = tutorialFingerprint(latest);
  expect(step()).toBe('Discover AI chat');
  await click('AI chat');
  expect(button('Continue').disabled).toBe(false);
  await click('Continue');
  expect(step()).toBe('Discover Canvas Help');
  await click('Canvas help');
  await click('Continue');
  expect(step()).toBe('Discover workflow export');
  await click('Export workflow');
  expect(el('.dxp-export-modal .dxp-tutorial')).toBeTruthy();
  await click('Workflow JSON');
  expect(JSON.parse(el('.dxp-code code').textContent!)).toMatchObject({
    websiteUrl: '/demo-site.html',
  });
  await click('Close export');
  await click('Continue');
  expect(step()).toBe('Discover Presets');
  await click('Presets');
  expect(host.textContent).toContain('Welcome journey');
  await click('Continue');
  await click('Keep editing');
  expect(host.querySelector('.dxp-tutorial')).toBeNull();
  expect(tutorialFingerprint(latest)).toBe(completed);
  expect(JSON.parse(localStorage.getItem(progressKey)!).status).toBe('completed');
  expect(JSON.stringify(latest)).not.toContain('tutorial');
  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/api/ai/chat'))).toBe(
    false,
  );
});

it('automatically starts and resumes progress, then keeps an explicitly closed tutorial closed', async () => {
  vi.useFakeTimers();
  await render();
  expect(step()).toBe('Build your first digital experience.');
  await launch();
  await click('Continue');
  expect(step()).toBe('Name your workflow');
  await input('[aria-label="Workflow name"]', 'My first workflow.');
  await click('Continue');
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  vi.useRealTimers();
  const before = tutorialFingerprint(latest);
  await act(async () => root.unmount());
  root = createRoot(host);
  await render();
  expect(step()).toBe('Choose the demo website');
  expect(tutorialFingerprint(latest)).toBe(before);
  await click('Exit');
  await act(async () => root.unmount());
  root = createRoot(host);
  await render();
  expect(host.querySelector('.dxp-tutorial')).toBeNull();
});

it('protects existing work on automatic launch and remembers dismissal of the reset prompt', async () => {
  const existing = { ...defaultWorkflow, nodes: [createNode('note')] };
  localStorage.setItem(key, JSON.stringify(existing));
  await render();
  expect(step()).toBe('Start a new tutorial?');
  expect(latest).toMatchObject(existing);
  await act(async () => root.unmount());
  root = createRoot(host);
  await render();
  expect(step()).toBe('Start a new tutorial?');
  expect(latest).toMatchObject(existing);
  await click('Cancel');
  await act(async () => root.unmount());
  root = createRoot(host);
  await render();
  expect(host.querySelector('.dxp-tutorial')).toBeNull();
  await launch();
  expect(step()).toBe('Start a new tutorial?');
  expect(latest).toMatchObject(existing);
});

it('opens recovery for changed active workflows and remembers Cancel without accepting the mismatch', async () => {
  const original = newTutorial(defaultWorkflow);
  const changed = { ...defaultWorkflow, nodes: [createNode('note')] };
  localStorage.setItem(progressKey, JSON.stringify(original));
  localStorage.setItem(key, JSON.stringify(changed));
  await render();
  expect(step()).toBe('Review saved tutorial progress');
  expect(latest).toMatchObject(changed);
  await click('Cancel');
  expect(JSON.parse(localStorage.getItem(progressKey)!)).toMatchObject({
    status: 'dismissed',
    fingerprint: original.fingerprint,
  });
  await act(async () => root.unmount());
  root = createRoot(host);
  await render();
  expect(host.querySelector('.dxp-tutorial')).toBeNull();
  await launch();
  expect(step()).toBe('Review saved tutorial progress');
  await act(async () => root.unmount());
  root = createRoot(host);
  await render();
  expect(step()).toBe('Review saved tutorial progress');
  expect(latest).toMatchObject(changed);
});

it('keeps dismissed and completed tutorials closed, supports manual resume and cancels reset without edits', async () => {
  await render();
  await launch();
  await click('Continue');
  expect(step()).toBe('Name your workflow');
  await input('[aria-label="Workflow name"]', 'My first workflow.');
  await click('Continue');
  await click('Exit');
  expect(host.querySelector('.dxp-tutorial')).toBeNull();
  expect(latest.name).toBe('My first workflow.');
  localStorage.setItem(key, JSON.stringify(latest));
  await act(async () => root.unmount());
  root = createRoot(host);
  await render();
  expect(host.querySelector('.dxp-tutorial')).toBeNull();
  await click('Canvas help');
  await click('Start interactive tutorial');
  expect(step()).toBe('Choose the demo website');
  await click('Exit');
  const changed = { ...latest, nodes: [createNode('note')] };
  localStorage.setItem(key, JSON.stringify(changed));
  await act(async () => root.unmount());
  root = createRoot(host);
  await render();
  await click('Canvas help');
  await click('Start interactive tutorial');
  expect(step()).toBe('Review saved tutorial progress');
  await click('Resume and repair');
  expect(latest.nodes).toHaveLength(1);
  await click('Exit');
  const record = newTutorial(changed);
  localStorage.setItem(progressKey, JSON.stringify({ ...record, status: 'completed' }));
  await act(async () => root.unmount());
  root = createRoot(host);
  await render();
  expect(host.querySelector('.dxp-tutorial')).toBeNull();
  await click('Canvas help');
  await click('Start interactive tutorial');
  expect(step()).toBe('Start a new tutorial?');
  await click('Cancel');
  expect(latest).toMatchObject(changed);
});

it('adapts optional capabilities and keeps progress functional without storage', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('denied');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('denied');
  });
  await act(async () =>
    root.render(
      <VisualDXPBuilder
        tutorial={{ websiteUrl: '/demo-site.html' }}
        initialWorkflow={defaultWorkflow}
      />,
    ),
  );
  await launch();
  expect(el('.dxp-tutorial').textContent).toContain('Step 1 of 12');
  await click('Continue');
  await input('.dxp-tutorial input', 'My first workflow.');
  await click('Continue');
  await click('Exit');
  await click('Canvas help');
  await click('Start interactive tutorial');
  expect(step()).toBe('Choose the demo website');
});

function savedExercise() {
  const nodes = [createNode('trigger'), createNode('delay'), createNode('popover')];
  nodes[1].data.config.duration = 1000;
  const w: Workflow = {
    ...defaultWorkflow,
    name: 'My first workflow.',
    websiteUrl: '/demo-site.html',
    nodes,
    edges: [
      { id: 'one', source: nodes[0].id, target: nodes[1].id },
      { id: 'two', source: nodes[1].id, target: nodes[2].id },
    ],
  };
  const r = {
    ...newTutorial(w),
    step: 'test',
    ids: { trigger: nodes[0].id, delay: nodes[1].id, popover: nodes[2].id },
    inspected: { trigger: nodes[0].id, delay: nodes[1].id, popover: nodes[2].id },
    confirmedTrigger: nodes[0].id,
    defaultContent: nodes[2].data.config.content,
  };
  localStorage.setItem(key, JSON.stringify(w));
  localStorage.setItem(progressKey, JSON.stringify(r));
  return { w, r };
}

it('rejects old preview events, reports active execution errors, and allows a successful retry', async () => {
  const { r } = savedExercise();
  await render();
  await click('Canvas help');
  await click('Start interactive tutorial');
  await click('Test workflow');
  const frame = el<HTMLIFrameElement>('iframe[title="Workflow preview website"]');
  connectPreview(frame);
  await act(async () => frame.dispatchEvent(new Event('load')));
  vi.useFakeTimers();
  await click('Run workflow');
  const sent = vi.mocked(frame.contentWindow!.postMessage).mock.calls.map(([data]) => data);
  const active = sent.filter((data) => data.type === 'run').at(-1);
  async function emit(runId: string, status: string) {
    await act(async () =>
      window.dispatchEvent(
        new MessageEvent('message', {
          source: frame.contentWindow,
          origin: 'null',
          data: {
            protocol: 'visual-dxp:preview',
            type: 'log',
            channel: active.channel,
            runId,
            log: {
              nodeId: r.ids.popover,
              label: '',
              status,
              message: 'Example runtime result',
              timestamp: Date.now(),
            },
          },
        }),
      ),
    );
  }
  await emit('previous', 'success');
  expect(step()).toBe('Test your workflow');
  expect(host.textContent).not.toContain('Example runtime result');
  await emit(active.runId, 'error');
  expect(host.textContent).toContain('The preview could not complete this run.');
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(step()).toBe('Test your workflow');
  await click('Restart workflow');
  await emit(active.runId, 'error');
  expect(host.textContent).not.toContain('Example runtime result');
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(step()).toBe('Your popover worked');
});

it('gives recovery guidance when the demo cannot load, without completing the test', async () => {
  savedExercise();
  vi.mocked(fetch).mockRejectedValue(new Error('Unavailable'));
  await render();
  await click('Canvas help');
  await click('Start interactive tutorial');
  await click('Test workflow');
  expect(step()).toBe('Test your workflow');
  expect(button('Run workflow').disabled).toBe(true);
  expect(host.textContent).toContain('The preview could not complete this run.');
  await click('Exit');
  expect(latest.nodes).toHaveLength(3);
});

it('recovers from real deletion and Undo and keeps Back independent of history', async () => {
  const { w } = savedExercise();
  await render();
  await click('Canvas help');
  await click('Start interactive tutorial');
  await selectNode(w.nodes[1].id);
  await click('Delete');
  expect(host.textContent).toContain('A prerequisite changed.');
  const undo = el<HTMLButtonElement>('button[title^="Undo"]');
  await act(async () => undo.click());
  expect(latest.nodes.some((n) => n.id === w.nodes[1].id)).toBe(true);
  expect(host.textContent).not.toContain('A prerequisite changed.');
  const before = tutorialFingerprint(latest);
  await click('Back');
  expect(step()).toBe('Connect the workflow');
  expect(tutorialFingerprint(latest)).toBe(before);
  await click('Continue');
  await click('Exit');
});

it('requires explicit reset confirmation and can Undo the reset', async () => {
  const { w, r } = savedExercise();
  localStorage.setItem(progressKey, JSON.stringify({ ...r, status: 'completed' }));
  await render();
  await click('Canvas help');
  await click('Start interactive tutorial');
  expect(tutorialFingerprint(latest)).toBe(tutorialFingerprint(w));
  await click('Save workflow JSON');
  expect(el('.dxp-export-modal .dxp-tutorial')).toBeTruthy();
  expect(JSON.parse(el('.dxp-code code').textContent || '{}').nodes).toHaveLength(3);
  await click('Close dialog');
  await click('Reset canvas and start');
  expect(latest.nodes).toEqual([]);
  expect(latest.websiteUrl).toBe('');
  await act(async () => el<HTMLButtonElement>('button[title^="Undo"]').click());
  expect(tutorialFingerprint(latest)).toBe(tutorialFingerprint(w));
});

it('supports an optional host practice target without a demo header or demo URL', async () => {
  await act(async () =>
    root.render(
      <VisualDXPBuilder
        tutorial={{ websiteUrl: 'https://practice.example.test' }}
        onChange={(w) => {
          latest = w;
        }}
      />,
    ),
  );
  await launch();
  await click('Continue');
  await input('.dxp-tutorial input', 'My first workflow.');
  await click('Continue');
  expect(host.textContent).toContain('https://practice.example.test');
  await click('Change target website');
  await input('.dxp-website-settings input', 'https://practice.example.test');
  expect(latest.websiteUrl).toBe('');
  await click('Save website');
  expect(latest.websiteUrl).toBe('https://practice.example.test');
  expect(button('Continue').disabled).toBe(false);
});
