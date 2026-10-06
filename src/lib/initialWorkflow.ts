import { createEmptyWorkflow } from './catalog';
import type { BuilderTranslator } from './i18n';
import { isWorkflow } from './serialization';
import type { Workflow } from './types';

/** Preserve the existing precedence: valid saved data, explicit input, then a fresh blank. */
export function restoreWorkflow(
  initial: Workflow | undefined,
  key: string | undefined,
  t: BuilderTranslator,
): Workflow {
  let workflow = initial;
  if (key) {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(key) || 'null');
      if (isWorkflow(saved)) workflow = saved;
    } catch {
      /* Fall back without deleting storage. */
    }
  }
  const value = workflow ?? createEmptyWorkflow(t);
  return { ...structuredClone(value), includeSubpages: value.includeSubpages ?? false };
}
