import { describe, expect, it } from 'vitest';
import {
  applyWorkflowOperations as applyClient,
  parseAIChatRequest as parseClientRequest,
  workflowFingerprint,
} from '../../src/lib/ai';
import type { Workflow as ClientWorkflow } from '../../src/lib/types';
import { createWorkflowTools } from '../../src/server/ai/tools';
import {
  applyWorkflowOperations as applyServer,
  parseAIChatRequest as parseServerRequest,
} from '../../src/server/ai/workflow/ai';
import type { Workflow } from '../../src/server/ai/workflow/types';

const tourSteps = [
  { contentType: 'html' as const, content: '<h2>Welcome</h2>', position: 'center' as const },
  {
    contentType: 'html' as const,
    content: '<h2>Search</h2>',
    position: 'anchor' as const,
    selector: '#search',
    width: 320,
    popoverAnimation: 'zoom' as const,
  },
];
function workflow(): Workflow {
  return {
    version: 1,
    name: 'Tour',
    websiteUrl: 'https://example.test',
    nodes: [
      {
        id: 'start',
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: { kind: 'trigger', label: 'Start', config: { event: 'page-load' } },
      },
      {
        id: 'tour',
        type: 'workflow',
        position: { x: 300, y: 0 },
        data: {
          kind: 'tour',
          label: 'Onboarding',
          config: { tourSteps, tourNextLabel: 'Continue' },
        },
      },
    ],
    edges: [{ id: 'edge', type: 'smoothstep', source: 'start', target: 'tour' }],
  };
}
const request = (graph: Workflow) => ({
  messages: [{ role: 'user', content: 'Rename the tour' }],
  workflow: graph,
  selectedNodeIds: [],
});

describe('tours in AI editing', () => {
  it('accepts workflows containing tours and keeps their steps in client and server requests', () => {
    for (const parse of [parseClientRequest, parseServerRequest]) {
      const parsed = parse(request(workflow()));
      expect(parsed.workflow.nodes[1].data.config).toEqual({
        tourSteps,
        tourNextLabel: 'Continue',
      });
    }
    const malformed = workflow();
    malformed.nodes[1].data.config.tourSteps = [{ event: 'click' }] as never;
    expect(() => parseClientRequest(request(malformed))).toThrow(
      'Tour steps must be a list of popover settings.',
    );
    expect(() => parseServerRequest(request(malformed))).toThrow(
      'Tour steps must be a list of popover settings.',
    );
  });

  it('detects concurrent tour edits in the workflow fingerprint', () => {
    const edited = workflow() as ClientWorkflow;
    edited.nodes[1].data.config.tourSteps = [tourSteps[0]];
    expect(workflowFingerprint(edited)).not.toBe(workflowFingerprint(workflow() as ClientWorkflow));
  });

  it('relabels, moves and reconnects tours without dropping their steps', () => {
    const operations = [
      { type: 'update_node', id: 'tour', label: 'Welcome tour', position: { x: 500, y: 40 } },
    ];
    for (const apply of [applyClient, applyServer]) {
      const result = apply(workflow() as ClientWorkflow & Workflow, operations);
      expect(result.nodes[1].data).toMatchObject({
        label: 'Welcome tour',
        config: { tourSteps, tourNextLabel: 'Continue' },
      });
    }
  });

  it('does not let AI tools create tours or change their steps', () => {
    const tools = createWorkflowTools(workflow(), []);
    const added = JSON.parse(tools.invokePrivate('add_node', { kind: 'tour' }));
    expect(added).toMatchObject({ ok: false, code: 'invalid_arguments' });
    const updated = JSON.parse(
      tools.invokePrivate('update_node', { id: 'tour', config: { tourNextLabel: 'Go' } }),
    );
    expect(updated).toMatchObject({ ok: false });
    expect(() =>
      applyClient(workflow() as ClientWorkflow, [
        { type: 'update_node', id: 'tour', config: { tourSteps: [] } },
      ]),
    ).toThrow('Invalid configuration fields: tourSteps for tour.');
    const renamed = JSON.parse(
      tools.invokePrivate('update_node', { id: 'tour', label: 'Welcome tour' }),
    );
    expect(renamed).toMatchObject({ ok: true, changed: true });
    expect(tools.getWorkflow().nodes[1].data.config).toEqual({
      tourSteps,
      tourNextLabel: 'Continue',
    });
  });
});
