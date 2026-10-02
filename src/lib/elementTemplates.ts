import type { Workflow } from './types';

/** Legacy standalone template migration. The builder uses Data Transform migration first. */
export function migrateElementTemplates(workflow: Workflow): Workflow {
  let changed = false;
  const nodes = workflow.nodes.map((node) => {
    if (node.data.kind !== 'dom' || node.data.config.valueSource === undefined) return node;
    const config = { ...node.data.config };
    // Unknown legacy modes remain visible to validation instead of being silently repaired.
    if (!['manual', 'incoming-data'].includes(config.valueSource ?? '')) return node;
    if (config.valueSource === 'incoming-data') {
      const path = config.valueDataPath?.trim();
      config.value = path ? `{{$${path.startsWith('[') ? '' : '.'}${path}}}` : '{{$}}';
    }
    delete config.valueSource;
    delete config.valueDataPath;
    changed = true;
    return { ...node, data: { ...node.data, config } };
  });
  return changed ? { ...workflow, nodes } : workflow;
}
