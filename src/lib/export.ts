import { buildCookie } from './cookies';
import { getDateRange } from './dateRange';
import { isNoteMarks } from './noteText';
import { getRuntimeSource } from './runtime';
import { type ExportOptions, matchesTargetUrl, validateExportTarget } from './targeting';
import { getTimeRange } from './timeRange';
import { elementTriggerEvents, validateTriggerConfig } from './triggers';
import type { ValidationIssue, Workflow } from './types';

export function validateWorkflow(workflow: Workflow): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // JSON importers and JavaScript consumers can bypass TypeScript. Report bad
  // input instead of throwing while the editor is trying to display issues.
  if (
    !workflow ||
    typeof workflow !== 'object' ||
    !Array.isArray(workflow.nodes) ||
    !Array.isArray(workflow.edges)
  ) {
    return [{ message: 'A workflow must contain arrays of steps and connections.' }];
  }
  if (
    workflow.nodes.some(
      (node) =>
        !node ||
        typeof node.id !== 'string' ||
        !node.data ||
        typeof node.data !== 'object' ||
        typeof node.data.kind !== 'string' ||
        typeof node.data.label !== 'string' ||
        !node.data.config ||
        typeof node.data.config !== 'object' ||
        Array.isArray(node.data.config),
    )
  ) {
    return [{ message: 'Every step must have an ID, type, label, and configuration object.' }];
  }
  if (
    workflow.edges.some(
      (edge) =>
        !edge ||
        typeof edge.id !== 'string' ||
        typeof edge.source !== 'string' ||
        typeof edge.target !== 'string' ||
        (edge.sourceHandle != null && typeof edge.sourceHandle !== 'string'),
    )
  ) {
    return [
      { message: 'Every connection must have an ID, source, target, and valid output handle.' },
    ];
  }
  const knownKinds = new Set([
    'trigger',
    'http',
    'dom',
    'cookie',
    'delay',
    'fork',
    'loop',
    'popover',
    'note',
    'frame',
  ]);
  const ids = new Set<string>();
  const nodeMap = new Map(workflow.nodes.map((node) => [node.id, node]));
  const add = (message: string, nodeId?: string) =>
    issues.push({ message, ...(nodeId ? { nodeId } : {}) });
  const selector = (value: string | undefined, nodeId: string, message: string) => {
    if (!value?.trim()) {
      add(message, nodeId);
      return;
    }
    if (typeof document !== 'undefined') {
      try {
        document.querySelector(value);
      } catch {
        add(`Invalid CSS selector: ${value}`, nodeId);
      }
    }
  };
  const url = (
    value: string | undefined,
    nodeId: string,
    message: string,
    allowRelative = false,
  ) => {
    try {
      if (!value?.trim()) throw new Error();
      const parsed = new URL(value, allowRelative ? 'https://example.invalid/' : undefined);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      add(message, nodeId);
    }
  };
  if (workflow.includeSubpages !== undefined && typeof workflow.includeSubpages !== 'boolean')
    add('Include subpages must be a boolean.');
  if (workflow.version !== 1) add('This workflow version is not supported.');
  if (!workflow.nodes.length) add('Add a trigger and a step to get started.');
  if (!workflow.nodes.some((node) => node.data.kind === 'trigger'))
    add('Add at least one trigger.');
  for (const node of workflow.nodes) {
    const config = node.data.config;
    if (!node.id || ids.has(node.id)) add('Every step must have a unique ID.', node.id);
    ids.add(node.id);
    if (!knownKinds.has(node.data.kind)) add('Unknown step type.', node.id);
    if (
      node.parentId !== undefined &&
      (node.data.kind === 'frame' || nodeMap.get(node.parentId)?.data.kind !== 'frame')
    )
      add('Nodes must belong to an existing top-level frame.', node.id);
    if (
      node.data.kind === 'frame' &&
      [node.width, node.height].some(
        (size) => size !== undefined && (!Number.isFinite(size) || size <= 0),
      )
    )
      add('Frame dimensions must be positive numbers.', node.id);
    const textFields = [
      'event',
      'selector',
      'url',
      'method',
      'headers',
      'body',
      'action',
      'value',
      'attribute',
      'cookieName',
      'cookieValue',
      'condition',
      'conditionType',
      'conditionKey',
      'conditionValue',
      'conditionStartDate',
      'conditionEndDate',
      'conditionStartTime',
      'conditionEndTime',
      'conditionTimeZone',
      'contentType',
      'content',
      'position',
      'noteText',
      'noteColor',
    ] as const;
    if (
      textFields.some((field) => config[field] !== undefined && typeof config[field] !== 'string')
    ) {
      add('Step text parameters must contain strings.', node.id);
      continue;
    }
    if (
      config.noteMarks !== undefined &&
      !isNoteMarks(config.noteMarks, (config.noteText ?? '').length)
    )
      add(
        'Note text formatting must use sorted, nonoverlapping ranges within the note text.',
        node.id,
      );
    switch (node.data.kind) {
      case 'cookie':
        try {
          buildCookie(config);
        } catch (error) {
          add((error as Error).message, node.id);
        }
        break;
      case 'note':
        if (
          (['noteBold', 'noteItalic', 'noteStrikethrough'] as const).some(
            (field) => config[field] !== undefined && typeof config[field] !== 'boolean',
          )
        )
          add('Note text formatting must contain boolean values.', node.id);
        if (
          config.noteColor !== undefined &&
          config.noteColor !== 'transparent' &&
          !/^#[\da-f]{6}$/i.test(config.noteColor)
        )
          add('Note colors must be a six-digit hex color or transparent.', node.id);
        break;
      case 'trigger':
        for (const message of validateTriggerConfig(config)) add(message, node.id);
        if (elementTriggerEvents.includes(config.event ?? 'page-load'))
          selector(config.selector, node.id, 'Choose a target element for this trigger.');
        break;
      case 'http':
        url(config.url, node.id, 'Enter a valid HTTP or HTTPS request URL.', true);
        if (
          config.method &&
          !['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(
            config.method.toUpperCase(),
          )
        )
          add('Choose a supported HTTP method.', node.id);
        if (config.headers?.trim()) {
          try {
            const parsed: unknown = JSON.parse(config.headers);
            if (
              !parsed ||
              typeof parsed !== 'object' ||
              Array.isArray(parsed) ||
              Object.values(parsed).some((value) => typeof value !== 'string')
            )
              throw new Error();
          } catch {
            add('Headers must be a JSON object with string values.', node.id);
          }
        }
        break;
      case 'dom':
        selector(config.selector, node.id, 'Choose an element to update.');
        if (
          config.action &&
          !['text', 'html', 'add-class', 'remove-class', 'hide', 'show', 'attribute'].includes(
            config.action,
          )
        )
          add('Choose a supported element action.', node.id);
        if (config.action === 'attribute' && !config.attribute?.trim())
          add('Enter an attribute name.', node.id);
        break;
      case 'delay':
        if (
          config.duration !== undefined &&
          (!Number.isFinite(config.duration) || config.duration < 0 || config.duration > 86400000)
        )
          add('Delay must be between 0 and 86,400,000 milliseconds.', node.id);
        break;
      case 'fork':
        switch (config.conditionType ?? 'selector') {
          case 'time-of-day':
            try {
              getTimeRange(config);
            } catch (error) {
              add((error as Error).message, node.id);
            }
            break;
          case 'date-range':
            try {
              getDateRange(config);
            } catch (error) {
              add((error as Error).message, node.id);
            }
            break;
          case 'selector':
            selector(config.condition, node.id, 'Choose a CSS selector for the branch condition.');
            break;
          case 'device':
            if (!['desktop', 'mobile'].includes(config.conditionValue ?? ''))
              add('Choose desktop or mobile for the device condition.', node.id);
            break;
          case 'language':
            try {
              if (!config.conditionValue?.trim()) throw new Error();
              Intl.getCanonicalLocales(config.conditionValue.trim());
            } catch {
              add('Enter a language code such as en, es, or en-US.', node.id);
            }
            break;
          case 'referrer':
            try {
              const value = config.conditionValue?.trim() ?? '';
              const isUrl = /^https?:\/\//i.test(value);
              if (!value || (!isUrl && /[\s/\\?#@:]/.test(value))) throw new Error();
              // Accept saved URL conditions, comparing only their hostname.
              const parsed = new URL(isUrl ? value : `https://${value}`);
              const domain = parsed.hostname.replace(/\.$/, '');
              if (
                parsed.username ||
                parsed.password ||
                !domain ||
                domain.length > 253 ||
                domain
                  .split('.')
                  .some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
              )
                throw new Error();
            } catch {
              add('Enter a valid referrer domain such as example.com.', node.id);
            }
            break;
          case 'query-param':
          case 'cookie':
            if (!config.conditionKey?.trim())
              add('Enter a name for the condition variable.', node.id);
            if (config.conditionValue === undefined)
              add(
                'Enter an expected value for the condition (an empty string is allowed).',
                node.id,
              );
            break;
          default:
            add('Choose a supported condition type.', node.id);
        }
        break;
      case 'loop':
        if (
          config.iterations !== undefined &&
          (!Number.isInteger(config.iterations) ||
            config.iterations < 1 ||
            config.iterations > 1000)
        )
          add('Repeat count must be an integer from 1 to 1,000.', node.id);
        break;
      case 'popover':
        if (config.contentType && !['html', 'iframe'].includes(config.contentType))
          add('Choose HTML or an iframe for the popover content.', node.id);
        if (
          config.position &&
          !['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'anchor'].includes(
            config.position,
          )
        )
          add('Choose a supported popover position.', node.id);
        if (config.contentType === 'iframe')
          url(config.url, node.id, 'Enter a valid HTTP or HTTPS URL for the popover iframe.');
        if (config.position === 'anchor')
          selector(config.selector, node.id, 'Choose an anchor element for the popover.');
        if (
          config.width !== undefined &&
          (!Number.isFinite(config.width) || config.width < 240 || config.width > 960)
        )
          add('Popover width must be between 240 and 960 pixels.', node.id);
        break;
    }
  }
  const edgeIds = new Set<string>();
  for (const edge of workflow.edges) {
    if (edgeIds.has(edge.id)) add('Every connection must have a unique ID.');
    edgeIds.add(edge.id);
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) {
      add('A connection refers to a missing step.');
      continue;
    }
    if (source.data.kind === 'note' || target.data.kind === 'note') {
      add(
        'Notes cannot have workflow connections.',
        source.data.kind === 'note' ? source.id : target.id,
      );
      continue;
    }
    if (source.data.kind === 'frame' || target.data.kind === 'frame') {
      add(
        'Frames cannot have workflow connections.',
        source.data.kind === 'frame' ? source.id : target.id,
      );
      continue;
    }
    if (target.data.kind === 'trigger')
      add('Triggers cannot receive incoming connections.', target.id);
    if (source.data.kind === 'fork' && !['true', 'false'].includes(edge.sourceHandle ?? ''))
      add('Connect branches using the Yes or No outputs.', source.id);
    if (source.data.kind === 'loop' && !['body', 'done'].includes(edge.sourceHandle ?? ''))
      add('Connect repeats using the Repeat or Done outputs.', source.id);
  }
  const pending = new Map(workflow.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, string[]>();
  for (const edge of workflow.edges) {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) continue;
    pending.set(edge.target, pending.get(edge.target)! + 1);
    const targets = outgoing.get(edge.source) ?? [];
    targets.push(edge.target);
    outgoing.set(edge.source, targets);
  }
  const ready = Array.from(pending.keys()).filter((nodeId) => pending.get(nodeId) === 0);
  let visited = 0;
  // Kahn's algorithm avoids overflowing the call stack on imported graphs.
  for (let index = 0; index < ready.length; index += 1) {
    const nodeId = ready[index];
    visited += 1;
    for (const target of outgoing.get(nodeId) ?? []) {
      const count = pending.get(target)! - 1;
      pending.set(target, count);
      if (count === 0) ready.push(target);
    }
  }
  if (visited !== pending.size)
    add(
      'Circular connections are not supported. Use a Repeat step with separate Repeat and Done outputs.',
    );
  return issues;
}

/** Create a dependency-free script to load on the target website. */
export function exportWorkflow(workflow: Workflow, options: ExportOptions = {}): string {
  const target = validateExportTarget(workflow, options);
  const issues = validateWorkflow(workflow);
  if (issues.length) throw new Error(issues.map((issue) => issue.message).join('\n'));
  const annotations = new Set(
    workflow.nodes
      .filter((node) => node.data.kind === 'note' || node.data.kind === 'frame')
      .map((node) => node.id),
  );
  // Export configuration only: editor positions, selection, and transient status
  // are unnecessary in a production snippet.
  const definition = {
    version: workflow.version,
    name: workflow.name,
    websiteUrl: target.href,
    includeSubpages: workflow.includeSubpages ?? false,
    nodes: workflow.nodes
      .filter((node) => !annotations.has(node.id))
      .map(({ id, data }) => ({
        id,
        data: { kind: data.kind, label: data.label, config: data.config },
      })),
    edges: workflow.edges
      .filter((edge) => !annotations.has(edge.source) && !annotations.has(edge.target))
      .map(({ id, source, target, sourceHandle }) => ({
        id,
        source,
        target,
        sourceHandle,
      })),
  };
  const json = JSON.stringify(definition, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `/* Visual DXP — generated workflow. Load this script on your target website. */\n(() => {\n  "use strict";\n  const workflow = ${json};\n  const matchesTargetUrl = ${matchesTargetUrl.toString()};\n  if (!matchesTargetUrl(workflow.websiteUrl, window.location.href, workflow.includeSubpages)) return;\n  const createRuntime = ${getRuntimeSource()};\n  if (window.dlbDXP && typeof window.dlbDXP.destroy === "function") window.dlbDXP.destroy();\n  window.dlbDXP = createRuntime(workflow);\n  window.dlbDXP.start();\n})();\n`;
}
