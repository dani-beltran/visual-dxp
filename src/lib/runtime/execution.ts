import type { createAnalyticsTools } from '../analytics';
import type { buildCookie } from '../cookies';
import type { createDataTools, DataSelection } from '../data';
import type { createDataTransformTools } from '../dataTransform';
import type { getDateRange } from '../dateRange';
import type { createExperimentTools } from '../experiment';
import type { placePopover } from '../popoverPosition';
import type { getTimeRange } from '../timeRange';
import type { Workflow } from '../types';
import type { getWeekdays } from '../weekdays';
import type { matchesCondition } from './conditions';
import type { RuntimeContext } from './context';
import type { createExperimentAnalytics } from './experiment-analytics';
import type { createPopoverElements, showPopover } from './popovers';
import type { WorkflowRuntime } from './types';
import type { createWorkflowAnalytics } from './workflow-analytics';

interface ExecutionModules {
  createAnalyticsTools: typeof createAnalyticsTools;
  createWorkflowAnalytics: typeof createWorkflowAnalytics;
  createExperimentTools: typeof createExperimentTools;
  createExperimentAnalytics: typeof createExperimentAnalytics;
  createDataTransformTools: typeof createDataTransformTools;
  createDataTools: typeof createDataTools;
  buildCookie: typeof buildCookie;
  matchesCondition: typeof matchesCondition;
  getDateRange: typeof getDateRange;
  getTimeRange: typeof getTimeRange;
  getWeekdays: typeof getWeekdays;
  createPopoverElements: typeof createPopoverElements;
  showPopover: typeof showPopover;
  placePopover: typeof placePopover;
}

export function createExecution(
  workflow: Workflow,
  context: RuntimeContext,
  {
    createAnalyticsTools,
    createWorkflowAnalytics,
    createExperimentTools,
    createExperimentAnalytics,
    buildCookie,
    matchesCondition,
    getDateRange,
    getTimeRange,
    getWeekdays,
    createPopoverElements,
    showPopover,
    placePopover,
    createDataTools,
    createDataTransformTools,
  }: ExecutionModules,
): WorkflowRuntime['run'] {
  const { doc, win, signal, nodes, fetcher, maxSteps, aborted, log, wait, selectorElements } =
    context;
  const experimentTools = createExperimentTools();
  const experimentAnalytics = createExperimentAnalytics(context, experimentTools);
  const workflowAnalytics = createWorkflowAnalytics(
    workflow,
    context,
    createAnalyticsTools(),
    experimentTools,
  );
  const dataTools = createDataTools();
  const transformTools = createDataTransformTools(dataTools);
  type RunState = {
    steps: number;
    active: Set<string>;
    hadError: boolean;
    analytics: ReturnType<typeof workflowAnalytics.begin>;
  };

  async function next(
    nodeId: string,
    state: RunState,
    data: DataSelection,
    handle?: string,
  ): Promise<void> {
    const edges = workflow.edges.filter(
      (edge) => edge.source === nodeId && (handle === undefined || edge.sourceHandle === handle),
    );
    for (const edge of edges) {
      const preview = { source: data };
      try {
        context.onConnectionPreview?.(edge.id, preview);
      } catch {
        /* Observers cannot interrupt execution. */
      }
      await execute(edge.target, state, data);
    }
  }

  async function execute(nodeId: string, state: RunState, input: DataSelection): Promise<void> {
    aborted();
    const node = nodes.get(nodeId);
    if (!node) throw new Error(`Step “${nodeId}” does not exist.`);
    // Imported graphs can bypass validation. An annotation never executes or
    // acts as a bridge to downstream steps, even if it has malformed connections.
    if (node.data.kind === 'note' || node.data.kind === 'frame') return;
    if (state.active.has(nodeId)) {
      const message = 'Circular connections are not supported. Use a Repeat step instead.';
      log(nodeId, 'error', message);
      throw new Error(message);
    }
    state.steps += 1;
    if (state.steps > maxSteps) {
      const message = `Execution stopped after ${maxSteps} steps. Check for cycles or excessive loops.`;
      log(nodeId, 'error', message);
      throw new Error(message);
    }
    state.active.add(nodeId);
    try {
      const config = node.data.config;
      // Data belongs to this path, never the shared runtime (runs may overlap).
      let output = input;
      let requestError: string | undefined;
      let selectedHandle: string | undefined;
      let loopIterations = 0;
      log(nodeId, 'running', 'Running step');
      try {
        switch (node.data.kind) {
          case 'transform':
            output = transformTools.apply(input, config);
            break;
          case 'cookie': {
            const cookie = buildCookie({
              ...config,
              cookieName:
                typeof config.cookieName === 'string'
                  ? dataTools.interpolate(config.cookieName, input, undefined, 'cookie name')
                  : config.cookieName,
              cookieValue:
                typeof config.cookieValue === 'string'
                  ? dataTools.interpolate(config.cookieValue, input)
                  : config.cookieValue,
            });
            try {
              doc.cookie = cookie + (win.location.protocol === 'https:' ? '; Secure' : '');
              const pair = cookie.split(';', 1)[0];
              if (!doc.cookie.split(';').some((entry) => entry.trim() === pair)) throw new Error();
            } catch {
              throw new Error(
                'The browser could not save this cookie. Check the website’s cookie settings.',
              );
            }
            break;
          }
          case 'track-event':
            state.analytics.custom(
              node,
              dataTools.requestTemplate(config.analyticsPayload ?? '', input, true),
            );
            break;
          case 'trigger':
            break;
          case 'delay': {
            const duration = config.duration ?? 1000;
            if (!Number.isFinite(duration) || duration < 0 || duration > 86400000)
              throw new Error('Delay must be between 0 and 86,400,000 milliseconds.');
            await wait(duration);
            break;
          }
          case 'http': {
            dataTools.validateRequest(config);
            if (!fetcher) throw new Error('This browser does not support fetch.');
            if (!config.url?.trim()) throw new Error('Enter a request URL.');
            const requestUrl = dataTools.requestTemplate(config.url, input);
            if (!requestUrl.trim()) throw new Error('Enter a request URL.');
            const url = new URL(requestUrl, doc.baseURI);
            if (!['http:', 'https:'].includes(url.protocol))
              throw new Error('Requests require an HTTP or HTTPS URL.');
            const headers = config.headers?.trim()
              ? (JSON.parse(dataTools.requestTemplate(config.headers, input, true)) as Record<
                  string,
                  string
                >)
              : {};
            if (
              !headers ||
              typeof headers !== 'object' ||
              Array.isArray(headers) ||
              Object.values(headers).some((value) => typeof value !== 'string')
            ) {
              throw new Error('Request headers must be a JSON object with string values.');
            }
            const method = (config.method ?? 'GET').toUpperCase();
            const requestBody =
              method === 'GET' || method === 'HEAD' || !config.body
                ? undefined
                : dataTools.requestTemplate(config.body, input, true);
            let body: string;
            try {
              const response = await fetcher(url.href, {
                method,
                headers,
                signal,
                ...(requestBody === undefined ? {} : { body: requestBody }),
              });
              if (!response.ok) {
                requestError = `Request failed: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}.`;
                output = {
                  exists: true,
                  value: { error: { message: requestError, code: response.status } },
                };
                break;
              }
              body = await response.text();
            } catch (error) {
              aborted();
              requestError = error instanceof Error ? error.message : String(error);
              output = {
                exists: true,
                value: { error: { message: requestError, code: 'NETWORK_ERROR' } },
              };
              break;
            }
            output = dataTools.parseResponse(body);
            break;
          }
          case 'dom': {
            const variables = input;
            const value = dataTools.elementValue(config, variables);
            const selector = dataTools.interpolate(
              config.selector ?? '',
              variables,
              undefined,
              true,
            );
            const attribute =
              config.action === 'attribute'
                ? dataTools.interpolate(config.attribute ?? '', variables, undefined, true)
                : '';
            const targets = selectorElements(selector);
            const imageAlt =
              config.action === 'replace-image' && config.imageAlt !== undefined
                ? dataTools.interpolate(config.imageAlt, variables)
                : undefined;
            if (
              config.action === 'replace-image' &&
              targets.some((element) => element.localName !== 'img')
            )
              throw new Error('Replace image requires an img element.');
            for (const element of targets) {
              switch (config.action ?? 'text') {
                case 'text':
                  element.textContent = value;
                  break;
                case 'html':
                  element.innerHTML = value;
                  break;
                case 'add-class':
                  element.classList.add(...value.split(/\s+/).filter(Boolean));
                  break;
                case 'remove-class':
                  element.classList.remove(...value.split(/\s+/).filter(Boolean));
                  break;
                case 'hide':
                  (element as HTMLElement).style.display = 'none';
                  break;
                case 'show': {
                  element.removeAttribute('hidden');
                  (element as HTMLElement).style.removeProperty('display');
                  if (win.getComputedStyle(element).display === 'none')
                    (element as HTMLElement).style.display = 'block';
                  break;
                }
                case 'replace-image': {
                  element.removeAttribute('srcset');
                  element.removeAttribute('sizes');
                  const picture = element.parentElement;
                  if (picture?.localName === 'picture') {
                    for (const source of Array.from(picture.children)) {
                      if (source.localName === 'source') source.removeAttribute('srcset');
                    }
                  }
                  element.setAttribute('src', value);
                  if (imageAlt !== undefined) element.setAttribute('alt', imageAlt);
                  break;
                }
                case 'attribute':
                  if (!attribute.trim()) throw new Error('Enter an attribute name.');
                  element.setAttribute(attribute, value);
                  break;
                default:
                  throw new Error('Unknown element action.');
              }
            }
            break;
          }
          case 'experiment': {
            const variant = experimentTools.assign(nodeId, config, win);
            selectedHandle = variant;
            experimentAnalytics.track(
              nodeId,
              experimentTools.resolveAnalytics(config, workflow.analytics),
              variant,
            );
            break;
          }
          case 'fork':
            selectedHandle = matchesCondition(
              config,
              { ...context, data: input },
              { getDateRange, getTimeRange, getWeekdays, dataTools },
            )
              ? 'true'
              : 'false';
            break;
          case 'loop':
            loopIterations = config.iterations ?? 3;
            if (!Number.isInteger(loopIterations) || loopIterations < 1 || loopIterations > 1000)
              throw new Error('Repeat count must be an integer from 1 to 1,000.');
            break;
          case 'popover':
            showPopover(node, context, createPopoverElements, placePopover);
            break;
          default:
            throw new Error(`Unknown step type: ${String(node.data.kind)}.`);
        }
        aborted();
        log(
          nodeId,
          requestError !== undefined ? 'error' : 'success',
          requestError ??
            (selectedHandle
              ? node.data.kind === 'experiment'
                ? `Experiment assigned variant ${selectedHandle.toUpperCase()}`
                : `Condition is ${selectedHandle}`
              : loopIterations
                ? `Repeating ${loopIterations} times`
                : 'Step completed'),
        );
      } catch (error) {
        if (!signal.aborted)
          log(nodeId, 'error', error instanceof Error ? error.message : String(error));
        throw error;
      }
      if (requestError !== undefined) state.hadError = true;
      if (!loopIterations && node.data.kind !== 'trigger' && requestError === undefined)
        state.analytics.step(node, selectedHandle);
      if (loopIterations) {
        for (let index = 0; index < loopIterations; index += 1) {
          aborted();
          await next(nodeId, state, output, 'body');
        }
        if (!state.hadError) state.analytics.step(node);
        await next(nodeId, state, output, 'done');
      } else {
        await next(nodeId, state, output, selectedHandle);
      }
    } finally {
      state.active.delete(nodeId);
    }
  }

  async function run(triggerId?: string): Promise<void> {
    if (context.destroyed) return;
    const triggers = triggerId
      ? [nodes.get(triggerId)]
      : workflow.nodes.filter((node) => node.data.kind === 'trigger');
    if (!triggers.length) throw new Error('Add a trigger to run this workflow.');
    try {
      for (const trigger of triggers) {
        if (trigger?.data.kind !== 'trigger')
          throw new Error('Choose a valid trigger to run this workflow.');
        aborted();
        const state: RunState = {
          steps: 0,
          active: new Set(),
          hadError: false,
          analytics: workflowAnalytics.begin(trigger.id),
        };
        await execute(trigger.id, state, { exists: false, value: undefined });
        aborted();
        if (!state.hadError) state.analytics.complete();
      }
    } catch (error) {
      if (!signal.aborted) throw error;
    }
  }

  return run;
}
