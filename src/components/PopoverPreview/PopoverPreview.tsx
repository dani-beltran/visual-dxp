import { PanelTop } from 'lucide-react';
import type { ReactNode } from 'react';
import { useBuilderI18n } from '../../lib/i18nContext';
import type { StepConfig, WorkflowNode } from '../../lib/types';
import { PopoverEditorDialog } from './PopoverEditorDialog';
import { PopoverEditorPanel } from './PopoverEditorPanel';

/** Fullscreen popover editor. Only Save writes the local draft to the workflow. */
export function PopoverPreview({
  node,
  websiteUrl,
  onClose,
  onSave,
  guidance,
}: {
  guidance?: ReactNode;
  node: WorkflowNode;
  websiteUrl: string;
  onClose: () => void;
  onSave: (config: StepConfig) => void;
}) {
  const { t } = useBuilderI18n();
  return (
    <PopoverEditorDialog
      node={node}
      websiteUrl={websiteUrl}
      onClose={onClose}
      onSave={onSave}
      guidance={guidance}
      icon={<PanelTop size={19} aria-hidden="true" />}
      text={{
        title: t('popoverEditor.editPopover'),
        description: t('popoverEditor.description'),
        unsavedChanges: t('popoverEditor.unsavedChanges'),
        previewHint: t('popoverEditor.previewHint'),
        cancelTitle: t('popoverEditor.cancelTitle'),
        previewTitle: t('popoverPreview.popoverPreviewWebsite'),
      }}
      pickPatch={(_, selector) => ({ selector })}
      renderPanel={({ config, update, picking, setPicking, canPick, ready }) => (
        <PopoverEditorPanel
          config={config}
          onChange={update}
          picking={picking}
          onPickingChange={setPicking}
          canPick={canPick}
          ready={ready}
        />
      )}
    />
  );
}
