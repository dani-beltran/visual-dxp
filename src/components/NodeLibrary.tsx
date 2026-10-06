import { Ellipsis } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { getCatalog } from '../lib/catalog';
import { useBuilderI18n } from '../lib/i18nContext';
import type { NodeKind } from '../lib/types';

export function NodeLibrary({ onAdd }: { onAdd: (kind: NodeKind) => void }) {
  const { t } = useBuilderI18n();
  const catalog = getCatalog(t);
  const tooltipPrefix = useId();
  const [activeTooltip, setActiveTooltip] = useState<NodeKind | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const [visibleCount, setVisibleCount] = useState(catalog.length);
  const [overflowOpen, setOverflowOpen] = useState(false);

  useLayoutEffect(() => {
    const element = rootRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const resize = () => {
      // Wait for layout when the canvas is hidden or has not been measured yet.
      if (!element.clientHeight) return;
      // Each slot is 28px plus a 4px gap; padding and borders take 18px.
      const slots = Math.max(1, Math.floor((element.clientHeight - 18 + 4) / 32));
      setVisibleCount(slots >= catalog.length ? catalog.length : slots - 1);
      setOverflowOpen(false);
      setActiveTooltip(null);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => observer.disconnect();
  }, [catalog.length]);

  useLayoutEffect(() => {
    if (!overflowOpen) return;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOverflowOpen(false);
        setActiveTooltip(null);
      }
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [overflowOpen]);

  const renderNode = (
    { kind, label, description, color, icon: Icon }: (typeof catalog)[number],
    overflow = false,
  ) => (
    <button
      type="button"
      className={`dxp-node-library-button dxp-color-${color}`}
      data-tutorial={`add-${kind}`}
      key={kind}
      aria-label={t('nodeLibrary.addLabel', { label: String(label) })}
      aria-describedby={
        !overflow && activeTooltip === kind ? `${tooltipPrefix}-${kind}` : undefined
      }
      onClick={() => {
        setActiveTooltip(null);
        onAdd(kind);
        if (overflow) {
          setOverflowOpen(false);
          moreRef.current?.focus();
        }
      }}
      onMouseEnter={() => setActiveTooltip(kind)}
      onMouseLeave={() => setActiveTooltip(null)}
      onFocus={() => setActiveTooltip(kind)}
      onBlur={() => setActiveTooltip(null)}
      draggable
      onDragStart={(event) => {
        setActiveTooltip(null);
        event.dataTransfer.setData('application/visual-dxp-node', kind);
        event.dataTransfer.effectAllowed = 'move';
      }}
    >
      <Icon size={20} aria-hidden="true" />
      {overflow && <span>{label}</span>}
      {!overflow && activeTooltip === kind && (
        <span className="dxp-node-library-tooltip" id={`${tooltipPrefix}-${kind}`} role="tooltip">
          <strong>{label}</strong>
          <span>{description}</span>
        </span>
      )}
    </button>
  );

  return (
    // biome-ignore lint/a11y/useSemanticElements: This group contains canvas actions rather than form inputs and retains its compact flex layout.
    <div
      ref={rootRef}
      className="dxp-node-library-root nodrag nopan nowheel"
      role="group"
      aria-label={t('nodeLibrary.nodeLibrary')}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setActiveTooltip(null);
          setOverflowOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          if (overflowOpen) moreRef.current?.focus();
          setOverflowOpen(false);
          setActiveTooltip(null);
        }
      }}
    >
      <div className="dxp-node-library">
        {catalog.slice(0, visibleCount).map((entry) => renderNode(entry))}
        {visibleCount < catalog.length && (
          <button
            ref={moreRef}
            type="button"
            className="dxp-node-library-button dxp-node-library-more"
            aria-label={t('nodeLibrary.moreNodes')}
            title={t('nodeLibrary.moreNodes')}
            aria-expanded={overflowOpen}
            aria-controls={`${tooltipPrefix}-overflow`}
            onClick={() => setOverflowOpen((open) => !open)}
          >
            <Ellipsis size={20} aria-hidden="true" />
          </button>
        )}
      </div>
      {overflowOpen && visibleCount < catalog.length && (
        <div className="dxp-node-library-overflow" id={`${tooltipPrefix}-overflow`}>
          {catalog.slice(visibleCount).map((entry) => renderNode(entry, true))}
        </div>
      )}
    </div>
  );
}
