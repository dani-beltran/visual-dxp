import { MousePointer2 } from 'lucide-react';
import { useId } from 'react';
import { useBuilderI18n } from '../../lib/i18nContext';
import { popoverHasForm } from '../../lib/popoverForm';
import type { PopoverSettings } from '../../lib/types';
import { Field, NumberInput } from '../InspectorFields/InspectorFields';
import { Select } from '../Select/Select';

export interface PopoverSettingsFieldsProps {
  config: PopoverSettings;
  onChange: (patch: Partial<PopoverSettings>) => void;
  /** Picking targets the anchor selector; it stops once the position no longer uses one. */
  onPickingChange: (picking: boolean) => void;
  picking: boolean;
  canPick: boolean;
  ready: boolean;
  /** Explains what a form in this content does. Defaults to the Popover node's behavior. */
  formHint?: string;
}

/** Content, placement and appearance fields shared by the Popover and Tour editors. */
export function PopoverSettingsFields({
  config,
  onChange,
  onPickingChange,
  picking,
  canPick,
  ready,
  formHint,
}: PopoverSettingsFieldsProps) {
  const { t } = useBuilderI18n();
  const prefix = useId();
  const id = (name: string) => `${prefix}-${name}`;
  const update = onChange;
  return (
    <>
      <Field label={t('nodeInspector.contentType')} htmlFor={id('content-type')}>
        <Select
          id={id('content-type')}
          value={config.contentType ?? 'html'}
          onChange={(event) =>
            update({ contentType: event.target.value as PopoverSettings['contentType'] })
          }
        >
          <option value="html">{t('nodeInspector.customHtml')}</option>
          <option value="iframe">{t('nodeInspector.embeddedWebsite')}</option>
        </Select>
      </Field>
      {config.contentType === 'iframe' ? (
        <Field
          label={t('nodeInspector.websiteUrl')}
          htmlFor={id('url')}
          hint={t('nodeInspector.theWebsiteMustAllowEmbeddingInAnIframe')}
        >
          <input
            id={id('url')}
            type="url"
            value={config.url ?? ''}
            placeholder="https://example.com"
            onChange={(event) => update({ url: event.target.value })}
            spellCheck={false}
          />
        </Field>
      ) : (
        <Field
          label={t('nodeInspector.htmlContent')}
          htmlFor={id('content')}
          hint={popoverHasForm(config) ? (formHint ?? t('popoverEditor.formDetected')) : undefined}
        >
          <textarea
            id={id('content')}
            className="dxp-inspector-code"
            rows={6}
            value={config.content ?? ''}
            placeholder={'<h2>A little something for you</h2>\n<p>Make yourself at home.</p>'}
            onChange={(event) => update({ content: event.target.value })}
            spellCheck={false}
          />
        </Field>
      )}
      <Field label={t('nodeInspector.position')} htmlFor={id('position')}>
        <Select
          id={id('position')}
          value={config.position ?? 'bottom-right'}
          onChange={(event) => {
            const position = event.target.value as PopoverSettings['position'];
            if (picking && position !== 'anchor') onPickingChange(false);
            update({ position });
          }}
        >
          <option value="center">{t('nodeInspector.centerOfScreen')}</option>
          <option value="top-left">{t('nodeInspector.topLeft')}</option>
          <option value="top-right">{t('nodeInspector.topRight')}</option>
          <option value="bottom-left">{t('nodeInspector.bottomLeft')}</option>
          <option value="bottom-right">{t('nodeInspector.bottomRight')}</option>
          <option value="anchor">{t('nodeInspector.nextToAnElement')}</option>
        </Select>
      </Field>
      {config.position === 'anchor' && (
        <Field
          label={t('nodeInspector.anchorElement')}
          htmlFor={id('selector')}
          hint={
            picking ? undefined : t('nodeInspector.useACssSelectorOrPickAnElementFromYourWebsite')
          }
        >
          <input
            id={id('selector')}
            value={config.selector ?? ''}
            spellCheck={false}
            placeholder={t('nodeInspector.eGSignupButton')}
            onChange={(event) => update({ selector: event.target.value })}
          />
          <button
            type="button"
            className={`dxp-button${picking ? ' dxp-button-primary' : ''}`}
            aria-pressed={picking}
            disabled={!ready || !canPick}
            onClick={() => onPickingChange(!picking)}
          >
            <MousePointer2 size={14} /> {t('nodeInspector.selectOnWebsite')}
          </button>
          {picking && (
            <p className="dxp-inspector-hint" role="status">
              {t('popoverEditor.pickingHint')}
            </p>
          )}
          {ready && !canPick && (
            <p className="dxp-inspector-hint">{t('popoverEditor.pickingUnavailable')}</p>
          )}
        </Field>
      )}
      <Field
        label={t('nodeInspector.popoverAnimation')}
        htmlFor={id('popover-animation')}
        hint={t('nodeInspector.animationHint')}
      >
        <Select
          id={id('popover-animation')}
          value={config.popoverAnimation ?? 'none'}
          onChange={(event) =>
            update({ popoverAnimation: event.target.value as PopoverSettings['popoverAnimation'] })
          }
        >
          <option value="none">{t('nodeInspector.animationNone')}</option>
          <option value="fade">{t('nodeInspector.animationFade')}</option>
          <option value="slide">{t('nodeInspector.animationSlide')}</option>
          <option value="zoom">{t('nodeInspector.animationZoom')}</option>
          <option value="bounce">{t('nodeInspector.animationBounce')}</option>
        </Select>
      </Field>
      <Field
        label={t('nodeInspector.popoverWidth')}
        htmlFor={id('width')}
        hint={t('nodeInspector.chooseAWidthBetween240And960Pixels')}
      >
        <div className="dxp-inspector-unit-field">
          <NumberInput
            id={id('width')}
            min={240}
            max={960}
            step={10}
            value={config.width ?? 360}
            onChange={(width) => update({ width })}
          />
          <span>{t('nodeInspector.px')}</span>
        </div>
      </Field>
    </>
  );
}

export function PopoverEditorPanel(props: PopoverSettingsFieldsProps) {
  const { t } = useBuilderI18n();
  return (
    <aside
      className="dxp-website-editor-panel dxp-popover-editor-panel"
      aria-label={t('popoverEditor.settings')}
    >
      <h3>{t('popoverEditor.settings')}</h3>
      <PopoverSettingsFields {...props} />
    </aside>
  );
}
