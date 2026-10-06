import '../../styles/base.css';
import '../../styles/shared.css';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useBuilderI18n } from '../../lib/i18nContext';
import './NodeContextMenu.css';

export function NodeContextMenu({
  x,
  y,
  onAction,
  onClose,
}: {
  x: number;
  y: number;
  onAction: (action: 'edit' | 'duplicate' | 'delete') => void;
  onClose: () => void;
}) {
  const { t } = useBuilderI18n();
  const menu = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = menu.current;
    const parent = element?.parentElement;
    if (!element || !parent) return;
    element.style.left = `${Math.max(0, Math.min(x, parent.clientWidth - element.offsetWidth))}px`;
    element.style.top = `${Math.max(0, Math.min(y, parent.clientHeight - element.offsetHeight))}px`;
    element.querySelector('button')?.focus();
  }, [x, y]);
  useEffect(() => {
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) onClose();
    };
    document.addEventListener('pointerdown', dismiss, true);
    document.addEventListener('focusin', dismiss);
    window.addEventListener('blur', onClose);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', dismiss, true);
      document.removeEventListener('focusin', dismiss);
      window.removeEventListener('blur', onClose);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);
  return (
    <div
      ref={menu}
      role="menu"
      aria-label={t('nodeInspector.actions')}
      className="dxp-node-context-menu"
      style={{ left: x, top: y }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' || event.key === 'Tab') {
          if (event.key === 'Escape') event.preventDefault();
          event.stopPropagation();
          onClose();
        } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const buttons = [...event.currentTarget.querySelectorAll('button')];
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          buttons[
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? buttons.length - 1
                : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
          ]?.focus();
        }
      }}
    >
      <button type="button" role="menuitem" onClick={() => onAction('edit')}>
        <Pencil size={14} />
        {t('nodeInspector.edit')}
      </button>
      <button type="button" role="menuitem" onClick={() => onAction('duplicate')}>
        <Copy size={14} />
        {t('nodeInspector.duplicate')}
      </button>
      <button type="button" role="menuitem" onClick={() => onAction('delete')}>
        <Trash2 size={14} />
        {t('nodeInspector.delete')}
      </button>
    </div>
  );
}
