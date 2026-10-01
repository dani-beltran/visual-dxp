import { buildCookie } from './cookies';
import { dataTools } from './data';
import { getDateRange } from './dateRange';
import { type BuilderTranslator, formatBuilderError, translateEnglish } from './i18n';
import { isNoteMarks } from './noteText';
import { getRuntimeSource } from './runtime';
import { type ExportOptions, matchesTargetUrl, validateExportTarget } from './targeting';
import { getTimeRange } from './timeRange';
import { elementTriggerEvents, validateTriggerConfig } from './triggers';
import type { ValidationIssue, Workflow } from './types';

export function validateWorkflow(
  workflow: Workflow,
  t: BuilderTranslator = translateEnglish,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // JSON importers and JavaScript consumers can bypass TypeScript. Report bad
  // input instead of throwing while the editor is trying to display issues.
  if (
    !workflow ||
    typeof workflow !== 'object' ||
    !Array.isArray(workflow.nodes) ||
    !Array.isArray(workflow.edges)
  ) {
    return [{ message: t('validation.aWorkflowMustContainArraysOfStepsAndConnections') }];
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
    return [{ message: t('validation.everyStepMustHaveAnIdTypeLabelAndConfiguration') }];
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
    return [{ message: t('validation.everyConnectionMustHaveAnIdSourceTargetAndValid') }];
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
  const add = (message: string, nodeId?: string, code?: string) =>
    issues.push({ message, ...(nodeId ? { nodeId } : {}), ...(code ? { code } : {}) });
  const selector = (value: string | undefined, nodeId: string, message: string) => {
    if (!value?.trim()) {
      add(message, nodeId);
      return;
    }
    if (typeof document !== 'undefined') {
      try {
        document.querySelector(value);
      } catch {
        add(t('validation.invalidSelector', { value }), nodeId);
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
    add(t('validation.includeSubpagesMustBeABoolean'));
  if (workflow.version !== 1) add(t('validation.thisWorkflowVersionIsNotSupported'));
  if (!workflow.nodes.length) add(t('validation.addATriggerAndAStepToGetStarted'));
  if (!workflow.nodes.some((node) => node.data.kind === 'trigger'))
    add(t('validation.addAtLeastOneTrigger'));
  for (const node of workflow.nodes) {
    const config = node.data.config;
    if (!node.id || ids.has(node.id)) add(t('validation.everyStepMustHaveAUniqueId'), node.id);
    ids.add(node.id);
    if (!knownKinds.has(node.data.kind)) add(t('validation.unknownStepType'), node.id);
    if (
      node.parentId !== undefined &&
      (node.data.kind === 'frame' || nodeMap.get(node.parentId)?.data.kind !== 'frame')
    )
      add(t('validation.nodesMustBelongToAnExistingTopLevelFrame'), node.id);
    if (
      node.data.kind === 'frame' &&
      [node.width, node.height].some(
        (size) => size !== undefined && (!Number.isFinite(size) || size <= 0),
      )
    )
      add(t('validation.frameDimensionsMustBePositiveNumbers'), node.id);
    const textFields = [
      'event',
      'commercePlatform',
      'selector',
      'url',
      'method',
      'headers',
      'body',
      'responseDataPath',
      'action',
      'value',
      'valueSource',
      'valueDataPath',
      'attribute',
      'cookieName',
      'cookieValue',
      'condition',
      'conditionType',
      'conditionDataPath',
      'conditionOperator',
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
      add(t('validation.stepTextParametersMustContainStrings'), node.id);
      continue;
    }
    if (
      config.noteMarks !== undefined &&
      !isNoteMarks(config.noteMarks, (config.noteText ?? '').length)
    )
      add(t('validation.noteTextFormattingMustUseSortedNonoverlappingRangesWithinThe'), node.id);
    switch (node.data.kind) {
      case 'cookie':
        try {
          buildCookie(config);
        } catch (error) {
          add(formatBuilderError(error, t), node.id);
        }
        break;
      case 'note':
        if (
          (['noteBold', 'noteItalic', 'noteStrikethrough'] as const).some(
            (field) => config[field] !== undefined && typeof config[field] !== 'boolean',
          )
        )
          add(t('validation.noteTextFormattingMustContainBooleanValues'), node.id);
        if (
          config.noteColor !== undefined &&
          config.noteColor !== 'transparent' &&
          !/^#[\da-f]{6}$/i.test(config.noteColor)
        )
          add(t('validation.noteColorsMustBeASixDigitHexColorOr'), node.id);
        break;
      case 'trigger':
        for (const message of validateTriggerConfig(config, t)) add(message, node.id);
        if (elementTriggerEvents.includes(config.event ?? 'page-load'))
          selector(config.selector, node.id, t('validation.chooseATargetElementForThisTrigger'));
        break;
      case 'http':
        try {
          dataTools.validateResponse(config);
        } catch (error) {
          add((error as Error).message, node.id);
        }
        url(config.url, node.id, t('validation.enterAValidHttpOrHttpsRequestUrl'), true);
        if (
          config.method &&
          !['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(
            config.method.toUpperCase(),
          )
        )
          add(t('validation.chooseASupportedHttpMethod'), node.id);
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
            add(t('validation.headersMustBeAJsonObjectWithStringValues'), node.id);
          }
        }
        break;
      case 'dom':
        try {
          dataTools.validateElementValue(config);
        } catch (error) {
          add((error as Error).message, node.id);
        }
        selector(config.selector, node.id, t('validation.chooseAnElementToUpdate'));
        if (
          config.action &&
          !['text', 'html', 'add-class', 'remove-class', 'hide', 'show', 'attribute'].includes(
            config.action,
          )
        )
          add(t('validation.chooseASupportedElementAction'), node.id);
        if (config.action === 'attribute' && !config.attribute?.trim())
          add(t('validation.enterAnAttributeName'), node.id);
        break;
      case 'delay':
        if (
          config.duration !== undefined &&
          (!Number.isFinite(config.duration) || config.duration < 0 || config.duration > 86400000)
        )
          add(t('validation.delayMustBeBetween0And86400000Milliseconds'), node.id);
        break;
      case 'fork':
        switch (config.conditionType ?? 'selector') {
          case 'data':
            try {
              dataTools.validateCondition(config);
            } catch (error) {
              add((error as Error).message, node.id);
            }
            break;
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
            selector(
              config.condition,
              node.id,
              t('validation.chooseACssSelectorForTheBranchCondition'),
            );
            break;
          case 'device':
            if (!['desktop', 'mobile'].includes(config.conditionValue ?? ''))
              add(t('validation.chooseDesktopOrMobileForTheDeviceCondition'), node.id);
            break;
          case 'language':
            try {
              if (!config.conditionValue?.trim()) throw new Error();
              Intl.getCanonicalLocales(config.conditionValue.trim());
            } catch {
              add(t('validation.enterALanguageCodeSuchAsEnEsOrEn'), node.id);
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
              add(t('validation.enterAValidReferrerDomainSuchAsExampleCom'), node.id);
            }
            break;
          case 'query-param':
          case 'cookie':
            if (!config.conditionKey?.trim())
              add(t('validation.enterANameForTheConditionVariable'), node.id);
            if (config.conditionValue === undefined)
              add(t('validation.enterAnExpectedValueForTheConditionAnEmptyString'), node.id);
            break;
          default:
            add(t('validation.chooseASupportedConditionType'), node.id);
        }
        break;
      case 'loop':
        if (
          config.iterations !== undefined &&
          (!Number.isInteger(config.iterations) ||
            config.iterations < 1 ||
            config.iterations > 1000)
        )
          add(t('validation.repeatCountMustBeAnIntegerFrom1To1'), node.id);
        break;
      case 'popover':
        if (config.contentType && !['html', 'iframe'].includes(config.contentType))
          add(t('validation.chooseHtmlOrAnIframeForThePopoverContent'), node.id);
        if (
          config.position &&
          !['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'anchor'].includes(
            config.position,
          )
        )
          add(t('validation.chooseASupportedPopoverPosition'), node.id);
        if (config.contentType === 'iframe')
          url(config.url, node.id, t('validation.enterAValidHttpOrHttpsUrlForThePopover'));
        if (config.position === 'anchor')
          selector(config.selector, node.id, t('validation.chooseAnAnchorElementForThePopover'));
        if (
          config.width !== undefined &&
          (!Number.isFinite(config.width) || config.width < 240 || config.width > 960)
        )
          add(t('validation.popoverWidthMustBeBetween240And960Pixels'), node.id);
        break;
    }
  }
  const edgeIds = new Set<string>();
  for (const edge of workflow.edges) {
    if (edgeIds.has(edge.id)) add(t('validation.everyConnectionMustHaveAUniqueId'));
    edgeIds.add(edge.id);
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) {
      add(t('validation.aConnectionRefersToAMissingStep'));
      continue;
    }
    if (source.data.kind === 'note' || target.data.kind === 'note') {
      add(
        t('validation.notesCannotHaveWorkflowConnections'),
        source.data.kind === 'note' ? source.id : target.id,
      );
      continue;
    }
    if (source.data.kind === 'frame' || target.data.kind === 'frame') {
      add(
        t('validation.framesCannotHaveWorkflowConnections'),
        source.data.kind === 'frame' ? source.id : target.id,
      );
      continue;
    }
    if (target.data.kind === 'trigger')
      add(t('validation.triggersCannotReceiveIncomingConnections'), target.id);
    if (source.data.kind === 'fork' && !['true', 'false'].includes(edge.sourceHandle ?? ''))
      add(t('validation.connectBranchesUsingTheYesOrNoOutputs'), source.id);
    if (source.data.kind === 'loop' && !['body', 'done'].includes(edge.sourceHandle ?? ''))
      add(t('validation.connectRepeatsUsingTheRepeatOrDoneOutputs'), source.id);
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
      t('validation.circularConnectionsAreNotSupportedUseARepeatStepWith'),
      undefined,
      'workflow.cycle',
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
  return `/* Visual DXP — generated workflow. Load this script on your target website. */\n(() => {\n  "use strict";\n  const workflow = ${json};\n  const matchesTargetUrl = ${matchesTargetUrl.toString()};\n  if (!matchesTargetUrl(workflow.websiteUrl, window.location.href, workflow.includeSubpages)) return;\n  const createRuntime = ${getRuntimeSource()};\n  if (window.visualDXP && typeof window.visualDXP.destroy === "function") window.visualDXP.destroy();\n  window.visualDXP = createRuntime(workflow);\n  window.visualDXP.start();\n})();\n`;
}
