// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyWorkflowOperations, parseAIChatRequest, parseAIChatResponse } from '../src/lib/ai';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { createRuntime } from '../src/lib/runtime';
import { isWorkflow } from '../src/lib/serialization';
import type { StepConfig, Workflow, WorkflowNode } from '../src/lib/types';

function graph(config: StepConfig): Workflow {
  const node = (
    id: string,
    kind: WorkflowNode['data']['kind'],
    settings: StepConfig,
  ): WorkflowNode => ({
    id,
    type: 'workflow',
    position: { x: 0, y: 0 },
    data: { kind, label: id, config: settings },
  });
  return {
    version: 1,
    name: 'Conditions',
    websiteUrl: window.location.href,
    nodes: [
      node('start', 'trigger', { event: 'page-load' }),
      node('condition', 'fork', config),
      node('yes', 'dom', { selector: '#result', value: 'yes' }),
      node('no', 'dom', { selector: '#result', value: 'no' }),
    ],
    edges: [
      { id: 'start-condition', source: 'start', target: 'condition' },
      { id: 'condition-yes', source: 'condition', target: 'yes', sourceHandle: 'true' },
      { id: 'condition-no', source: 'condition', target: 'no', sourceHandle: 'false' },
    ],
  };
}
const runtimes: ReturnType<typeof createRuntime>[] = [];
const exportWindow = window as Window & { visualDXP?: ReturnType<typeof createRuntime> };
const originalUrl = window.location.href;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 22, 12));
  document.body.innerHTML = '<p id="result">waiting</p>';
  window.history.replaceState(null, '', '?campaign=other&campaign=summer+sale&empty=&token=a%3Db');
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('en-US');
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone) Mobile');
  vi.spyOn(document, 'referrer', 'get').mockReturnValue(
    'https://source.example:8443/article?campaign=summer#section',
  );
  vi.spyOn(document, 'cookie', 'get').mockReturnValue(
    'unrelated=1; audience=summer%20sale; token=a=b; empty=; literal=bad%escape',
  );
  window.localStorage.setItem('storedAudience', 'summer sale');
  window.localStorage.setItem('audience', 'returning');
  window.localStorage.setItem('storedEmpty', '');
  window.sessionStorage.setItem('sessionAudience', 'summer sale');
  window.sessionStorage.setItem('sessionEmpty', '');
  window.sessionStorage.setItem('audience', 'this visit');
  window.sessionStorage.setItem('encoded', 'summer%20sale');
});
afterEach(() => {
  for (const instance of runtimes.splice(0)) instance.destroy();
  exportWindow.visualDXP?.destroy();
  delete exportWindow.visualDXP;
  vi.restoreAllMocks();
  vi.useRealTimers();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState(null, '', originalUrl);
  document.body.innerHTML = '';
});

const cases: [string, StepConfig, boolean][] = [
  ['selected weekday', { conditionType: 'weekdays', conditionWeekdays: [1, 2, 3] }, true],
  ['unselected weekday', { conditionType: 'weekdays', conditionWeekdays: [1, 6] }, false],
  [
    'UTC weekday',
    {
      conditionType: 'weekdays',
      conditionWeekdays: [new Date(2026, 8, 22, 12).getUTCDay()],
      conditionTimeZone: 'utc',
    },
    true,
  ],
  [
    'explicit local date range',
    {
      conditionType: 'date-range',
      conditionStartDate: '2026-09-01',
      conditionEndDate: '2026-09-30',
      conditionTimeZone: 'local',
    },
    true,
  ],
  [
    'UTC date range',
    {
      conditionType: 'date-range',
      conditionStartDate: '2026-09-01',
      conditionEndDate: '2026-09-30',
      conditionTimeZone: 'utc',
    },
    true,
  ],
  [
    'within date range',
    {
      conditionType: 'date-range',
      conditionStartDate: '2026-09-01',
      conditionEndDate: '2026-09-30',
    },
    true,
  ],
  [
    'single-day date range',
    {
      conditionType: 'date-range',
      conditionStartDate: '2026-09-22',
      conditionEndDate: '2026-09-22',
    },
    true,
  ],
  [
    'before date range',
    {
      conditionType: 'date-range',
      conditionStartDate: '2026-09-23',
      conditionEndDate: '2026-09-30',
    },
    false,
  ],
  [
    'after date range',
    {
      conditionType: 'date-range',
      conditionStartDate: '2026-09-01',
      conditionEndDate: '2026-09-21',
    },
    false,
  ],
  ['legacy selector', { condition: '#result' }, true],
  ['selector', { conditionType: 'selector', condition: '#missing' }, false],
  ['mobile', { conditionType: 'device', conditionValue: 'mobile' }, true],
  ['desktop', { conditionType: 'device', conditionValue: 'desktop' }, false],
  ['base language', { conditionType: 'language', conditionValue: 'en' }, true],
  ['case-insensitive locale', { conditionType: 'language', conditionValue: 'EN-us' }, true],
  ['different locale', { conditionType: 'language', conditionValue: 'en-GB' }, false],
  ['different language', { conditionType: 'language', conditionValue: 'es' }, false],
  [
    'case-insensitive referrer domain',
    { conditionType: 'referrer', conditionValue: 'SOURCE.example' },
    true,
  ],
  [
    'legacy URL compares only the domain',
    { conditionType: 'referrer', conditionValue: 'http://source.example:8080/sale?other=1#top' },
    true,
  ],
  [
    'different referrer domain',
    { conditionType: 'referrer', conditionValue: 'other.example' },
    false,
  ],
  [
    'referrer subdomains are distinct',
    { conditionType: 'referrer', conditionValue: 'www.source.example' },
    false,
  ],
  [
    'referrer suffixes are not partial matches',
    { conditionType: 'referrer', conditionValue: 'example' },
    false,
  ],
  ['trailing domain dot', { conditionType: 'referrer', conditionValue: 'source.example.' }, true],
  [
    'repeated decoded query',
    { conditionType: 'query-param', conditionKey: 'campaign', conditionValue: 'summer sale' },
    true,
  ],
  [
    'wrong query value',
    { conditionType: 'query-param', conditionKey: 'campaign', conditionValue: 'Summer sale' },
    false,
  ],
  [
    'empty query',
    { conditionType: 'query-param', conditionKey: 'empty', conditionValue: '' },
    true,
  ],
  [
    'absent query',
    { conditionType: 'query-param', conditionKey: 'missing', conditionValue: '' },
    false,
  ],
  [
    'decoded cookie',
    { conditionType: 'cookie', conditionKey: 'audience', conditionValue: 'summer sale' },
    true,
  ],
  [
    'wrong cookie value',
    { conditionType: 'cookie', conditionKey: 'audience', conditionValue: 'Summer sale' },
    false,
  ],
  [
    'cookie with equals',
    { conditionType: 'cookie', conditionKey: 'token', conditionValue: 'a=b' },
    true,
  ],
  [
    'cookie with malformed encoding',
    { conditionType: 'cookie', conditionKey: 'literal', conditionValue: 'bad%escape' },
    true,
  ],
  ['empty cookie', { conditionType: 'cookie', conditionKey: 'empty', conditionValue: '' }, true],
  [
    'absent cookie',
    { conditionType: 'cookie', conditionKey: 'missing', conditionValue: '' },
    false,
  ],
  [
    'exact cookie name',
    { conditionType: 'cookie', conditionKey: 'aud', conditionValue: 'summer sale' },
    false,
  ],
  [
    'storage matches when a same-name cookie differs',
    { conditionType: 'cookie', conditionKey: 'audience', conditionValue: 'returning' },
    true,
  ],
  [
    'local storage',
    { conditionType: 'cookie', conditionKey: 'storedAudience', conditionValue: 'summer sale' },
    true,
  ],
  [
    'wrong stored value',
    { conditionType: 'cookie', conditionKey: 'storedAudience', conditionValue: 'Summer sale' },
    false,
  ],
  [
    'empty storage',
    { conditionType: 'cookie', conditionKey: 'storedEmpty', conditionValue: '' },
    true,
  ],
  [
    'absent storage',
    { conditionType: 'cookie', conditionKey: 'missing', conditionValue: '' },
    false,
  ],
  [
    'session storage',
    { conditionType: 'cookie', conditionKey: 'sessionAudience', conditionValue: 'summer sale' },
    true,
  ],
  [
    'wrong session value',
    { conditionType: 'cookie', conditionKey: 'sessionAudience', conditionValue: 'Summer sale' },
    false,
  ],
  [
    'empty session value',
    { conditionType: 'cookie', conditionKey: 'sessionEmpty', conditionValue: '' },
    true,
  ],
  [
    'session matches when cookie and local storage differ',
    { conditionType: 'cookie', conditionKey: 'audience', conditionValue: 'this visit' },
    true,
  ],
  [
    'session values are not URL-decoded',
    { conditionType: 'cookie', conditionKey: 'encoded', conditionValue: 'summer sale' },
    false,
  ],
];

async function run(config: StepConfig, options: Parameters<typeof createRuntime>[1] = {}) {
  const instance = createRuntime(graph(config), options);
  runtimes.push(instance);
  await instance.run();
  return (options.document ?? document).querySelector('#result')?.textContent;
}

describe('condition branching in preview and exported scripts', () => {
  it.each(cases)('%s routes only the matching output', async (_label, config, matches) => {
    expect(await run(config)).toBe(matches ? 'yes' : 'no');
    document.querySelector('#result')!.textContent = 'waiting';
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
    // Execute the actual standalone export, which cannot rely on module-scoped helpers.
    new Function('window', 'document', exportWorkflow(graph(config)))(window, document);
    await vi.waitFor(() =>
      expect(document.querySelector('#result')?.textContent).toBe(matches ? 'yes' : 'no'),
    );
  });

  it.each([
    [new Date(2026, 8, 21, 23, 59, 59, 999), false],
    [new Date(2026, 8, 22, 0, 0, 0, 0), true],
    [new Date(2026, 8, 30, 23, 59, 59, 999), true],
    [new Date(2026, 9, 1, 0, 0, 0, 0), false],
  ])('includes both local date boundaries at %s: %s', async (now, matches) => {
    vi.setSystemTime(now);
    const config: StepConfig = {
      conditionType: 'date-range',
      conditionStartDate: '2026-09-22',
      conditionEndDate: '2026-09-30',
    };
    expect(await run(config)).toBe(matches ? 'yes' : 'no');
    document.querySelector('#result')?.replaceChildren('waiting');
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
    new Function('window', 'document', exportWorkflow(graph(config)))(window, document);
    // Await execution directly: waitFor advances fake time across the midnight boundary.
    await exportWindow.visualDXP?.run();
    expect(document.querySelector('#result')?.textContent).toBe(matches ? 'yes' : 'no');
  });

  it.each([
    ['2026-09-21T23:59:59.999Z', false],
    ['2026-09-22T00:00:00.000Z', true],
    ['2026-09-30T23:59:59.999Z', true],
    ['2026-10-01T00:00:00.000Z', false],
  ] as const)('includes both UTC date boundaries at %s: %s', async (now, matches) => {
    vi.setSystemTime(new Date(now));
    const config: StepConfig = {
      conditionType: 'date-range',
      conditionStartDate: '2026-09-22',
      conditionEndDate: '2026-09-30',
      conditionTimeZone: 'utc',
    };
    expect(await run(config)).toBe(matches ? 'yes' : 'no');
    document.querySelector('#result')?.replaceChildren('waiting');
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
    new Function('window', 'document', exportWorkflow(graph(config)))(window, document);
    await exportWindow.visualDXP?.run();
    expect(document.querySelector('#result')?.textContent).toBe(matches ? 'yes' : 'no');
  });

  it.each([new Date(2026, 8, 22, 0), new Date(2026, 8, 22, 23, 59, 59, 999)])(
    'uses the selected calendar for a single-day range at local time %s',
    async (now) => {
      vi.setSystemTime(now);
      for (const conditionTimeZone of [undefined, 'local', 'utc'] as const) {
        const config: StepConfig = {
          conditionType: 'date-range',
          conditionStartDate: '2026-09-22',
          conditionEndDate: '2026-09-22',
          ...(conditionTimeZone ? { conditionTimeZone } : {}),
        };
        const expected = conditionTimeZone !== 'utc' || now.getUTCDate() === 22 ? 'yes' : 'no';
        expect(await run(config)).toBe(expected);
        document.querySelector('#result')?.replaceChildren('waiting');
        vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
        new Function('window', 'document', exportWorkflow(graph(config)))(window, document);
        await exportWindow.visualDXP?.run();
        expect(document.querySelector('#result')?.textContent).toBe(expected);
      }
    },
  );

  it('checks the date again on every run, including a leap day', async () => {
    const instance = createRuntime(
      graph({
        conditionType: 'date-range',
        conditionStartDate: '2028-02-29',
        conditionEndDate: '2028-02-29',
      }),
    );
    runtimes.push(instance);
    for (const [now, expected] of [
      [new Date(2028, 1, 28, 23, 59, 59, 999), 'no'],
      [new Date(2028, 1, 29, 0), 'yes'],
      [new Date(2028, 1, 29, 23, 59, 59, 999), 'yes'],
      [new Date(2028, 2, 1, 0), 'no'],
    ] as const) {
      vi.setSystemTime(now);
      await instance.run();
      expect(document.querySelector('#result')?.textContent).toBe(expected);
    }
  });

  it('uses browser mobile hints when available, including explicit false', async () => {
    for (const mobile of [false, true]) {
      Object.defineProperty(window.navigator, 'userAgentData', {
        configurable: true,
        value: { mobile },
      });
      try {
        expect(await run({ conditionType: 'device', conditionValue: 'mobile' })).toBe(
          mobile ? 'yes' : 'no',
        );
      } finally {
        Reflect.deleteProperty(window.navigator, 'userAgentData');
      }
    }
  });

  it.each([
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0, 'desktop'],
    ['Mozilla/5.0 (Linux; Android 13) Mobile', 5, 'mobile'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X)', 5, 'mobile'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X)', 0, 'desktop'],
  ])('detects %s with %s touch points as %s', async (agent, touchPoints, device) => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(agent);
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      configurable: true,
      value: touchPoints,
    });
    try {
      expect(await run({ conditionType: 'device', conditionValue: device })).toBe('yes');
    } finally {
      Reflect.deleteProperty(window.navigator, 'maxTouchPoints');
    }
  });

  it('checks each storage source when earlier sources are blocked', async () => {
    vi.spyOn(document, 'referrer', 'get').mockReturnValue('');
    expect(await run({ conditionType: 'referrer', conditionValue: 'source.example' })).toBe('no');
    vi.spyOn(document, 'cookie', 'get').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    expect(await run({ conditionType: 'cookie', conditionKey: 'empty', conditionValue: '' })).toBe(
      'no',
    );
    expect(
      await run({ conditionType: 'cookie', conditionKey: 'storedEmpty', conditionValue: '' }),
    ).toBe('yes');
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    expect(
      await run({ conditionType: 'cookie', conditionKey: 'storedEmpty', conditionValue: '' }),
    ).toBe('no');
    expect(
      await run({ conditionType: 'cookie', conditionKey: 'sessionEmpty', conditionValue: '' }),
    ).toBe('yes');
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    expect(
      await run({ conditionType: 'cookie', conditionKey: 'sessionEmpty', conditionValue: '' }),
    ).toBe('no');
  });

  it('matches cookies even when local storage is blocked', async () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    expect(
      await run({
        conditionType: 'cookie',
        conditionKey: 'audience',
        conditionValue: 'summer sale',
      }),
    ).toBe('yes');
    expect(
      await run({ conditionType: 'cookie', conditionKey: 'missing', conditionValue: '' }),
    ).toBe('no');
  });

  it('still matches local storage when session storage is blocked', async () => {
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    expect(
      await run({
        conditionType: 'cookie',
        conditionKey: 'storedAudience',
        conditionValue: 'summer sale',
      }),
    ).toBe('yes');
    expect(
      await run({ conditionType: 'cookie', conditionKey: 'missing', conditionValue: '' }),
    ).toBe('no');
  });

  it('reads the supplied preview window and document instead of the editor', async () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    const win = frame.contentWindow!;
    doc.body.innerHTML = '<p id="result">waiting</p>';
    vi.spyOn(win.navigator, 'language', 'get').mockReturnValue('es-ES');
    vi.spyOn(doc, 'referrer', 'get').mockReturnValue('https://preview.example/');
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue('audience=preview');
    vi.spyOn(win, 'localStorage', 'get').mockReturnValue({
      getItem: (key: string) => (key === 'storedAudience' ? 'preview' : null),
    } as unknown as Storage);
    vi.spyOn(win, 'sessionStorage', 'get').mockReturnValue({
      getItem: (key: string) => (key === 'sessionAudience' ? 'preview session' : null),
    } as unknown as Storage);
    for (const config of [
      { conditionType: 'language', conditionValue: 'es' },
      { conditionType: 'referrer', conditionValue: 'preview.example' },
      { conditionType: 'cookie', conditionKey: 'audience', conditionValue: 'preview' },
      { conditionType: 'cookie', conditionKey: 'storedAudience', conditionValue: 'preview' },
      {
        conditionType: 'cookie',
        conditionKey: 'sessionAudience',
        conditionValue: 'preview session',
      },
    ] satisfies StepConfig[])
      expect(await run(config, { document: doc, window: win })).toBe('yes');
    // about:blank has no query string even though the editor does.
    expect(
      await run(
        { conditionType: 'query-param', conditionKey: 'campaign', conditionValue: 'summer sale' },
        { document: doc, window: win },
      ),
    ).toBe('no');
  });
});

describe('condition persistence and validation', () => {
  it.each(['UTC', 'Europe/Madrid', '', 42, null])(
    'rejects unsupported date-range time zone %j',
    async (conditionTimeZone) => {
      const config = {
        conditionType: 'date-range',
        conditionStartDate: '2026-09-01',
        conditionEndDate: '2026-09-30',
        conditionTimeZone,
      } as StepConfig;
      expect(validateWorkflow(graph(config))).toHaveLength(1);
      expect(() => exportWorkflow(graph(config))).toThrow();
      await expect(run(config)).rejects.toThrow('Choose visitor local time or UTC');
      expect(document.querySelector('#result')?.textContent).toBe('waiting');
    },
  );
  it.each([
    {},
    { conditionStartDate: '2026-09-01' },
    { conditionEndDate: '2026-09-30' },
    { conditionStartDate: '', conditionEndDate: '' },
    { conditionStartDate: '2026-09-30', conditionEndDate: '2026-09-01' },
    { conditionStartDate: '2026-02-29', conditionEndDate: '2026-03-01' },
    { conditionStartDate: '1900-02-29', conditionEndDate: '1900-03-01' },
    { conditionStartDate: '2026-04-31', conditionEndDate: '2026-05-01' },
    { conditionStartDate: '2026-01-01', conditionEndDate: '2026-02-30' },
    { conditionStartDate: '2026-13-01', conditionEndDate: '2027-01-01' },
    { conditionStartDate: '2026-09-00', conditionEndDate: '2026-09-30' },
    { conditionStartDate: '2026-9-1', conditionEndDate: '2026-09-30' },
    { conditionStartDate: '2026-09-01T00:00:00Z', conditionEndDate: '2026-09-30' },
    { conditionStartDate: ' 2026-09-01', conditionEndDate: '2026-09-30' },
    { conditionStartDate: '0000-01-01', conditionEndDate: '2026-09-30' },
    { conditionStartDate: '2026-09-01', conditionEndDate: '10000-01-01' },
    { conditionStartDate: 42, conditionEndDate: '2026-09-30' },
    { conditionStartDate: '2026-09-01', conditionEndDate: null },
  ])('rejects invalid date ranges at export and runtime: %j', async (dates) => {
    const config = { conditionType: 'date-range', ...dates } as StepConfig;
    expect(validateWorkflow(graph(config))).toEqual([
      { nodeId: 'condition', message: expect.any(String) },
    ]);
    expect(() => exportWorkflow(graph(config))).toThrow();
    await expect(run(config)).rejects.toThrow();
    expect(document.querySelector('#result')?.textContent).toBe('waiting');
  });

  it.each(['0001-01-01', '2000-02-29', '2028-02-29', '9999-12-31'])(
    'accepts valid calendar date %s',
    (date) => {
      expect(
        validateWorkflow(
          graph({
            conditionType: 'date-range',
            conditionStartDate: date,
            conditionEndDate: date,
          }),
        ),
      ).toEqual([]);
    },
  );
  it.each(cases)('preserves %s through JSON and AI operations', (_label, config) => {
    const workflow = JSON.parse(JSON.stringify(graph(config)));
    expect(isWorkflow(workflow)).toBe(true);
    expect(validateWorkflow(workflow)).toEqual([]);
    const request = parseAIChatRequest({
      workflow,
      messages: [{ role: 'user', content: 'Edit' }],
      selectedNodeIds: [],
    });
    expect(request.workflow.nodes[1].data.config).toEqual(config);
    const response = parseAIChatResponse({
      message: 'Updated',
      operations: [{ type: 'update_node', id: 'condition', config }],
    });
    const edited = applyWorkflowOperations(graph({ condition: '#result' }), response.operations);
    expect(edited.nodes[1].data.config).toMatchObject(config);
  });

  it.each([
    { conditionType: 'weekdays' },
    { conditionType: 'weekdays', conditionWeekdays: [] },
    { conditionType: 'weekdays', conditionWeekdays: [7] },
    { conditionType: 'weekdays', conditionWeekdays: [-1] },
    { conditionType: 'weekdays', conditionWeekdays: [1.5] },
    { conditionType: 'weekdays', conditionWeekdays: 'Monday' },
    { conditionType: 'weekdays', conditionWeekdays: [1], conditionTimeZone: 'invalid' },
    { conditionType: 'unknown', conditionValue: 'value' },
    { conditionType: 'selector', condition: '' },
    { conditionType: 'device', conditionValue: 'tablet' },
    { conditionType: 'language', conditionValue: 'en_US' },
    { conditionType: 'language', conditionValue: '' },
    { conditionType: 'referrer', conditionValue: 'javascript:alert(1)' },
    { conditionType: 'referrer', conditionValue: '/relative' },
    { conditionType: 'referrer', conditionValue: '' },
    { conditionType: 'referrer', conditionValue: 'not a domain' },
    { conditionType: 'referrer', conditionValue: 'example.com/path' },
    { conditionType: 'referrer', conditionValue: '-example.com' },
    { conditionType: 'referrer', conditionValue: 'example..com' },
    { conditionType: 'referrer', conditionValue: 'https://user@example.com' },
    { conditionType: 'query-param', conditionKey: '', conditionValue: '' },
    { conditionType: 'cookie', conditionKey: 'name' },
    { conditionType: 42 },
    { conditionType: 'cookie', conditionKey: {}, conditionValue: 'x' },
    { conditionType: 'cookie', conditionKey: 'name', conditionValue: 42 },
  ])('rejects invalid condition %j at export', (config) => {
    expect(() => exportWorkflow(graph(config as StepConfig))).toThrow();
  });

  it.each([
    'conditionType',
    'conditionKey',
    'conditionValue',
    'conditionStartDate',
    'conditionEndDate',
    'conditionTimeZone',
  ])('rejects non-string %s on import', (field) => {
    expect(isWorkflow(graph({ [field]: 42 }))).toBe(false);
  });
});

it.each([0, 1, 2, 3, 4, 5, 6])('checks weekday %s using the configured clock', async (day) => {
  vi.spyOn(Date.prototype, 'getDay').mockReturnValue(day);
  vi.spyOn(Date.prototype, 'getUTCDay').mockReturnValue((day + 1) % 7);
  expect(await run({ conditionType: 'weekdays', conditionWeekdays: [day] })).toBe('yes');
  expect(
    await run({ conditionType: 'weekdays', conditionWeekdays: [day], conditionTimeZone: 'utc' }),
  ).toBe('no');
  expect(
    await run({
      conditionType: 'weekdays',
      conditionWeekdays: [(day + 1) % 7],
      conditionTimeZone: 'utc',
    }),
  ).toBe('yes');
});
