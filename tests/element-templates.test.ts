// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { dataTools } from '../src/lib/data';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { getNodeDataPorts } from '../src/lib/nodeData';
import { createRuntime } from '../src/lib/runtime';
import type { StepConfig, Workflow, WorkflowNode } from '../src/lib/types';
import { dataTools as serverData } from '../src/server/ai/workflow/data';
import { validateWorkflow as serverValidate } from '../src/server/ai/workflow/validation';

const input = {
  exists: true,
  value: {
    name: 'Ada',
    user: { surname: 'Lovelace' },
    items: [{ price: 0 }],
    nil: null,
    enabled: false,
    classes: ['active', 'premium'],
    object: { a: 1 },
    literal: '{{name}}',
  },
};
it.each([dataTools, serverData])(
  'interpolates multiple variables with the same client/server rules',
  (data) => {
    expect(
      data.elementValue(
        { value: 'Hello {{ name }} {{user.surname}} — {{items[0].price}} / {{enabled}}!' },
        input,
      ),
    ).toBe('Hello Ada Lovelace — 0 / false!');
    expect(data.elementValue({ value: '{{nil}}|{{missing}}|{{object}}|{{literal}}' }, input)).toBe(
      '||{"a":1}|{{name}}',
    );
    expect(data.elementValue({ value: 'Value: {{$}}' }, { exists: true, value: 42 })).toBe(
      'Value: 42',
    );
    expect(data.elementValue({ value: '{{$.name}}' }, input)).toBe('Ada');
    expect(data.elementValue({ value: 'base {{classes}}', action: 'add-class' }, input)).toBe(
      'base active premium',
    );
    expect(() => data.elementValue({ value: '{{object}}', action: 'remove-class' }, input)).toThrow(
      'Incoming CSS classes',
    );
    expect(
      data.elementValue({ value: '<script>if(true){if(true){}}</script>', action: 'html' }, input),
    ).toBe('<script>if(true){if(true){}}</script>');
    expect(() => data.elementValue({ value: '{{ }}' }, input)).toThrow('variable name');
    expect(() => data.elementValue({ value: '{{$.}}' }, input)).toThrow('Invalid data path');
    expect(() => data.elementValue({ value: 'Hello {{name' }, input)).toThrow('matching braces');
    expect(() => data.elementValue({ value: '{{name.toUpperCase()}}' }, input)).toThrow(
      'Invalid data path',
    );
    expect(() => data.interpolate('#{{missing}}', input, undefined, true)).toThrow('missing');
    expect(() => data.interpolate('data-{{nil}}', input, undefined, true)).toThrow('missing');
  },
);

it('derives the incoming data flag from variables in active fields only', () => {
  for (const action of [
    'text',
    'html',
    'add-class',
    'remove-class',
    'attribute',
    'hide',
    'show',
  ] as const) {
    const config: StepConfig = { action, selector: '#target', value: '{{name}}' };
    expect(getNodeDataPorts({ kind: 'dom', config }).acceptsData).toBe(
      !['hide', 'show'].includes(action),
    );
    config.value = 'static';
    expect(getNodeDataPorts({ kind: 'dom', config }).acceptsData).toBe(false);
    config.selector = '#{{id}}';
    expect(getNodeDataPorts({ kind: 'dom', config }).acceptsData).toBe(true);
  }
  expect(dataTools.usesIncomingValue({ action: 'attribute', attribute: 'data-{{name}}' })).toBe(
    true,
  );
  expect(dataTools.usesIncomingValue({ action: 'text', attribute: 'data-{{name}}' })).toBe(false);
});

function node(id: string, kind: WorkflowNode['data']['kind'], config: StepConfig): WorkflowNode {
  return { id, type: 'workflow', position: { x: 0, y: 0 }, data: { kind, label: id, config } };
}
function graph(config: StepConfig): Workflow {
  return {
    version: 1,
    name: 'Templates',
    websiteUrl: window.location.href,
    nodes: [
      node('start', 'trigger', { event: 'click', selector: '#run' }),
      node('http', 'http', { url: 'https://example.com/data' }),
      node('update', 'dom', config),
      node('forward', 'dom', { selector: '#forward', value: '{{$}}' }),
      node('transform', 'transform', { dataPath: 'customer', transformations: [] }),
    ],
    edges: [
      { id: 'start-http', source: 'start', target: 'http' },
      {
        id: 'http-update',
        source: 'http',
        target: 'transform',
      },
      { id: 'transform-update', source: 'transform', target: 'update' },
      { id: 'update-forward', source: 'update', target: 'forward' },
    ],
  };
}
const runtimes: ReturnType<typeof createRuntime>[] = [];
afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.destroy();
  vi.restoreAllMocks();
});

it.each(['direct', 'exported'] as const)(
  'supports variables for every element action and forwards selected data (%s)',
  async (mode) => {
    const payload = {
      customer: { id: 'target', name: 'Ada', attribute: 'name', classes: ['active', 'premium'] },
    };
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(JSON.stringify(payload)));
    for (const action of [
      'text',
      'html',
      'add-class',
      'remove-class',
      'attribute',
      'hide',
      'show',
    ] as const) {
      document.body.innerHTML =
        '<button id="run"></button><div id="target" class="base active premium"></div><p id="forward"></p>';
      const target = document.querySelector<HTMLElement>('#target');
      if (!target) throw new Error('Missing target');
      if (action === 'show') target.style.display = 'none';
      if (action === 'add-class') target.className = 'base';
      const workflow = graph({
        selector: '#{{id}}',
        action,
        attribute: 'data-{{attribute}}',
        value: action.includes('class')
          ? '{{classes}}'
          : action === 'html'
            ? '<b>Hello {{name}}</b>'
            : 'Hello {{name}}',
      });
      expect(validateWorkflow(workflow)).toEqual([]);
      expect(serverValidate(workflow as Parameters<typeof serverValidate>[0])).toEqual([]);
      let runtime: ReturnType<typeof createRuntime>;
      if (mode === 'direct') runtime = createRuntime(workflow, { fetch: fetcher });
      else {
        new Function('window', 'document', exportWorkflow(workflow))(window, document);
        const exported = (window as Window & { visualDXP?: ReturnType<typeof createRuntime> })
          .visualDXP;
        if (!exported) throw new Error('Missing exported runtime');
        runtime = exported;
      }
      runtimes.push(runtime);
      await runtime.run();
      if (action === 'text') expect(target.textContent).toBe('Hello Ada');
      if (action === 'html') expect(target.innerHTML).toBe('<b>Hello Ada</b>');
      if (action === 'attribute') expect(target.getAttribute('data-name')).toBe('Hello Ada');
      if (action === 'add-class') expect(target.className).toBe('base active premium');
      if (action === 'remove-class') expect(target.className).toBe('base');
      if (action === 'hide') expect(target.style.display).toBe('none');
      if (action === 'show') expect(target.style.display).not.toBe('none');
      expect(JSON.parse(document.querySelector('#forward')?.textContent ?? '')).toEqual(
        payload.customer,
      );
      runtime.destroy();
    }
  },
);

it('rejects missing selector variables before mutating any element', async () => {
  document.body.innerHTML = '<button id="run"></button><div id="target">unchanged</div>';
  const workflow = graph({ action: 'text', selector: '#{{missing}}', value: '{{name}}' });
  const runtime = createRuntime(workflow, {
    fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('{"customer":{"name":"Ada"}}')),
  });
  runtimes.push(runtime);
  await expect(runtime.run()).rejects.toThrow('Variable “missing” is missing');
  expect(document.querySelector('#target')?.textContent).toBe('unchanged');
});

it.each(['direct', 'exported'] as const)(
  'replaces responsive images, preserves layout and forwards data (%s)',
  async (mode) => {
    for (const imageAlt of [undefined, 'Photo of {{name}}', '']) {
      document.body.innerHTML =
        '<button id="run"></button><picture><source srcset="wide.jpg" media="(min-width: 600px)"><img id="target" src="old.jpg" srcset="old@2x.jpg 2x" sizes="50vw" alt="Original" width="320" height="200" class="hero" style="object-fit: cover"></picture><p id="forward"></p>';
      const payload = { customer: { image: '/new.jpg', name: 'Ada' } };
      const fetcher = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(async () => new Response(JSON.stringify(payload)));
      const workflow = graph({
        selector: '#target',
        action: 'replace-image',
        value: '{{image}}',
        imageAlt,
      });
      expect(validateWorkflow(workflow)).toEqual([]);
      expect(serverValidate(workflow as Parameters<typeof serverValidate>[0])).toEqual([]);
      let runtime: ReturnType<typeof createRuntime>;
      if (mode === 'direct') runtime = createRuntime(workflow, { fetch: fetcher });
      else {
        new Function('window', 'document', exportWorkflow(workflow))(window, document);
        const exported = (window as Window & { visualDXP?: ReturnType<typeof createRuntime> })
          .visualDXP;
        if (!exported) throw new Error('Missing exported runtime');
        runtime = exported;
      }
      runtimes.push(runtime);
      const target = document.querySelector<HTMLImageElement>('#target')!;
      await runtime.run();
      expect(document.querySelector('#target')).toBe(target);
      expect(target.getAttribute('src')).toBe('/new.jpg');
      expect(target.hasAttribute('srcset')).toBe(false);
      expect(target.hasAttribute('sizes')).toBe(false);
      expect(document.querySelector('source')?.hasAttribute('srcset')).toBe(false);
      expect(target.alt).toBe(
        imageAlt === undefined ? 'Original' : imageAlt === '' ? '' : 'Photo of Ada',
      );
      expect([target.width, target.height, target.className, target.style.objectFit]).toEqual([
        320,
        200,
        'hero',
        'cover',
      ]);
      expect(JSON.parse(document.querySelector('#forward')!.textContent!)).toEqual(
        payload.customer,
      );
      runtime.destroy();
    }
  },
);

it.each([dataTools, serverData])('validates image URLs and alt templates', (data) => {
  for (const value of ['', 'javascript:alert(1)', 'data:text/html,test', 'https://']) {
    expect(() => data.validateElementValue({ action: 'replace-image', value })).toThrow();
  }
  for (const value of [
    'https://example.com/photo.jpg',
    '/photo.jpg',
    '../photo.jpg',
    '{{image}}',
  ]) {
    expect(() => data.validateElementValue({ action: 'replace-image', value })).not.toThrow();
  }
  expect(() => data.elementValue({ action: 'replace-image', value: '{{missing}}' }, input)).toThrow(
    'image URL',
  );
  expect(() =>
    data.validateElementValue({
      action: 'replace-image',
      value: '/photo.jpg',
      imageAlt: '{{broken',
    }),
  ).toThrow('matching braces');
  expect(
    data.usesIncomingValue({ action: 'replace-image', value: '/photo.jpg', imageAlt: '{{name}}' }),
  ).toBe(true);
  expect(data.usesIncomingValue({ action: 'text', imageAlt: '{{name}}' })).toBe(false);
});

it('rejects mixed non-image targets before replacing any image', async () => {
  document.body.innerHTML =
    '<button id="run"></button><img class="target" src="old.jpg"><div class="target"></div>';
  const runtime = createRuntime(
    graph({ selector: '.target', action: 'replace-image', value: '/new.jpg' }),
    {
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('{"customer":{}}')),
    },
  );
  runtimes.push(runtime);
  await expect(runtime.run()).rejects.toThrow('img element');
  expect(document.querySelector('img')?.getAttribute('src')).toBe('old.jpg');
});
