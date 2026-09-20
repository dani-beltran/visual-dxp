import { createContext } from 'react';
import type { StepConfig } from './types';

// Keep editor callbacks out of the serializable workflow and its undo snapshots.
export const NoteEditingContext = createContext<(id: string, patch: Partial<StepConfig>) => void>(
  () => {},
);
