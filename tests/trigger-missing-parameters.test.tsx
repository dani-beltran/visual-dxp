// @vitest-environment jsdom
import { Position, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VisualDXPBuilder } from '../src/components/VisualDXPBuilder/VisualDXPBuilder';
import { WorkflowCard } from '../src/components/WorkflowCard/WorkflowCard';
import { missingTriggerParameters } from '../src/lib/triggers';
import type { NodeKind, StepConfig, StepData, Workflow, WorkflowNode } from '../src/lib/types';

describe('missingTriggerParameters', () => {
  it.each([
    [{}, []],
    [{ event: 'page-load' }, []],
    [{ event: 'exit-intent' }, []],
    // Numeric settings are never empty: omitted values use their defaults.
    [{ event: 'rage-click' }, []],
    [{ event: 'inactivity' }, []],
    [{ event: 'scroll-depth' }, []],
    [{ event: 'click' }, ['selector']],
    [{ event: 'click', selector: '' }, ['selector']],
    [{ event: 'mouseover', selector: '   ' }, ['selector']],
    [{ event: 'swipe', selector: '#gallery' }, []],
    [{ event: 'zoom-in', selector: '\t' }, ['selector']],
    [{ event: 'custom-event' }, ['customEventName']],
    [{ event: 'custom-event', customEventName: '  ' }, ['customEventName']],
    [{ event: 'custom-event', customEventName: ' cart:updated ' }, []],
    // Stale parameters from another trigger type do not count.
    [{ event: 'custom-event', selector: '#old', customEventName: '' }, ['customEventName']],
    [{ event: 'click', selector: '#buy', customEventName: '' }, []],
    // Unsupported events are reported by validation instead.
    [{ event: 'unknown' as StepConfig['event'] }, []],
  ] satisfies [StepConfig, string[]][])('%j → %j', (config, missing) => {
    expect(missingTriggerParameters(config)).toEqual(missing);
  });
});

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const createElementNS = document.createElementNS.bind(document);
  vi.spyOn(document, 'createElementNS').mockImplementation((namespace, name, options) => {
    const element = createElementNS(namespace, name, options);
    if (name === 'text')
      Object.assign(element, { getBBox: () => ({ x: 0, y: 0, width: 180, height: 14 }) });
    return element;
  });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function flowNode(
  id: string,
  config: StepConfig,
  status?: StepData['status'],
  kind: NodeKind = 'trigger',
): WorkflowNode {
  return {
    id,
    type: 'workflow',
    position: { x: 0, y: 0 },
    width: 220,
    height: 140,
    data: { kind, label: id, config, status },
    handles: [
      { type: 'source', position: Position.Right, x: 220, y: 70 },
      { type: 'target', position: Position.Left, x: 0, y: 70 },
    ],
  } as WorkflowNode;
}
const status = (id: string) =>
  host.querySelector(`[data-id="${id}"] .dxp-node-footer > span:first-child`);

it('replaces Configured and Completed with Missing parameters while a trigger parameter is empty', async () => {
  const nodes = [
    flowNode('no-name', { event: 'custom-event' }),
    flowNode('no-name-run', { event: 'custom-event', customEventName: ' ' }, 'success'),
    flowNode('no-target', { event: 'click', selector: '' }),
    flowNode('no-target-run', { event: 'swipe' }, 'success'),
    flowNode('named', { event: 'custom-event', customEventName: 'cart:updated' }),
    flowNode('named-run', { event: 'custom-event', customEventName: 'cart:updated' }, 'success'),
    flowNode('page-load', { event: 'page-load' }),
    flowNode('rage-click', { event: 'rage-click' }),
    // Running and error statuses from a test run keep their meaning.
    flowNode('running', { event: 'custom-event' }, 'running'),
    flowNode('error', { event: 'click' }, 'error'),
    // Other node kinds are unaffected, even with empty settings.
    flowNode('dom', {}, 'idle', 'dom'),
  ];
  const nodeTypes = { workflow: WorkflowCard };
  await act(async () =>
    root.render(
      <ReactFlowProvider>
        <div style={{ width: 1000, height: 800 }}>
          <ReactFlow nodes={nodes} edges={[]} nodeTypes={nodeTypes} />
        </div>
      </ReactFlowProvider>,
    ),
  );
  const expected: Record<string, string> = {
    'no-name': 'Missing parameters',
    'no-name-run': 'Missing parameters',
    'no-target': 'Missing parameters',
    'no-target-run': 'Missing parameters',
    named: 'Configured',
    'named-run': 'Completed',
    'page-load': 'Configured',
    'rage-click': 'Configured',
    running: 'Running',
    error: 'Needs attention',
    dom: 'Configured',
  };
  for (const [id, text] of Object.entries(expected)) {
    const element = status(id);
    expect(element?.textContent?.trim(), id).toBe(text);
    const flagged = text === 'Missing parameters';
    expect(element?.classList.contains('dxp-node-missing-parameters'), id).toBe(flagged);
    expect(element?.hasAttribute('title'), id).toBe(flagged);
  }
  expect(status('no-name')?.getAttribute('title')).toBe(
    'Enter a custom event name for this trigger.',
  );
  expect(status('no-target')?.getAttribute('title')).toBe(
    'Choose a target element for this trigger.',
  );
});

function workflow(config: StepConfig): Workflow {
  return {
    version: 1,
    name: 'Missing parameters',
    websiteUrl: '/demo-site.html',
    nodes: [flowNode('start', config)] as Workflow['nodes'],
    edges: [],
  };
}
async function change(label: string, value: string) {
  const id = [...host.querySelectorAll('label')].find(
    (item) => item.textContent === label,
  )?.htmlFor;
  const input = document.getElementById(id ?? '');
  if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement))
    throw new Error(`Missing field: ${label}`);
  const select = input instanceof HTMLSelectElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      select ? HTMLSelectElement.prototype : HTMLInputElement.prototype,
      'value',
    )?.set?.call(input, value);
    input.dispatchEvent(new Event(select ? 'change' : 'input', { bubbles: true }));
  });
}

it('updates the trigger status while its parameters are edited', async () => {
  await act(async () =>
    root.render(<VisualDXPBuilder initialWorkflow={workflow({ event: 'custom-event' })} />),
  );
  const text = () => status('start')?.textContent?.trim();
  expect(text()).toBe('Missing parameters');
  await act(async () => {
    host
      .querySelector('[data-id="start"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await change('Custom event name', 'cart:updated');
  expect(text()).toBe('Configured');
  await change('Custom event name', '   ');
  expect(text()).toBe('Missing parameters');
  await change('Start when', 'page-load');
  expect(text()).toBe('Configured');
  await change('Start when', 'click');
  expect(text()).toBe('Missing parameters');
  await change('Target element', '#shop-now');
  expect(text()).toBe('Configured');
});
