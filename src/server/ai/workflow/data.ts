export interface DataSelection {
  exists: boolean;
  value: unknown;
}

interface DataConditionConfig {
  conditionDataPath?: string;
  conditionOperator?: string;
  conditionValue?: string;
}

interface ResponseConfig {
  responseDataPath?: string;
}

interface ElementValueConfig {
  action?: string;
  value?: string;
  valueSource?: string;
  valueDataPath?: string;
}

/** Self-contained so preview and exported scripts use exactly the same rules. */
export function createDataTools() {
  const operators = {
    equal: 'Equal',
    'not-equal': 'Not equal',
    'greater-than': 'Greater than',
    'less-than': 'Less than',
    'greater-than-or-equal': 'Greater than or equal',
    'less-than-or-equal': 'Less than or equal',
    contains: 'Contains',
    'not-contains': 'Does not contain',
    matches: 'Matches',
    'not-matches': 'Does not match',
    'starts-with': 'Starts with',
    'ends-with': 'Ends with',
    'is-empty': 'Is empty',
    'is-not-empty': 'Is not empty',
    exists: 'Exists',
    'not-exists': 'Does not exist',
    'is-null': 'Is null',
    'is-not-null': 'Is not null',
    'is-true': 'Is true',
    'is-false': 'Is false',
  } as const;

  function needsValue(operator: string): boolean {
    return ![
      'exists',
      'not-exists',
      'is-null',
      'is-not-null',
      'is-true',
      'is-false',
      'is-empty',
      'is-not-empty',
    ].includes(operator);
  }

  function parsePath(path = ''): (string | number)[] {
    if (typeof path !== 'string') throw new Error('Data path must be text.');
    const source = path.trim();
    if (!source) return [];
    const tokens: (string | number)[] = [];
    const pattern = /(?:^|\.)([A-Za-z_$][\w$-]*)|\[(0|[1-9]\d*)\]/g;
    let end = 0;
    for (const match of source.matchAll(pattern)) {
      if (match.index !== end) break;
      const token = match[1] ?? Number(match[2]);
      if (typeof token === 'number' && !Number.isSafeInteger(token)) break;
      tokens.push(token);
      end += match[0].length;
    }
    if (source.startsWith('.') || end !== source.length)
      throw new Error(
        `Invalid data path “${path}”. Use properties and array indexes, e.g. data.items[0].price.`,
      );
    return tokens;
  }

  function select(input: DataSelection, path = ''): DataSelection {
    const tokens = parsePath(path);
    let { exists, value } = input;
    for (const token of tokens) {
      if (
        !exists ||
        value === null ||
        typeof value !== 'object' ||
        (typeof token === 'number' ? !Array.isArray(value) : Array.isArray(value)) ||
        !Object.hasOwn(value, token)
      ) {
        exists = false;
        value = undefined;
        break;
      }
      value = (value as Record<string | number, unknown>)[token];
    }
    return { exists, value };
  }

  function usesIncomingValue(config: ElementValueConfig): boolean {
    return config.valueSource === 'incoming-data' && !['hide', 'show'].includes(config.action ?? 'text');
  }

  function validateElementValue(config: ElementValueConfig): void {
    if (['hide', 'show'].includes(config.action ?? 'text')) return;
    if (!['manual', 'incoming-data'].includes(config.valueSource ?? 'manual'))
      throw new Error('Choose Manual value or Incoming data as the value source.');
    if (usesIncomingValue(config)) parsePath(config.valueDataPath);
  }

  function elementValue(config: ElementValueConfig, input: DataSelection): string {
    validateElementValue(config);
    if (!usesIncomingValue(config)) return config.value ?? '';
    const { value } = select(input, config.valueDataPath);
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (config.action === 'add-class' || config.action === 'remove-class') {
      if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value.join(' ');
      throw new Error('Incoming CSS classes must be text, a number, a boolean, or an array of strings.');
    }
    return JSON.stringify(value);
  }

  function validateResponse(config: ResponseConfig): void {
    parsePath(config.responseDataPath);
  }

  function parseResponse(body: string, config: ResponseConfig): DataSelection {
    validateResponse(config);
    let value: unknown;
    try {
      value = JSON.parse(body);
    } catch {
      // Non-JSON bodies are always passed through as complete text.
      return { exists: true, value: body };
    }
    // Preserve missingness so downstream Exists checks distinguish it from null.
    return select({ exists: true, value }, config.responseDataPath);
  }

  function validateCondition(config: DataConditionConfig): void {
    parsePath(config.conditionDataPath);
    const operator = config.conditionOperator ?? 'equal';
    if (!Object.hasOwn(operators, operator))
      throw new Error('Choose a supported Incoming data condition operator.');
    if (needsValue(operator) && typeof config.conditionValue !== 'string')
      throw new Error('Enter a comparison value for the Incoming data condition.');
    if (operator === 'matches' || operator === 'not-matches') {
      try {
        new RegExp(config.conditionValue ?? '');
      } catch {
        throw new Error(
          'Invalid regular expression. Enter a pattern such as ^premium, without / delimiters.',
        );
      }
    }
  }

  function deepEqual(left: unknown, right: unknown): boolean {
    if (left === right) return true;
    if (
      left === null ||
      right === null ||
      typeof left !== 'object' ||
      typeof right !== 'object' ||
      Array.isArray(left) !== Array.isArray(right)
    )
      return false;
    const keys = Object.keys(left);
    return (
      keys.length === Object.keys(right).length &&
      keys.every(
        (key) =>
          Object.hasOwn(right, key) &&
          deepEqual(
            (left as Record<string, unknown>)[key],
            (right as Record<string, unknown>)[key],
          ),
      )
    );
  }

  function number(value: string | number): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (
      typeof value === 'string' &&
      /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim()) &&
      Number.isFinite(Number(value))
    )
      return Number(value);
    throw new Error('Numeric comparisons require valid finite numbers on both sides.');
  }

  function jsonOrText(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  function evaluate(config: DataConditionConfig, input: DataSelection): boolean {
    validateCondition(config);
    const operator = config.conditionOperator ?? 'equal';
    const { exists, value } = select(input, config.conditionDataPath);
    if (operator === 'exists') return exists;
    if (operator === 'not-exists') return !exists;
    if (operator === 'is-null') return exists && value === null;
    if (operator === 'is-not-null') return exists && value !== null;
    if (!exists)
      throw new Error(
        `Data path “${config.conditionDataPath?.trim() || '(incoming data)'}” could not be resolved. Use Exists or Does not exist to check missing data.`,
      );
    const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    const unsupported = () =>
      new Error(
        `“${operators[operator as keyof typeof operators]}” is not supported for ${type} data.`,
      );
    const expected = config.conditionValue ?? '';
    if (operator === 'is-true' || operator === 'is-false') {
      if (typeof value !== 'boolean') throw unsupported();
      return value === (operator === 'is-true');
    }
    if (operator === 'is-empty' || operator === 'is-not-empty') {
      let empty: boolean;
      if (typeof value === 'string' || Array.isArray(value)) empty = value.length === 0;
      else if (value !== null && typeof value === 'object') empty = Object.keys(value).length === 0;
      else if (typeof value === 'number' || typeof value === 'boolean') empty = false;
      else throw unsupported();
      return operator === 'is-empty' ? empty : !empty;
    }
    if (
      ['greater-than', 'less-than', 'greater-than-or-equal', 'less-than-or-equal'].includes(
        operator,
      )
    ) {
      if (typeof value !== 'number' && typeof value !== 'string') throw unsupported();
      const left = number(value),
        right = number(expected);
      if (operator === 'greater-than') return left > right;
      if (operator === 'less-than') return left < right;
      if (operator === 'greater-than-or-equal') return left >= right;
      return left <= right;
    }
    if (operator === 'equal' || operator === 'not-equal') {
      let comparison: unknown = expected;
      if (typeof value === 'number') comparison = number(expected);
      else if (typeof value === 'boolean') {
        if (!['true', 'false'].includes(expected.trim()))
          throw new Error('Boolean comparisons require true or false.');
        comparison = expected.trim() === 'true';
      } else if (value !== null && typeof value === 'object') {
        try {
          comparison = JSON.parse(expected);
        } catch {
          throw new Error('Array and object equality requires a valid JSON comparison value.');
        }
        if (
          comparison === null ||
          typeof comparison !== 'object' ||
          Array.isArray(value) !== Array.isArray(comparison)
        )
          throw new Error(`Enter a JSON ${type} to compare with ${type} data.`);
      } else if (value === null) comparison = jsonOrText(expected);
      else if (typeof value !== 'string') throw unsupported();
      const equal = deepEqual(value, comparison);
      return operator === 'equal' ? equal : !equal;
    }
    if (operator === 'contains' || operator === 'not-contains') {
      let contains: boolean;
      if (typeof value === 'string') contains = value.includes(expected);
      else if (Array.isArray(value))
        contains = value.some((item) => deepEqual(item, jsonOrText(expected)));
      else if (value !== null && typeof value === 'object')
        contains = Object.hasOwn(value, expected);
      else throw unsupported();
      return operator === 'contains' ? contains : !contains;
    }
    if (typeof value !== 'string') throw unsupported();
    if (operator === 'starts-with') return value.startsWith(expected);
    if (operator === 'ends-with') return value.endsWith(expected);
    const matches = new RegExp(expected).test(value);
    return operator === 'matches' ? matches : !matches;
  }

  function hint(operator: string): string {
    if (operator === 'contains' || operator === 'not-contains')
      return 'Strings: case-sensitive substring. Arrays: matching item (JSON or plain text; quote numeric strings, e.g. "42"). Objects: exact key.';
    if (operator === 'equal' || operator === 'not-equal')
      return 'Uses the incoming type: numbers, true/false, exact case-sensitive text, or JSON for deep array/object equality. Numeric-looking strings stay text.';
    if (operator.includes('greater') || operator.includes('less'))
      return 'Numeric comparison. Numbers and numeric strings are accepted only when both sides are valid finite numbers.';
    if (operator === 'matches' || operator === 'not-matches')
      return 'Strings only. Enter a case-sensitive regular expression without / delimiters, e.g. ^premium or sale$.';
    if (operator.includes('empty'))
      return 'Empty means an empty string, array, or object. Whitespace, 0, and false are not empty. Null and missing data need their own checks.';
    if (operator.includes('exists') || operator.includes('null'))
      return 'Exists includes null. Is null and Is not null require a resolved path; missing data matches neither.';
    if (operator === 'is-true' || operator === 'is-false')
      return 'Boolean data only; strings such as "true" are not booleans.';
    return 'Strings only. Exact, case-sensitive text comparison.';
  }

  return {
    usesIncomingValue,
    validateElementValue,
    elementValue,
    operators,
    needsValue,
    parsePath,
    select,
    validateResponse,
    parseResponse,
    validateCondition,
    evaluate,
    hint,
  };
}

export type DataOperator = keyof ReturnType<typeof createDataTools>['operators'];
export const dataTools = createDataTools();
