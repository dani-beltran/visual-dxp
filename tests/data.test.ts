import { describe, expect, it } from 'vitest';
import { type DataOperator, dataTools } from '../src/lib/data';

const input = (value: unknown) => ({ exists: true, value });
const evaluate = (value: unknown, conditionOperator: DataOperator, conditionValue?: string) =>
  dataTools.evaluate({ conditionOperator, conditionValue }, input(value));

describe('HTTP response data and selection', () => {
  it.each([
    ['{"user":{"name":"Ada"}}', { user: { name: 'Ada' } }],
    ['[1,true,null]', [1, true, null]],
    ['12.5', 12.5],
    ['true', true],
    ['false', false],
    ['null', null],
    ['"042"', '042'],
    ['plain text', 'plain text'],
    ['', ''],
    ['{invalid}', '{invalid}'],
  ])('automatically parses %s without losing its type', (body, expected) => {
    expect(dataTools.parseResponse(body, {})).toEqual(input(expected));
  });
  it.each(['user.name', 'data.items[0].price', 'items[2].tags', '[0][1].name'])(
    'accepts %s',
    (path) => {
      expect(() => dataTools.parsePath(path)).not.toThrow();
    },
  );
  it('selects nested arrays and distinguishes missing, null, false, zero and empty', () => {
    const data = { items: [{ price: 0, enabled: false }, null, { tags: [] }] };
    expect(dataTools.select(input(data), 'items[0].price')).toEqual(input(0));
    expect(dataTools.select(input(data), 'items[0].enabled')).toEqual(input(false));
    expect(dataTools.select(input(data), 'items[1]')).toEqual(input(null));
    expect(dataTools.select(input(data), 'items[2].tags')).toEqual(input([]));
    for (const path of [
      'items[3]',
      'items[1].name',
      'items.length',
      'items[0][0]',
      'constructor',
      'toString',
    ])
      expect(dataTools.select(input(data), path)).toEqual({ exists: false, value: undefined });
    expect(dataTools.select(input([[0, { name: 'Ada' }]]), '[0][1].name')).toEqual(input('Ada'));
    expect(dataTools.select(input(data), '   ')).toEqual(input(data));
    expect(dataTools.select(input(JSON.parse('{"__proto__":null}')), '__proto__')).toEqual(
      input(null),
    );
  });
  it.each([
    '.user',
    'user.',
    'user..name',
    'items[-1]',
    'items[1.5]',
    'items[01]',
    'items[]',
    'items[0]name',
    'items[9007199254740992]',
    'user["name"]',
  ])('rejects malformed path %s', (path) => {
    expect(() => dataTools.parsePath(path)).toThrow('Invalid data path');
  });
  it('selects from automatically parsed JSON and returns undefined for unresolved paths', () => {
    const body = '{"items":[{"price":12},null]}';
    expect(dataTools.parseResponse(body, { responseDataPath: 'items[0].price' })).toEqual(
      input(12),
    );
    expect(dataTools.parseResponse(body, { responseDataPath: 'items[1]' })).toEqual(input(null));
    for (const responseDataPath of ['items[2]', 'items[0].missing', 'items[1].name']) {
      expect(dataTools.parseResponse(body, { responseDataPath })).toEqual({
        exists: false,
        value: undefined,
      });
    }
    expect(() => dataTools.parseResponse(body, { responseDataPath: 'invalid[' })).toThrow(
      'Invalid data path',
    );
    expect(dataTools.parseResponse('invalid JSON', { responseDataPath: 'items[0]' })).toEqual(
      input('invalid JSON'),
    );
    expect(dataTools.parseResponse('', { responseDataPath: 'items[0]' })).toEqual(input(''));
  });
  it.each(['text', 'json', 'auto'])('ignores the legacy %s response format', (responseFormat) => {
    const config = { responseFormat, responseDataPath: 'item' };
    expect(dataTools.parseResponse('{"item":42}', config)).toEqual(input(42));
    expect(dataTools.parseResponse('plain text', config)).toEqual(input('plain text'));
  });
});

describe('type-aware Data operators', () => {
  const cases: [unknown, DataOperator, string | undefined, boolean][] = [
    [12, 'equal', '12.0', true],
    [12, 'not-equal', '13', true],
    [12, 'equal', '13', false],
    [12, 'greater-than', '11', true],
    [12, 'less-than', '13', true],
    [12, 'greater-than-or-equal', '12', true],
    [12, 'less-than-or-equal', '12', true],
    ['012', 'equal', '12', false],
    ['012', 'equal', '012', true],
    ['12', 'less-than', '20', true],
    ['2', 'greater-than', '10', false],
    ['True', 'equal', 'true', false],
    ['false', 'equal', 'false', true],
    [true, 'equal', 'true', true],
    [false, 'equal', 'false', true],
    [false, 'not-equal', 'true', true],
    [false, 'is-false', undefined, true],
    [true, 'is-true', undefined, true],
    [false, 'is-true', undefined, false],
    ['Premium plan', 'contains', 'plan', true],
    ['Premium plan', 'not-contains', 'premium', true],
    ['Premium plan', 'starts-with', 'Premium', true],
    ['Premium plan', 'ends-with', 'plan', true],
    ['Premium plan', 'matches', '^Premium.*plan$', true],
    ['Premium plan', 'not-matches', '^premium', true],
    [[1, { b: false, a: null }], 'equal', '[1,{"a":null,"b":false}]', true],
    [[1, 2], 'not-equal', '[2,1]', true],
    [[1], 'equal', '["1"]', false],
    [[1, false, null], 'contains', 'false', true],
    [[1, false, null], 'contains', 'null', true],
    [[1], 'contains', '1', true],
    [['1'], 'contains', '1', false],
    [['1'], 'contains', '"1"', true],
    [['hello'], 'contains', 'hello', true],
    [[{ a: 1 }], 'contains', '{"a":1}', true],
    [[1], 'not-contains', '2', true],
    [{ b: 2, a: [1] }, 'equal', '{"a":[1],"b":2}', true],
    [{ a: null }, 'contains', 'a', true],
    [{ a: 1 }, 'not-contains', '1', true],
    [{}, 'contains', 'constructor', false],
    ['', 'is-empty', undefined, true],
    [[], 'is-empty', undefined, true],
    [{}, 'is-empty', undefined, true],
    [' ', 'is-not-empty', undefined, true],
    [0, 'is-empty', undefined, false],
    [false, 'is-empty', undefined, false],
    [[null], 'is-not-empty', undefined, true],
    [{ a: null }, 'is-not-empty', undefined, true],
    [null, 'equal', 'null', true],
    [null, 'not-equal', '', true],
    [null, 'is-null', undefined, true],
    [null, 'is-not-null', undefined, false],
    [null, 'exists', undefined, true],
    [null, 'not-exists', undefined, false],
    [false, 'is-not-null', undefined, true],
  ];
  it.each(cases)('%j %s %s => %s', (value, operator, expected, result) => {
    expect(evaluate(value, operator, expected)).toBe(result);
  });
  it('handles missing data separately from explicit null', () => {
    for (const [operator, result] of [
      ['exists', false],
      ['not-exists', true],
      ['is-null', false],
      ['is-not-null', false],
    ] as const) {
      expect(
        dataTools.evaluate({ conditionOperator: operator, conditionDataPath: 'absent' }, input({})),
      ).toBe(result);
      expect(
        dataTools.evaluate({ conditionOperator: operator }, { exists: false, value: undefined }),
      ).toBe(result);
    }
    expect(() =>
      dataTools.evaluate(
        { conditionOperator: 'equal', conditionValue: 'null', conditionDataPath: 'absent' },
        input({}),
      ),
    ).toThrow('could not be resolved');
  });
  it.each(['', ' ', '12x', '0x10', 'Infinity', 'NaN', '1e999', 'true'])(
    'rejects invalid numeric comparison %j',
    (expected) => {
      expect(() => evaluate(1, 'equal', expected)).toThrow('valid finite numbers');
      expect(() => evaluate('1', 'less-than', expected)).toThrow('valid finite numbers');
    },
  );
  it.each([
    [true, 'equal', '1', 'true or false'],
    ['apple', 'greater-than', '2', 'valid finite numbers'],
    [[], 'equal', 'broken', 'valid JSON'],
    [{}, 'equal', '[]', 'JSON object'],
    [[], 'equal', '{}', 'JSON array'],
    [12, 'contains', '2', 'not supported'],
    [false, 'starts-with', 'f', 'not supported'],
    ['true', 'is-true', undefined, 'not supported'],
    [null, 'is-empty', undefined, 'not supported'],
    [{}, 'matches', '.*', 'not supported'],
    ['text', 'matches', '[', 'Invalid regular expression'],
    ['text', 'not-matches', '(', 'Invalid regular expression'],
  ] as [unknown, DataOperator, string | undefined, string][])(
    'validates %j %s %s',
    (value, operator, expected, message) => {
      expect(() => evaluate(value, operator, expected)).toThrow(message);
    },
  );
});
