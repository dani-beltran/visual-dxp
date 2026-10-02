import {
  Braces,
  CircleHelp,
  Frame,
  Hand,
  MousePointer2,
  Plus,
  StickyNote,
  Workflow,
  X,
} from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { useBuilderI18n } from '../lib/i18nContext';

export function CanvasHelp({
  open: controlledOpen,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} = {}) {
  const { t } = useBuilderI18n();
  const instructions = [
    {
      icon: Plus,
      title: t('canvasHelp.addAStep'),
      text: t('canvasHelp.clickAnIconInTheNodeLibraryOrDragItOntoThe'),
    },
    {
      icon: MousePointer2,
      title: t('canvasHelp.arrangeAndConfigure'),
      text: t('canvasHelp.dragNodesToMoveThemClickANodeToOpenItsSettings'),
    },
    {
      icon: Hand,
      title: t('canvasHelp.moveAroundTheCanvas'),
      text: t('canvasHelp.dragEmptySpaceToPanScrollPinchOrUseTheZoomButtons'),
    },
    {
      icon: StickyNote,
      title: t('canvasHelp.leaveANote'),
      text: t('canvasHelp.addANoteAndTypeDirectlyOnTheCanvasSelectTextThen'),
    },
    {
      icon: Frame,
      title: t('canvasHelp.groupNodesInAFrame'),
      text: t('canvasHelp.addAFrameAndGiveItANameInItsSettingsDrop'),
    },
    {
      icon: Workflow,
      title: t('canvasHelp.connectYourSteps'),
      text: t('canvasHelp.dragFromTheCircleOnTheRightOfOneNodeToThe'),
    },
    {
      icon: Braces,
      title: t('canvasHelp.useVariables'),
      text: t('canvasHelp.useVariablesDescription'),
    },
  ];
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
        aria-label={t('canvasHelp.canvasHelp')}
        title={t('canvasHelp.canvasHelp')}
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
            <h2 id={`${id}-title`}>{t('canvasHelp.howToUseTheCanvas')}</h2>
            <button
              ref={closeButton}
              type="button"
              className="dxp-icon-button"
              aria-label={t('canvasHelp.closeCanvasHelp')}
              onClick={close}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <section
            className="dxp-canvas-help-content"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: The scrollable instructions must be keyboard-focusable for scrolling.
            tabIndex={0}
            aria-label={t('canvasHelp.canvasInstructions')}
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
                <dt>{t('common.undo')}</dt>
                <dd>
                  <kbd>{t('canvasHelp.ctrlZ')}</kbd>
                </dd>
              </div>
              <div>
                <dt>{t('common.redo')}</dt>
                <dd>
                  <kbd>{t('canvasHelp.ctrlShiftZ')}</kbd>
                </dd>
              </div>
              <div>
                <dt>{t('canvasHelp.removeSelected')}</dt>
                <dd>
                  <kbd>{t('canvasHelp.deleteBackspace')}</kbd>
                </dd>
              </div>
            </dl>
          </section>
        </section>
      )}
    </div>
  );
}
