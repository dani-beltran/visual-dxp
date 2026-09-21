import { Globe2, LoaderCircle, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createRuntime } from '../lib/runtime';
import type { StepConfig, Workflow, WorkflowNode } from '../lib/types';
import { useDialogFocus } from '../lib/useDialogFocus';
import '../styles/popover-preview.css';

const positions: Record<NonNullable<StepConfig['position']>, string> = {
  center: 'Center of screen',
  'top-left': 'Top left',
  'top-right': 'Top right',
  'bottom-left': 'Bottom left',
  'bottom-right': 'Bottom right',
  anchor: 'Next to an element',
};

export function PopoverPreview({ node, onClose }: { node: WorkflowNode; onClose: () => void }) {
  const dialogRef = useDialogFocus(true);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const config = node.data.config;

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    // Events inside the website do not bubble to the builder window.
    const frameWindow = previewDocument?.defaultView;
    window.addEventListener('keydown', close, true);
    frameWindow?.addEventListener('keydown', close, true);
    return () => {
      window.removeEventListener('keydown', close, true);
      frameWindow?.removeEventListener('keydown', close, true);
    };
  }, [onClose, previewDocument]);

  useEffect(() => {
    if (!previewDocument?.defaultView) return;
    let runtime: ReturnType<typeof createRuntime> | undefined;
    let disposed = false;
    setError('');
    const reportError = (cause: unknown) => {
      if (!disposed)
        setError(cause instanceof Error ? cause.message : 'The popover could not be previewed.');
    };
    try {
      if (config.position === 'anchor' && config.selector?.trim()) {
        previewDocument
          .querySelector(config.selector)
          ?.scrollIntoView?.({ block: 'center', behavior: 'instant' });
      }
      const triggerId = `${node.id}-preview-trigger`;
      // Only this popover runs, independently of the rest of the user's workflow.
      const workflow: Workflow = {
        version: 1,
        name: 'Popover preview',
        websiteUrl: '/demo-site.html',
        nodes: [
          {
            id: triggerId,
            type: 'workflow',
            position: { x: 0, y: 0 },
            data: { kind: 'trigger', label: 'Preview', config: { event: 'page-load' } },
          },
          node,
        ],
        edges: [{ id: 'preview-popover', source: triggerId, target: node.id }],
      };
      runtime = createRuntime(workflow, {
        document: previewDocument,
        window: previewDocument.defaultView,
      });
      void runtime.run().catch(reportError);
    } catch (cause) {
      reportError(cause);
    }
    return () => {
      disposed = true;
      runtime?.destroy();
    };
  }, [node, config, previewDocument]);

  function loaded() {
    try {
      const doc = frameRef.current?.contentDocument;
      if (!doc?.body) throw new Error();
      setError('');
      setPreviewDocument(doc);
    } catch {
      setPreviewDocument(null);
      setError('The demo website could not be loaded. Restart the preview to try again.');
    }
  }

  return (
    <section
      ref={dialogRef}
      className="dxp-popover-preview"
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen popover preview"
    >
      <header className="dxp-popover-preview-header">
        <div className="dxp-popover-preview-heading">
          <span className="dxp-eyebrow">CONTENT PREVIEW</span>
          <h2>{node.data.label || 'Popover'}</h2>
        </div>
        <button
          type="button"
          className="dxp-button"
          onClick={() => {
            setPreviewDocument(null);
            setError('');
            setReload((value) => value + 1);
          }}
        >
          <RotateCcw size={14} /> Restart preview
        </button>
        <button
          type="button"
          className="dxp-icon-button"
          onClick={onClose}
          aria-label="Close popover preview"
          title="Close preview (Esc)"
        >
          <X size={20} />
        </button>
      </header>
      <div className="dxp-popover-preview-bar">
        <span>
          <Globe2 size={14} /> Demo website
        </span>
        <span>
          {positions[config.position ?? 'bottom-right']} · {config.width ?? 360} px
        </span>
      </div>
      {error && (
        <p className="dxp-popover-preview-error" role="alert">
          {error}
        </p>
      )}
      <div className="dxp-popover-preview-website">
        {!previewDocument && !error && (
          <div className="dxp-popover-preview-loading" role="status">
            <LoaderCircle className="dxp-spin" size={18} /> Loading demo website…
          </div>
        )}
        <iframe
          key={reload}
          ref={frameRef}
          src="/demo-site.html"
          title="Popover preview website"
          onLoad={loaded}
          onError={() =>
            setError('The demo website could not be loaded. Try restarting the preview.')
          }
        />
      </div>
    </section>
  );
}
