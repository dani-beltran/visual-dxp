import { useState } from 'react';
import { catalog } from '../lib/catalog';
import type { NodeKind } from '../lib/types';

export function NodeLibrary({ onAdd }: { onAdd: (kind: NodeKind) => void }) {
  const [activeTooltip, setActiveTooltip] = useState<NodeKind | null>(null);

  return (
    <div
      className="dxp-node-library nodrag nopan nowheel"
      role="group"
      aria-label="Node library"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          setActiveTooltip(null);
        }
      }}
    >
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
            event.dataTransfer.setData('application/forma-node', kind);
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
  );
}
