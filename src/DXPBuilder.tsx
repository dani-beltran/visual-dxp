import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  type Connection,
  type EdgeChange,
  MiniMap,
  type NodeChange,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Code2,
  Command,
  Copy,
  FileJson,
  Globe2,
  History,
  Layers2,
  Maximize,
  MousePointer2,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Sparkles,
  Undo2,
  Upload,
  Workflow as WorkflowIcon,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { ActivityPanel } from './components/ActivityPanel';
import { CanvasChat } from './components/CanvasChat';
import { CanvasHelp } from './components/CanvasHelp';
import { ElementPicker } from './components/ElementPicker';
import { NodeInspector } from './components/NodeInspector';
import { NodeLibrary } from './components/NodeLibrary';
import { PopoverPreview } from './components/PopoverPreview';
import { Preview } from './components/Preview';
import { WorkflowCard } from './components/WorkflowCard';
import { type ActivityEntry, type ActivityStore, createActivityStore } from './lib/activity';
import {
  type AIChatConfig,
  type AIChatMessage,
  applyWorkflowOperations,
  requestAIChat,
  workflowFingerprint,
} from './lib/ai';
import { catalog, createNode, defaultWorkflow } from './lib/catalog';
import { exportWorkflow, validateWorkflow } from './lib/export';
import { isWorkflow } from './lib/serialization';
import type { NodeKind, RunLog, StepData, Workflow, WorkflowEdge, WorkflowNode } from './lib/types';
import { useDialogFocus } from './lib/useDialogFocus';
import '@xyflow/react/dist/style.css';
import './styles/builder.css';

const nodeTypes = { workflow: WorkflowCard };
const edgeOptions = {
  type: 'smoothstep',
  style: { stroke: '#a5b9af', strokeWidth: 1.6 },
  labelStyle: { fill: '#7c8982', fontSize: 11 },
  labelBgStyle: { fill: '#f8faf9' },
  labelBgPadding: [7, 5] as [number, number],
  labelBgBorderRadius: 4,
};
export interface DXPBuilderProps {
  initialWorkflow?: Workflow;
  onChange?: (workflow: Workflow) => void;
  onExport?: (script: string, workflow: Workflow) => void;
  className?: string;
  style?: CSSProperties;
  persistenceKey?: string;
  /** One activity store per workflow; the host owns server synchronization. */
  activityStore?: ActivityStore;
  /** Username attached to actions taken in this builder. Defaults to "You". */
  activityUser?: string;
  /** Connect to your authenticated server endpoint; never include provider keys. */
  ai?: AIChatConfig;
}
interface RecordedActivity {
  entry: ActivityEntry;
  store: ActivityStore;
}
interface HistoryEntry {
  workflow: Workflow;
  activity?: RecordedActivity;
}
function copyWorkflow(w: Workflow): Workflow {
  return structuredClone(w);
}
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function DXPBuilder(props: DXPBuilderProps) {
  return (
    <ReactFlowProvider>
      <Builder {...props} />
    </ReactFlowProvider>
  );
}
function Builder({
  initialWorkflow = defaultWorkflow,
  onChange,
  onExport,
  className = '',
  style,
  persistenceKey,
  activityStore,
  activityUser = 'You',
  ai,
}: DXPBuilderProps) {
  const [localActivityStore] = useState(() => createActivityStore());
  const store = activityStore ?? localActivityStore;
  const subscribeActivity = useCallback(
    (listener: () => void) => store.subscribe(listener),
    [store],
  );
  const getActivitySnapshot = useCallback(() => store.getSnapshot(), [store]);
  const activity = useSyncExternalStore(
    subscribeActivity,
    getActivitySnapshot,
    getActivitySnapshot,
  );
  const [view, setView] = useState<'canvas' | 'activity'>('canvas');
  const viewId = useId();
  const [workflow, setWorkflow] = useState<Workflow>(() => {
    if (persistenceKey)
      try {
        const saved = JSON.parse(localStorage.getItem(persistenceKey) || 'null');
        if (isWorkflow(saved)) return saved;
      } catch {
        /* Start fresh if storage is unavailable. */
      }
    return copyWorkflow(initialWorkflow);
  });
  const current = useRef(workflow);
  current.current = workflow;
  const history = useRef<{ past: HistoryEntry[]; future: HistoryEntry[] }>({
    past: [],
    future: [],
  });
  const dragStartPositions = useRef<Map<string, { x: number; y: number }> | null>(null);
  const dragStartWorkflow = useRef<Workflow | null>(null);
  const [, refreshHistory] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasAssistant, setCanvasAssistant] = useState<'chat' | 'help' | null>(null);
  const toggleChat = useCallback((open: boolean) => setCanvasAssistant(open ? 'chat' : null), []);
  const toggleHelp = useCallback((open: boolean) => setCanvasAssistant(open ? 'help' : null), []);
  const [modal, setModal] = useState<
    'export' | 'preview' | 'popover-preview' | 'help' | 'website' | null
  >(null);
  const [picking, setPicking] = useState(false);
  const [exportTab, setExportTab] = useState<'javascript' | 'json'>('javascript');
  const [toast, setToast] = useState('');
  const [saved, setSaved] = useState(true);
  const [statuses, setStatuses] = useState<Record<string, RunLog['status']>>({});
  const [showMinimap, setShowMinimap] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [websiteDraft, setWebsiteDraft] = useState(workflow.websiteUrl);
  const [websiteError, setWebsiteError] = useState('');
  const modalRef = useDialogFocus(!!modal && modal !== 'preview' && modal !== 'popover-preview');
  const changeCallback = useRef(onChange);
  changeCallback.current = onChange;
  const upload = useRef<HTMLInputElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const flow = useReactFlow<WorkflowNode>();
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let width = element.clientWidth;
    let timer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === 0) return;
      if (Math.abs(element.clientWidth - width) < 16) return;
      width = element.clientWidth;
      clearTimeout(timer);
      timer = setTimeout(() => void flow.fitView({ padding: 0.18, duration: 200 }), 120);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [flow]);
  const selected = workflow.nodes.find((n) => n.id === selectedId);
  const nodes = useMemo(
    () =>
      workflow.nodes.map((n) => ({
        ...n,
        selected: n.id === selectedId,
        data: { ...n.data, status: statuses[n.id] || 'idle' },
      })),
    [workflow.nodes, selectedId, statuses],
  );
  const notify = useCallback((message: string) => setToast(message), []);
  const pendingActivity = useRef<{
    key: string;
    activity: RecordedActivity;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const appendActivity = useCallback(
    (targetStore: ActivityStore, entry: ActivityEntry) => {
      try {
        targetStore.append(entry);
      } catch {
        notify('The activity could not be saved. Your workflow edit is still applied.');
      }
    },
    [notify],
  );
  const flushActivity = useCallback(() => {
    const pending = pendingActivity.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingActivity.current = null;
    appendActivity(pending.activity.store, pending.activity.entry);
  }, [appendActivity]);
  const recordActivity = useCallback(
    (action: string, key?: string) => {
      const pending = pendingActivity.current;
      const username = activityUser.trim() || 'You';
      const coalesced =
        pending?.key === key &&
        pending?.activity.store === store &&
        pending?.activity.entry.username === username
          ? pending
          : null;
      if (coalesced) {
        clearTimeout(coalesced.timer);
      } else {
        flushActivity();
      }
      const entry: ActivityEntry = {
        id: coalesced?.activity.entry.id ?? crypto.randomUUID(),
        username,
        action,
        timestamp: new Date().toISOString(),
      };
      const recorded = coalesced?.activity ?? { entry, store };
      recorded.entry = entry;
      if (key) {
        pendingActivity.current = {
          key,
          activity: recorded,
          timer: setTimeout(flushActivity, 600),
        };
      } else {
        appendActivity(store, entry);
      }
      return recorded;
    },
    [store, activityUser, flushActivity, appendActivity],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: Flush pending edits when the activity destination or author changes, as well as on unmount.
  useEffect(() => flushActivity, [flushActivity, store, activityUser]);
  function changeView(next: 'canvas' | 'activity') {
    flushActivity();
    setModal(null);
    setView(next);
  }
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    changeCallback.current?.(workflow);
    if (!persistenceKey) return;
    setSaved(false);
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(persistenceKey, JSON.stringify(workflow));
        setSaved(true);
      } catch {
        notify('Browser storage is unavailable. Export your workflow to keep a copy.');
      }
    }, 550);
    return () => clearTimeout(timer);
  }, [workflow, persistenceKey, notify]);
  const remember = useCallback(
    (activityKey?: string, before: Workflow = current.current) => {
      const pending = pendingActivity.current;
      const last = history.current.past.at(-1);
      // One coalesced edit has one history entry and one activity entry.
      if (
        activityKey &&
        pending?.key === activityKey &&
        pending.activity.store === store &&
        pending.activity.entry.username === (activityUser.trim() || 'You') &&
        last?.activity === pending.activity
      )
        return last;
      const entry: HistoryEntry = { workflow: copyWorkflow(before) };
      history.current.past.push(entry);
      if (history.current.past.length > 60) history.current.past.shift();
      history.current.future = [];
      refreshHistory((x) => x + 1);
      return entry;
    },
    [store, activityUser],
  );
  const commit = useCallback(
    (update: (w: Workflow) => Workflow, action: string, activityKey?: string) => {
      const next = update(current.current);
      if (JSON.stringify(next) === JSON.stringify(current.current)) return;
      const entry = remember(activityKey);
      current.current = next;
      setWorkflow(next);
      setStatuses({});
      entry.activity = recordActivity(action, activityKey);
    },
    [remember, recordActivity],
  );
  const undo = useCallback(() => {
    const prev = history.current.past.pop();
    if (!prev) return;
    const pending = pendingActivity.current;
    const unpublished = pending && pending.activity === prev.activity;
    if (unpublished) {
      clearTimeout(pending.timer);
      pendingActivity.current = null;
    } else {
      flushActivity();
    }
    history.current.future.push({
      workflow: copyWorkflow(current.current),
      activity: prev.activity,
    });
    current.current = prev.workflow;
    setWorkflow(prev.workflow);
    setSelectedId(null);
    setStatuses({});
    refreshHistory((x) => x + 1);
    if (prev.activity && !unpublished) {
      try {
        prev.activity.store.remove(prev.activity.entry.id);
      } catch {
        notify('The change was undone, but its activity entry could not be removed.');
      }
    }
  }, [flushActivity, notify]);
  const redo = useCallback(() => {
    const next = history.current.future.pop();
    if (!next) return;
    flushActivity();
    history.current.past.push({ workflow: copyWorkflow(current.current), activity: next.activity });
    current.current = next.workflow;
    setWorkflow(next.workflow);
    setSelectedId(null);
    setStatuses({});
    refreshHistory((x) => x + 1);
    if (next.activity) appendActivity(next.activity.store, next.activity.entry);
  }, [flushActivity, appendActivity]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        !(e.metaKey || e.ctrlKey) ||
        e.key.toLowerCase() !== 'z' ||
        (e.target as HTMLElement).closest('input,textarea,[contenteditable]')
      )
        return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPicking(false);
        setModal(null);
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  const onNodesChange = useCallback(
    (changes: NodeChange<WorkflowNode>[]) => {
      // React Flow reports connected-edge and node removals separately. Handle both in onDelete.
      const meaningful = changes.filter((c) => c.type !== 'select' && c.type !== 'remove');
      if (!meaningful.length) return;
      const moved = current.current.nodes.filter((node) =>
        meaningful.some(
          (change) =>
            change.type === 'position' &&
            change.id === node.id &&
            change.position &&
            (change.position.x !== node.position.x || change.position.y !== node.position.y),
        ),
      );
      const keyboardMove = moved.length > 0 && !dragStartPositions.current;
      const activityKey = `move:${moved
        .map((node) => node.id)
        .sort()
        .join(',')}`;
      const entry = keyboardMove ? remember(activityKey) : undefined;
      const next = {
        ...current.current,
        nodes: applyNodeChanges(meaningful, current.current.nodes),
      };
      current.current = next;
      setWorkflow(next);
      if (entry) {
        entry.activity = recordActivity(
          moved.length === 1
            ? `Moved “${moved[0].data.label}” on the canvas`
            : `Moved ${moved.length} steps on the canvas`,
          activityKey,
        );
      }
    },
    [remember, recordActivity],
  );
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const updates = changes.filter((change) => change.type !== 'remove');
    if (!updates.length) return;
    const next = {
      ...current.current,
      edges: applyEdgeChanges(updates, current.current.edges),
    };
    current.current = next;
    setWorkflow(next);
  }, []);
  function onDelete({ nodes, edges }: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }) {
    const removedNodes = new Set(nodes.map((node) => node.id));
    const removedEdges = new Set(edges.map((edge) => edge.id));
    const label = (id: string) => current.current.nodes.find((node) => node.id === id)?.data.label;
    const action = nodes.length
      ? `${nodes.length === 1 ? `Deleted “${nodes[0].data.label}”` : `Deleted ${nodes.length} steps`}${edges.length ? ` and ${edges.length} ${edges.length === 1 ? 'connection' : 'connections'}` : ''}`
      : edges.length === 1
        ? `Disconnected “${label(edges[0].source) ?? 'step'}” from “${label(edges[0].target) ?? 'step'}”`
        : `Removed ${edges.length} connections`;
    commit(
      (w) => ({
        ...w,
        nodes: w.nodes.filter((node) => !removedNodes.has(node.id)),
        edges: w.edges.filter(
          (edge) =>
            !removedEdges.has(edge.id) &&
            !removedNodes.has(edge.source) &&
            !removedNodes.has(edge.target),
        ),
      }),
      action,
    );
    if (selectedId && removedNodes.has(selectedId)) setSelectedId(null);
  }
  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source === connection.target) {
        notify('Connect this step to a different step.');
        return;
      }
      const target = current.current.nodes.find((n) => n.id === connection.target);
      if (target?.data.kind === 'trigger') {
        notify('Triggers begin a journey and cannot receive connections.');
        return;
      }
      const candidate = { ...current.current, edges: addEdge(connection, current.current.edges) };
      const problem = validateWorkflow(candidate).find((i) => /circular|cycle/i.test(i.message));
      if (problem) {
        notify(problem.message);
        return;
      }
      const source = current.current.nodes.find((n) => n.id === connection.source);
      commit(
        (w) => ({ ...w, edges: addEdge({ ...connection, type: 'smoothstep' }, w.edges) }),
        `Connected “${source?.data.label ?? 'step'}” to “${target?.data.label ?? 'step'}”`,
      );
    },
    [commit, notify],
  );
  function add(kind: NodeKind, position?: { x: number; y: number }) {
    const rect = canvas.current?.getBoundingClientRect();
    const point =
      position ||
      (rect
        ? flow.screenToFlowPosition({
            x: rect.left + rect.width / 2 - 100,
            y: rect.top + rect.height / 2 - 60,
          })
        : { x: 200, y: 200 });
    const node = createNode(kind, point);
    commit((w) => ({ ...w, nodes: [...w.nodes, node] }), `Added “${node.data.label}”`);
    setSelectedId(node.id);
    notify(`${catalog.find((c) => c.kind === kind)!.label} added`);
  }
  function patchNode(patch: Partial<StepData>) {
    if (!selected) return;
    commit(
      (w) => ({
        ...w,
        nodes: w.nodes.map((n) =>
          n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n,
        ),
      }),
      patch.label !== undefined
        ? `Renamed a step to “${patch.label}”`
        : `Updated ${patch.description !== undefined ? 'the description of' : 'settings for'} “${selected.data.label}”`,
      `node:${selected.id}:${Object.keys(patch).sort().join(',')}`,
    );
  }
  function removeNode() {
    if (!selected) return;
    commit(
      (w) => ({
        ...w,
        nodes: w.nodes.filter((n) => n.id !== selectedId),
        edges: w.edges.filter((e) => e.source !== selectedId && e.target !== selectedId),
      }),
      `Deleted “${selected.data.label}”`,
    );
    setSelectedId(null);
  }
  function duplicate() {
    if (!selected) return;
    const copy = {
      ...copyWorkflow(workflow).nodes.find((n) => n.id === selected.id)!,
      id: crypto.randomUUID(),
      position: { x: selected.position.x + 40, y: selected.position.y + 190 },
      data: { ...selected.data, label: `${selected.data.label} copy` },
    };
    commit((w) => ({ ...w, nodes: [...w.nodes, copy] }), `Duplicated “${selected.data.label}”`);
    setSelectedId(copy.id);
  }
  const issues = useMemo(() => validateWorkflow(workflow), [workflow]);
  const script = useMemo(() => {
    try {
      return exportWorkflow(workflow);
    } catch {
      return '// Resolve the workflow issues below before exporting.';
    }
  }, [workflow]);
  const code = exportTab === 'javascript' ? script : JSON.stringify(workflow, null, 2);
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      recordActivity(
        `Copied the workflow as ${exportTab === 'javascript' ? 'JavaScript' : 'JSON'}`,
      );
      notify('Copied to clipboard');
    } catch {
      notify('Clipboard is unavailable. Use Download instead.');
    }
  }
  function exportFile() {
    if (exportTab === 'javascript' && issues.length) return;
    const name = workflow.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'workflow';
    download(
      `${name}.${exportTab === 'javascript' ? 'js' : 'json'}`,
      code,
      exportTab === 'javascript' ? 'text/javascript' : 'application/json',
    );
    recordActivity(
      `Exported the workflow as ${exportTab === 'javascript' ? 'JavaScript' : 'JSON'}`,
    );
    if (exportTab === 'javascript') onExport?.(script, workflow);
    notify('Your workflow is ready to go');
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      const value: unknown = JSON.parse(await file.text());
      if (!isWorkflow(value)) throw new Error('Choose a valid Forma workflow JSON file.');
      commit(() => value, `Imported workflow “${value.name}”`);
      setSelectedId(null);
      setTimeout(() => void flow.fitView({ padding: 0.2, duration: 300 }), 80);
      notify('Workflow imported');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not import this file');
    }
    if (upload.current) upload.current.value = '';
  }
  function saveWebsite() {
    try {
      const url = new URL(websiteDraft, window.location.origin);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      commit(
        (w) => ({ ...w, websiteUrl: websiteDraft.trim() }),
        `Changed the target website to “${websiteDraft.trim()}”`,
      );
      setModal(null);
      notify('Target website updated');
    } catch {
      setWebsiteError('Enter an http:// or https:// URL, or a relative website path.');
    }
  }
  async function sendAIMessage(messages: AIChatMessage[], signal: AbortSignal) {
    if (!ai?.endpoint) throw new Error('Connect the assistant service to start chatting.');
    const snapshot = copyWorkflow(current.current);
    const baseline = workflowFingerprint(snapshot);
    const response = await requestAIChat(
      ai,
      {
        messages,
        workflow: snapshot,
        selectedNodeIds: selectedId ? [selectedId] : [],
      },
      signal,
    );
    signal.throwIfAborted();
    if (baseline !== workflowFingerprint(current.current)) {
      throw new Error(
        'The canvas changed while I was working. Send your message again to use the latest version.',
      );
    }
    const updated = applyWorkflowOperations(current.current, response.operations);
    const changed = workflowFingerprint(updated) !== baseline;
    if (changed) {
      commit(
        () => updated,
        `Applied ${response.operations.length} ${response.operations.length === 1 ? 'edit' : 'edits'} with the AI assistant`,
      );
      if (selectedId && !updated.nodes.some((node) => node.id === selectedId)) setSelectedId(null);
      notify('AI updated your workflow. Use Undo to revert this change.');
      requestAnimationFrame(() => void flow.fitView({ padding: 0.2, duration: 300 }));
    }
    return { message: response.message, changeCount: changed ? response.operations.length : 0 };
  }
  return (
    <div className={`dxp-builder ${className}`} style={style}>
      <aside className="dxp-sidebar">
        <button
          type="button"
          className="dxp-brand"
          onClick={() => {
            void flow.fitView({ padding: 0.18, duration: 350 });
          }}
          aria-label="Forma home"
        >
          <span className="dxp-brand-mark">
            <span />
            <span />
            <span />
          </span>
          forma<span className="dxp-brand-period">.</span>
          <span className="dxp-brand-tag">DXP</span>
        </button>
        <div className="dxp-workspace-label">
          <span className="dxp-workspace-icon">
            <Layers2 size={16} />
          </span>
          <div>
            <strong>Personal workspace</strong>
            <span>Your space to create</span>
          </div>
        </div>
        <div className="dxp-sidebar-section">
          <span className="dxp-eyebrow">BUILD SOMETHING GREAT</span>
          <div className="dxp-active-nav">
            <WorkflowIcon size={17} /> Experience builder <span>01</span>
          </div>
        </div>
        <div className="dxp-sidebar-bottom">
          <div className="dxp-tip">
            <span className="dxp-tip-icon">
              <Sparkles size={17} />
            </span>
            <strong>
              Small moments.
              <br />
              Better experiences.
            </strong>
            <p>Connect your ideas. Bring your website to life.</p>
            <button type="button" onClick={() => setModal('help')}>
              A quick introduction <ArrowUpRight size={14} />
            </button>
          </div>
          <button type="button" className="dxp-help-link" onClick={() => setModal('help')}>
            <CircleHelp size={16} /> Help & resources <ArrowUpRight size={13} />
          </button>
          <div className="dxp-profile">
            <span className="dxp-avatar">ME</span>
            <div>
              <strong>My workspace</strong>
              <small>Saved in this browser</small>
            </div>
            <span className="dxp-local-badge">LOCAL</span>
          </div>
        </div>
      </aside>
      <main className="dxp-main">
        <header className="dxp-header">
          <div className="dxp-breadcrumb">
            <Layers2 size={13} />
            <span>Workspace</span>
            <ChevronRight size={12} />
            <span>Experiences</span>
            <ChevronRight size={12} />
            <strong>{workflow.name}</strong>
            <div className="dxp-header-right">
              <span className="dxp-local-indicator" /> Local workspace{' '}
              <button
                type="button"
                className="dxp-icon-button"
                title="Help and keyboard shortcuts"
                onClick={() => setModal('help')}
              >
                <CircleHelp size={16} />
              </button>
            </div>
          </div>
          <div className="dxp-heading">
            <div>
              <div className="dxp-title-row">
                <input
                  aria-label="Workflow name"
                  value={workflow.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    commit(
                      (w) => ({ ...w, name }),
                      `Renamed the workflow to “${name}”`,
                      'workflow:name',
                    );
                  }}
                  onBlur={flushActivity}
                />
                <span className="dxp-draft-badge">DRAFT</span>
              </div>
              <p>A thoughtful first impression, on autopilot.</p>
            </div>
            <div className="dxp-header-actions">
              <button
                type="button"
                className="dxp-button"
                onClick={() => {
                  setStatuses({});
                  setModal('preview');
                  recordActivity(`Opened a test preview of “${workflow.name}”`);
                }}
              >
                <Play size={14} /> Test workflow
              </button>
              <button
                type="button"
                className="dxp-button dxp-button-primary"
                onClick={() => setModal('export')}
              >
                <Code2 size={16} /> Export workflow <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        </header>
        <div className="dxp-toolbar">
          <div
            className="dxp-view-tabs"
            role="tablist"
            aria-label="Builder views"
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const next =
                event.key === 'Home'
                  ? 'canvas'
                  : event.key === 'End'
                    ? 'activity'
                    : view === 'canvas'
                      ? 'activity'
                      : 'canvas';
              changeView(next);
              document.getElementById(`${viewId}-${next}-tab`)?.focus();
            }}
          >
            <button
              type="button"
              role="tab"
              id={`${viewId}-canvas-tab`}
              aria-selected={view === 'canvas'}
              aria-controls={`${viewId}-canvas-panel`}
              tabIndex={view === 'canvas' ? 0 : -1}
              className={view === 'canvas' ? 'active' : ''}
              onClick={() => changeView('canvas')}
            >
              <WorkflowIcon size={15} /> Canvas
            </button>
            <button
              type="button"
              role="tab"
              id={`${viewId}-activity-tab`}
              aria-selected={view === 'activity'}
              aria-controls={`${viewId}-activity-panel`}
              tabIndex={view === 'activity' ? 0 : -1}
              className={view === 'activity' ? 'active' : ''}
              onClick={() => changeView('activity')}
            >
              <History size={15} /> Activity
            </button>
          </div>
          <span className="dxp-toolbar-divider" />
          <span className="dxp-save-state">
            <Check size={13} />
            {persistenceKey ? (saved ? 'All changes saved' : 'Saving…') : 'Ready to build'}
          </span>
          <div className="dxp-toolbar-spacer" />
          <button
            type="button"
            className="dxp-website-button"
            aria-label="Change target website"
            onClick={() => {
              setWebsiteDraft(workflow.websiteUrl);
              setWebsiteError('');
              setModal('website');
            }}
          >
            <Globe2 size={14} />
            <span>
              {workflow.websiteUrl === '/demo-site.html'
                ? 'Atelier · Demo website'
                : workflow.websiteUrl.replace(/^https?:\/\//, '')}
            </span>
            <ChevronDown size={12} />
          </button>
          <span className="dxp-toolbar-divider" />
          <button
            type="button"
            className="dxp-icon-button"
            onClick={undo}
            disabled={!history.current.past.length}
            title="Undo (⌘Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            className="dxp-icon-button"
            onClick={redo}
            disabled={!history.current.future.length}
            title="Redo (⌘⇧Z)"
          >
            <Redo2 size={16} />
          </button>
        </div>
        <div
          className="dxp-work-area"
          role="tabpanel"
          id={`${viewId}-canvas-panel`}
          aria-labelledby={`${viewId}-canvas-tab`}
          hidden={view !== 'canvas'}
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: Dropping is an alternative to the keyboard-accessible node library buttons. */}
          <div
            className="dxp-canvas"
            ref={canvas}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              e.preventDefault();
              const kind = e.dataTransfer.getData('application/forma-node') as NodeKind;
              if (catalog.some((c) => c.kind === kind))
                add(kind, flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
            }}
          >
            <ReactFlow
              nodes={nodes}
              edges={workflow.edges}
              nodeTypes={nodeTypes}
              defaultEdgeOptions={edgeOptions}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onDelete={onDelete}
              onConnect={onConnect}
              onNodeDragStart={() => {
                flushActivity();
                dragStartWorkflow.current = copyWorkflow(current.current);
                dragStartPositions.current = new Map(
                  current.current.nodes.map((node) => [node.id, { ...node.position }]),
                );
              }}
              onNodeDragStop={(_, _node, draggedNodes) => {
                const moved = draggedNodes.filter((node) => {
                  const start = dragStartPositions.current?.get(node.id);
                  return start && (start.x !== node.position.x || start.y !== node.position.y);
                });
                dragStartPositions.current = null;
                if (moved.length && dragStartWorkflow.current) {
                  const entry = remember(undefined, dragStartWorkflow.current);
                  entry.activity = recordActivity(
                    moved.length === 1
                      ? `Moved “${moved[0].data.label}” on the canvas`
                      : `Moved ${moved.length} steps on the canvas`,
                  );
                }
                dragStartWorkflow.current = null;
              }}
              onNodeClick={(_, node) => setSelectedId(node.id)}
              onPaneClick={() => setSelectedId(null)}
              onMove={(_, viewport) => setZoom(Math.round(viewport.zoom * 100))}
              fitView
              fitViewOptions={{ padding: 0.18, minZoom: 0.35, maxZoom: 1 }}
              minZoom={0.25}
              maxZoom={1.8}
              deleteKeyCode={view === 'canvas' ? ['Backspace', 'Delete'] : null}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1.1} color="#d8e0dc" />
              <Panel position="top-left" className="dxp-canvas-heading">
                <div className="dxp-canvas-kicker">
                  <span /> YOUR EXPERIENCE, CONNECTED
                </div>
                <h2>Make every visit feel personal.</h2>
                <p>A few simple steps. A more memorable welcome.</p>
              </Panel>
              <Panel position="top-right">
                <button
                  type="button"
                  className="dxp-import-button"
                  onClick={() => upload.current?.click()}
                  title="Import a workflow JSON file"
                >
                  <Upload size={14} /> Import
                </button>
              </Panel>
              {showMinimap && (
                <MiniMap
                  nodeColor={(n) =>
                    catalog.find((c) => c.kind === n.data.kind)?.color === 'green'
                      ? '#c4e5d5'
                      : '#dfebe6'
                  }
                  maskColor="rgba(241,246,243,.7)"
                  zoomable
                  pannable
                />
              )}
              <Panel position="bottom-left" className="dxp-canvas-dock nodrag nopan nowheel">
                <div className="dxp-canvas-controls">
                  <button
                    type="button"
                    onClick={() => void flow.zoomOut({ duration: 180 })}
                    title="Zoom out"
                  >
                    <ZoomOut size={17} />
                  </button>
                  <span>{zoom}%</span>
                  <button
                    type="button"
                    onClick={() => void flow.zoomIn({ duration: 180 })}
                    title="Zoom in"
                  >
                    <ZoomIn size={17} />
                  </button>
                  <i />
                  <button
                    type="button"
                    onClick={() => void flow.fitView({ padding: 0.18, duration: 300 })}
                    title="Fit all nodes"
                  >
                    <Maximize size={16} />
                  </button>
                  <button
                    type="button"
                    className={showMinimap ? 'active' : ''}
                    onClick={() => setShowMinimap(!showMinimap)}
                    title="Toggle minimap"
                  >
                    <Layers2 size={16} />
                  </button>
                </div>
                <NodeLibrary onAdd={add} />
                <div className="dxp-canvas-assistants">
                  <CanvasChat
                    open={canvasAssistant === 'chat'}
                    onOpenChange={toggleChat}
                    configured={!!ai?.endpoint}
                    selectedLabel={selected?.data.label}
                    onSend={sendAIMessage}
                  />
                  <CanvasHelp open={canvasAssistant === 'help'} onOpenChange={toggleHelp} />
                </div>
              </Panel>
              {workflow.nodes.length === 0 && (
                <Panel position="top-center" className="dxp-empty-canvas">
                  <span>
                    <Plus size={24} />
                  </span>
                  <h2>Every experience starts somewhere.</h2>
                  <p>Add a trigger from the library to begin your journey.</p>
                  <button
                    type="button"
                    className="dxp-button dxp-button-primary"
                    onClick={() => add('trigger')}
                  >
                    Add your first trigger
                  </button>
                </Panel>
              )}
            </ReactFlow>
          </div>
          {selected && (
            <NodeInspector
              node={selected}
              onChange={patchNode}
              onClose={() => setSelectedId(null)}
              onPickElement={() => setPicking(true)}
              onDelete={removeNode}
              onDuplicate={duplicate}
              onPreviewContent={() => setModal('popover-preview')}
            />
          )}
        </div>
        <div
          className="dxp-work-area"
          role="tabpanel"
          id={`${viewId}-activity-panel`}
          aria-labelledby={`${viewId}-activity-tab`}
          hidden={view !== 'activity'}
        >
          {view === 'activity' && <ActivityPanel entries={activity} />}
        </div>
        <footer className="dxp-footer">
          <span>
            <span className="dxp-status-dot" />
            {workflow.nodes.length} nodes <i /> {workflow.edges.length} connections
          </span>
          <span>
            <span className="dxp-footer-label">MADE FOR THE MOMENTS THAT MATTER</span>
            <span className="dxp-footer-shortcut">
              <Command size={11} /> Z to undo
            </span>
          </span>
        </footer>
      </main>
      <input
        ref={upload}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => void importFile(e.target.files?.[0])}
      />
      {toast && (
        <div className="dxp-toast" role="status">
          <Check size={16} />
          {toast}
          <button type="button" onClick={() => setToast('')} aria-label="Dismiss notification">
            <X size={14} />
          </button>
        </div>
      )}
      {picking && selected && (
        <ElementPicker
          url={workflow.websiteUrl}
          initialSelector={selected.data.config.selector}
          onClose={() => setPicking(false)}
          onUrlChange={(url) =>
            commit((w) => ({ ...w, websiteUrl: url }), `Changed the target website to “${url}”`)
          }
          onSelect={(selector) => {
            patchNode({ config: { ...selected.data.config, selector } });
            setPicking(false);
            notify('Target element selected');
          }}
        />
      )}
      {modal === 'preview' && (
        <Preview
          workflow={workflow}
          onClose={() => setModal(null)}
          onLog={(log) => setStatuses((s) => ({ ...s, [log.nodeId]: log.status }))}
        />
      )}
      {modal === 'popover-preview' && selected?.data.kind === 'popover' && (
        <PopoverPreview node={selected} onClose={() => setModal(null)} />
      )}
      {modal && modal !== 'preview' && modal !== 'popover-preview' && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: The close button and Escape key dismiss this dialog for keyboard users.
        // biome-ignore lint/a11y/noStaticElementInteractions: Only the backdrop uses clicks to dismiss the dialog.
        <div className="dxp-modal-backdrop" onClick={() => setModal(null)}>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: This handler only prevents dialog clicks from reaching the backdrop. */}
          <section
            ref={modalRef}
            className={`dxp-modal ${modal === 'export' ? 'dxp-export-modal' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === 'export'
                ? 'Export workflow'
                : modal === 'website'
                  ? 'Target website'
                  : 'About Forma'
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dxp-modal-header">
              <div>
                <span className="dxp-eyebrow">
                  {modal === 'export'
                    ? 'FROM CANVAS TO CODE'
                    : modal === 'website'
                      ? 'YOUR DIGITAL EXPERIENCE'
                      : 'A LITTLE GUIDANCE'}
                </span>
                <h2>
                  {modal === 'export'
                    ? 'Your workflow. Ready for the web.'
                    : modal === 'website'
                      ? 'Choose your website'
                      : 'Make something worth experiencing.'}
                </h2>
              </div>
              <button
                type="button"
                className="dxp-icon-button"
                onClick={() => setModal(null)}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>
            {modal === 'export' ? (
              <>
                <p className="dxp-modal-description">
                  Add this standalone script to your website. Your triggers and actions take it from
                  there.
                </p>
                <div className="dxp-export-tabs">
                  <button
                    type="button"
                    className={exportTab === 'javascript' ? 'active' : ''}
                    onClick={() => setExportTab('javascript')}
                  >
                    <Code2 size={15} /> JavaScript
                  </button>
                  <button
                    type="button"
                    className={exportTab === 'json' ? 'active' : ''}
                    onClick={() => setExportTab('json')}
                  >
                    <FileJson size={15} /> Workflow JSON
                  </button>
                  <span />
                  <button type="button" onClick={copyCode}>
                    <Copy size={14} /> Copy
                  </button>
                </div>
                {issues.length > 0 && (
                  <div className="dxp-validation">
                    <strong>Before you export</strong>
                    {issues.map((issue, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: These stateless validation messages are rendered together without persistent row state.
                      <p key={i}>{issue.message}</p>
                    ))}
                  </div>
                )}
                <pre className="dxp-code">
                  <code>{code}</code>
                </pre>
                <div className="dxp-modal-footer">
                  <span>
                    <Check size={14} /> Standalone. No dependencies.
                  </span>
                  <button
                    type="button"
                    className="dxp-button dxp-button-primary"
                    disabled={exportTab === 'javascript' && issues.length > 0}
                    onClick={exportFile}
                  >
                    <ArrowDownToLine size={16} /> Download{' '}
                    {exportTab === 'javascript' ? '.js' : '.json'}
                  </button>
                </div>
              </>
            ) : modal === 'website' ? (
              <div className="dxp-website-settings">
                <p>Set the website where this experience will happen.</p>
                <label>
                  Website URL
                  <input
                    value={websiteDraft}
                    placeholder="https://your-website.com"
                    onChange={(e) => setWebsiteDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveWebsite();
                    }}
                    // biome-ignore lint/a11y/noAutofocus: The explicitly opened website dialog focuses its primary input and restores focus when closed.
                    autoFocus
                  />
                </label>
                {websiteError && <p className="dxp-error">{websiteError}</p>}
                <div className="dxp-website-note">
                  <Globe2 size={18} />
                  <p>
                    Element selection works directly with same-origin pages. Other websites need the
                    picker bridge and permission to load in an iframe.
                  </p>
                </div>
                <button
                  type="button"
                  className="dxp-demo-link"
                  onClick={() => setWebsiteDraft('/demo-site.html')}
                >
                  <RotateCcw size={13} /> Use the Atelier demo website
                </button>
                <div className="dxp-modal-footer">
                  <button type="button" className="dxp-button" onClick={() => setModal(null)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="dxp-button dxp-button-primary"
                    onClick={saveWebsite}
                  >
                    Save website <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="dxp-help-content">
                <p>
                  Forma turns little ideas into thoughtful digital experiences. Start with a
                  trigger, connect your steps, and make the journey your own.
                </p>
                {[
                  {
                    icon: Plus,
                    title: '1. Start with a step',
                    body: 'Drag a node from the library, or click it to add it to your canvas.',
                  },
                  {
                    icon: WorkflowIcon,
                    title: '2. Connect the moments',
                    body: 'Drag between the circles on your nodes. Conditions follow the top path when an element exists, and the bottom path otherwise.',
                  },
                  {
                    icon: MousePointer2,
                    title: '3. Make it personal',
                    body: 'Click a node to configure it. Use the element picker to choose a target directly on your website.',
                  },
                  {
                    icon: Code2,
                    title: '4. Put it out into the world',
                    body: 'Test your workflow on the demo site, then export a standalone JavaScript file for your own website.',
                  },
                ].map(({ icon: Icon, title, body }) => (
                  <div className="dxp-help-step" key={title}>
                    <span>
                      <Icon size={18} />
                    </span>
                    <div>
                      <h3>{title}</h3>
                      <p>{body}</p>
                    </div>
                  </div>
                ))}
                <div className="dxp-shortcuts">
                  <span>
                    <kbd>⌘ / Ctrl Z</kbd> Undo
                  </span>
                  <span>
                    <kbd>Delete</kbd> Remove selected
                  </span>
                  <span>
                    <kbd>Esc</kbd> Close panel
                  </span>
                </div>
                <button
                  type="button"
                  className="dxp-button dxp-button-primary"
                  onClick={() => setModal(null)}
                >
                  Back to creating <ArrowRight size={14} />
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
