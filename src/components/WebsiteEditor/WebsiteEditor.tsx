import { Monitor, RefreshCw, Smartphone, X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef } from 'react';
import { useBuilderI18n } from '../../lib/i18nContext';
import './WebsiteEditor.css';

export function WebsitePreviewHeader({
  icon,
  title,
  description,
  titleId,
  closeLabel,
  onClose,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  titleId?: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <header className="dxp-website-preview-header">
      <div className="dxp-website-preview-heading">
        <div className="dxp-editor-title-icon">{icon}</div>
        <div className="dxp-editor-heading">
          <h2 id={titleId}>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <button type="button" className="dxp-icon-button" onClick={onClose} aria-label={closeLabel}>
        <X size={20} />
      </button>
    </header>
  );
}

export function WebsitePreviewToolbar({
  className = '',
  url,
  device,
  onDeviceChange,
  onReload,
  children,
  actions,
}: {
  className?: string;
  url: string;
  device: 'desktop' | 'mobile';
  onDeviceChange: (device: 'desktop' | 'mobile') => void;
  onReload: () => void;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const { t } = useBuilderI18n();
  return (
    <div className={`dxp-website-preview-toolbar ${className}`}>
      <span className="dxp-website-preview-url">
        <span className="dxp-status-dot" aria-hidden="true" />
        {url === '/demo-site.html' ? t('popoverPreview.demoWebsite') : url}
      </span>
      {children}
      <div className="dxp-website-preview-devices">
        <PreviewDeviceToggle device={device} onChange={onDeviceChange} />
        <button
          type="button"
          className="dxp-button"
          title={t('preview.reloadWebsite')}
          aria-label={t('preview.reloadWebsite')}
          onClick={onReload}
        >
          <RefreshCw size={14} aria-hidden="true" />
        </button>
      </div>
      {actions && (
        <>
          <span className="dxp-website-preview-divider" aria-hidden="true" />
          <div className="dxp-website-preview-actions">{actions}</div>
        </>
      )}
    </div>
  );
}

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
