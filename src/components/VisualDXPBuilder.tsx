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
  ArrowRight,
  Check,
  ChevronDown,
  Command,
  Globe2,
  History,
  KeyRound,
  Layers2,
  LayoutTemplate,
  Maximize,
  Plus,
  Redo2,
  RotateCcw,
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
import {
  type ActivityAction,
  type ActivityEntry,
  type ActivityStore,
  activityAction,
  createActivityStore,
} from '../lib/activity';
import {
  type AIChatConfig,
  type AIChatMessage,
  applyWorkflowOperations,
  requestAIChat,
  workflowFingerprint,
} from '../lib/ai';
import {
  AI_PROVIDER_LABELS,
  AIConfigurationError,
  allowsBrowserCredentials,
  resolveAIEndpoint,
} from '../lib/aiCredentials';
import { AISettingsStore } from '../lib/aiSettings';
import { createNode, defaultWorkflow, getCatalog } from '../lib/catalog';
import type { ConnectionPreview } from '../lib/connections';
import { validateWorkflow } from '../lib/export';
import { getFlowLabels } from '../lib/flowLabels';
import { duplicateNode, framesFirst, groupNodes, nodeSize, removeNodes } from '../lib/frames';
import type { BuilderI18n } from '../lib/i18n';
import { formatBuilderError } from '../lib/i18n';
import { BuilderI18nProvider, useBuilderI18n } from '../lib/i18nContext';
import { getNodeDataFlow } from '../lib/nodeData';
import { NoteEditingContext } from '../lib/noteEditing';
import { NoteSelectionProvider, useNoteSelection } from '../lib/noteSelection';
import { normalizeWebsiteUrl } from '../lib/picker';
import { isWorkflow } from '../lib/serialization';
import { resolveWebsiteUrl, validateExportTarget, websiteUrlInputValue } from '../lib/targeting';
import type {
  NodeKind,
  RunLog,
  StepConfig,
  StepData,
  Workflow,
  WorkflowEdge,
  WorkflowNode,
  WorkflowPreset,
} from '../lib/types';
import { useDialogFocus } from '../lib/useDialogFocus';
import { ActivityPanel } from './ActivityPanel';
import { AISettings } from './AISettings';
import { CanvasChat } from './CanvasChat';
import { CanvasHelp } from './CanvasHelp';
import { EdgeInspector } from './EdgeInspector';
import { ElementPicker } from './ElementPicker';
import { InfoBox } from './InfoBox';
import { NodeInspector } from './NodeInspector';
import { NodeLibrary } from './NodeLibrary';
import { PopoverPreview } from './PopoverPreview';
import { PresetsPanel } from './PresetsPanel';
import { Preview } from './Preview';
import { WebsiteConnectionCheck } from './WebsiteConnectionCheck';
import { WorkflowCard } from './WorkflowCard';
import '@xyflow/react/dist/style.css';
import '../styles/builder.css';

const nodeTypes = { workflow: WorkflowCard };
const edgeOptions = {
  type: 'smoothstep',
  style: { stroke: 'var(--dxp-edge)', strokeWidth: 1.6 },
  labelStyle: { fill: 'var(--dxp-muted)', fontSize: 11 },
  labelBgStyle: { fill: 'var(--dxp-canvas)' },
  labelBgPadding: [7, 5] as [number, number],
  labelBgBorderRadius: 4,
};
export interface WebsiteConfigurationOptions {
  /** Require a production target before saving, then resume the host's export flow. */
  requireExportable?: boolean;
  onSave?: (workflow: Workflow) => void;
}
export interface VisualDXPBuilderApi {
  /** Read the latest committed workflow, including edits not yet delivered to onChange. */
  getWorkflow: () => Workflow;
  /** Open the existing target website dialog. Cancellation never invokes onSave. */
  configureWebsite: (options?: WebsiteConfigurationOptions) => void;
  /** Open the built-in test preview using the current workflow. */
  testWorkflow: () => void;
  /** Rename the workflow through the editor's undo and activity history. */
  renameWorkflow: (name: string) => void;
  /** Fit all nodes into the canvas viewport. */
  fitView: () => void;
  /** Publish any coalesced activity, for example when a host input loses focus. */
  flushActivity: () => void;
}
export interface VisualDXPBuilderProps {
  /** Host-supplied translations; omitted messages fall back to English. */
  i18n?: BuilderI18n;
  initialWorkflow?: Workflow;
  /** Optional configurations shown in Presets. Applying replaces the graph as one undoable edit. */
  presets?: readonly WorkflowPreset[];
  /** Receives the initial/restored workflow and every edit as a JSON-serializable object. */
  onChange?: (workflow: Workflow) => void;
  /** Exposes editor actions to the host; receives null when detached. Use a stable callback. */
  onReady?: (api: VisualDXPBuilderApi | null) => void;
  className?: string;
  style?: CSSProperties;
  persistenceKey?: string;
  /** One activity store per workflow; the host owns server synchronization. */
  activityStore?: ActivityStore;
  /** Username attached to actions taken in this builder. Defaults to "You". */
  activityUser?: string;
  /** Connect to your server endpoint; never include provider keys. */
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
type BuilderView = 'canvas' | 'presets' | 'activity' | 'settings';
function copyWorkflow(w: Workflow): Workflow {
  return { ...structuredClone(w), includeSubpages: w.includeSubpages ?? false };
}
export function VisualDXPBuilder(props: VisualDXPBuilderProps) {
  return (
    <BuilderI18nProvider i18n={props.i18n}>
      <ReactFlowProvider>
        <NoteSelectionProvider>
          <Builder {...props} />
        </NoteSelectionProvider>
      </ReactFlowProvider>
    </BuilderI18nProvider>
  );
}
function Builder({
  initialWorkflow = defaultWorkflow,
  presets,
  onChange,
  onReady,
  className = '',
  style,
  persistenceKey,
  activityStore,
  activityUser = 'You',
  ai,
}: VisualDXPBuilderProps) {
  const { t, locale, direction } = useBuilderI18n();
  const catalog = getCatalog(t);
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
  const [view, setView] = useState<BuilderView>('canvas');
  const showPresets = Boolean(presets?.length);
  const viewId = useId();
  useEffect(() => {
    if (!showPresets && view === 'presets') {
      setView('canvas');
      document.getElementById(`${viewId}-canvas-tab`)?.focus();
    }
  }, [showPresets, view, viewId]);
  const aiEnabled = Boolean(ai?.endpoint?.trim());
  const showAISettings = aiEnabled && ai?.showSettings !== false;
  const [aiSettings] = useState(() => new AISettingsStore());
  const aiSettingsState = useSyncExternalStore(
    aiSettings.subscribe,
    aiSettings.getSnapshot,
    aiSettings.getSnapshot,
  );
  const [aiRequestConfigurationError, setAIRequestConfigurationError] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: A settings or endpoint change invalidates the previous connection failure.
  useEffect(() => {
    setAIRequestConfigurationError(false);
  }, [aiSettingsState.effectiveRevision, ai?.endpoint]);
  let aiConfigurationError = aiRequestConfigurationError;
  if (aiEnabled && ai) {
    try {
      const destination = resolveAIEndpoint(ai.endpoint);
      aiConfigurationError ||=
        aiSettingsState.status === 'locked' ||
        aiSettingsState.status === 'unavailable' ||
        (aiSettingsState.status === 'unlocked' &&
          (!allowsBrowserCredentials(destination) || aiSettings.needsConfirmation(ai.endpoint)));
    } catch {
      aiConfigurationError = true;
    }
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: Changing the application destination must cancel pending requests and revoke unlocked keys.
  useEffect(() => {
    if (!aiEnabled) {
      aiSettings.lock();
      return;
    }
    aiSettings.refresh();
    window.addEventListener('storage', aiSettings.refresh);
    window.addEventListener('pagehide', aiSettings.lock);
    return () => {
      aiSettings.lock();
      window.removeEventListener('storage', aiSettings.refresh);
      window.removeEventListener('pagehide', aiSettings.lock);
    };
  }, [aiEnabled, aiSettings, ai?.endpoint]);
  useEffect(() => {
    if (!showAISettings && view === 'settings') setView('canvas');
  }, [showAISettings, view]);
  const [workflow, setWorkflow] = useState<Workflow>(() => {
    if (persistenceKey)
      try {
        const saved = JSON.parse(localStorage.getItem(persistenceKey) || 'null');
        if (isWorkflow(saved)) return copyWorkflow(saved);
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
  const resizeStartWorkflow = useRef<Workflow | null>(null);
  const [, refreshHistory] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [canvasAssistant, setCanvasAssistant] = useState<'chat' | 'help' | null>(null);
  const [assistantRevision, setAssistantRevision] = useState(0);
  const { setSelection: setNoteSelection } = useNoteSelection();
  const toggleChat = useCallback((open: boolean) => setCanvasAssistant(open ? 'chat' : null), []);
  const toggleHelp = useCallback((open: boolean) => setCanvasAssistant(open ? 'help' : null), []);
  const [modal, setModal] = useState<'preview' | 'popover-preview' | 'website' | null>(null);
  const [picking, setPicking] = useState(false);
  const [toast, setToast] = useState('');
  const [saved, setSaved] = useState(true);
  const [connectionPreviews, setConnectionPreviews] = useState<Record<string, ConnectionPreview>>(
    {},
  );
  const [statuses, setStatuses] = useState<Record<string, RunLog['status']>>({});
  const [showMinimap, setShowMinimap] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [websiteDraft, setWebsiteDraft] = useState(() => websiteUrlInputValue(workflow.websiteUrl));
  const [includeSubpagesDraft, setIncludeSubpagesDraft] = useState(
    workflow.includeSubpages ?? false,
  );
  const [websiteError, setWebsiteError] = useState('');
  const websiteOptions = useRef<WebsiteConfigurationOptions>({});
  const configureWebsite = useCallback((options: WebsiteConfigurationOptions = {}) => {
    websiteOptions.current = options;
    setWebsiteDraft(websiteUrlInputValue(current.current.websiteUrl ?? ''));
    setIncludeSubpagesDraft(current.current.includeSubpages ?? false);
    setWebsiteError('');
    setModal('website');
  }, []);
  const closeWebsite = useCallback(() => {
    websiteOptions.current = {};
    setModal(null);
  }, []);
  let websiteScope: URL | undefined;
  let websiteConnectionUrl: string | undefined;
  try {
    const target = resolveWebsiteUrl(websiteDraft.trim() || '/demo-site.html');
    if (target.href !== resolveWebsiteUrl('/demo-site.html').href) websiteScope = target;
    if (websiteScope)
      websiteConnectionUrl = normalizeWebsiteUrl(websiteDraft, window.location.href);
  } catch {
    // The save action reports invalid input; omit scope until it can be parsed.
  }
  const modalRef = useDialogFocus(modal === 'website');
  const changeCallback = useRef(onChange);
  changeCallback.current = onChange;
  const upload = useRef<HTMLInputElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const flow = useReactFlow<WorkflowNode>();
  const [fitPreset, setFitPreset] = useState(false);
  useEffect(() => {
    if (!fitPreset || view !== 'canvas') return;
    // Queue fitting after React commits the new graph and reveals the canvas.
    // React Flow waits for node measurements before fulfilling fitView.
    const frame = requestAnimationFrame(() => {
      void flow.fitView({ padding: 0.2, duration: 300 });
      setFitPreset(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [fitPreset, view, flow.fitView]);
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
  const selectedEdge = workflow.edges.find((edge) => edge.id === selectedEdgeId);
  const nodes = useMemo(
    () =>
      framesFirst(workflow.nodes).map((n) => ({
        ...n,
        ...(n.data.kind === 'frame'
          ? {
              ...nodeSize(n),
              style: { ...n.style, ...nodeSize(n) },
              zIndex: -1,
              dragHandle: '.dxp-frame-header',
            }
          : {}),
        selected: n.id === selectedId,
        data: { ...n.data, status: statuses[n.id] || 'idle' },
      })),
    [workflow.nodes, selectedId, statuses],
  );
  const edges = useMemo(() => {
    const dataFlows = new Map(
      workflow.nodes.map((node) => [
        node.id,
        getNodeDataFlow(node.id, workflow.nodes, workflow.edges),
      ]),
    );
    return workflow.edges.map((edge) => {
      const sourceFlow = dataFlows.get(edge.source);
      const carriesData =
        (sourceFlow === 'produces' || sourceFlow === 'forwards') &&
        dataFlows.get(edge.target) !== undefined;
      return {
        ...edge,
        ...(typeof edge.label === 'string' && edge.label ? { ariaLabel: edge.label } : {}),
        ...(carriesData ? { className: `${edge.className ?? ''} dxp-edge-data`.trim() } : {}),
      };
    });
  }, [workflow.nodes, workflow.edges]);

  const translation = useRef(t);
  translation.current = t;
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
        notify(t('builder.theActivityCouldNotBeSavedYourWorkflowEditIsStillApplied'));
      }
    },
    [notify, t],
  );
  const flushActivity = useCallback(() => {
    const pending = pendingActivity.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingActivity.current = null;
    appendActivity(pending.activity.store, pending.activity.entry);
  }, [appendActivity]);
  const recordActivity = useCallback(
    (action: ActivityAction, key?: string) => {
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
        ...action,
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
  function changeView(next: BuilderView) {
    flushActivity();
    closeWebsite();
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
        notify(
          translation.current('builder.browserStorageIsUnavailableExportYourWorkflowToKeepACopy'),
        );
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
    (update: (w: Workflow) => Workflow, action: ActivityAction, activityKey?: string) => {
      const next = update(current.current);
      if (JSON.stringify(next) === JSON.stringify(current.current)) return;
      const entry = remember(activityKey);
      current.current = next;
      setWorkflow(next);
      setStatuses({});
      setConnectionPreviews({});
      entry.activity = recordActivity(action, activityKey);
    },
    [remember, recordActivity],
  );
  const api = useMemo<VisualDXPBuilderApi>(
    () => ({
      getWorkflow: () => copyWorkflow(current.current),
      configureWebsite,
      testWorkflow: () => {
        setStatuses({});
        setConnectionPreviews({});
        setPicking(false);
        setModal('preview');
        recordActivity(activityAction('activity.previewOpened', { name: current.current.name }));
      },
      renameWorkflow: (name) => {
        commit(
          (w) => ({ ...w, name }),
          activityAction('activity.workflowRenamed', { name }),
          'workflow:name',
        );
      },
      fitView: () => {
        void flow.fitView({ padding: 0.18, duration: 350 });
      },
      flushActivity,
    }),
    [commit, recordActivity, flow.fitView, flushActivity, configureWebsite],
  );
  useEffect(() => {
    onReady?.(api);
    return () => onReady?.(null);
  }, [onReady, api]);
  const editNote = useCallback(
    (id: string, patch: Partial<StepConfig>) => {
      const note = current.current.nodes.find((node) => node.id === id);
      if (note?.data.kind !== 'note') return;
      commit(
        (w) => ({
          ...w,
          nodes: w.nodes.map((node) =>
            node.id === id
              ? { ...node, data: { ...node.data, config: { ...node.data.config, ...patch } } }
              : node,
          ),
        }),
        activityAction('activity.settingsUpdated', { label: note.data.label }),
        `node:${id}:config`,
      );
    },
    [commit],
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
    setSelectedEdgeId(null);
    setStatuses({});
    setConnectionPreviews({});
    refreshHistory((x) => x + 1);
    if (prev.activity && !unpublished) {
      try {
        prev.activity.store.remove(prev.activity.entry.id);
      } catch {
        notify(t('builder.theChangeWasUndoneButItsActivityEntryCouldNotBeRemoved'));
      }
    }
  }, [flushActivity, notify, t]);
  const redo = useCallback(() => {
    const next = history.current.future.pop();
    if (!next) return;
    flushActivity();
    history.current.past.push({ workflow: copyWorkflow(current.current), activity: next.activity });
    current.current = next.workflow;
    setWorkflow(next.workflow);
    setSelectedId(null);
    setSelectedEdgeId(null);
    setStatuses({});
    setConnectionPreviews({});
    refreshHistory((x) => x + 1);
    if (next.activity) appendActivity(next.activity.store, next.activity.entry);
  }, [flushActivity, appendActivity]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        !(e.metaKey || e.ctrlKey) ||
        e.key.toLowerCase() !== 'z' ||
        ((e.target as HTMLElement).closest('input,textarea,[contenteditable]') &&
          !(e.target as HTMLElement).closest('.dxp-note-editor'))
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
        closeWebsite();
        setSelectedId(null);
        setSelectedEdgeId(null);
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [closeWebsite]);
  const onNodesChange = useCallback(
    (changes: NodeChange<WorkflowNode>[]) => {
      // React Flow reports connected-edge and node removals separately. Handle both in onDelete.
      const meaningful = changes.filter((c) => c.type !== 'select' && c.type !== 'remove');
      if (!meaningful.length) return;
      const resize = meaningful.find(
        (change) => change.type === 'dimensions' && change.resizing !== undefined,
      );
      if (resize?.type === 'dimensions' && resize.resizing && !resizeStartWorkflow.current) {
        flushActivity();
        resizeStartWorkflow.current = copyWorkflow(current.current);
      }
      const moved = current.current.nodes.filter((node) =>
        meaningful.some(
          (change) =>
            change.type === 'position' &&
            change.id === node.id &&
            change.position &&
            (change.position.x !== node.position.x || change.position.y !== node.position.y),
        ),
      );
      const keyboardMove =
        moved.length > 0 && !dragStartPositions.current && !resizeStartWorkflow.current;
      const activityKey = `move:${moved
        .map((node) => node.id)
        .sort()
        .join(',')}`;
      const entry = keyboardMove ? remember(activityKey) : undefined;
      const next = {
        ...current.current,
        nodes: applyNodeChanges(meaningful, current.current.nodes),
      };
      if (keyboardMove) next.nodes = groupNodes(next.nodes, new Set(moved.map((node) => node.id)));
      if (resize?.type === 'dimensions' && !resize.resizing && resizeStartWorkflow.current) {
        next.nodes = groupNodes(
          next.nodes,
          new Set(
            next.nodes
              .filter((node) => !node.parentId || node.parentId === resize.id)
              .map((node) => node.id),
          ),
          resize.id,
        );
        const entry = remember(undefined, resizeStartWorkflow.current);
        entry.activity = recordActivity(
          activityAction('activity.nodeResized', {
            label: next.nodes.find((node) => node.id === resize.id)?.data.label ?? '',
          }),
        );
        resizeStartWorkflow.current = null;
      }
      current.current = next;
      setWorkflow(next);
      if (entry) {
        entry.activity = recordActivity(
          moved.length === 1
            ? activityAction('activity.nodeMoved', { label: moved[0].data.label })
            : activityAction('activity.nodesMoved', { count: moved.length }),
          activityKey,
        );
      }
    },
    [remember, recordActivity, flushActivity],
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
    const selection = updates.find((change) => change.type === 'select' && change.selected);
    if (selection?.type === 'select') {
      setSelectedId(null);
      setSelectedEdgeId(selection.id);
    } else {
      setSelectedEdgeId((id) =>
        next.edges.some((edge) => edge.id === id && edge.selected) ? id : null,
      );
    }
  }, []);
  function onDelete({ nodes, edges }: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }) {
    const removedNodes = new Set(nodes.map((node) => node.id));
    const removedEdges = new Set(edges.map((edge) => edge.id));
    const label = (id: string) => current.current.nodes.find((node) => node.id === id)?.data.label;
    const action = nodes.length
      ? activityAction('activity.deleted', {
          count: nodes.length,
          label: nodes[0].data.label,
          connections: edges.length,
        })
      : edges.length === 1
        ? activityAction('activity.disconnected', {
            source: label(edges[0].source) ?? '',
            target: label(edges[0].target) ?? '',
          })
        : activityAction('activity.connectionsRemoved', { count: edges.length });
    commit(
      (w) => ({
        ...w,
        nodes: removeNodes(w.nodes, removedNodes),
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
    if (selectedEdge && !current.current.edges.some((edge) => edge.id === selectedEdge.id))
      setSelectedEdgeId(null);
  }
  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source === connection.target) {
        notify(t('builder.connectThisStepToADifferentStep'));
        return;
      }
      const target = current.current.nodes.find((n) => n.id === connection.target);
      const source = current.current.nodes.find((n) => n.id === connection.source);
      if (source?.data.kind === 'note' || target?.data.kind === 'note') {
        notify(t('builder.notesAreCanvasAnnotationsAndCannotBeConnected'));
        return;
      }
      if (source?.data.kind === 'frame' || target?.data.kind === 'frame') {
        notify(t('builder.connectTheStepsInsideAFrameToBuildYourWorkflow'));
        return;
      }
      if (target?.data.kind === 'trigger') {
        notify(t('builder.triggersBeginAJourneyAndCannotReceiveConnections'));
        return;
      }
      const candidate = { ...current.current, edges: addEdge(connection, current.current.edges) };
      const problem = validateWorkflow(candidate, t).find(
        (issue) => issue.code === 'workflow.cycle',
      );
      if (problem) {
        notify(problem.message);
        return;
      }
      commit(
        (w) => ({ ...w, edges: addEdge({ ...connection, type: 'smoothstep' }, w.edges) }),
        activityAction('activity.connected', {
          source: source?.data.label ?? '',
          target: target?.data.label ?? '',
        }),
      );
    },
    [commit, notify, t],
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
    node.data.label = t(`nodes.${kind}.label`);
    commit(
      (w) => ({
        ...w,
        nodes: groupNodes(
          [...w.nodes, node],
          new Set(
            kind === 'frame'
              ? w.nodes.filter((entry) => !entry.parentId).map((entry) => entry.id)
              : [node.id],
          ),
          kind === 'frame' ? node.id : undefined,
        ),
      }),
      activityAction('activity.nodeAdded', { label: node.data.label }),
    );
    setSelectedId(node.id);
    setSelectedEdgeId(null);
    notify(
      t('builder.labelAdded', {
        label: String(catalog.find((c) => c.kind === kind)!.label),
      }),
    );
  }
  function patchNode(patch: Partial<StepData>) {
    if (!selected) return;
    const inputSamples =
      selected?.data.kind === 'transform' && patch.config
        ? Object.fromEntries(
            workflow.edges
              .filter((edge) => edge.target === selectedId && connectionPreviews[edge.id])
              .map((edge) => [edge.id, connectionPreviews[edge.id]]),
          )
        : undefined;
    commit(
      (w) => ({
        ...w,
        nodes: w.nodes.map((n) =>
          n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n,
        ),
      }),
      patch.label !== undefined
        ? activityAction('activity.nodeRenamed', { kind: selected.data.kind, label: patch.label })
        : patch.description !== undefined
          ? activityAction('activity.descriptionUpdated', { label: selected.data.label })
          : activityAction('activity.settingsUpdated', { label: selected.data.label }),
      `node:${selected.id}:${Object.keys(patch).sort().join(',')}`,
    );
    if (inputSamples) setConnectionPreviews(inputSamples);
  }
  function renameEdge(label: string) {
    if (!selectedEdge) return;
    const nodeLabel = (id: string) => workflow.nodes.find((node) => node.id === id)?.data.label;
    commit(
      (w) => ({
        ...w,
        edges: w.edges.map((edge) => (edge.id === selectedEdge.id ? { ...edge, label } : edge)),
      }),
      activityAction('activity.connectionRenamed', {
        source: nodeLabel(selectedEdge.source) ?? '',
        target: nodeLabel(selectedEdge.target) ?? '',
        label,
      }),
      `edge:${selectedEdge.id}:label`,
    );
  }
  function removeNode() {
    if (!selected) return;
    commit(
      (w) => ({
        ...w,
        nodes: removeNodes(w.nodes, new Set([selected.id])),
        edges: w.edges.filter((e) => e.source !== selectedId && e.target !== selectedId),
      }),
      activityAction('activity.nodeDeleted', { label: selected.data.label }),
    );
    setSelectedId(null);
  }
  function duplicate() {
    if (!selected) return;
    const copy = duplicateNode(current.current, selected);
    commit(
      () => copy.workflow,
      activityAction('activity.nodeDuplicated', { label: selected.data.label }),
    );
    setSelectedId(copy.selectedId);
    setSelectedEdgeId(null);
  }
  function applyPreset(preset: WorkflowPreset): string | undefined {
    let next: Workflow;
    try {
      if (!isWorkflow(preset.workflow)) throw new Error(t('builder.invalidWorkflowStructure'));
      next = copyWorkflow(preset.workflow);
      // Empty presets reset the canvas; execution still requires a runnable workflow.
      const issues =
        next.nodes.length === 0 && next.edges.length === 0 ? [] : validateWorkflow(next, t);
      if (issues.length) throw new Error(issues.map((issue) => issue.message).join(' '));
    } catch (error) {
      return t('builder.couldNotApplyNameValue', {
        name: String(preset.name),
        value: String(error instanceof Error ? formatBuilderError(error, t) : 'Invalid workflow.'),
      });
    }
    // Discard saved editor state as well as the current editor's transient state.
    for (const node of next.nodes) {
      delete node.selected;
      delete node.dragging;
      delete node.resizing;
      delete node.measured;
      delete node.data.status;
    }
    for (const edge of next.edges) delete edge.selected;
    commit(
      (w) => ({ ...w, name: next.name, nodes: next.nodes, edges: next.edges }),
      activityAction('activity.presetApplied', { name: preset.name }),
    );
    setSelectedId(null);
    setSelectedEdgeId(null);
    setNoteSelection(null);
    setStatuses({});
    setConnectionPreviews({});
    setPicking(false);
    setCanvasAssistant(null);
    // Unmount the chat to cancel pending requests and discard stale graph context.
    setAssistantRevision((revision) => revision + 1);
    dragStartPositions.current = null;
    dragStartWorkflow.current = null;
    resizeStartWorkflow.current = null;
    changeView('canvas');
    document.getElementById(`${viewId}-canvas-tab`)?.focus();
    setFitPreset(true);
    notify(
      t('builder.appliedNameUseUndoToRestoreYourPreviousWorkflow', {
        name: String(preset.name),
      }),
    );
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      const value: unknown = JSON.parse(await file.text());
      if (!isWorkflow(value)) throw new Error(t('builder.chooseAValidVisualDxpWorkflowJsonFile'));
      commit(
        () => copyWorkflow(value),
        activityAction('activity.workflowImported', { name: value.name }),
      );
      setSelectedId(null);
      setSelectedEdgeId(null);
      setTimeout(() => void flow.fitView({ padding: 0.2, duration: 300 }), 80);
      notify(t('builder.workflowImported'));
    } catch (e) {
      notify(e instanceof Error ? formatBuilderError(e, t) : t('builder.couldNotImportThisFile'));
    }
    if (upload.current) upload.current.value = '';
  }
  function saveWebsite() {
    try {
      const websiteUrl = websiteDraft.trim() || '/demo-site.html';
      resolveWebsiteUrl(websiteUrl);
      const next = {
        ...current.current,
        websiteUrl,
        includeSubpages: includeSubpagesDraft,
      };
      if (websiteOptions.current.requireExportable) validateExportTarget(next);
      commit(
        () => next,
        activityAction('activity.websiteConfigured', {
          url: next.websiteUrl,
          includeSubpages: includeSubpagesDraft,
        }),
      );
      const onSave = websiteOptions.current.onSave;
      closeWebsite();
      notify(t('builder.targetWebsiteUpdated'));
      onSave?.(copyWorkflow(next));
    } catch (error) {
      setWebsiteError(formatBuilderError(error, t));
    }
  }
  async function sendAIMessage(
    messages: AIChatMessage[],
    signal: AbortSignal,
    onText?: (text: string) => void,
  ) {
    if (!aiEnabled || !ai) throw new Error(t('builder.connectTheAssistantServiceToStartChatting'));
    const snapshot = copyWorkflow(current.current);
    const baseline = workflowFingerprint(snapshot);
    const controller = new AbortController();
    const override = aiSettings.forRequest(ai.endpoint, controller);
    const response = await requestAIChat(
      ai,
      {
        messages,
        workflow: snapshot,
        selectedNodeIds: selectedId ? [selectedId] : [],
      },
      AbortSignal.any([signal, controller.signal]),
      override,
      onText,
    )
      .then((result) => {
        setAIRequestConfigurationError(false);
        return result;
      })
      .catch((error: unknown) => {
        if (!signal.aborted && !controller.signal.aborted && error instanceof AIConfigurationError)
          setAIRequestConfigurationError(true);
        throw error;
      })
      .finally(() => aiSettings.finishRequest(controller));
    signal.throwIfAborted();
    controller.signal.throwIfAborted();
    if (baseline !== workflowFingerprint(current.current)) {
      throw new Error(t('builder.theCanvasChangedWhileIWasWorkingSendYourMessageAgainTo'));
    }
    const updated = applyWorkflowOperations(current.current, response.operations);
    const changed = workflowFingerprint(updated) !== baseline;
    if (changed) {
      commit(
        () => updated,
        activityAction('activity.aiEditsApplied', { count: response.operations.length }),
      );
      if (selectedId && !updated.nodes.some((node) => node.id === selectedId)) setSelectedId(null);
      if (selectedEdgeId && !updated.edges.some((edge) => edge.id === selectedEdgeId))
        setSelectedEdgeId(null);
      notify(t('builder.aiUpdatedYourWorkflowUseUndoToRevertThisChange'));
      requestAnimationFrame(() => void flow.fitView({ padding: 0.2, duration: 300 }));
    }
    return { message: response.message, changeCount: changed ? response.operations.length : 0 };
  }
  return (
    <div lang={locale} dir={direction} className={`dxp-builder ${className}`} style={style}>
      <div className="dxp-toolbar">
        <div
          className="dxp-view-tabs"
          role="tablist"
          aria-label={t('builder.builderViews')}
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const tabs: BuilderView[] = ['canvas'];
            if (showPresets) tabs.push('presets');
            tabs.push('activity');
            if (showAISettings) tabs.push('settings');
            const index = tabs.indexOf(view);
            const next =
              event.key === 'Home'
                ? tabs[0]
                : event.key === 'End'
                  ? tabs[tabs.length - 1]
                  : tabs[
                      (index +
                        ((event.key === 'ArrowRight') === (direction === 'ltr')
                          ? 1
                          : tabs.length - 1)) %
                        tabs.length
                    ];
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
            <WorkflowIcon size={15} /> {t('builder.canvas')}
          </button>
          {showPresets && (
            <button
              type="button"
              role="tab"
              id={`${viewId}-presets-tab`}
              aria-selected={view === 'presets'}
              aria-controls={`${viewId}-presets-panel`}
              tabIndex={view === 'presets' ? 0 : -1}
              className={view === 'presets' ? 'active' : ''}
              onClick={() => changeView('presets')}
            >
              <LayoutTemplate size={15} /> {t('builder.presets')}
            </button>
          )}
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
            <History size={15} /> {t('builder.activity')}
          </button>
          {showAISettings && (
            <button
              type="button"
              role="tab"
              id={`${viewId}-settings-tab`}
              aria-selected={view === 'settings'}
              aria-controls={`${viewId}-settings-panel`}
              tabIndex={view === 'settings' ? 0 : -1}
              className={view === 'settings' ? 'active' : ''}
              onClick={() => changeView('settings')}
            >
              <KeyRound size={15} /> {t('builder.aiSettings')}
            </button>
          )}
        </div>
        <span className="dxp-toolbar-divider" />
        <span className="dxp-save-state">
          <Check size={13} />
          {persistenceKey
            ? saved
              ? t('builder.allChangesSaved')
              : t('builder.saving')
            : t('builder.readyToBuild')}
        </span>
        <div className="dxp-toolbar-spacer" />
        <button
          type="button"
          className="dxp-website-button"
          aria-label={t('builder.changeTargetWebsite')}
          onClick={() => configureWebsite()}
        >
          <Globe2 size={14} />
          <span>
            {workflow.websiteUrl === '/demo-site.html'
              ? t('builder.demoWebsite')
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
          title={t('builder.undoZ')}
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          className="dxp-icon-button"
          onClick={redo}
          disabled={!history.current.future.length}
          title={t('builder.redoZ')}
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
            const kind = e.dataTransfer.getData('application/visual-dxp-node') as NodeKind;
            if (catalog.some((c) => c.kind === kind))
              add(kind, flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
          }}
        >
          <NoteEditingContext.Provider value={editNote}>
            <ReactFlow
              ariaLabelConfig={getFlowLabels(t)}
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              defaultEdgeOptions={edgeOptions}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onDelete={onDelete}
              onBeforeDelete={async ({ nodes, edges }) => {
                const candidates = new Set(nodes.map((node) => node.id));
                const removed = nodes.filter(
                  (node) => node.selected || !node.parentId || !candidates.has(node.parentId),
                );
                const ids = new Set(removed.map((node) => node.id));
                return {
                  nodes: removed,
                  edges: edges.filter(
                    (edge) => edge.selected || ids.has(edge.source) || ids.has(edge.target),
                  ),
                };
              }}
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
                const next = {
                  ...current.current,
                  nodes: groupNodes(current.current.nodes, new Set(moved.map((node) => node.id))),
                };
                current.current = next;
                setWorkflow(next);
                dragStartPositions.current = null;
                if (moved.length && dragStartWorkflow.current) {
                  const entry = remember(undefined, dragStartWorkflow.current);
                  entry.activity = recordActivity(
                    moved.length === 1
                      ? activityAction('activity.nodeMoved', { label: moved[0].data.label })
                      : activityAction('activity.nodesMoved', { count: moved.length }),
                  );
                }
                dragStartWorkflow.current = null;
              }}
              onNodeClick={(_, node) => {
                flushActivity();
                setSelectedId(node.id);
                setSelectedEdgeId(null);
              }}
              onEdgeClick={(_, edge) => {
                flushActivity();
                setSelectedId(null);
                setSelectedEdgeId(edge.id);
              }}
              onPaneClick={() => {
                flushActivity();
                setSelectedId(null);
                setSelectedEdgeId(null);
              }}
              onMove={(_, viewport) => setZoom(Math.round(viewport.zoom * 100))}
              fitView
              fitViewOptions={{ padding: 0.18, minZoom: 0.35, maxZoom: 1 }}
              minZoom={0.25}
              maxZoom={1.8}
              elevateNodesOnSelect={false}
              deleteKeyCode={view === 'canvas' ? ['Backspace', 'Delete'] : null}
              proOptions={{ hideAttribution: true }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1.1}
                color="var(--dxp-grid)"
              />
              <Panel position="top-left" className="dxp-node-library-panel">
                <NodeLibrary onAdd={add} />
              </Panel>
              <Panel position="top-right">
                <button
                  type="button"
                  className="dxp-import-button"
                  onClick={() => upload.current?.click()}
                  title={t('builder.importAWorkflowJsonFile')}
                >
                  <Upload size={14} /> {t('builder.import')}
                </button>
              </Panel>
              {showMinimap && (
                <MiniMap
                  nodeColor={(n) =>
                    catalog.find((c) => c.kind === n.data.kind)?.color === 'green'
                      ? '#c4e5d5'
                      : '#dfebe6'
                  }
                  maskColor="var(--dxp-minimap-mask)"
                  zoomable
                  pannable
                />
              )}
              <Panel position="bottom-left" className="dxp-canvas-dock nodrag nopan nowheel">
                <div className="dxp-canvas-controls">
                  <button
                    type="button"
                    onClick={() => void flow.zoomOut({ duration: 180 })}
                    title={t('canvas.zoomOut')}
                  >
                    <ZoomOut size={17} />
                  </button>
                  <span>
                    {new Intl.NumberFormat(locale, { style: 'percent' }).format(zoom / 100)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void flow.zoomIn({ duration: 180 })}
                    title={t('canvas.zoomIn')}
                  >
                    <ZoomIn size={17} />
                  </button>
                  <i />
                  <button
                    type="button"
                    onClick={() => void flow.fitView({ padding: 0.18, duration: 300 })}
                    title={t('builder.fitAllNodes')}
                  >
                    <Maximize size={16} />
                  </button>
                  <button
                    type="button"
                    className={showMinimap ? 'active' : ''}
                    onClick={() => setShowMinimap(!showMinimap)}
                    title={t('builder.toggleMinimap')}
                  >
                    <Layers2 size={16} />
                  </button>
                </div>
                <div className="dxp-canvas-assistants">
                  {aiEnabled && (
                    <CanvasChat
                      key={assistantRevision}
                      open={canvasAssistant === 'chat'}
                      onOpenChange={toggleChat}
                      configured={aiEnabled}
                      activeProvider={AI_PROVIDER_LABELS[aiSettingsState.activeProvider]}
                      locked={aiSettingsState.status === 'locked'}
                      configurationError={aiConfigurationError}
                      selectedLabel={selected?.data.label}
                      onSend={sendAIMessage}
                    />
                  )}
                  <CanvasHelp open={canvasAssistant === 'help'} onOpenChange={toggleHelp} />
                </div>
              </Panel>
              {workflow.nodes.length === 0 && (
                <Panel position="top-center" className="dxp-empty-canvas">
                  <span>
                    <Plus size={24} />
                  </span>
                  <h2>{t('builder.everyExperienceStartsSomewhere')}</h2>
                  <p>{t('builder.addATriggerFromTheLibraryToBeginYourJourney')}</p>
                  <button
                    type="button"
                    className="dxp-button dxp-button-primary"
                    onClick={() => add('trigger')}
                  >
                    {t('builder.addYourFirstTrigger')}
                  </button>
                </Panel>
              )}
            </ReactFlow>
          </NoteEditingContext.Provider>
        </div>
        {selected && (
          <NodeInspector
            node={selected}
            forwardsData={
              getNodeDataFlow(selected.id, workflow.nodes, workflow.edges) === 'forwards'
            }
            onChange={patchNode}
            onClose={() => setSelectedId(null)}
            onPickElement={() => setPicking(true)}
            onDelete={removeNode}
            onDuplicate={duplicate}
            onPreviewContent={() => setModal('popover-preview')}
          />
        )}
        {selectedEdge && (
          <EdgeInspector
            edge={selectedEdge}
            sourceLabel={
              workflow.nodes.find((node) => node.id === selectedEdge.source)?.data.label ??
              t('builder.step')
            }
            targetLabel={
              workflow.nodes.find((node) => node.id === selectedEdge.target)?.data.label ??
              t('builder.step')
            }
            onChange={renameEdge}
            onBlur={flushActivity}
            onDelete={() => onDelete({ nodes: [], edges: [selectedEdge] })}
            onClose={() => {
              flushActivity();
              setSelectedEdgeId(null);
            }}
          />
        )}
      </div>
      {showPresets && presets && (
        <div
          className="dxp-work-area"
          role="tabpanel"
          id={`${viewId}-presets-panel`}
          aria-labelledby={`${viewId}-presets-tab`}
          hidden={view !== 'presets'}
        >
          {view === 'presets' && <PresetsPanel presets={presets} onApply={applyPreset} />}
        </div>
      )}
      <div
        className="dxp-work-area"
        role="tabpanel"
        id={`${viewId}-activity-panel`}
        aria-labelledby={`${viewId}-activity-tab`}
        hidden={view !== 'activity'}
      >
        {view === 'activity' && <ActivityPanel entries={activity} />}
      </div>
      {showAISettings && (
        <div
          className="dxp-work-area"
          role="tabpanel"
          id={`${viewId}-settings-panel`}
          aria-labelledby={`${viewId}-settings-tab`}
          hidden={view !== 'settings'}
        >
          {view === 'settings' && <AISettings store={aiSettings} endpoint={ai!.endpoint} />}
        </div>
      )}
      <footer className="dxp-footer">
        <span>
          <span className="dxp-status-dot" />
          {t('canvas.nodeCount', { count: workflow.nodes.length })} <i />{' '}
          {t('canvas.connectionCount', { count: workflow.edges.length })}
        </span>
          <span>
            <a
              className="dxp-footer-link"
              href="https://github.com/dani-beltran"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="dxp-footer-label">
              {t('builder.createdWithLoveByDanielJLBeltran')}
              </span>
            </a>
            <a
              className="dxp-footer-link"
              href="https://reactflow.dev"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="dxp-footer-label">
              {t('builder.reactFlowAttribution')} 
              </span>
            </a>
            <span className="dxp-footer-shortcut">
              <Command size={11} /> {t('builder.zToUndo')}
            </span>
        </span>
      </footer>
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
          <button
            type="button"
            onClick={() => setToast('')}
            aria-label={t('builder.dismissNotification')}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {picking && selected && (
        <ElementPicker
          url={workflow.websiteUrl}
          initialSelector={
            selected.data.kind === 'experiment'
              ? selected.data.config.experimentSelector
              : selected.data.config.selector
          }
          onClose={() => setPicking(false)}
          onSelect={(selector) => {
            patchNode({
              config: {
                ...selected.data.config,
                [selected.data.kind === 'experiment' ? 'experimentSelector' : 'selector']: selector,
              },
            });
            setPicking(false);
            notify(t('builder.targetElementSelected'));
          }}
        />
      )}
      {modal === 'preview' && (
        <Preview
          workflow={workflow}
          onClose={() => setModal(null)}
          onPreviewStart={() => setConnectionPreviews({})}
          onConnectionPreview={(id, preview) =>
            setConnectionPreviews((samples) => ({ ...samples, [id]: preview }))
          }
          onLog={(log) => setStatuses((s) => ({ ...s, [log.nodeId]: log.status }))}
        />
      )}
      {modal === 'popover-preview' && selected?.data.kind === 'popover' && (
        <PopoverPreview
          node={selected}
          websiteUrl={workflow.websiteUrl}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'website' && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: The close button and Escape key dismiss this dialog for keyboard users.
        // biome-ignore lint/a11y/noStaticElementInteractions: Only the backdrop uses clicks to dismiss the dialog.
        <div className="dxp-modal-backdrop" onClick={closeWebsite}>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: This handler only prevents dialog clicks from reaching the backdrop. */}
          <section
            ref={modalRef}
            className="dxp-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t('builder.targetWebsite')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dxp-modal-header">
              <div>
                <span className="dxp-eyebrow">{t('builder.yourDigitalExperience')}</span>
                <h2>{t('builder.chooseYourWebsite')}</h2>
              </div>
              <button
                type="button"
                className="dxp-icon-button"
                onClick={closeWebsite}
                aria-label={t('builder.closeDialog')}
              >
                <X size={20} />
              </button>
            </div>
            <div className="dxp-website-settings">
              <p>{t('builder.thisExperienceWillRunOnlyOnThePageAtThisUrl')}</p>
              {websiteOptions.current.requireExportable && (
                <p className="dxp-error" role="alert">
                  {t('website.exportTargetRequired')}
                </p>
              )}
              <label>
                {t('builder.websiteUrl')}
                <input
                  aria-invalid={Boolean(websiteError)}
                  aria-describedby={websiteError ? `${viewId}-website-error` : undefined}
                  value={websiteDraft}
                  placeholder={t('builder.leaveEmptyToUseTheDemoWebsite')}
                  onChange={(e) => setWebsiteDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveWebsite();
                  }}
                  // biome-ignore lint/a11y/noAutofocus: The explicitly opened website dialog focuses its primary input and restores focus when closed.
                  autoFocus
                />
              </label>
              {websiteScope && (
                <div className="dxp-website-scope" role="status">
                  <InfoBox>
                    <strong>
                      {t('builder.effectiveScope')} {websiteScope.href}
                    </strong>
                    <br />
                    {t('builder.trailingSlashesQueryParametersAndFragmentsDoNotChangeTheScope')}
                  </InfoBox>
                </div>
              )}
              {websiteError && (
                <p id={`${viewId}-website-error`} className="dxp-error" role="alert">
                  {websiteError}
                </p>
              )}
              <label className="dxp-subpages-option">
                <input
                  type="checkbox"
                  checked={includeSubpagesDraft}
                  onChange={(event) => setIncludeSubpagesDraft(event.target.checked)}
                  aria-describedby={`${viewId}-subpages-help`}
                />
                {t('builder.includeSubpages')}
              </label>
              <p id={`${viewId}-subpages-help`} className="dxp-subpages-help">
                {t('builder.alsoRunThisExperienceOnPagesBeneathThisUrl')}
              </p>
              {websiteConnectionUrl && (
                <WebsiteConnectionCheck key={websiteConnectionUrl} url={websiteConnectionUrl} />
              )}
              {websiteConnectionUrl && (
                <>
                  <button
                    type="button"
                    className="dxp-demo-link"
                    onClick={() => setWebsiteDraft('')}
                  >
                    <RotateCcw size={13} /> {t('builder.useTheDemoWebsite')}
                  </button>
                </>
              )}
              <div className="dxp-modal-footer">
                <button type="button" className="dxp-button" onClick={closeWebsite}>
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="dxp-button dxp-button-primary"
                  onClick={saveWebsite}
                >
                  {t('website.save')} <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
