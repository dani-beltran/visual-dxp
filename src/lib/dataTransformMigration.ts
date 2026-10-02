import type { ConnectionMapping } from './connectionMapping';
import type { StepConfig, Workflow, WorkflowEdge, WorkflowNode } from './types';

/** Non-mutating and idempotent import migration. */
export function migrateDataTransforms(workflow: Workflow, legacyNodes = true): Workflow {
  const nodeMap = new Map(workflow.nodes.map((node) => [node.id, node]));
  const ids = new Set([...workflow.nodes, ...workflow.edges].map((entry) => entry.id));
  const uniqueId = (base: string) => {
    base = base.slice(0, 180);
    let id = base;
    let index = 1;
    while (ids.has(id)) id = `${base}-${index++}`;
    ids.add(id);
    return id;
  };
  const configs = new Map<string, StepConfig>();
  const edit = (node: WorkflowNode) => {
    const config = configs.get(node.id) ?? { ...node.data.config };
    configs.set(node.id, config);
    return config;
  };
  const added: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];
  let changed = false;
  function insert(edge: WorkflowEdge, config: StepConfig, index: number) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    const parentId = source?.parentId === target?.parentId ? source?.parentId : undefined;
    const absolute = (node?: WorkflowNode) => {
      const parent = node?.parentId ? nodeMap.get(node.parentId) : undefined;
      return {
        x: (node?.position.x ?? 0) + (parent?.position.x ?? 0),
        y: (node?.position.y ?? 0) + (parent?.position.y ?? 0),
      };
    };
    const a = parentId && source ? source.position : absolute(source);
    const b = parentId && target ? target.position : absolute(target);
    const id = uniqueId(`transform-${edge.id}-${index}`);
    added.push({
      id,
      type: 'workflow',
      ...(parentId ? { parentId } : {}),
      position: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + (index - 1) * 160 },
      data: { kind: 'transform', label: 'Data Transform', config },
    });
    nodeMap.set(id, added[added.length - 1]);
    const { data, ...rest } = edge;
    const cleanData = data ? { ...data } : undefined;
    if (cleanData) delete cleanData.mapping;
    edges.push({
      ...rest,
      id: uniqueId(`${edge.id}-transform-${index}`),
      target: id,
      targetHandle: null,
      label: undefined,
      ...(cleanData && Object.keys(cleanData).length ? { data: cleanData } : {}),
    });
    return {
      ...rest,
      source: id,
      sourceHandle: null,
      ...(cleanData && Object.keys(cleanData).length ? { data: cleanData } : {}),
    };
  }
  for (const original of workflow.edges) {
    const source = nodeMap.get(original.source);
    const target = nodeMap.get(original.target);
    let mapping: ConnectionMapping | undefined = original.data?.mapping;
    if (legacyNodes) {
      const responsePath =
        source?.data.kind === 'http' ? source.data.config.responseDataPath : undefined;
      const targetKey =
        target?.data.kind === 'dom' &&
        target.data.config.valueSource === 'incoming-data' &&
        !['hide', 'show'].includes(target.data.config.action ?? 'text')
          ? 'valueDataPath'
          : target?.data.kind === 'fork' && target.data.config.conditionType === 'data'
            ? 'conditionDataPath'
            : undefined;
      const targetPath = targetKey ? target?.data.config[targetKey] : undefined;
      if (responsePath !== undefined || targetPath !== undefined) {
        mapping = {
          sourcePath: targetPath ?? '',
          targetInput:
            targetKey === 'valueDataPath'
              ? 'value'
              : targetKey === 'conditionDataPath'
                ? 'condition'
                : 'data',
          ...(responsePath === undefined ? {} : { responseDataPath: responsePath }),
          ...mapping,
        };
        if (source && responsePath !== undefined) delete edit(source).responseDataPath;
        if (target && targetKey && targetPath !== undefined) delete edit(target)[targetKey];
      }
    }
    if (!mapping) {
      edges.push(original);
      continue;
    }
    changed = true;
    let edge = original;
    let index = 1;
    if (mapping.responseDataPath !== undefined) {
      edge = insert(
        edge,
        {
          dataPath: mapping.responseDataPath,
          transformations: [],
          legacyJsonOnly: true,
          ...(source?.data.kind !== 'http'
            ? {
                migrationWarning:
                  'The imported response selection requires an HTTP source. Reconnect this Data Transform before reviewing the migration.',
              }
            : {}),
        },
        index++,
      );
    }
    const config: StepConfig = { dataPath: mapping.sourcePath, transformations: [] };
    const active =
      mapping.targetInput === 'data' ||
      (mapping.targetInput === 'value' &&
        target?.data.kind === 'dom' &&
        ((!['hide', 'show'].includes(target.data.config.action ?? 'text') &&
          (target.data.config.valueSource === 'incoming-data' ||
            /\{\{/.test(target.data.config.value ?? ''))) ||
          /\{\{/.test(target.data.config.selector ?? '') ||
          (target.data.config.action === 'attribute' &&
            /\{\{/.test(target.data.config.attribute ?? '')))) ||
      (mapping.targetInput === 'condition' &&
        target?.data.kind === 'fork' &&
        target.data.config.conditionType === 'data');
    if (!active)
      config.migrationWarning = `The imported ${String(mapping.targetInput)} selection (${JSON.stringify(mapping.sourcePath)}) was inactive or incompatible. Review the Data Transform and destination configuration before using the selected value.`;
    else if (
      mapping.targetInput !== 'data' &&
      mapping.sourcePath?.trim() &&
      workflow.edges.some((entry) => entry.source === original.target)
    )
      config.migrationWarning = `The imported ${mapping.targetInput} mapping used ${JSON.stringify(mapping.sourcePath)} but forwarded the original data after “${target?.data.label ?? original.target}”. Data Transform forwards the selected value. Review downstream steps, then confirm this selection or rewire the workflow to retain the original data.`;
    if (mapping.sourcePath !== '' || config.migrationWarning || index === 1)
      edge = insert(edge, config, index);
    const clean = { ...edge.data };
    delete clean.mapping;
    const { data: _data, ...rest } = edge;
    edges.push({ ...rest, ...(Object.keys(clean).length ? { data: clean } : {}) });
  }
  if (legacyNodes) {
    // Disconnected active paths become explicit nodes too; dormant paths require review.
    for (const node of workflow.nodes) {
      const config = configs.get(node.id) ?? node.data.config;
      if (
        node.data.kind === 'http' &&
        config.responseDataPath !== undefined &&
        !workflow.edges.some((edge) => edge.source === node.id)
      ) {
        const id = uniqueId(`transform-${node.id}`);
        added.push({
          id,
          type: 'workflow',
          position: { x: node.position.x + 300, y: node.position.y },
          ...(node.parentId ? { parentId: node.parentId } : {}),
          data: {
            kind: 'transform',
            label: 'Data Transform',
            config: {
              dataPath: config.responseDataPath,
              transformations: [],
              legacyJsonOnly: true,
            },
          },
        });
        edges.push({
          id: uniqueId(`${node.id}-transform`),
          source: node.id,
          target: id,
          type: 'smoothstep',
        });
        delete edit(node).responseDataPath;
        changed = true;
      }
      for (const key of ['valueDataPath', 'conditionDataPath'] as const) {
        if (config[key] === undefined) continue;
        const active =
          key === 'valueDataPath'
            ? node.data.kind === 'dom' &&
              config.valueSource === 'incoming-data' &&
              !['hide', 'show'].includes(config.action ?? 'text')
            : node.data.kind === 'fork' && config.conditionType === 'data';
        if (active && !workflow.edges.some((edge) => edge.target === node.id)) {
          const id = uniqueId(`transform-${node.id}`);
          added.push({
            id,
            type: 'workflow',
            position: { x: node.position.x - 300, y: node.position.y },
            ...(node.parentId ? { parentId: node.parentId } : {}),
            data: {
              kind: 'transform',
              label: 'Data Transform',
              config: { dataPath: config[key], transformations: [] },
            },
          });
          edges.push({
            id: uniqueId(`transform-${node.id}-input`),
            source: id,
            target: node.id,
            type: 'smoothstep',
          });
        } else if (config[key]?.trim())
          edit(node).migrationWarning =
            `A dormant legacy ${key} selection (${JSON.stringify(config[key])}) needs review. Add a Data Transform with this path if the step should use it, then confirm the reviewed configuration.`;
        delete edit(node)[key];
        changed = true;
      }
      if (
        node.data.kind === 'dom' &&
        ['manual', 'incoming-data'].includes(config.valueSource ?? '')
      ) {
        const next = edit(node);
        if (next.valueSource === 'incoming-data') next.value = '{{$}}';
        delete next.valueSource;
        changed = true;
      }
    }
  }
  if (!changed) return workflow;
  return {
    ...workflow,
    edges,
    nodes: [
      ...workflow.nodes.map((node) =>
        configs.has(node.id)
          ? { ...node, data: { ...node.data, config: configs.get(node.id) ?? node.data.config } }
          : node,
      ),
      ...added,
    ],
  };
}
