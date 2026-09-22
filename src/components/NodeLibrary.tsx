import { useState } from 'react';
import { catalog } from '../lib/catalog';
import type { NodeKind } from '../lib/types';

export function NodeLibrary({ onAdd }: { onAdd: (kind: NodeKind) => void }) {
  const [activeTooltip, setActiveTooltip] = useState<NodeKind | null>(null);

  return (
    // biome-ignore lint/a11y/useSemanticElements: This group contains canvas actions rather than form inputs and retains its compact flex layout.
    <div
      className="dxp-node-library-root nodrag nopan nowheel"
      role="group"
      aria-label="Node library"
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
        {catalog.map(({ kind, label, color, icon: Icon }) => (
          <button
            type="button"
            className={`dxp-node-library-button dxp-color-${color}`}
            key={kind}
            aria-label={`Add ${label}`}
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
              event.dataTransfer.setData('application/dlb-dxp-node', kind);
              event.dataTransfer.effectAllowed = 'move';
            }}
          >
            <Icon size={20} aria-hidden="true" />
            {activeTooltip === kind && (
              <span className="dxp-node-library-tooltip" aria-hidden="true">
                {label}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
