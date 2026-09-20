import { CircleHelp, Hand, MousePointer2, Plus, StickyNote, Workflow, X } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState } from 'react';

const instructions = [
  {
    icon: Plus,
    title: 'Add a step',
    text: 'Click an icon in the node library or drag it onto the canvas. Hover over an icon to see its name. Start your journey with a Trigger.',
  },
  {
    icon: MousePointer2,
    title: 'Arrange and configure',
    text: 'Drag nodes to move them. Click a node to open its settings, where you can also duplicate or delete it.',
  },
  {
    icon: StickyNote,
    title: 'Leave a note',
    text: 'Add a Note and type directly on the canvas. Select text, then use its settings to make that selection bold, italic, or struck through. You can also change the background or choose transparency. Drag its header to move it.',
  },
  {
    icon: Workflow,
    title: 'Connect your steps',
    text: 'Drag from the circle on the right of one node to the circle on the left of another. A Condition uses its top output when the element exists and its bottom output otherwise.',
  },
  {
    icon: Hand,
    title: 'Move around the canvas',
    text: 'Drag empty space to pan. Scroll, pinch, or use the zoom buttons to zoom. Fit all nodes brings the whole journey into view; the minimap gives you an overview.',
  },
];

export function CanvasHelp({
  open: controlledOpen,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [panelSize, setPanelSize] = useState({ width: 360, maxHeight: 460 });
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    button.current?.focus();
  }

  useLayoutEffect(() => {
    if (!open || !root.current || !button.current) return;
    const element = root.current;
    const trigger = button.current;
    const canvas = element.closest('.dxp-canvas');
    const dock = element.parentElement;
    if (!canvas || !dock) return;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const anchor = trigger.getBoundingClientRect();
      setPanelSize({
        width: Math.min(360, Math.max(0, anchor.right - bounds.left - 16)),
        maxHeight: Math.min(460, Math.max(0, anchor.top - bounds.top - 28)),
      });
    };
    resize();
    closeButton.current?.focus();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    observer.observe(dock);
    window.addEventListener('resize', resize);

    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !element.contains(event.target)) setOpen(false);
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.focus();
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissEscape, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissEscape, true);
    };
  }, [open, setOpen]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Bubbling blur closes the help panel when focus leaves its controls.
    <div
      className="dxp-canvas-tip"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        className={`dxp-canvas-help-button ${open ? 'active' : ''}`}
        aria-label="Canvas help"
        title="Canvas help"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <CircleHelp size={18} aria-hidden="true" />
      </button>
      {open && (
        <section
          id={id}
          className="dxp-canvas-help-panel nodrag nopan nowheel"
          style={panelSize}
          role="dialog"
          aria-labelledby={`${id}-title`}
        >
          <div className="dxp-canvas-help-header">
            <h2 id={`${id}-title`}>How to use the canvas</h2>
            <button
              ref={closeButton}
              type="button"
              className="dxp-icon-button"
              aria-label="Close canvas help"
              onClick={close}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <section
            className="dxp-canvas-help-content"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: The scrollable instructions must be keyboard-focusable for scrolling.
            tabIndex={0}
            aria-label="Canvas instructions"
          >
            {instructions.map(({ icon: Icon, title, text }) => (
              <div className="dxp-canvas-help-step" key={title}>
                <Icon size={17} aria-hidden="true" />
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
            <dl className="dxp-canvas-help-shortcuts">
              <div>
                <dt>Undo</dt>
                <dd>
                  <kbd>⌘ / Ctrl + Z</kbd>
                </dd>
              </div>
              <div>
                <dt>Redo</dt>
                <dd>
                  <kbd>⌘ / Ctrl + Shift + Z</kbd>
                </dd>
              </div>
              <div>
                <dt>Remove selected</dt>
                <dd>
                  <kbd>Delete / Backspace</kbd>
                </dd>
              </div>
            </dl>
          </section>
        </section>
      )}
    </div>
  );
}
