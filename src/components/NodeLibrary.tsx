import { Plus } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { catalog } from '../lib/catalog';
import type { NodeKind } from '../lib/types';

export function NodeLibrary({ onAdd }: { onAdd: (kind: NodeKind) => void }) {
  const [activeTooltip, setActiveTooltip] = useState<NodeKind | null>(null);
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    setActiveTooltip(null);
    trigger.current?.focus();
  }

  useLayoutEffect(() => {
    if (!open || !root.current) return;
    const element = root.current;
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !element.contains(event.target)) {
        setOpen(false);
        setActiveTooltip(null);
      }
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setActiveTooltip(null);
      trigger.current?.focus();
    };
    const observer = new ResizeObserver(() => {
      if (trigger.current && getComputedStyle(trigger.current).display === 'none') {
        setOpen(false);
        setActiveTooltip(null);
      }
    });
    if (element.parentElement) observer.observe(element.parentElement);
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissEscape, true);
    return () => {
      observer.disconnect();
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissEscape, true);
    };
  }, [open]);

  return (
    // biome-ignore lint/a11y/useSemanticElements: This group contains canvas actions rather than form inputs and retains its compact flex layout.
    <div
      className={`dxp-node-library-root nodrag nopan nowheel${open ? ' is-open' : ''}`}
      ref={root}
      role="group"
      aria-label="Node library"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
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
      <button
        ref={trigger}
        type="button"
        className="dxp-node-library-toggle"
        aria-label="Node library"
        title="Node library"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Plus size={20} aria-hidden="true" />
      </button>
      <div id={id} className="dxp-node-library">
        {catalog.map(({ kind, label, color, icon: Icon }) => (
          <button
            type="button"
            className={`dxp-node-library-button dxp-color-${color}`}
            key={kind}
            aria-label={`Add ${label}`}
            onClick={() => {
              setActiveTooltip(null);
              if (open) close();
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
            onDragEnd={() => {
              if (open) close();
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
