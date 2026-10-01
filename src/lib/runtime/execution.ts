import type { createConnectionTools } from '../connectionMapping';
import type { buildCookie } from '../cookies';
import type { createDataTools, DataSelection } from '../data';
import type { getDateRange } from '../dateRange';
import type { getTimeRange } from '../timeRange';
import type { Workflow } from '../types';
import type { matchesCondition } from './conditions';
import type { RuntimeContext } from './context';
import type { showPopover } from './popovers';
import type { WorkflowRuntime } from './types';

interface ExecutionModules {
  createConnectionTools: typeof createConnectionTools;
  createDataTools: typeof createDataTools;
  buildCookie: typeof buildCookie;
  matchesCondition: typeof matchesCondition;
  getDateRange: typeof getDateRange;
  getTimeRange: typeof getTimeRange;
  showPopover: typeof showPopover;
}

export function createExecution(
  workflow: Workflow,
  context: RuntimeContext,
  {
    buildCookie,
    matchesCondition,
    getDateRange,
    getTimeRange,
    showPopover,
    createDataTools,
    createConnectionTools,
  }: ExecutionModules,
): WorkflowRuntime['run'] {
  const { doc, win, signal, nodes, fetcher, maxSteps, aborted, log, wait, selectorElements } =
    context;
  const dataTools = createDataTools();
  const connectionTools = createConnectionTools(dataTools);
  type RunState = { steps: number; active: Set<string> };

  async function next(
    nodeId: string,
    state: RunState,
    data: DataSelection,
    handle?: string,
    jsonResponse = false,
  ): Promise<void> {
    const edges = workflow.edges.filter(
      (edge) => edge.source === nodeId && (handle === undefined || edge.sourceHandle === handle),
    );
    for (const edge of edges) {
      const preview = { source: data, jsonResponse };
      try {
        context.onConnectionPreview?.(edge.id, preview);
      } catch {
        /* Observers cannot interrupt execution. */
      }
      const mapping = edge.data?.mapping;
      let resolved: ReturnType<typeof connectionTools.resolve>;
      try {
        connectionTools.validate(
          mapping,
          nodes.get(edge.target)?.data,
          nodes.get(edge.source)?.data.kind,
        );
        resolved = connectionTools.resolve(mapping, preview);
      } catch (error) {
        log(
          edge.target,
          'error',
          `Connection “${edge.id}”: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
      await execute(
        edge.target,
        state,
        resolved.incoming,
        mapping?.targetInput === 'data' ? undefined : resolved.selected,
      );
    }
  }

  async function execute(
    nodeId: string,
    state: RunState,
    input: DataSelection,
    selected?: DataSelection,
  ): Promise<void> {
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
      let jsonResponse = false;
      let requestError: string | undefined;
      let selectedHandle: string | undefined;
      let loopIterations = 0;
      log(nodeId, 'running', 'Running step');
      try {
        switch (node.data.kind) {
          case 'cookie': {
            const cookie = buildCookie(config);
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
            dataTools.validateResponse(config);
            if (!fetcher) throw new Error('This browser does not support fetch.');
            if (!config.url?.trim()) throw new Error('Enter a request URL.');
            const requestUrl = dataTools.requestTemplate(config.url, input);
            if (!requestUrl.trim()) throw new Error('Enter a request URL.');
            const url = new URL(requestUrl, doc.baseURI);
            if (!['http:', 'https:'].includes(url.protocol))
              throw new Error('Requests require an HTTP or HTTPS URL.');
            const headers = config.headers?.trim()
              ? (JSON.parse(config.headers) as Record<string, string>)
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
            output = dataTools.parseResponse(body, config);
            try {
              JSON.parse(body);
              jsonResponse = true;
            } catch {
              /* Complete text response. */
            }
            break;
          }
          case 'dom': {
            const variables = selected ?? input;
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
          case 'fork':
            selectedHandle = matchesCondition(
              config,
              { ...context, data: selected ?? input },
              { getDateRange, getTimeRange, dataTools },
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
            showPopover(node, context);
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
              ? `Condition is ${selectedHandle}`
              : loopIterations
                ? `Repeating ${loopIterations} times`
                : 'Step completed'),
        );
      } catch (error) {
        if (!signal.aborted)
          log(nodeId, 'error', error instanceof Error ? error.message : String(error));
        throw error;
      }
      if (loopIterations) {
        for (let index = 0; index < loopIterations; index += 1) {
          aborted();
          await next(nodeId, state, output, 'body');
        }
        await next(nodeId, state, output, 'done');
      } else {
        await next(nodeId, state, output, selectedHandle, jsonResponse);
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
        await execute(
          trigger.id,
          { steps: 0, active: new Set() },
          { exists: false, value: undefined },
        );
      }
    } catch (error) {
      if (!signal.aborted) throw error;
    }
  }

  return run;
}
