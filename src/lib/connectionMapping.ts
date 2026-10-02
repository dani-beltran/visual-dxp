import type { DataSelection } from './data';

/** Legacy import schema only. New connections carry data without selecting fields. */
export interface ConnectionMapping {
  sourcePath: string;
  targetInput: 'data' | 'value' | 'condition';
  /** Compatibility selection applied only to successful JSON HTTP responses, before sourcePath. */
  responseDataPath?: string;
}

export type ConnectionData = { mapping?: ConnectionMapping; [key: string]: unknown };
export interface ConnectionPreview {
  source: DataSelection;
  /** Distinguishes JSON strings from non-JSON text and request failures. */
  jsonResponse: boolean;
}

export function isConnectionMapping(value: unknown): value is ConnectionMapping {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const mapping = value as Record<string, unknown>;
  return (
    typeof mapping.sourcePath === 'string' &&
    ['data', 'value', 'condition'].includes(mapping.targetInput as string) &&
    (mapping.responseDataPath === undefined || typeof mapping.responseDataPath === 'string')
  );
}

/** @deprecated Use migrateDataTransforms; retained as an import migration entry point. */
export { migrateDataTransforms as migrateConnectionMappings } from './dataTransformMigration';
