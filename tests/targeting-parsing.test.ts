import { describe, expect, it } from 'vitest';
import * as frontend from '../src/lib/ai';
import { defaultWorkflow } from '../src/lib/catalog';
import { exportWorkflow, validateWorkflow } from '../src/lib/export';
import { isWorkflow } from '../src/lib/serialization';
import type { Workflow } from '../src/lib/types';
import * as server from '../src/server/ai/workflow/ai';
import { validateWorkflow as validateServerWorkflow } from '../src/server/ai/workflow/validation';

describe('target scope across JSON and AI boundaries', () => {
  it.each([undefined, false, true])(
    'preserves includeSubpages=%s through request and response parsing',
    (includeSubpages) => {
      const workflow = { ...defaultWorkflow, includeSubpages };
      const restored = JSON.parse(JSON.stringify(workflow));
      expect(isWorkflow(restored)).toBe(true);
      expect(restored.includeSubpages ?? false).toBe(includeSubpages ?? false);
      const request = {
        workflow: restored,
        messages: [{ role: 'user', content: 'Rename the first step' }],
        selectedNodeIds: [],
      };
      for (const protocol of [frontend, server]) {
        const parsed = protocol.parseAIChatRequest(request);
        expect(parsed.workflow.includeSubpages).toBe(includeSubpages ?? false);
        const response = protocol.parseAIChatResponse({
          message: 'Renamed',
          operations: [{ type: 'update_node', id: workflow.nodes[0].id, label: 'Renamed' }],
        });
        const updated =
          protocol === frontend
            ? frontend.applyWorkflowOperations(
                frontend.parseAIChatRequest(request).workflow,
                response.operations,
              )
            : server.applyWorkflowOperations(
                server.parseAIChatRequest(request).workflow,
                response.operations,
              );
        expect(updated.includeSubpages).toBe(includeSubpages ?? false);
        expect(updated.websiteUrl).toBe(workflow.websiteUrl);
      }
      expect(frontend.parseAIChatRequest(request)).toEqual(server.parseAIChatRequest(request));
    },
  );
  it.each([null, 'true', 1, {}, []])(
    'rejects an invalid scope value %j at every boundary',
    (includeSubpages) => {
      const workflow = { ...defaultWorkflow, includeSubpages } as unknown as Workflow;
      expect(isWorkflow(workflow)).toBe(false);
      for (const protocol of [frontend, server])
        expect(() =>
          protocol.parseAIChatRequest({
            workflow,
            messages: [{ role: 'user', content: 'Edit' }],
            selectedNodeIds: [],
          }),
        ).toThrow(/boolean/);
      expect(validateWorkflow(workflow)).toContainEqual({
        message: 'Include subpages must be a boolean.',
      });
      expect(validateServerWorkflow({ ...workflow, edges: [] })).toContainEqual({
        message: 'Include subpages must be a boolean.',
      });
    },
  );
  it('includes scope in AI stale-response fingerprints, with old workflows equivalent to false', () => {
    const old = { ...defaultWorkflow };
    delete old.includeSubpages;
    expect(frontend.workflowFingerprint(old)).toBe(
      frontend.workflowFingerprint({ ...old, includeSubpages: false }),
    );
    expect(frontend.workflowFingerprint(old)).not.toBe(
      frontend.workflowFingerprint({ ...old, includeSubpages: true }),
    );
  });
  it('requires an explicit base for relative exports outside a browser', () => {
    const workflow = { ...defaultWorkflow, websiteUrl: '/products' };
    expect(() => exportWorkflow(workflow)).toThrow(/baseUrl/);
    expect(exportWorkflow(workflow, { baseUrl: 'https://example.com/editor' })).toContain(
      'https://example.com/products',
    );
    expect(() => exportWorkflow(defaultWorkflow)).toThrow(/Configure your website URL/);
    expect(() =>
      exportWorkflow(defaultWorkflow, { baseUrl: 'https://editor.example.com' }),
    ).toThrow(/preview only/);
    expect(() =>
      exportWorkflow({ ...workflow, websiteUrl: 'https://external.example/demo-site.html' }),
    ).not.toThrow();
  });
});
