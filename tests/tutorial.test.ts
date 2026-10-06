// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { spanishMessages } from '../src/app/locales/es';
import { catalog, createEmptyWorkflow, createNode, defaultWorkflow } from '../src/lib/catalog';
import { validateWorkflow } from '../src/lib/export';
import { createBuilderTranslator, translateEnglish } from '../src/lib/i18n';
import { restoreWorkflow } from '../src/lib/initialWorkflow';
import { commonDXPPresets } from '../src/presets';
import { welcomeJourneyPreset } from '../src/presets/welcome-journey';
import {
  advanceRun,
  missingPrerequisite,
  newTutorial,
  readTutorial,
  requirements,
  type TutorialRun,
  trackCreated,
  tutorialFingerprint,
} from '../src/tutorial/model';

const key = 'tutorial-unit-workflow';
afterEach(() => {
  localStorage.removeItem(key);
  vi.restoreAllMocks();
});
function exercise() {
  const w = createEmptyWorkflow();
  w.name = 'My first workflow.';
  w.websiteUrl = '/demo-site.html';
  let r = newTutorial(w);
  for (const kind of ['trigger', 'delay', 'popover'] as const) {
    const n = createNode(kind);
    r = trackCreated(r, n, w);
    w.nodes.push(n);
    r.inspected[kind] = n.id;
  }
  w.nodes[1].data.config.duration = 1000;
  r.confirmedTrigger = w.nodes[0].id;
  w.edges = [
    { id: 'a', source: w.nodes[0].id, target: w.nodes[1].id },
    { id: 'b', source: w.nodes[1].id, target: w.nodes[2].id },
  ];
  return { w, r };
}
describe('blank initialization', () => {
  it('has no graph or website and localizes only the generated name', () => {
    expect(defaultWorkflow).toMatchObject({
      nodes: [],
      edges: [],
      websiteUrl: '',
      name: 'Untitled workflow',
    });
    expect(
      restoreWorkflow(undefined, undefined, createBuilderTranslator(spanishMessages)).name,
    ).toBe('Flujo sin título');
    expect(commonDXPPresets.some((p) => p.id === 'welcome-journey')).toBe(true);
  });
  it('retains saved > explicit > blank precedence without mutating inputs or storage', () => {
    const saved = structuredClone(welcomeJourneyPreset.workflow);
    saved.name = 'Edited welcome';
    localStorage.setItem(key, JSON.stringify(saved));
    expect(
      restoreWorkflow({ ...defaultWorkflow, name: 'Explicit' }, key, translateEnglish),
    ).toMatchObject(saved);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
    const explicit = { ...defaultWorkflow, name: 'Explicit' };
    localStorage.setItem(key, 'invalid');
    expect(restoreWorkflow(explicit, key, translateEnglish).name).toBe('Explicit');
    expect(restoreWorkflow(undefined, key, translateEnglish).nodes).toEqual([]);
    localStorage.setItem(key, JSON.stringify({ ...saved, nodes: [{}] }));
    expect(restoreWorkflow(undefined, key, translateEnglish).nodes).toEqual([]);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Denied');
    });
    expect(restoreWorkflow(undefined, key, translateEnglish).websiteUrl).toBe('');
  });
});
describe('tutorial prerequisites and execution', () => {
  it('tracks generated IDs and preserves the exact catalog HTML without translated labels', () => {
    const { w, r } = exercise();
    const popoverDefault = catalog.find((n) => n.kind === 'popover')!.config.content;
    expect(r.defaultContent).toBe(popoverDefault);
    w.nodes.forEach((n) => {
      n.data.label = 'Arbitrary name';
    });
    expect(requirements(r, w, w.websiteUrl).popover).toBe(true);
    expect(validateWorkflow(w)).toEqual([]);
    w.nodes[2].data.config.content = '<p>Changed</p>';
    expect(requirements(r, w, w.websiteUrl).popover).toBe(false);
    expect(catalog.find((n) => n.kind === 'popover')!.config.content).toBe(popoverDefault);
  });
  it('requires confirmation and repairs deletion, Undo-like settings changes, and wrong edges', () => {
    const { w, r } = exercise();
    r.step = 'test';
    expect(missingPrerequisite(r, w, w.websiteUrl)).toBeUndefined();
    expect(requirements({ ...r, confirmedTrigger: undefined }, w, w.websiteUrl).event).toBe(false);
    const removed = { ...w, nodes: w.nodes.filter((n) => n.id !== r.ids.delay) };
    expect(missingPrerequisite(r, removed, w.websiteUrl)).toBe('delay');
    expect(missingPrerequisite(r, { ...w, edges: [] }, w.websiteUrl)).toBe('connect');
    expect(
      requirements(
        r,
        { ...w, edges: w.edges.map((e) => ({ ...e, source: e.target, target: e.source })) },
        w.websiteUrl,
      ).connect,
    ).toBe(false);
    w.nodes[1].data.config.duration = 1500;
    expect(missingPrerequisite(r, w, w.websiteUrl)).toBe('delay');
  });
  it('accepts only ordered success for the intended nodes in the current unchanged run', () => {
    const { w, r } = exercise();
    let run: TutorialRun | null = advanceRun(null, { type: 'start', runId: 'active' }, r, w);
    const log = (nodeId: string, runId = 'active', status: 'success' | 'error' = 'success') => ({
      type: 'log' as const,
      runId,
      log: { nodeId, status, label: '', message: '', timestamp: 0 },
    });
    run = advanceRun(run, log(r.ids.popover!, 'previous'), r, w);
    run = advanceRun(run, log('unrelated'), r, w);
    run = advanceRun(run, log(r.ids.popover!), r, w);
    expect(run?.succeeded).toEqual([]);
    for (const id of [r.ids.trigger!, r.ids.delay!, r.ids.popover!])
      run = advanceRun(run, log(id), r, w);
    expect(run?.succeeded).toHaveLength(3);
    expect(advanceRun(run, { type: 'error', runId: 'previous' }, r, w)?.error).toBe(false);
    expect(advanceRun(run, { type: 'error', runId: 'active' }, r, w)?.error).toBe(true);
    expect(advanceRun(run, { type: 'stop', runId: 'active' }, r, w)).toBeNull();
    const changed = { ...w, websiteUrl: 'https://different.test' };
    expect(advanceRun(run, log(r.ids.popover!), r, changed)).toEqual(run);
    expect(
      tutorialFingerprint({
        ...w,
        nodes: w.nodes.map((n) => ({ ...n, position: { x: 999, y: 100 } })),
      }),
    ).toBe(tutorialFingerprint(w));
  });
  it('reads only supported progress records and tolerates storage denial', () => {
    const { w, r } = exercise();
    localStorage.setItem(
      key,
      JSON.stringify({ ...r, fingerprint: tutorialFingerprint(w), status: 'dismissed' }),
    );
    expect(readTutorial(key)?.ids).toEqual(r.ids);
    for (const invalid of [
      null,
      { ...r, version: 2 },
      { ...r, step: 'made-up' },
      { ...r, ids: { trigger: 42 } },
      { ...r, defaultContent: 123 },
    ]) {
      localStorage.setItem(key, JSON.stringify(invalid));
      expect(readTutorial(key)).toBeNull();
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Denied');
    });
    expect(readTutorial(key)).toBeNull();
  });
});
