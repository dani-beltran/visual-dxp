import { useId, useState } from 'react';
import { getCatalog } from '../lib/catalog';
import { useBuilderI18n } from '../lib/i18nContext';
import type { NodeKind } from '../lib/types';

export function NodeLibrary({ onAdd }: { onAdd: (kind: NodeKind) => void }) {
  const { t } = useBuilderI18n();
  const catalog = getCatalog(t);
  const tooltipPrefix = useId();
  const [activeTooltip, setActiveTooltip] = useState<NodeKind | null>(null);

  return (
    // biome-ignore lint/a11y/useSemanticElements: This group contains canvas actions rather than form inputs and retains its compact flex layout.
    <div
      className="dxp-node-library-root nodrag nopan nowheel"
      role="group"
      aria-label={t('nodeLibrary.nodeLibrary')}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setActiveTooltip(null);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          setActiveTooltip(null);
        }
      }}
    >
      <div className="dxp-node-library">
        {catalog.map(({ kind, label, description, color, icon: Icon }) => (
          <button
            type="button"
            className={`dxp-node-library-button dxp-color-${color}`}
            data-tutorial={`add-${kind}`}
            key={kind}
            aria-label={t('nodeLibrary.addLabel', { label: String(label) })}
            aria-describedby={activeTooltip === kind ? `${tooltipPrefix}-${kind}` : undefined}
            onClick={() => {
              setActiveTooltip(null);
              onAdd(kind);
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
            {activeTooltip === kind && (
              <span
                className="dxp-node-library-tooltip"
                id={`${tooltipPrefix}-${kind}`}
                role="tooltip"
              >
                <strong>{label}</strong>
                <span>{description}</span>
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
