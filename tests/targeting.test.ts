// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import type { WorkflowRuntime } from '../src/lib/runtime';
import { matchesTargetUrl, resolveWebsiteUrl, validateExportTarget } from '../src/lib/targeting';
import type { Workflow, WorkflowNode } from '../src/lib/types';

// Vitest exposes the environment's real jsdom instance for URL navigation.
declare const jsdom: { reconfigure(options: { url: string }): void };
const editorUrl = 'https://editor.example.test/editor';
const page = window as Window & { visualDXP?: Pick<WorkflowRuntime, 'destroy'> };
function graph(websiteUrl: string, includeSubpages?: boolean): Workflow {
  const nodes: WorkflowNode[] = ['page-load', 'click', 'inactivity'].flatMap((event, index) => [
    {
      id: `trigger-${index}`,
      type: 'workflow',
      position: { x: 0, y: 0 },
      data: {
        kind: 'trigger',
        label: event,
        config: { event: event as 'click', selector: '#button', duration: 1000 },
      },
    },
    {
      id: `action-${index}`,
      type: 'workflow',
      position: { x: 200, y: 0 },
      data: {
        kind: 'dom',
        label: 'Update',
        config: { selector: `#result-${index}`, value: 'Ran' },
      },
    },
  ]);
  return {
    version: 1,
    name: 'Targeted experience',
    websiteUrl,
    includeSubpages,
    nodes,
    edges: [0, 1, 2].map((index) => ({
      id: `edge-${index}`,
      source: `trigger-${index}`,
      target: `action-${index}`,
    })),
  };
}
beforeEach(() => {
  jsdom.reconfigure({ url: editorUrl });
  vi.useFakeTimers();
  document.body.innerHTML =
    '<button id="button">Click</button><p id="result-0">Waiting</p><p id="result-1">Waiting</p><p id="result-2">Waiting</p>';
  vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
});
afterEach(() => {
  page.visualDXP?.destroy();
  delete page.visualDXP;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('standalone script targeting on the actual page URL', () => {
  const cases: [string, string, boolean, boolean][] = [
    ['https://example.com', 'https://example.com/', false, true],
    ['https://example.com', 'https://example.com/products', false, false],
    ['https://example.com', 'https://example.com/', true, true],
    ['https://example.com', 'https://example.com/products/item', true, true],
    ['https://example.com/products', 'https://example.com/products', false, true],
    [
      'https://example.com/products/',
      'https://example.com/products?campaign=x#details',
      false,
      true,
    ],
    ['https://example.com/products?campaign=y#intro', 'https://example.com/products/', false, true],
    ['https://example.com/products', 'https://example.com/products/item', false, false],
    ['https://example.com/products', 'https://example.com/products', true, true],
    ['https://example.com/products', 'https://example.com/products/item/details', true, true],
    ['https://example.com/products', 'https://example.com/products-sale', true, false],
    ['https://example.com/products', 'https://example.com/other/products', true, false],
    ['https://example.com/products', 'https://example.com/products%2Fitem', true, false],
    ['https://example.com/products', 'https://example.com/Products', true, false],
    ['https://example.com:443/products', 'https://EXAMPLE.com/products/./item', true, true],
    ...[false, true].flatMap((include): [string, string, boolean, boolean][] => [
      ['https://example.com/products', 'https://shop.example.com/products', include, false],
      ['https://example.com/products', 'https://other.example/products', include, false],
      ['https://example.com/products', 'http://example.com/products', include, false],
      ['https://example.com/products', 'https://example.com:444/products', include, false],
    ]),
  ];
  it.each(cases)('%s on %s, subpages=%s => active=%s', async (target, url, include, active) => {
    const script = exportWorkflow(graph(target, include));
    jsdom.reconfigure({ url });
    const previous = { destroy: vi.fn() };
    page.visualDXP = previous;
    const documentListen = vi.spyOn(document, 'addEventListener');
    const windowListen = vi.spyOn(window, 'addEventListener');
    const timer = vi.spyOn(window, 'setTimeout');
    new Function('window', 'document', script)(window, document);
    if (active) {
      expect(previous.destroy).toHaveBeenCalledOnce();
      expect(page.visualDXP).not.toBe(previous);
      expect(documentListen).toHaveBeenCalled();
      expect(timer).toHaveBeenCalled();
    } else {
      expect(previous.destroy).not.toHaveBeenCalled();
      expect(page.visualDXP).toBe(previous);
      expect(documentListen).not.toHaveBeenCalled();
      expect(windowListen).not.toHaveBeenCalled();
      expect(timer).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    }
    document.dispatchEvent(new Event('DOMContentLoaded'));
    const button = document.querySelector<HTMLButtonElement>('#button');
    if (!button) throw new Error('Expected the test button');
    button.click();
    await vi.advanceTimersByTimeAsync(1100);
    for (const result of document.querySelectorAll('p'))
      expect(result.textContent).toBe(active ? 'Ran' : 'Waiting');
  });
  it('treats older workflows as exact-page targets', async () => {
    const old = graph('https://example.com/products');
    delete old.includeSubpages;
    const script = exportWorkflow(old);
    expect(script).toContain('"includeSubpages": false');
    jsdom.reconfigure({ url: 'https://example.com/products/child' });
    new Function('window', 'document', script)(window, document);
    await vi.advanceTimersByTimeAsync(2000);
    expect(page.visualDXP).toBeUndefined();
    jsdom.reconfigure({ url: 'https://example.com/products' });
    new Function('window', 'document', script)(window, document);
    await vi.advanceTimersByTimeAsync(2000);
    expect(document.querySelector('#result-0')?.textContent).toBe('Ran');
  });
  it('freezes relative targets to the editor origin, ignoring document base and deployment origin', async () => {
    document.head.innerHTML = '<base href="https://unrelated.example/">';
    const script = exportWorkflow(graph('./products', true));
    document.head.innerHTML = '';
    expect(script).toContain('https://editor.example.test/products');
    jsdom.reconfigure({ url: 'https://other.example/products' });
    new Function('window', 'document', script)(window, document);
    expect(page.visualDXP).toBeUndefined();
    jsdom.reconfigure({ url: 'https://editor.example.test/products/item' });
    new Function('window', 'document', script)(window, document);
    await vi.advanceTimersByTimeAsync(1100);
    expect(document.querySelector('#result-0')?.textContent).toBe('Ran');
  });
});

describe('export eligibility, independent of preview validation', () => {
  it.each([
    '',
    '   ',
    'https://',
    'not a URL',
    'javascript:alert(1)',
    'ftp://example.com',
    '/demo-site.html',
    'demo-site.html?x=1',
    './demo-site.html#intro',
    '/%64emo-site.html?x#y',
    '/demo-site%2ehtml/',
    '../demo-site.html',
    '/shop/../demo-site.html?x#y',
    '/demo-site.html/',
    'https://editor.example.test/demo-site.html?x#y',
    '//editor.example.test/demo-site.html',
  ])('rejects %j with actionable instructions', (target) => {
    const workflow = graph(target);
    expect(validateWorkflow(workflow)).toEqual([]);
    expect(() => exportWorkflow(workflow)).toThrow(/Configure your website URL before exporting/);
  });
  it('rejects a missing target supplied by an untyped consumer', () => {
    const workflow = graph('');
    delete (workflow as Partial<Workflow>).websiteUrl;
    expect(() => exportWorkflow(workflow)).toThrow(/Enter a website URL/);
  });
  it.each([
    'https://unrelated.example/demo-site.html?x#y',
    'https://sub.editor.example.test/demo-site.html',
    'https://editor.example.test/other/demo-site.html',
  ])('allows unrelated page %s', (target) => {
    expect(() => exportWorkflow(graph(target))).not.toThrow();
  });
  it('uses an explicit editor baseUrl for relative paths and demo detection', () => {
    expect(
      validateExportTarget(graph('/products'), { baseUrl: 'https://production.example/editor' })
        .href,
    ).toBe('https://production.example/products');
    expect(() =>
      exportWorkflow(graph('https://production.example/demo-site.html'), {
        baseUrl: 'https://production.example/editor',
      }),
    ).toThrow(/preview only/);
  });
  it('fails closed for malformed matching inputs and normalizes standard URL components', () => {
    expect(matchesTargetUrl('/products', 'https://example.com/products', true)).toBe(false);
    expect(matchesTargetUrl('https://example.com', 'garbage')).toBe(false);
    expect(resolveWebsiteUrl('HTTPS://EXAMPLE.COM:443/a/../products///?x#y').href).toBe(
      'https://example.com/products',
    );
  });
});
