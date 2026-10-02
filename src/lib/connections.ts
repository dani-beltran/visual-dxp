import type { DataSelection } from './data';

export type ConnectionData = Record<string, unknown>;

export interface ConnectionPreview {
  source: DataSelection;
}
