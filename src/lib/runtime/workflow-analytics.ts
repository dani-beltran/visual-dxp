import type { createAnalyticsTools } from '../analytics';
import type { createExperimentTools } from '../experiment';
import type { Workflow, WorkflowNode } from '../types';
import type { RuntimeContext } from './context';

/** All state is scoped to this runtime; all run metadata is scoped to a trigger invocation. */
export function createWorkflowAnalytics(
  workflow: Workflow,
  context: RuntimeContext,
  tools: ReturnType<typeof createAnalyticsTools>,
  experimentTools: ReturnType<typeof createExperimentTools>,
) {
  type Parameters = Record<string, unknown>;
  const browser = context.win as Window & {
    gtag?: (command: string, name: string, parameters: Parameters) => void;
    dataLayer?: { push: (event: Parameters) => unknown };
  };
  let runtimeId: string;
  try {
    runtimeId = Array.from(context.win.crypto.getRandomValues(new Uint32Array(4)), (value) =>
      value.toString(36),
    ).join('-');
  } catch {
    // Minimal host windows may omit crypto. Analytics must not prevent execution.
    runtimeId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
  let sequence = 0;

  function emit(nodeId: string, name: string, parameters: Parameters): void {
    if (context.destroyed || context.signal.aborted) return;
    const settings = workflow.analytics;
    if (settings?.provider !== 'ga4') return;
    try {
      experimentTools.validateSettings(settings);
      tools.validateIdentity(settings);
      const detail = `${name} ${JSON.stringify(parameters)}`;
      if (context.analyticsMode === 'simulate') {
        context.recordAnalytics?.(name);
        context.log(nodeId, 'success', `Simulated analytics: ${detail}`);
        return;
      }
      if ((settings.delivery ?? 'gtag') === 'gtag') {
        if (typeof browser.gtag !== 'function') throw new Error('window.gtag is unavailable');
        browser.gtag('event', name, {
          ...parameters,
          ...(settings.measurementId?.trim() ? { send_to: settings.measurementId.trim() } : {}),
        });
      } else {
        if (typeof browser.dataLayer?.push !== 'function')
          throw new Error('window.dataLayer is unavailable');
        browser.dataLayer.push({ event: name, ...parameters });
      }
      context.log(
        nodeId,
        'success',
        `Analytics queued via ${settings.delivery ?? 'gtag'}: ${detail}. Delivery is not confirmed.`,
      );
    } catch {
      context.log(nodeId, 'success', `Analytics unavailable: ${name}. Event was not queued.`);
    }
  }

  function begin(triggerId: string) {
    const parameters: Parameters = {
      workflow_id:
        (typeof workflow.analytics?.workflowId === 'string' &&
          workflow.analytics.workflowId.trim()) ||
        workflow.name.slice(0, 100),
      workflow_version:
        (typeof workflow.analytics?.workflowVersion === 'string' &&
          workflow.analytics.workflowVersion.trim()) ||
        '1',
      trigger_id: triggerId,
      run_id: `${runtimeId}-${++sequence}`,
    };
    emit(triggerId, 'dxp_workflow_started', parameters);
    let steps = 0;
    return {
      step(node: WorkflowNode, branch?: string) {
        emit(node.id, 'dxp_workflow_step', {
          ...parameters,
          step_id: node.id,
          step_type: node.data.kind,
          step_index: ++steps,
          ...(branch ? { branch } : {}),
          ...(node.data.kind === 'experiment' && branch
            ? {
                experiment_id: node.data.config.experimentKey?.trim() || node.id,
                variant_id: branch,
              }
            : {}),
        });
      },
      custom(node: WorkflowNode, payload = '') {
        const customParameters = tools.parsePayload(payload);
        const name = tools.validateEventName(node.data.config.analyticsEventName);
        if (workflow.analytics?.provider !== 'ga4')
          context.log(
            node.id,
            'success',
            `Analytics disabled: ${name}. Enable Google Analytics in the Analytics tab.`,
          );
        emit(node.id, name, {
          ...customParameters,
          ...parameters,
          step_id: node.id,
          step_type: node.data.kind,
        });
      },
      complete() {
        emit(triggerId, 'dxp_workflow_completed', { ...parameters, step_count: steps });
      },
    };
  }
  return { begin };
}
