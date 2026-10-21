// Manual browser regression fixture: pnpm exec vite --host 127.0.0.1
// Open /tests/browser/layout.html. Uses the production builder, cards and sockets.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import VisualDXPBuilder, { type VisualDXPBuilderApi, type Workflow } from '../../src';
import { applyWorkflowOperations } from '../../src/lib/ai';
import { type Point, segmentInterference, sourcePort } from '../../src/lib/workflowGeometry';
import { layoutOperations } from '../../src/server/ai/workflow/layout';
import { diamond } from '../helpers/layoutWorkflow';

function fixture(kind: 'fork' | 'experiment' | 'loop', nested = false, sized = false) {
  const workflow = diamond(kind);
  workflow.nodes[2].data.label = 'First branch';
  workflow.nodes[3].data.label = 'Second branch';
  if (sized) {
    workflow.nodes[1].width = 330;
    workflow.nodes[1].height = 260;
    workflow.nodes[2].width = 410;
    workflow.nodes[2].height = 280;
    workflow.nodes[3].width = 200;
    workflow.nodes[3].height = 180;
  }
  if (nested) {
    const inner = diamond('experiment');
    workflow.nodes.push(
      ...inner.nodes.filter((n) => n.id !== 'start').map((n) => ({ ...n, id: `inner-${n.id}` })),
    );
    workflow.edges.find((e) => e.id === 'first-join')!.target = 'inner-split';
    workflow.edges.push(
      ...inner.edges
        .filter((e) => e.source !== 'start')
        .map((e) => ({
          ...e,
          id: `inner-${e.id}`,
          source: `inner-${e.source}`,
          target: `inner-${e.target}`,
        })),
      { id: 'inner-exit', source: 'inner-join', target: 'join' },
    );
  }
  workflow.nodes.push({
    id: 'unrelated',
    type: 'workflow',
    position: { x: 0, y: 1300 },
    data: { kind: 'delay', label: 'Unrelated, stays fixed', config: { duration: 10 } },
  });
  return applyWorkflowOperations(
    workflow,
    layoutOperations(workflow, new Set(['split']), new Set(), { mode: 'component' }),
  );
}
function Harness() {
  const [choice, setChoice] = useState('fork');
  const [report, setReport] = useState('Waiting for measured cards…');
  const api = useRef<VisualDXPBuilderApi | null>(null);
  const original = useRef<Map<string, { x: number; y: number }>>(new Map());
  const current = useRef<Workflow | null>(null);
  useEffect(() => {
    const interval = setInterval(() => {
      if (!current.current) return;
      const workflow = current.current;
      const errors: string[] = [];
      const cards = new Map(
        workflow.nodes.map((n) => [
          n.id,
          document.querySelector<HTMLElement>(`.react-flow__node[data-id="${n.id}"]`),
        ]),
      );
      const edges = [...document.querySelectorAll<SVGGElement>('.react-flow__edge')];
      let count = 0;
      const rendered: { edge: Workflow['edges'][number]; points: Point[] }[] = [];
      for (const group of edges) {
        const edge = workflow.edges.find((e) => e.id === group.getAttribute('data-id'));
        const path = group.querySelector<SVGPathElement>('.react-flow__edge-path');
        if (!path || !edge || !path.getScreenCTM()) continue;
        count++;
        const numbers =
          (path.getAttribute('d') ?? '').match(/-?[\d.]+(?:e[-+]?\d+)?/gi)?.map(Number) ?? [];
        rendered.push({
          edge,
          points: numbers.flatMap((x, i) => (i % 2 ? [] : [{ x, y: numbers[i + 1] }])),
        });
        const matrix = path.getScreenCTM()!;
        const sourceNode = workflow.nodes.find((n) => n.id === edge.source)!;
        const predicted = sourcePort(sourceNode, edge, workflow.nodes);
        const actual = path.getPointAtLength(0);
        if (Math.abs(predicted.x - actual.x) > 0.75 || Math.abs(predicted.y - actual.y) > 0.75)
          errors.push(`Server socket mismatch: ${edge.id}`);
        for (let d = 0; d <= path.getTotalLength(); d += 2) {
          const point = path.getPointAtLength(d).matrixTransform(matrix);
          for (const [id, card] of cards) {
            if (!card || id === edge.source || id === edge.target) continue;
            const r = card.getBoundingClientRect();
            if (
              point.x > r.left + 1 &&
              point.x < r.right - 1 &&
              point.y > r.top + 1 &&
              point.y < r.bottom - 1
            )
              errors.push(`${edge.id} through ${id}`);
          }
        }
        const source = cards
          .get(edge.source)
          ?.querySelector<HTMLElement>(
            edge.sourceHandle ? `[data-handleid="${edge.sourceHandle}"]` : '.source',
          );
        if (source) {
          const r = source.getBoundingClientRect(),
            p = path.getPointAtLength(0).matrixTransform(matrix);
          if (Math.abs(p.x - r.right) > 2 || Math.abs(p.y - (r.top + r.height / 2)) > 2)
            errors.push(`Socket mismatch: ${edge.id}`);
        }
        if (path.style.strokeDasharray) errors.push(`No route: ${edge.id}`);
      }
      for (let i = 0; i < rendered.length; i++)
        for (const b of rendered.slice(i + 1)) {
          const a = rendered[i];
          if (
            a.edge.source === b.edge.source ||
            a.edge.target === b.edge.target ||
            a.edge.target === b.edge.source ||
            a.edge.source === b.edge.target
          )
            continue;
          for (let j = 1; j < a.points.length; j++)
            for (let k = 1; k < b.points.length; k++) {
              if (segmentInterference(a.points[j - 1], a.points[j], b.points[k - 1], b.points[k]))
                errors.push(`Crossing: ${a.edge.id}/${b.edge.id}`);
            }
        }
      const stable = workflow.nodes.every(
        (n) => JSON.stringify(original.current.get(n.id)) === JSON.stringify(n.position),
      );
      setReport(
        count !== workflow.edges.length
          ? 'Waiting for measured cards…'
          : errors.length
            ? [...new Set(errors)].join('; ')
            : `PASS: ${count} rendered paths clear unrelated cards; sockets aligned; positions ${stable ? 'unchanged' : 'edited'}.`,
      );
    }, 400);
    return () => clearInterval(interval);
  }, []);
  const initial = useMemo(
    () =>
      fixture(
        ['nested', 'sized'].includes(choice) ? 'fork' : (choice as 'fork' | 'experiment' | 'loop'),
        choice === 'nested',
        choice === 'sized',
      ),
    [choice],
  );
  const ready = useCallback((value: VisualDXPBuilderApi | null) => {
    api.current = value;
    if (value) original.current = new Map(value.getWorkflow().nodes.map((n) => [n.id, n.position]));
  }, []);
  const changed = useCallback((value: Workflow) => {
    current.current = value;
  }, []);
  return (
    <div
      style={{
        height: '100vh',
        fontFamily: 'sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>
          Fixture{' '}
          <select value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="fork">Condition and shared join</option>
            <option value="experiment">Experiment A/B</option>
            <option value="loop">Loop body/done</option>
            <option value="nested">Nested and unequal branches</option>
            <option value="sized">Different card dimensions</option>
          </select>
        </label>
        <button type="button" onClick={() => api.current?.fitView()}>
          Fit graph
        </button>
        <output>{report}</output>
      </div>
      <VisualDXPBuilder
        key={choice}
        initialWorkflow={initial}
        style={{ flex: 1 }}
        onReady={ready}
        onChange={changed}
      />
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Harness />);
