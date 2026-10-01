import { createConnectionTools } from '../connectionMapping';
import { buildCookie } from '../cookies';
import { createDataTools } from '../data';
import { getDateRange } from '../dateRange';
import { getTimeRange } from '../timeRange';
import type { Workflow } from '../types';
import { startBehaviorTrigger } from './behavior-triggers';
import { matchesCondition } from './conditions';
import { createRuntimeContext } from './context';
import { createExecution } from './execution';
import { showPopover } from './popovers';
import { startSwipeTrigger } from './swipe-trigger';
import { startTriggers } from './triggers';
import type { RuntimeOptions, WorkflowRuntime } from './types';
import { startZoomTrigger } from './zoom-trigger';

// Each module function receives its dependencies through arguments. Keep these
// functions free of module-scope references so their compiled source can also
// power exported workflows, including after bundling and minification.
const runtimeModules = {
  createConnectionTools,
  createDataTools,
  buildCookie,
  createRuntimeContext,
  createExecution,
  matchesCondition,
  getDateRange,
  getTimeRange,
  showPopover,
  startTriggers,
  startBehaviorTrigger,
  startZoomTrigger,
  startSwipeTrigger,
};

function createRuntimeFactory(modules: typeof runtimeModules) {
  return function createRuntime(workflow: Workflow, options: RuntimeOptions = {}): WorkflowRuntime {
    const context = modules.createRuntimeContext(workflow, options);
    const { controller, cleanups, popovers } = context;
    const run = modules.createExecution(workflow, context, modules);
    let started = false;

    function start(): void {
      if (started || context.destroyed) return;
      started = true;
      modules.startTriggers(workflow, context, run, modules);
    }

    function destroy(): void {
      if (context.destroyed) return;
      context.destroyed = true;
      controller.abort();
      cleanups.forEach((cleanup) => {
        cleanup();
      });
      cleanups.clear();
      popovers.forEach((dispose) => {
        dispose();
      });
      popovers.clear();
      options.signal?.removeEventListener('abort', destroy);
    }

    if (options.signal?.aborted) destroy();
    else options.signal?.addEventListener('abort', destroy, { once: true });
    return { start, run, destroy };
  };
}

export const createRuntime = createRuntimeFactory(runtimeModules);
export const executeWorkflow = createRuntime;

/** Serialize the same runtime modules into a dependency-free factory expression. */
export function getRuntimeSource(): string {
  const modules = Object.entries(runtimeModules)
    .map(([name, implementation]) => `${JSON.stringify(name)}: ${implementation.toString()}`)
    .join(',\n');
  return `(${createRuntimeFactory.toString()})({\n${modules}\n})`;
}
