import { type DataSelection, dataTools } from './data';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
export type DataTransformation =
  | { type: 'capitalize' | 'lowercase' | 'uppercase' | 'title-case' | 'trim' }
  | { type: 'prefix' | 'suffix'; value: string }
  | { type: 'replace'; find: string; replacement: string }
  | { type: 'fallback'; value: JsonValue };
export interface DataTransformConfig {
  dataPath?: string;
  transformations?: DataTransformation[];
  /** Imported HTTP selections apply only to successful JSON responses. */
  legacyJsonOnly?: boolean;
  /** Blocks execution until the imported selection has been reviewed. */
  migrationWarning?: string;
}

/** Self-contained so the editor, runtime and exported script share the same rules. */
export function createDataTransformTools(data: Pick<typeof dataTools, 'parsePath' | 'select'>) {
  const types = [
    'capitalize',
    'lowercase',
    'uppercase',
    'title-case',
    'trim',
    'prefix',
    'suffix',
    'replace',
    'fallback',
  ] as const;
  function jsonValue(value: unknown, depth = 0): boolean {
    if (depth > 100) return false;
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (Array.isArray(value)) return value.every((item) => jsonValue(item, depth + 1));
    return (
      !!value &&
      typeof value === 'object' &&
      Object.getPrototypeOf(value) === Object.prototype &&
      Object.values(value).every((item) => jsonValue(item, depth + 1))
    );
  }
  function validate(config: DataTransformConfig, checkMigration = true, structural = false): void {
    data.parsePath(config.dataPath);
    if (config.legacyJsonOnly !== undefined && typeof config.legacyJsonOnly !== 'boolean')
      throw new Error('Imported JSON selection must be a boolean.');
    if (config.migrationWarning !== undefined && typeof config.migrationWarning !== 'string')
      throw new Error('Migration warning must be text.');
    if (checkMigration && config.migrationWarning) throw new Error(config.migrationWarning);
    if (config.transformations !== undefined && !Array.isArray(config.transformations))
      throw new Error('Transformations must be an ordered list.');
    if ((config.transformations?.length ?? 0) > 100)
      throw new Error('Use at most 100 transformations in one step.');
    for (const [index, transform] of (config.transformations ?? []).entries()) {
      const error = (message: string) => {
        throw new Error(`Transformation ${index + 1}: ${message}`);
      };
      if (!transform || typeof transform !== 'object' || !types.includes(transform.type))
        error('Choose a supported transformation.');
      if (
        (transform.type === 'prefix' || transform.type === 'suffix') &&
        typeof transform.value !== 'string'
      )
        error('Enter text to add.');
      if (
        transform.type === 'replace' &&
        (typeof transform.find !== 'string' ||
          (!structural && !transform.find.length) ||
          typeof transform.replacement !== 'string')
      )
        error('Enter nonempty text to find and replacement text (which may be empty).');
      if (transform.type === 'fallback' && !jsonValue(transform.value))
        error('Choose a JSON fallback value, including an empty string or null.');
    }
  }
  function apply(
    input: DataSelection,
    config: DataTransformConfig,
    jsonResponse = false,
    checkMigration = true,
  ): DataSelection {
    validate(config, checkMigration);
    let selected =
      config.legacyJsonOnly && !jsonResponse ? input : data.select(input, config.dataPath);
    if (selected.value === undefined) selected = { exists: false, value: undefined };
    for (const [index, transform] of (config.transformations ?? []).entries()) {
      if (transform.type === 'fallback') {
        if (!selected.exists || selected.value === null || selected.value === undefined)
          selected = { exists: true, value: transform.value };
        continue;
      }
      if (
        !selected.exists ||
        selected.value === undefined ||
        selected.value === null ||
        typeof selected.value !== 'string'
      ) {
        const type =
          !selected.exists || selected.value === undefined
            ? 'missing data'
            : selected.value === null
              ? 'null'
              : Array.isArray(selected.value)
                ? 'an array'
                : typeof selected.value === 'object'
                  ? 'an object'
                  : `a ${typeof selected.value}`;
        throw new Error(
          `Transformation ${index + 1} (${transform.type}) requires text; received ${type}. Select a text field${!selected.exists || selected.value == null ? ' or add a fallback before this transformation' : ''}.`,
        );
      }
      let value = selected.value;
      switch (transform.type) {
        case 'capitalize': {
          const characters = Array.from(value.toLowerCase());
          value = (characters.shift()?.toUpperCase() ?? '') + characters.join('');
          break;
        }
        case 'lowercase':
          value = value.toLowerCase();
          break;
        case 'uppercase':
          value = value.toUpperCase();
          break;
        case 'title-case':
          value = value
            .toLowerCase()
            .replace(/\p{L}[\p{L}\p{M}\p{N}]*(?:['’][\p{L}\p{M}\p{N}]+)*/gu, (word) => {
              const letters = Array.from(word);
              return (letters.shift()?.toUpperCase() ?? '') + letters.join('');
            });
          break;
        case 'trim':
          value = value.trim();
          break;
        case 'prefix':
          value = transform.value + value;
          break;
        case 'suffix':
          value += transform.value;
          break;
        case 'replace':
          value = value.split(transform.find).join(transform.replacement);
          break;
      }
      selected = { exists: true, value };
    }
    return selected;
  }
  return { types, validate, apply, jsonValue };
}
export const dataTransformTools = createDataTransformTools(dataTools);
