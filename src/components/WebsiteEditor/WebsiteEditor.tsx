import { Monitor, Smartphone } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { useBuilderI18n } from '../../lib/i18nContext';
import './WebsiteEditor.css';

export function PreviewDeviceToggle({
  device,
  onChange,
}: {
  device: 'desktop' | 'mobile';
  onChange: (device: 'desktop' | 'mobile') => void;
}) {
  const { t } = useBuilderI18n();
  return (
    <fieldset className="dxp-editor-device-toggle" aria-label={t('pageEditor.previewDevice')}>
      {(['desktop', 'mobile'] as const).map((option) => {
        const Icon = option === 'desktop' ? Monitor : Smartphone;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={device === option}
            onClick={() => onChange(option)}
          >
            <Icon size={14} aria-hidden="true" />
            {t(option === 'desktop' ? 'nodeInspector.desktop' : 'nodeInspector.mobile')}
          </button>
        );
      })}
    </fieldset>
  );
}

export function EditorDiscardDialog({
  title,
  onKeepEditing,
  onDiscard,
}: {
  title: string;
  onKeepEditing: () => void;
  onDiscard: () => void;
}) {
  const { t } = useBuilderI18n();
  const headingId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const prior = document.activeElement as HTMLElement | null;
    dialog.showModal?.();
    dialog.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      dialog.close?.();
      if (prior?.isConnected) prior.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dxp-editor-discard"
      aria-labelledby={headingId}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        onKeepEditing();
      }}
    >
      <h2 id={headingId}>{title}</h2>
      <div className="dxp-editor-discard-actions">
        <button type="button" className="dxp-button" onClick={onKeepEditing}>
          {t('pageEditor.keepEditing')}
        </button>
        <button type="button" className="dxp-button dxp-button-primary" onClick={onDiscard}>
          {t('pageEditor.discard')}
        </button>
      </div>
    </dialog>
  );
}
