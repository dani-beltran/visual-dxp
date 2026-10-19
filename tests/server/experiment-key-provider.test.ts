import { describe, expect, it } from 'vitest';
import { applyWorkflowOperations } from '../../src/lib/ai';
import { runLocalAgent } from '../../src/server/ai/agent';
import { experimentKeyRequest } from './experiment-key-fixture';

// Explicit opt-in: uses the existing server provider settings and makes real requests.
describe.skipIf(process.env.DXP_PROVIDER_EVAL !== '1')('issue #38 provider evaluation', () => {
  it.each([1, 2, 3])(
    'adds only the accepted experiment key (sample %s)',
    async () => {
      const request = experimentKeyRequest();
      const before = structuredClone(request);
      const id = request.selectedNodeIds[0];
      const response = await runLocalAgent(request, AbortSignal.timeout(90_000));
      const expected = structuredClone(request.workflow);
      const experiment = expected.nodes.find((node) => node.id === id);
      if (!experiment) throw new Error('Missing fixture experiment');
      experiment.data.config.experimentKey = 'headline-test-v1';
      expect(response.operations).toHaveLength(1);
      expect(response.operations[0]).toMatchObject({
        type: 'update_node',
        id,
        config: { experimentKey: 'headline-test-v1' },
      });
      expect(applyWorkflowOperations(request.workflow, response.operations)).toEqual(expected);
      expect(request).toEqual(before);
    },
    95_000,
  );
});
