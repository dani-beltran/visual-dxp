// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ElementPicker } from '../src/components/ElementPicker/ElementPicker';
import { Preview } from '../src/components/Preview/Preview';
import { applyWorkflowOperations } from '../src/lib/ai';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { getNodeDataPorts } from '../src/lib/nodeData';
import { applyPageChange, type PageChange } from '../src/lib/pageChanges';
import { attachPageEditing } from '../src/lib/pageEditing';
import { isWorkflow } from '../src/lib/serialization';
import type { Workflow } from '../src/lib/types';
import { createWorkflowTools } from '../src/server/ai/tools';
import type { Workflow as ServerWorkflow } from '../src/server/ai/workflow/types';
import { validateWorkflow as serverValidate } from '../src/server/ai/workflow/validation';
import { connectPreview, mockDemoFetch } from './helpers/preview';

const html =
  '<h1 id="headline">Original heading</h1><a id="cta" href="/old"><span>Original link</span><b>→</b></a><picture><source srcset="old.webp"><img id="photo" src="https://example.com/old.jpg" srcset="old.jpg 1x" sizes="100vw" alt="Old alt"></picture>';
const bridge = readFileSync('public/bridge.js', 'utf8');
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mockDemoFetch();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function button(name: string) {
  const result = [...host.querySelectorAll('button')].find(
    (el) => el.textContent?.trim() === name || el.getAttribute('aria-label') === name,
  );
  if (!result) throw new Error(`Missing button ${name}`);
  return result;
}
async function click(name: string) {
  await act(async () => button(name).click());
}
async function input(label: string, value: string) {
  const element = [...host.querySelectorAll('label')].find((el) =>
    el.textContent?.startsWith(label),
  );
  const field = element?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
  if (!field) throw new Error(`Missing field ${label}`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      field.localName === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value',
    )!.set!.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function website(editing: boolean, content = html, targetBaseUrl?: string) {
  const frame = host.querySelector('iframe')!;
  const win = frame.contentWindow!,
    doc = frame.contentDocument!;
  if (!doc.documentElement) doc.appendChild(doc.createElement('html'));
  if (!doc.body) doc.documentElement.appendChild(doc.createElement('body'));
  doc.body.innerHTML = content;
  if (editing) {
    const script = doc.createElement('script');
    script.setAttribute('data-parent-origin', window.location.origin);
    if (targetBaseUrl) script.setAttribute('data-target-base-url', targetBaseUrl);
    vi.spyOn(doc, 'currentScript', 'get').mockReturnValue(script);
    vi.spyOn(win.parent, 'postMessage').mockImplementation((data) =>
      window.dispatchEvent(new MessageEvent('message', { data, origin: 'null', source: win })),
    );
    vi.spyOn(win, 'postMessage').mockImplementation((data) =>
      win.dispatchEvent(
        new MessageEvent('message', { data, origin: window.location.origin, source: win.parent }),
      ),
    );
    new Function('window', 'document', bridge)(win, doc);
  } else connectPreview(frame);
  vi.spyOn(doc, 'readyState', 'get').mockReturnValue('complete');
  await act(async () => frame.dispatchEvent(new Event('load')));
  return { frame, doc, win };
}
function graph(changes: PageChange[]): Workflow {
  return {
    version: 1,
    name: 'Page customization',
    websiteUrl: '/demo-site.html',
    nodes: [
      {
        id: 'start',
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: { kind: 'trigger', label: 'Start', config: { event: 'page-load' } },
      },
      {
        id: 'page',
        type: 'workflow',
        position: { x: 300, y: 0 },
        data: { kind: 'dom', label: 'Customize Page', config: { changes } },
      },
    ],
    edges: [{ id: 'edge', source: 'start', target: 'page' }],
  };
}

it('opens proxied page URLs as website URLs and saves canonical image and link changes', async () => {
  const proxy = (origin: string, path: string) =>
    `http://127.0.0.1:3000/api/preview/content/${Buffer.from(JSON.stringify({ origin })).toString('base64url')}.signature${path}`;
  const save = vi.fn();
  await act(async () =>
    root.render(
      <ElementPicker
        url="https://shop.example/catalog/"
        previewTransport={{ resolve: async () => proxy('https://shop.example', '/catalog/') }}
        initialChanges={[
          {
            selector: '#cta',
            action: 'attribute',
            attribute: 'href',
            value: proxy('https://shop.example', '/saved'),
          },
          {
            selector: '#photo',
            action: 'replace-image',
            value: proxy('https://cdn.example', '/saved.jpg'),
          },
        ]}
        onSelect={() => {}}
        onSaveChanges={save}
        onClose={() => {}}
      />,
    ),
  );
  const { doc } = await website(
    true,
    `<a id="cta" href="${proxy('https://shop.example', '/old')}">Shop</a><img id="photo" src="${proxy('https://cdn.example', '/old.jpg')}" alt="Vase">`,
    'https://shop.example/catalog/',
  );
  await act(async () => doc.querySelector<HTMLElement>('#cta')!.click());
  expect(host.querySelector<HTMLInputElement>('input[id$="-href"]')?.value).toBe(
    'https://shop.example/saved',
  );
  await input('Destination', 'https://shop.example/new');
  await act(async () => doc.querySelector<HTMLElement>('#photo')!.click());
  expect(host.querySelector<HTMLInputElement>('input[id$="-image"]')?.value).toBe(
    'https://cdn.example/saved.jpg',
  );
  await input('Image URL', 'https://cdn.example/new.jpg');
  await click('Save changes');
  expect(save).toHaveBeenCalledOnce();
  expect(save.mock.calls[0][0].map((change: PageChange) => change.value)).toEqual([
    'https://shop.example/new',
    'https://cdn.example/new.jpg',
  ]);
});

it('edits multiple elements, saves them once, and runs those exact changes in Test workflow', async () => {
  const save = vi.fn<(changes: PageChange[]) => void>();
  await act(async () =>
    root.render(
      <ElementPicker
        url="/demo-site.html"
        initialChanges={[
          {
            selector: '#photo',
            action: 'replace-image',
            value: 'https://example.com/old.jpg',
            imageAlt: 'Saved alt text',
          },
        ]}
        onSelect={() => {}}
        onSaveChanges={save}
        onClose={() => {}}
      />,
    ),
  );
  const { doc } = await website(true);
  const select = async (selector: string) => {
    await act(async () => doc.querySelector<HTMLElement>(selector)!.click());
  };
  expect(host.querySelector('.dxp-page-editor-advanced')).toBeNull();
  expect(host.querySelector('.dxp-page-editor-empty p')?.textContent).toBe(
    'Select an element on the page to edit it.',
  );
  expect(host.querySelector('.dxp-page-editor-empty-icon svg')).not.toBeNull();
  await select('#headline');
  expect(host.querySelector('.dxp-page-editor-empty')).toBeNull();
  const advancedAction = host.querySelector<HTMLSelectElement>('.dxp-page-editor-advanced select')!;
  expect([...advancedAction.options].map((option) => option.value)).not.toContain('text');
  expect([...advancedAction.options].map((option) => option.value)).not.toContain('replace-image');
  expect(advancedAction.value).toBe('add-class');
  const title = doc.querySelector('#headline')!;
  const inline = title.querySelector('[contenteditable]')!;
  expect(inline.getAttribute('contenteditable')).toBe('plaintext-only');
  await act(async () => {
    inline.textContent = 'Customized heading';
    inline.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const originalFrame = host.querySelector('iframe');
  expect(button('Desktop').getAttribute('aria-pressed')).toBe('true');
  await click('Mobile');
  expect(button('Mobile').getAttribute('aria-pressed')).toBe('true');
  expect(button('Desktop').getAttribute('aria-pressed')).toBe('false');
  expect(host.querySelector('.dxp-picker-frame-wrap-mobile iframe')).toBe(originalFrame);
  expect(doc.querySelector('#headline')?.textContent).toBe('Customized heading');
  await click('Desktop');
  expect(host.querySelector('.dxp-picker-frame-wrap-mobile')).toBeNull();
  expect(host.querySelector('iframe')).toBe(originalFrame);
  expect(doc.querySelector('#headline')?.textContent).toBe('Customized heading');
  await click('Text changed to “Customized heading”');
  expect(host.querySelector<HTMLDetailsElement>('.dxp-page-editor-advanced')?.open).toBe(false);
  expect(advancedAction.value).toBe('add-class');
  await select('#cta span');
  await input('Link text', 'Shop now');
  await input('Destination', '/new');
  expect(doc.querySelector('#cta b')?.textContent).toBe('→');
  await select('#photo');
  await input('Image URL', 'https://example.com/new.jpg');
  await input('Alt text', '');
  await click('Save changes');
  expect(save).toHaveBeenCalledOnce();
  const changes = save.mock.calls[0][0];
  expect(changes).toHaveLength(5);
  expect(changes.find((change) => change.selector === '#headline')?.element).toEqual({
    kind: 'heading',
    name: 'Original heading',
  });
  expect(changes.find((change) => change.action === 'replace-image')?.imageAlt).toBe(
    'Saved alt text',
  );
  const workflow = graph(changes);
  expect(isWorkflow(workflow)).toBe(true);
  expect(validateWorkflow(workflow)).toEqual([]);
  expect(serverValidate(workflow as ServerWorkflow)).toEqual([]);
  const saved = JSON.stringify(workflow);
  const logs = vi.fn();
  await act(async () =>
    root.render(<Preview workflow={workflow} onClose={() => {}} onLog={logs} />),
  );
  const preview = await website(false);
  expect(preview.doc.querySelector('#headline')?.textContent).toBe('Original heading');
  await click('Run workflow');
  expect(preview.doc.querySelector('#headline')?.textContent).toBe('Customized heading');
  expect(preview.doc.querySelector('#cta span')?.textContent).toBe('Shop now');
  expect(preview.doc.querySelector('#cta b')?.textContent).toBe('→');
  expect(preview.doc.querySelector('#cta')?.getAttribute('href')).toBe('/new');
  expect(preview.doc.querySelector('#photo')?.getAttribute('src')).toBe(
    'https://example.com/new.jpg',
  );
  expect(preview.doc.querySelector('#photo')?.getAttribute('alt')).toBe('');
  expect(preview.doc.querySelector('source')?.hasAttribute('srcset')).toBe(false);
  expect(logs.mock.calls.some(([log]) => log.nodeId === 'page' && log.status === 'success')).toBe(
    true,
  );
  expect(JSON.stringify(workflow)).toBe(saved);
  // The generated standalone script includes the same multi-change implementation.
  workflow.websiteUrl = window.location.href;
  document.body.insertAdjacentHTML('beforeend', `<div id="export-fixture">${html}</div>`);
  new Function(exportWorkflow(workflow))();
  await act(async () => {});
  expect(document.querySelector('#export-fixture #headline')?.textContent).toBe(
    'Customized heading',
  );
  (window as unknown as { visualDXP: { destroy: () => void } }).visualDXP.destroy();
  document.querySelector('#export-fixture')!.remove();
});

it('reopens saved changes, deduplicates edits, removes a change, undoes it, and cancels without saving', async () => {
  const changes: PageChange[] = [
    { selector: '#headline', action: 'text', value: 'Saved heading', textPath: [0] },
  ];
  const close = vi.fn(),
    save = vi.fn();
  await act(async () =>
    root.render(
      <ElementPicker
        url="/demo-site.html"
        initialChanges={changes}
        onSelect={() => {}}
        onSaveChanges={save}
        onClose={close}
      />,
    ),
  );
  const { doc } = await website(true);
  expect(doc.querySelector('#headline')?.textContent).toBe('Saved heading');
  await act(async () => doc.querySelector<HTMLElement>('#headline')!.click());
  await input('Change text', 'Draft A');
  await input('Change text', 'Draft B');
  expect(host.querySelectorAll('.dxp-page-change-row')).toHaveLength(1);
  await click('Undo last change');
  expect(doc.querySelector('#headline')?.textContent).toBe('Draft A');
  await click('Remove change');
  expect(doc.querySelector('#headline')?.textContent).toBe('Original heading');
  await click('Undo last change');
  expect(doc.querySelector('#headline')?.textContent).toBe('Draft A');
  await click('Cancel');
  expect(close).not.toHaveBeenCalled();
  const confirmation = host.querySelector('dialog')!;
  expect(confirmation.getAttribute('aria-modal')).toBe('true');
  expect(confirmation.querySelector('h2')?.textContent).toBe('Discard unsaved page changes?');
  await click('Keep editing');
  expect(host.querySelector('dialog')).toBeNull();
  expect(doc.querySelector('#headline')?.textContent).toBe('Draft A');
  await click('Cancel');
  await act(async () =>
    host.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true })),
  );
  expect(host.querySelector('dialog')).toBeNull();
  expect(close).not.toHaveBeenCalled();
  await click('Cancel');
  await click('Discard changes');
  expect(close).toHaveBeenCalledOnce();
  expect(save).not.toHaveBeenCalled();
  expect(changes[0].value).toBe('Saved heading');
});

it('preserves a saved whole-element text replacement when editing and replaying it on nested markup', async () => {
  const originalHtml = '<h1 id="headline"><em>Original</em> suffix</h1>';
  const save = vi.fn<(changes: PageChange[]) => void>();
  await act(async () =>
    root.render(
      <ElementPicker
        url="/demo-site.html"
        initialChanges={[{ selector: '#headline', action: 'text', value: 'Saved heading' }]}
        onSelect={() => {}}
        onSaveChanges={save}
        onClose={() => {}}
      />,
    ),
  );
  const { doc } = await website(true, originalHtml);
  expect(doc.querySelector('#headline')?.textContent).toBe('Saved heading');

  await act(async () => doc.querySelector<HTMLElement>('#headline')!.click());
  await input('Change text', 'Updated heading');
  expect.soft(doc.querySelector('#headline')?.textContent).toBe('Updated heading');
  await click('Save changes');
  expect(save).toHaveBeenCalledOnce();
  const changes = save.mock.calls[0][0];
  expect(changes).toHaveLength(1);

  // Replay the saved operation against the original website, not the flattened preview DOM.
  const original = document.implementation.createHTMLDocument();
  original.body.innerHTML = originalHtml;
  const heading = original.querySelector('#headline')!;
  expect.soft(() => applyPageChange(heading, changes[0])).not.toThrow();
  expect(heading.textContent).toBe('Updated heading');
});

it('replays inline typing into an originally empty element after multiple preview updates', async () => {
  const originalHtml = '<h1 id="headline"></h1>';
  const save = vi.fn<(changes: PageChange[]) => void>();
  await act(async () =>
    root.render(
      <ElementPicker
        url="/demo-site.html"
        onSelect={() => {}}
        onSaveChanges={save}
        onClose={() => {}}
      />,
    ),
  );
  const { doc } = await website(true, originalHtml);
  await act(async () => doc.querySelector<HTMLElement>('#headline')!.click());
  for (const value of ['H', 'Hi']) {
    await act(async () => {
      const inline = doc.querySelector('#headline [contenteditable]')!;
      inline.textContent = value;
      inline.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(doc.querySelector('#headline')?.textContent).toBe(value);
  }
  await click('Save changes');
  expect(save).toHaveBeenCalledOnce();
  const changes = save.mock.calls[0][0];
  expect(changes).toHaveLength(1);
  const original = document.implementation.createHTMLDocument();
  original.body.innerHTML = originalHtml;
  const heading = original.querySelector('#headline')!;
  expect(() => applyPageChange(heading, changes[0])).not.toThrow();
  expect(heading.textContent).toBe('Hi');
});

it('restores original text nodes, image attributes, and picture sources when the editor closes', () => {
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = html;
  const span = doc.querySelector('#cta span')!,
    text = span.firstChild,
    source = doc.querySelector('source')!;
  const editing = attachPageEditing(doc, vi.fn());
  expect(
    editing.update([
      { selector: '#cta', action: 'text', textPath: [0, 0], value: 'Changed' },
      {
        selector: '#photo',
        action: 'replace-image',
        value: 'https://example.com/new.jpg',
        imageAlt: '',
      },
    ]),
  ).toBe(true);
  editing.destroy();
  expect(span.firstChild).toBe(text);
  expect(text?.textContent).toBe('Original link');
  expect(source.getAttribute('srcset')).toBe('old.webp');
  expect(doc.querySelector('#photo')?.getAttribute('srcset')).toBe('old.jpg 1x');
});

it('validates every change and finds incoming templates anywhere in a page customization', () => {
  const workflow = graph([
    { selector: '#headline', value: 'Hello {{name}}' },
    { selector: '#photo', action: 'replace-image', value: 'javascript:alert(1)' },
  ]);
  expect(validateWorkflow(workflow).some((issue) => issue.nodeId === 'page')).toBe(true);
  expect(serverValidate(workflow as ServerWorkflow).some((issue) => issue.nodeId === 'page')).toBe(
    true,
  );
  expect(getNodeDataPorts(workflow.nodes[1].data).acceptsData).toBe(true);
  const bad = structuredClone(workflow) as unknown as {
    nodes: { data: { config: { changes: unknown } } }[];
  };
  bad.nodes[1].data.config.changes = [{ selector: '#headline', value: 42 }];
  expect(isWorkflow(bad)).toBe(false);
});

it('preserves page changes through server AI edits and client replay', () => {
  const original = graph([{ selector: '#headline', action: 'text', value: 'Hello' }]);
  const tools = createWorkflowTools(original as ServerWorkflow, []);
  const changes: PageChange[] = [
    {
      selector: '#headline',
      action: 'text',
      value: 'Updated',
      textPath: [0],
      element: { kind: 'heading', name: 'Hello' },
    },
    { selector: '#cta', action: 'attribute', attribute: 'href', value: '/new' },
  ];
  const response = JSON.parse(
    tools.invokePrivate('update_node', { id: 'page', config: { changes } }),
  );
  expect(response).toMatchObject({ ok: true, changed: true });
  expect(tools.getWorkflow().nodes[1].data.config.changes).toEqual(changes);
  const replay = applyWorkflowOperations(original, tools.getOperations());
  expect(replay.nodes[1].data.config.changes).toEqual(changes);
  expect(
    JSON.parse(tools.invokePrivate('update_node', { id: 'page', config: { value: 'Ignored?' } })),
  ).toMatchObject({ ok: false, retryable: true });
  expect(tools.getWorkflow().nodes[1].data.config.changes).toEqual(changes);
});

it('edits a text segment inline while preserving formatted siblings and their node identities', () => {
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = '<h1>Hello <em>there</em><br>friend</h1>';
  const heading = doc.querySelector('h1')!,
    emphasis = heading.querySelector('em'),
    text = heading.firstChild;
  const send = vi.fn();
  const editing = attachPageEditing(doc, send);
  editing.select(heading);
  expect(editing.detail(heading).textPath).toEqual([0]);
  const inline = heading.querySelector<HTMLElement>('[contenteditable]')!;
  inline.textContent = 'Welcome ';
  inline.dispatchEvent(new Event('input', { bubbles: true }));
  const change = send.mock.lastCall?.[1].change;
  expect(change).toMatchObject({ value: 'Welcome ', textPath: [0] });
  expect(editing.update([change])).toBe(true);
  expect(heading.textContent).toBe('Welcome therefriend');
  expect(heading.querySelector('em')).toBe(emphasis);
  expect(editing.update([{ ...change, value: '' }])).toBe(true);
  expect(editing.detail(heading).text).toBe('');
  expect(editing.detail(heading).textPath).toEqual([0]);
  expect(heading.querySelector('[contenteditable]')).not.toBeNull();
  expect(heading.querySelector('em')?.textContent).toBe('there');
  editing.destroy();
  expect(heading.firstChild).toBe(text);
  expect(heading.innerHTML).toBe('Hello <em>there</em><br>friend');
});

it('preserves the original name after reopening and does not treat description hydration as an unsaved edit', async () => {
  const close = vi.fn();
  const initial: PageChange[] = [
    { selector: '#headline', action: 'text', value: 'Saved heading', textPath: [0] },
  ];
  await act(async () =>
    root.render(
      <ElementPicker
        url="/demo-site.html"
        initialChanges={initial}
        onSelect={() => {}}
        onSaveChanges={() => {}}
        onClose={close}
      />,
    ),
  );
  await website(true);
  expect(host.querySelector('.dxp-page-element-name')?.textContent).toBe(
    'Heading · “Original heading”',
  );
  await click('Cancel');
  expect(close).toHaveBeenCalledOnce();
  const described = [
    { ...initial[0], element: { kind: 'heading' as const, name: 'Original heading' } },
  ];
  // Each simulated demo load needs its own consumable Response body.
  mockDemoFetch();
  await act(async () =>
    root.render(
      <ElementPicker
        key="reopen"
        url="/demo-site.html"
        initialChanges={described}
        onSelect={() => {}}
        onSaveChanges={() => {}}
        onClose={() => {}}
      />,
    ),
  );
  await website(true, html.replace('Original heading', 'A later website heading'));
  expect(host.querySelector('.dxp-page-element-name')?.textContent).toBe(
    'Heading · “Original heading”',
  );
});
