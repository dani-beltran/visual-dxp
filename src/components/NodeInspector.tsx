import {
  ArrowDown,
  ArrowRight,
  Braces,
  Copy,
  Frame,
  Info,
  Maximize2,
  MousePointer2,
  Repeat2,
  ScanLine,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { createAnalyticsTools } from '../lib/analytics';
import { getCatalog } from '../lib/catalog';
import { validateCookie } from '../lib/cookies';
import { dataTools } from '../lib/data';
import { dataHint, getDataOperators } from '../lib/dataLabels';
import { formatBuilderError } from '../lib/i18n';
import { useBuilderI18n } from '../lib/i18nContext';
import { elementTriggerEvents, getTriggerOptions } from '../lib/triggers';
import type { ConditionType, NodeKind, StepConfig, StepData, WorkflowNode } from '../lib/types';
import { DataTransformInspector } from './DataTransformInspector';
import { InfoBox } from './InfoBox';
import { NoteControls } from './NoteControls';
import { NoteTextEditor } from './NoteTextEditor';
import { PopoverContentPreview } from './PopoverContentPreview';
import { Select } from './Select';
import '../styles/inspector.css';

interface NodeInspectorProps {
  node: WorkflowNode;
  connections?: ReactNode;
  forwardsData?: boolean;
  analytics?: import('../lib/types').AnalyticsSettings;
  onOpenAnalytics?: () => void;
  analyticsTabId?: string;
  onChange: (patch: Partial<StepData>) => void;
  onClose: () => void;
  onPickElement: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onPreviewContent: () => void;
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="dxp-inspector-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <p className="dxp-inspector-hint">{hint}</p>}
    </div>
  );
}

function NumberInput({
  id,
  value,
  min,
  max,
  step,
  onChange,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <input
      id={id}
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        const parsed = Number(next);
        if (next.trim() && Number.isInteger(parsed) && parsed >= min && parsed <= max)
          onChange(parsed);
      }}
      onBlur={() => {
        const parsed = draft.trim() === '' ? value : Number(draft);
        const next = Number.isFinite(parsed)
          ? Math.min(max, Math.max(min, Math.round(parsed)))
          : value;
        setDraft(String(next));
        if (next !== value) onChange(next);
      }}
    />
  );
}

export function NodeInspector({
  node,
  connections,
  forwardsData = false,
  analytics,
  onOpenAnalytics,
  analyticsTabId,
  onChange,
  onClose,
  onPickElement,
  onDelete,
  onDuplicate,
  onPreviewContent,
}: NodeInspectorProps) {
  const { t } = useBuilderI18n();
  const catalog = getCatalog(t);
  const nextOutputDescriptions = {
    'track-event': t('analytics.outputHint'),
    trigger: t('nodeInspector.runsWhenTheSelectedEventOccurs'),
    transform: t('transform.outputHint'),
    http: t('nodeInspector.passesResponseDataOrAnErrorObjectToTheNextNode'),
    dom: t('nodeInspector.runsAfterTheElementsAreUpdated'),
    cookie: t('nodeInspector.runsAfterTheCookieIsSaved'),
    delay: t('nodeInspector.runsAfterThePause'),
    popover: t('nodeInspector.runsAfterThePopoverIsDisplayed'),
  } satisfies Record<Exclude<NodeKind, 'experiment' | 'fork' | 'loop' | 'note' | 'frame'>, string>;
  const triggerOptions = getTriggerOptions(t);
  const prefix = useId();
  const config = node.data.config;
  const trigger = Object.hasOwn(triggerOptions, config.event ?? 'page-load')
    ? triggerOptions[config.event ?? 'page-load']
    : undefined;
  const conditionType = config.conditionType ?? 'selector';
  const dataOperator = config.conditionOperator ?? 'equal';
  let requestTemplateError: string | undefined;
  if (node.data.kind === 'http') {
    try {
      dataTools.validateRequest(config);
    } catch (error) {
      requestTemplateError = formatBuilderError(error, t);
    }
  }
  let dataError: string | undefined;
  try {
    if (node.data.kind === 'dom') dataTools.validateElementValue(config);
    if (node.data.kind === 'cookie') validateCookie(config);
    if (node.data.kind === 'track-event') {
      createAnalyticsTools().validateEventName(config.analyticsEventName);
      createAnalyticsTools().validatePayload(config.analyticsPayload, dataTools);
    }
    if (node.data.kind === 'fork' && conditionType === 'data') dataTools.validateCondition(config);
  } catch (error) {
    dataError = formatBuilderError(error, t);
  }
  const variableCondition = ['query-param', 'cookie'].includes(conditionType);
  const metadata = catalog.find((entry) => entry.kind === node.data.kind);
  if (!metadata) throw new Error(`Unknown node type: ${node.data.kind}`);
  const isNote = node.data.kind === 'note';
  const isFrame = node.data.kind === 'frame';
  const itemName = isFrame ? 'frame' : isNote ? 'note' : 'step';
  const Icon = metadata.icon;
  const id = (name: string) => `${prefix}-${name}`;
  const update = (patch: Partial<StepConfig>) => onChange({ config: { ...config, ...patch } });
  const targetField = (
    label = t('nodeInspector.targetElement'),
    optional = false,
    key: 'selector' | 'experimentSelector' = 'selector',
  ) => (
    <Field
      label={label}
      htmlFor={id(key)}
      hint={
        optional
          ? t('nodeInspector.optionalWithoutAnAnchorChooseAFixedScreenPosition')
          : t('nodeInspector.useACssSelectorOrPickAnElementFromYourWebsite')
      }
    >
      <div className="dxp-inspector-selector">
        <input
          id={id(key)}
          className="dxp-inspector-code"
          value={config[key] ?? ''}
          placeholder={t('nodeInspector.eGSignupButton')}
          onChange={(event) => update({ [key]: event.target.value })}
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="button"
          title={t('nodeInspector.pickAnElementFromYourWebsite')}
          aria-label={t('nodeInspector.pickAnElementFromYourWebsite')}
          onClick={onPickElement}
        >
          <ScanLine size={16} />
        </button>
      </div>
      <button type="button" className="dxp-inspector-pick" onClick={onPickElement}>
        <MousePointer2 size={13} /> {t('nodeInspector.selectOnWebsite')} <span>↗</span>
      </button>
    </Field>
  );

  return (
    <aside
      className="dxp-inspector"
      data-tutorial="inspector"
      aria-label={t('nodeInspector.labelConfiguration', { label: String(metadata.label) })}
    >
      <header className="dxp-inspector-header">
        <div className="dxp-inspector-eyebrow">
          {t('nodeInspector.detailsHeading', { kind: itemName })}
        </div>
        <button
          type="button"
          className="dxp-inspector-icon-button"
          title={t('nodeInspector.closeItemnameDetails', { itemName: String(itemName) })}
          aria-label={t('nodeInspector.closeItemnameDetails', { itemName: String(itemName) })}
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </header>
      <div className="dxp-inspector-content">
        <div className="dxp-inspector-intro">
          <div className={`dxp-inspector-node-icon dxp-inspector-node-icon-${metadata.color}`}>
            <Icon size={21} strokeWidth={1.8} />
          </div>
          <div>
            <h2>{metadata.label}</h2>
            <span>
              {isFrame
                ? t('nodeInspector.canvasGroup')
                : isNote
                  ? t('nodeInspector.canvasAnnotation')
                  : t('nodeInspector.workflowStep')}
            </span>
          </div>
        </div>
        <p className="dxp-inspector-description">{metadata.description}</p>
        <Field
          label={
            isFrame
              ? t('nodeInspector.frameName')
              : isNote
                ? t('nodeInspector.noteName')
                : t('nodeInspector.stepName')
          }
          htmlFor={id('name')}
        >
          <input
            id={id('name')}
            value={node.data.label}
            placeholder={metadata.label}
            onChange={(event) => onChange({ label: event.target.value })}
          />
        </Field>
        <div className="dxp-inspector-section-label">
          {isFrame ? <Frame size={14} /> : isNote ? <StickyNote size={14} /> : <Braces size={14} />}
          {isFrame
            ? t('nodeInspector.groupingNodes')
            : isNote
              ? t('nodeInspector.textAppearance')
              : t('nodeInspector.parameters')}
        </div>

        {isFrame && (
          <div className="dxp-inspector-note">
            <Info size={15} />
            <p>{t('nodeInspector.dropNodesFullyInsideThisFrameToGroupThemDragItsHeader')}</p>
          </div>
        )}

        {isNote && (
          <>
            <Field
              label={t('nodeInspector.noteText')}
              htmlFor={id('note-text')}
              hint={t('nodeInspector.youCanAlsoEditThisTextDirectlyOnTheCanvas')}
            >
              <NoteTextEditor
                key={node.id}
                id={id('note-text')}
                noteId={node.id}
                config={config}
                ariaLabel="Note text"
                className="dxp-note-inspector-editor"
                onChange={update}
              />
            </Field>
            <NoteControls noteId={node.id} config={config} onChange={update} />
          </>
        )}

        {node.data.kind === 'trigger' && (
          <>
            <Field label={t('nodeInspector.startWhen')} htmlFor={id('event')}>
              <Select
                id={id('event')}
                value={config.event ?? 'page-load'}
                onChange={(event) => update({ event: event.target.value as StepConfig['event'] })}
              >
                {Object.entries(triggerOptions).map(([value, option]) => (
                  <option key={value} value={value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <InfoBox>{trigger?.hint ?? t('nodeInspector.chooseASupportedTriggerEvent')}</InfoBox>
            {trigger?.settings.map(({ key, label, defaultValue, min, max }) => (
              <Field key={key} label={label} htmlFor={id(key)}>
                <NumberInput
                  id={id(key)}
                  value={config[key] ?? defaultValue}
                  min={min}
                  max={max}
                  step={1}
                  onChange={(value) => update({ [key]: value })}
                />
              </Field>
            ))}
            {elementTriggerEvents.includes(config.event ?? 'page-load') && targetField()}
          </>
        )}

        {node.data.kind === 'transform' && (
          <DataTransformInspector config={config} onChange={update} />
        )}
        {node.data.kind === 'http' && (
          <>
            {requestTemplateError && (
              <p className="dxp-inspector-hint" role="alert">
                {requestTemplateError}
              </p>
            )}
            <Field label={t('nodeInspector.method')} htmlFor={id('method')}>
              <Select
                id={id('method')}
                value={config.method ?? 'GET'}
                onChange={(event) => update({ method: event.target.value })}
              >
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((method) => (
                  <option key={method}>{method}</option>
                ))}
              </Select>
            </Field>
            <Field label={t('nodeInspector.requestUrl')} htmlFor={id('url')}>
              <input
                id={id('url')}
                type="text"
                value={config.url ?? ''}
                placeholder="https://api.example.com/data"
                onChange={(event) => update({ url: event.target.value })}
                spellCheck={false}
              />
            </Field>
            <Field
              label={t('nodeInspector.headers')}
              htmlFor={id('headers')}
              hint={t('nodeInspector.enterAJsonObjectLeaveEmptyForDefaultHeaders')}
            >
              <textarea
                id={id('headers')}
                className="dxp-inspector-code"
                rows={3}
                value={config.headers ?? ''}
                placeholder={'{\n  "Content-Type": "application/json"\n}'}
                onChange={(event) => update({ headers: event.target.value })}
                spellCheck={false}
              />
            </Field>
            {!['GET', 'HEAD'].includes(config.method ?? 'GET') && (
              <Field
                label={t('nodeInspector.requestBody')}
                htmlFor={id('body')}
                hint={t('nodeInspector.sentAsTheRawRequestBody')}
              >
                <textarea
                  id={id('body')}
                  className="dxp-inspector-code"
                  rows={4}
                  value={config.body ?? ''}
                  placeholder={'{ "event": "signup" }'}
                  onChange={(event) => update({ body: event.target.value })}
                  spellCheck={false}
                />
              </Field>
            )}
            <div className="dxp-inspector-note">
              <Info size={15} />
              <p>{t('nodeInspector.theApiMustAllowRequestsFromYourWebsiteThroughCors')}</p>
            </div>
            <InfoBox className="dxp-inspector-incoming-data">
              {t('nodeInspector.requestTemplates')}
            </InfoBox>
          </>
        )}

        {node.data.kind === 'dom' && (
          <>
            {targetField()}
            <Field label={t('nodeInspector.action')} htmlFor={id('action')}>
              <Select
                id={id('action')}
                value={config.action ?? 'text'}
                onChange={(event) => update({ action: event.target.value as StepConfig['action'] })}
              >
                <option value="text">{t('nodeInspector.changeText')}</option>
                <option value="html">{t('nodeInspector.replaceHtml')}</option>
                <option value="add-class">{t('nodeInspector.addCssClass')}</option>
                <option value="remove-class">{t('nodeInspector.removeCssClass')}</option>
                <option value="hide">{t('nodeInspector.hideElement')}</option>
                <option value="show">{t('nodeInspector.showElement')}</option>
                <option value="attribute">{t('nodeInspector.setAttribute')}</option>
              </Select>
            </Field>
            {config.action === 'attribute' && (
              <Field label={t('nodeInspector.attributeName')} htmlFor={id('attribute')}>
                <input
                  id={id('attribute')}
                  value={config.attribute ?? ''}
                  placeholder={t('nodeInspector.eGAriaLabel')}
                  onChange={(event) => update({ attribute: event.target.value })}
                  spellCheck={false}
                />
              </Field>
            )}
            {!['hide', 'show'].includes(config.action ?? 'text') && (
              <Field
                label={
                  config.action === 'html'
                    ? t('nodeInspector.htmlContent')
                    : ['add-class', 'remove-class'].includes(config.action ?? '')
                      ? t('nodeInspector.cssClassNames')
                      : config.action === 'attribute'
                        ? t('nodeInspector.attributeValue')
                        : t('nodeInspector.newText')
                }
                htmlFor={id('value')}
                hint={
                  ['add-class', 'remove-class'].includes(config.action ?? '')
                    ? t('nodeInspector.separateMultipleClassNamesWithSpaces')
                    : undefined
                }
              >
                <textarea
                  id={id('value')}
                  className={config.action === 'html' ? 'dxp-inspector-code' : ''}
                  rows={config.action === 'html' ? 5 : 3}
                  value={config.value ?? ''}
                  placeholder={
                    config.action === 'html'
                      ? '<p>Hello {{name}}</p>'
                      : t('nodeInspector.enterAValue')
                  }
                  onChange={(event) => update({ value: event.target.value })}
                  spellCheck={config.action !== 'html'}
                />
              </Field>
            )}
            {dataError && (
              <p role="alert" className="dxp-inspector-hint">
                {dataError}
              </p>
            )}
          </>
        )}

        {node.data.kind === 'cookie' && (
          <>
            <Field label={t('nodeInspector.cookieName')} htmlFor={id('cookie-name')}>
              <input
                id={id('cookie-name')}
                value={config.cookieName ?? ''}
                placeholder={t('nodeInspector.eGAudience')}
                onChange={(event) => update({ cookieName: event.target.value })}
                spellCheck={false}
              />
            </Field>
            <Field
              label={t('nodeInspector.cookieValue')}
              htmlFor={id('cookie-value')}
              hint={t('nodeInspector.anEmptyValueIsAllowed')}
            >
              <input
                id={id('cookie-value')}
                value={config.cookieValue ?? ''}
                placeholder={t('nodeInspector.eGReturning')}
                onChange={(event) => update({ cookieValue: event.target.value })}
                spellCheck={false}
              />
            </Field>
            {dataError && (
              <p role="alert" className="dxp-inspector-hint">
                {dataError}
              </p>
            )}
            <Field label={t('nodeInspector.expiration')} htmlFor={id('cookie-expiration')}>
              <Select
                id={id('cookie-expiration')}
                value={config.cookieDays ? 'days' : 'session'}
                onChange={(event) =>
                  update({ cookieDays: event.target.value === 'session' ? 0 : 30 })
                }
              >
                <option value="session">{t('nodeInspector.browserSession')}</option>
                <option value="days">{t('nodeInspector.afterANumberOfDays')}</option>
              </Select>
            </Field>
            {!!config.cookieDays && (
              <Field
                label={t('nodeInspector.expiresAfter')}
                htmlFor={id('cookie-days')}
                hint={t('nodeInspector.from1To400Days')}
              >
                <div className="dxp-inspector-unit-field">
                  <NumberInput
                    key={node.id}
                    id={id('cookie-days')}
                    min={1}
                    max={400}
                    step={1}
                    value={config.cookieDays}
                    onChange={(cookieDays) => update({ cookieDays })}
                  />
                  <span>{t('nodeInspector.days')}</span>
                </div>
              </Field>
            )}
            <p className="dxp-inspector-hint">
              {t('nodeInspector.savesTheCookieForAllPagesOnThisWebsiteALaterCondition')}
            </p>
          </>
        )}

        {node.data.kind === 'delay' && (
          <Field
            label={t('nodeInspector.waitFor')}
            htmlFor={id('duration')}
            hint={t('nodeInspector.1000Milliseconds1SecondMaximum24Hours')}
          >
            <div className="dxp-inspector-unit-field">
              <NumberInput
                key={node.id}
                id={id('duration')}
                min={0}
                max={86400000}
                step={100}
                value={config.duration ?? 1000}
                onChange={(duration) => update({ duration })}
              />
              <span>{t('nodeInspector.ms')}</span>
            </div>
          </Field>
        )}

        {node.data.kind === 'fork' && (
          <>
            <Field label={t('nodeInspector.conditionType')} htmlFor={id('condition-type')}>
              <Select
                id={id('condition-type')}
                value={conditionType}
                onChange={(event) => {
                  const next = event.target.value as ConditionType;
                  update({
                    conditionType: next,
                    conditionValue: next === 'device' ? 'desktop' : '',
                  });
                }}
              >
                <option value="selector">{t('nodeInspector.elementExists')}</option>
                <option value="data">{t('nodeInspector.incomingData')}</option>
                <option value="device">{t('nodeInspector.userDevice')}</option>
                <option value="language">{t('nodeInspector.userLanguage')}</option>
                <option value="referrer">{t('nodeInspector.referrerDomain')}</option>
                <option value="date-range">{t('nodeInspector.withinDateRange')}</option>
                <option value="time-of-day">{t('nodeInspector.timeOfDay')}</option>
                <option value="query-param">{t('nodeInspector.urlSearchParameter')}</option>
                <option value="cookie">{t('nodeInspector.cookies')}</option>
              </Select>
            </Field>
            {conditionType === 'data' && (
              <>
                <InfoBox>
                  {t(
                    'nodeInspector.evaluatesDataReceivedThroughTheIncomingConnectionSuchAsAnHttpResponse',
                  )}
                </InfoBox>
                <Field label={t('nodeInspector.operator')} htmlFor={id('condition-operator')}>
                  <Select
                    id={id('condition-operator')}
                    value={dataOperator}
                    onChange={(event) =>
                      update({
                        conditionOperator: event.target.value as StepConfig['conditionOperator'],
                      })
                    }
                  >
                    {Object.entries(getDataOperators(t)).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
                {dataTools.needsValue(dataOperator) && (
                  <Field label={t('nodeInspector.comparisonValue')} htmlFor={id('condition-value')}>
                    <input
                      id={id('condition-value')}
                      value={config.conditionValue ?? ''}
                      onChange={(event) => update({ conditionValue: event.target.value })}
                      spellCheck={false}
                    />
                  </Field>
                )}
                <InfoBox>{dataHint(dataOperator, t)}</InfoBox>
                {dataError && (
                  <p role="alert" className="dxp-inspector-hint">
                    {dataError}
                  </p>
                )}
              </>
            )}
            {conditionType === 'selector' && (
              <InfoBox>{t('nodeInspector.trueWhenThisCssSelectorMatchesAnElement')}</InfoBox>
            )}
            {conditionType === 'device' && (
              <InfoBox>
                {t('nodeInspector.usesTheBrowserSDeviceInformationWithUserAgentDetectionAsA')}
              </InfoBox>
            )}
            {conditionType === 'language' && (
              <InfoBox>
                {t('nodeInspector.checksThePrimaryBrowserLanguageUseEnForAnyEnglishVariantOr')}
              </InfoBox>
            )}
            {conditionType === 'referrer' && (
              <InfoBox>
                {t(
                  'nodeInspector.matchesTheExactDomainIgnoringProtocolPortAndPathSubdomainsAreDistinct',
                )}
              </InfoBox>
            )}
            {conditionType === 'date-range' && (
              <InfoBox>
                {t('nodeInspector.dateRangeHelp', { zone: config.conditionTimeZone || 'local' })}
              </InfoBox>
            )}
            {conditionType === 'time-of-day' && (
              <InfoBox>
                {t('nodeInspector.timeRangeHelp', { zone: config.conditionTimeZone || 'local' })}
              </InfoBox>
            )}
            {variableCondition && (
              <InfoBox>
                {conditionType === 'query-param'
                  ? t('nodeInspector.checksTheCurrentPageUrlAnyMatchingValueInARepeatedParameter')
                  : t(
                      'nodeInspector.checksCookiesLocalstorageAndSessionstorageOnThisWebsiteTrueIfAnySource',
                    )}{' '}
                {t('nodeInspector.exactCaseSensitiveMatchAnEmptyValueMatchesOnlyAPresentEmpty')}
              </InfoBox>
            )}
            {conditionType === 'selector' && (
              <Field label={t('nodeInspector.elementExists')} htmlFor={id('condition')}>
                <input
                  id={id('condition')}
                  className="dxp-inspector-code"
                  value={config.condition ?? ''}
                  placeholder={t('nodeInspector.eGLoggedIn')}
                  onChange={(event) => update({ condition: event.target.value })}
                  spellCheck={false}
                />
              </Field>
            )}
            {conditionType === 'device' && (
              <Field label={t('nodeInspector.deviceIs')} htmlFor={id('condition-value')}>
                <Select
                  id={id('condition-value')}
                  value={config.conditionValue ?? ''}
                  onChange={(event) => update({ conditionValue: event.target.value })}
                >
                  <option value="" disabled>
                    {t('nodeInspector.chooseADevice')}
                  </option>
                  <option value="desktop">{t('nodeInspector.desktop')}</option>
                  <option value="mobile">{t('nodeInspector.mobile')}</option>
                </Select>
              </Field>
            )}
            {conditionType === 'language' && (
              <Field label={t('nodeInspector.languageIs')} htmlFor={id('condition-value')}>
                <input
                  id={id('condition-value')}
                  value={config.conditionValue ?? ''}
                  placeholder={t('nodeInspector.eGEnEsEnUs')}
                  onChange={(event) => update({ conditionValue: event.target.value })}
                  spellCheck={false}
                />
              </Field>
            )}
            {conditionType === 'referrer' && (
              <Field
                label={t('nodeInspector.referrerDomainEquals')}
                htmlFor={id('condition-value')}
              >
                <input
                  id={id('condition-value')}
                  type="text"
                  value={config.conditionValue ?? ''}
                  placeholder={t('nodeInspector.exampleCom')}
                  onChange={(event) => update({ conditionValue: event.target.value })}
                  spellCheck={false}
                />
              </Field>
            )}
            {(conditionType === 'date-range' || conditionType === 'time-of-day') && (
              <Field
                label={
                  conditionType === 'date-range'
                    ? t('nodeInspector.dateBasedOn')
                    : t('nodeInspector.timeBasedOn')
                }
                htmlFor={id('condition-time-zone')}
              >
                <Select
                  id={id('condition-time-zone')}
                  value={config.conditionTimeZone ?? 'local'}
                  onChange={(event) =>
                    update({
                      conditionTimeZone: event.target.value as StepConfig['conditionTimeZone'],
                    })
                  }
                >
                  <option value="local">
                    {conditionType === 'date-range'
                      ? t('nodeInspector.visitorLocalDate')
                      : t('nodeInspector.visitorLocalTime')}
                  </option>
                  <option value="utc">{t('nodeInspector.utc')}</option>
                </Select>
              </Field>
            )}
            {conditionType === 'date-range' && (
              <>
                <Field label={t('nodeInspector.startDate')} htmlFor={id('condition-start-date')}>
                  <input
                    id={id('condition-start-date')}
                    type="date"
                    min="0001-01-01"
                    max={config.conditionEndDate || '9999-12-31'}
                    value={config.conditionStartDate ?? ''}
                    onChange={(event) => update({ conditionStartDate: event.target.value })}
                  />
                </Field>
                <Field label={t('nodeInspector.endDate')} htmlFor={id('condition-end-date')}>
                  <input
                    id={id('condition-end-date')}
                    type="date"
                    min={config.conditionStartDate || '0001-01-01'}
                    max="9999-12-31"
                    value={config.conditionEndDate ?? ''}
                    onChange={(event) => update({ conditionEndDate: event.target.value })}
                  />
                </Field>
              </>
            )}
            {conditionType === 'time-of-day' && (
              <>
                <Field label={t('nodeInspector.startTime')} htmlFor={id('condition-start-time')}>
                  <input
                    id={id('condition-start-time')}
                    type="time"
                    step={60}
                    value={config.conditionStartTime ?? ''}
                    onChange={(event) => update({ conditionStartTime: event.target.value })}
                  />
                </Field>
                <Field label={t('nodeInspector.endTime')} htmlFor={id('condition-end-time')}>
                  <input
                    id={id('condition-end-time')}
                    type="time"
                    step={60}
                    value={config.conditionEndTime ?? ''}
                    onChange={(event) => update({ conditionEndTime: event.target.value })}
                  />
                </Field>
              </>
            )}
            {variableCondition && (
              <>
                <Field
                  label={
                    conditionType === 'query-param'
                      ? t('nodeInspector.parameterName')
                      : t('nodeInspector.cookieOrStorageKey')
                  }
                  htmlFor={id('condition-key')}
                >
                  <input
                    id={id('condition-key')}
                    className="dxp-inspector-code"
                    value={config.conditionKey ?? ''}
                    placeholder={
                      conditionType === 'query-param'
                        ? t('nodeInspector.eGUtmSource')
                        : t('nodeInspector.eGAudience')
                    }
                    onChange={(event) => update({ conditionKey: event.target.value })}
                    spellCheck={false}
                  />
                </Field>
                <Field label={t('nodeInspector.valueEquals')} htmlFor={id('condition-value')}>
                  <input
                    id={id('condition-value')}
                    value={config.conditionValue ?? ''}
                    placeholder={t('nodeInspector.eGNewsletter')}
                    onChange={(event) => update({ conditionValue: event.target.value })}
                    spellCheck={false}
                  />
                </Field>
              </>
            )}
          </>
        )}

        {node.data.kind === 'track-event' && (
          <>
            <Field
              label={t('analytics.eventName')}
              htmlFor={id('analyticsEventName')}
              hint={t('analytics.eventNameHint')}
            >
              <input
                id={id('analyticsEventName')}
                value={config.analyticsEventName ?? ''}
                placeholder="offer_accepted"
                spellCheck={false}
                maxLength={40}
                onChange={(event) => update({ analyticsEventName: event.target.value })}
              />
            </Field>
            <Field
              label={t('analytics.payload')}
              htmlFor={id('analyticsPayload')}
              hint={t('analytics.payloadHint')}
            >
              <textarea
                id={id('analyticsPayload')}
                className="dxp-inspector-code"
                rows={5}
                value={config.analyticsPayload ?? ''}
                placeholder={'{ "plan": "{{plan}}", "value": {{price}} }'}
                onChange={(event) => update({ analyticsPayload: event.target.value })}
                spellCheck={false}
              />
            </Field>
            {dataError && (
              <p className="dxp-field-error" role="alert">
                {dataError}
              </p>
            )}
            <InfoBox>
              {t('analytics.milestoneHint')}{' '}
              {onOpenAnalytics && (
                <a
                  className="dxp-inspector-settings-link"
                  href={`#${analyticsTabId ?? 'analytics'}`}
                  onClick={(event) => {
                    event.preventDefault();
                    onOpenAnalytics();
                  }}
                >
                  {t('analytics.openSettings')}
                </a>
              )}
            </InfoBox>
            {analytics?.provider !== 'ga4' && (
              <p className="dxp-inspector-hint">{t('analytics.customDisabledHint')}</p>
            )}
          </>
        )}

        {node.data.kind === 'experiment' && (
          <>
            <Field
              label={t('experiment.id')}
              htmlFor={id('experimentKey')}
              hint={t('experiment.keyHint')}
            >
              <input
                id={id('experimentKey')}
                value={config.experimentKey ?? ''}
                placeholder="homepage-cta-v1"
                spellCheck={false}
                onChange={(event) => update({ experimentKey: event.target.value })}
              />
            </Field>
            <Field
              label={t('experiment.trafficA')}
              htmlFor={id('experimentSplit')}
              hint={t('experiment.splitHint')}
            >
              <NumberInput
                id={id('experimentSplit')}
                min={0}
                max={100}
                step={1}
                value={config.experimentSplit ?? 50}
                onChange={(experimentSplit) => update({ experimentSplit })}
              />
            </Field>
            <p className="dxp-inspector-hint">
              {t('experiment.summary', {
                a: config.experimentSplit ?? 50,
                b: 100 - (config.experimentSplit ?? 50),
              })}
            </p>
            <InfoBox>
              {t('experiment.sharedAnalyticsHint')}{' '}
              {onOpenAnalytics && (
                <a
                  className="dxp-inspector-settings-link"
                  href={`#${analyticsTabId ?? 'analytics'}`}
                  onClick={(event) => {
                    event.preventDefault();
                    onOpenAnalytics();
                  }}
                >
                  {t('analytics.openSettings')}
                </a>
              )}
            </InfoBox>
          </>
        )}
        {node.data.kind === 'loop' && (
          <Field label={t('nodeInspector.numberOfRepetitions')} htmlFor={id('iterations')}>
            <div className="dxp-inspector-unit-field">
              <NumberInput
                key={node.id}
                id={id('iterations')}
                min={1}
                max={1000}
                step={1}
                value={config.iterations ?? 3}
                onChange={(iterations) => update({ iterations })}
              />
              <span>{t('nodeInspector.times')}</span>
            </div>
          </Field>
        )}

        {node.data.kind === 'popover' && (
          <>
            <Field label={t('nodeInspector.contentType')} htmlFor={id('content-type')}>
              <Select
                id={id('content-type')}
                value={config.contentType ?? 'html'}
                onChange={(event) =>
                  update({ contentType: event.target.value as StepConfig['contentType'] })
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
              <Field label={t('nodeInspector.htmlContent')} htmlFor={id('content')}>
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
                onChange={(event) =>
                  update({ position: event.target.value as StepConfig['position'] })
                }
              >
                <option value="center">{t('nodeInspector.centerOfScreen')}</option>
                <option value="top-left">{t('nodeInspector.topLeft')}</option>
                <option value="top-right">{t('nodeInspector.topRight')}</option>
                <option value="bottom-left">{t('nodeInspector.bottomLeft')}</option>
                <option value="bottom-right">{t('nodeInspector.bottomRight')}</option>
                <option value="anchor">{t('nodeInspector.nextToAnElement')}</option>
              </Select>
            </Field>
            {config.position === 'anchor' && targetField(t('nodeInspector.anchorElement'))}
            <Field
              label={t('nodeInspector.popoverAnimation')}
              htmlFor={id('popover-animation')}
              hint={t('nodeInspector.animationHint')}
            >
              <Select
                id={id('popover-animation')}
                value={config.popoverAnimation ?? 'none'}
                onChange={(event) =>
                  update({ popoverAnimation: event.target.value as StepConfig['popoverAnimation'] })
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
                  key={node.id}
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
            <div className="dxp-inspector-preview">
              <div>
                <span>{t('nodeInspector.contentPreview')}</span>
                <button
                  type="button"
                  className="dxp-inspector-preview-expand"
                  onClick={onPreviewContent}
                  aria-label={t('nodeInspector.openFullscreenContentPreview')}
                  title={t('nodeInspector.previewOnTheDemoWebsite')}
                >
                  <Maximize2 size={12} /> {t('nodeInspector.fullscreen')}
                </button>
              </div>
              {(config.contentType ?? 'html') === 'html' && config.content ? (
                <PopoverContentPreview node={node} title={t('nodeInspector.popoverHtmlPreview')} />
              ) : (
                <p className="dxp-inspector-preview-hint">
                  {t('nodeInspector.previewYourPopoverInPositionOnTheDemoWebsite')}
                </p>
              )}
            </div>
          </>
        )}
        <section aria-labelledby={id('outputs-heading')}>
          <h3 id={id('outputs-heading')} className="dxp-inspector-section-label">
            <ArrowRight size={14} aria-hidden="true" /> {t('nodeInspector.outputs')}
          </h3>
          {node.data.kind === 'experiment' ? (
            <div className="dxp-inspector-branches">
              <div>
                <ArrowRight size={13} />
                <strong>{t('experiment.variantA')}</strong>
                <span>{t('experiment.outputA')}</span>
              </div>
              <div>
                <ArrowRight size={13} />
                <strong>{t('experiment.variantB')}</strong>
                <span>{t('experiment.outputB')}</span>
              </div>
            </div>
          ) : node.data.kind === 'fork' ? (
            <div className="dxp-inspector-branches">
              <div>
                <b className="dxp-inspector-branch-letter" aria-hidden="true">
                  T
                </b>
                <strong>{t('nodeInspector.true')}</strong>
                <span>
                  {forwardsData
                    ? t('nodeInspector.conditionMatchesWithData')
                    : t('nodeInspector.conditionMatches')}
                </span>
              </div>
              <div>
                <b className="dxp-inspector-branch-letter" aria-hidden="true">
                  F
                </b>
                <strong>{t('nodeInspector.false')}</strong>
                <span>
                  {forwardsData
                    ? t('nodeInspector.conditionDoesNotMatchWithData')
                    : t('nodeInspector.conditionDoesNotMatch')}
                </span>
              </div>
            </div>
          ) : node.data.kind === 'loop' ? (
            <>
              <div className="dxp-inspector-branches dxp-inspector-loop-outputs">
                <div>
                  <Repeat2 size={13} className="dxp-loop-body-icon" />
                  <strong>{t('nodeInspector.body')}</strong>
                  <span>{t('nodeInspector.runsEachRepetition')}</span>
                </div>
                <div>
                  <ArrowDown size={13} className="dxp-loop-done-icon" />
                  <strong>{t('nodeInspector.done')}</strong>
                  <span>{t('nodeInspector.runsAfterTheLastOne')}</span>
                </div>
              </div>
              <p className="dxp-inspector-hint">
                {t('nodeInspector.connectTheStepsToRepeatToBodyConnectTheNextStepTo')}
              </p>
            </>
          ) : node.data.kind === 'note' || node.data.kind === 'frame' ? (
            <InfoBox>{t('nodeInspector.annotationOutputs', { kind: itemName })}</InfoBox>
          ) : (
            <div
              className={`dxp-inspector-branches${['http', 'transform'].includes(node.data.kind) ? ' dxp-inspector-data-output' : ''}`}
            >
              <div>
                {['http', 'transform'].includes(node.data.kind) ? (
                  <i className="dxp-inspector-dot-data" aria-hidden="true" />
                ) : (
                  <ArrowRight size={13} aria-hidden="true" />
                )}
                <strong>
                  {['http', 'transform'].includes(node.data.kind)
                    ? t('nodeInspector.data')
                    : t('nodeInspector.next')}
                </strong>
                <span>{nextOutputDescriptions[node.data.kind]}</span>
              </div>
            </div>
          )}
        </section>
        {connections}
      </div>
      <footer className="dxp-inspector-footer">
        <button
          type="button"
          onClick={onDuplicate}
          title={t('nodeInspector.duplicateItemname', { itemName: String(itemName) })}
        >
          <Copy size={14} /> {t('nodeInspector.duplicate')}
        </button>
        <button
          type="button"
          className="dxp-inspector-delete"
          onClick={onDelete}
          title={t('nodeInspector.deleteItemname', { itemName: String(itemName) })}
        >
          <Trash2 size={14} /> {t('nodeInspector.delete')}
        </button>
      </footer>
    </aside>
  );
}
