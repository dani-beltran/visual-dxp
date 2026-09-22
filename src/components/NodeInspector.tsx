import {
  ArrowDown,
  Braces,
  ChevronDown,
  Clock3,
  Copy,
  GitFork,
  Globe2,
  Info,
  Maximize2,
  MousePointer2,
  MousePointerClick,
  PanelTop,
  Repeat2,
  ScanLine,
  StickyNote,
  Timer,
  Trash2,
  X,
} from 'lucide-react';
import { type ReactNode, type SelectHTMLAttributes, useEffect, useId, useState } from 'react';
import { elementTriggerEvents, triggerOptions } from '../lib/triggers';
import type { ConditionType, NodeKind, StepConfig, StepData, WorkflowNode } from '../lib/types';
import { NoteControls } from './NoteControls';
import { NoteTextEditor } from './NoteTextEditor';
import '../styles/inspector.css';

interface NodeInspectorProps {
  node: WorkflowNode;
  onChange: (patch: Partial<StepData>) => void;
  onClose: () => void;
  onPickElement: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onPreviewContent: () => void;
}

const details = {
  trigger: {
    name: 'Trigger',
    icon: MousePointerClick,
    summary: 'Choose the moment your experience begins.',
    color: 'green',
  },
  http: {
    name: 'HTTP request',
    icon: Globe2,
    summary: 'Connect your experience to any API.',
    color: 'blue',
  },
  dom: {
    name: 'Update element',
    icon: MousePointer2,
    summary: 'Make a change to an element on your website.',
    color: 'orange',
  },
  delay: {
    name: 'Delay',
    icon: Timer,
    summary: 'Give your experience a little breathing room.',
    color: 'amber',
  },
  fork: {
    name: 'Condition',
    icon: GitFork,
    summary: 'Take a different path based on your visitor or page.',
    color: 'violet',
  },
  loop: {
    name: 'Loop',
    icon: Repeat2,
    summary: 'Run a group of steps more than once.',
    color: 'pink',
  },
  popover: {
    name: 'Popover',
    icon: PanelTop,
    summary: 'Bring a message or embedded page into the moment.',
    color: 'teal',
  },
  note: {
    name: 'Note',
    icon: StickyNote,
    summary: 'Keep ideas, context, and reminders alongside your workflow.',
    color: 'amber',
  },
} satisfies Record<NodeKind, { name: string; icon: typeof Timer; summary: string; color: string }>;

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

function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="dxp-inspector-select">
      <select {...props}>{children}</select>
      <ChevronDown size={13} aria-hidden="true" />
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
  onChange,
  onClose,
  onPickElement,
  onDelete,
  onDuplicate,
  onPreviewContent,
}: NodeInspectorProps) {
  const prefix = useId();
  const config = node.data.config;
  const trigger = Object.hasOwn(triggerOptions, config.event ?? 'page-load')
    ? triggerOptions[config.event ?? 'page-load']
    : undefined;
  const conditionType = config.conditionType ?? 'selector';
  const variableCondition = ['query-param', 'cookie'].includes(conditionType);
  const metadata = details[node.data.kind];
  const isNote = node.data.kind === 'note';
  const Icon = metadata.icon;
  const id = (name: string) => `${prefix}-${name}`;
  const update = (patch: Partial<StepConfig>) => onChange({ config: { ...config, ...patch } });
  const targetField = (label = 'Target element', optional = false) => (
    <Field
      label={label}
      htmlFor={id('selector')}
      hint={
        optional
          ? 'Optional. Without an anchor, choose a fixed screen position.'
          : 'Use a CSS selector or pick an element from your website.'
      }
    >
      <div className="dxp-inspector-selector">
        <input
          id={id('selector')}
          className="dxp-inspector-code"
          value={config.selector ?? ''}
          placeholder="e.g. #signup-button"
          onChange={(event) => update({ selector: event.target.value })}
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="button"
          title="Pick an element from your website"
          aria-label="Pick an element from your website"
          onClick={onPickElement}
        >
          <ScanLine size={16} />
        </button>
      </div>
      <button type="button" className="dxp-inspector-pick" onClick={onPickElement}>
        <MousePointer2 size={13} /> Select on website <span>↗</span>
      </button>
    </Field>
  );

  return (
    <aside className="dxp-inspector" aria-label={`${metadata.name} configuration`}>
      <header className="dxp-inspector-header">
        <div className="dxp-inspector-eyebrow">{isNote ? 'NOTE DETAILS' : 'STEP DETAILS'}</div>
        <button
          type="button"
          className="dxp-inspector-icon-button"
          title={isNote ? 'Close note details' : 'Close step details'}
          aria-label={isNote ? 'Close note details' : 'Close step details'}
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
            <h2>{metadata.name}</h2>
            <span>{isNote ? 'Canvas annotation' : 'Workflow step'}</span>
          </div>
        </div>
        <p className="dxp-inspector-description">{metadata.summary}</p>
        <Field label={isNote ? 'Note name' : 'Step name'} htmlFor={id('name')}>
          <input
            id={id('name')}
            value={node.data.label}
            placeholder={metadata.name}
            onChange={(event) => onChange({ label: event.target.value })}
          />
        </Field>
        <div className="dxp-inspector-section-label">
          {isNote ? <StickyNote size={14} /> : <Braces size={14} />}
          {isNote ? 'Text & appearance' : 'Parameters'}
        </div>

        {isNote && (
          <>
            <Field
              label="Note text"
              htmlFor={id('note-text')}
              hint="You can also edit this text directly on the canvas."
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
            <div className="dxp-inspector-note">
              <Info size={15} />
              <p>Notes stay on your canvas and are skipped when the workflow runs.</p>
            </div>
          </>
        )}

        {node.data.kind === 'trigger' && (
          <>
            <Field label="Start when" htmlFor={id('event')}>
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
            <div className="dxp-inspector-note">
              <Info size={15} />
              <p>{trigger?.hint ?? 'Choose a supported trigger event.'}</p>
            </div>
          </>
        )}

        {node.data.kind === 'http' && (
          <>
            <Field label="Method" htmlFor={id('method')}>
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
            <Field label="Request URL" htmlFor={id('url')}>
              <input
                id={id('url')}
                type="url"
                value={config.url ?? ''}
                placeholder="https://api.example.com/data"
                onChange={(event) => update({ url: event.target.value })}
                spellCheck={false}
              />
            </Field>
            <Field
              label="Headers"
              htmlFor={id('headers')}
              hint="Enter a JSON object. Leave empty for default headers."
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
              <Field label="Request body" htmlFor={id('body')} hint="Sent as the raw request body.">
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
              <p>The API must allow requests from your website through CORS.</p>
            </div>
          </>
        )}

        {node.data.kind === 'dom' && (
          <>
            {targetField()}
            <Field label="Action" htmlFor={id('action')}>
              <Select
                id={id('action')}
                value={config.action ?? 'text'}
                onChange={(event) => update({ action: event.target.value as StepConfig['action'] })}
              >
                <option value="text">Change text</option>
                <option value="html">Replace HTML</option>
                <option value="add-class">Add CSS class</option>
                <option value="remove-class">Remove CSS class</option>
                <option value="hide">Hide element</option>
                <option value="show">Show element</option>
                <option value="attribute">Set attribute</option>
              </Select>
            </Field>
            {config.action === 'attribute' && (
              <Field label="Attribute name" htmlFor={id('attribute')}>
                <input
                  id={id('attribute')}
                  value={config.attribute ?? ''}
                  placeholder="e.g. aria-label"
                  onChange={(event) => update({ attribute: event.target.value })}
                  spellCheck={false}
                />
              </Field>
            )}
            {!['hide', 'show'].includes(config.action ?? 'text') && (
              <Field
                label={
                  config.action === 'html'
                    ? 'HTML content'
                    : ['add-class', 'remove-class'].includes(config.action ?? '')
                      ? 'CSS class names'
                      : config.action === 'attribute'
                        ? 'Attribute value'
                        : 'New text'
                }
                htmlFor={id('value')}
                hint={
                  ['add-class', 'remove-class'].includes(config.action ?? '')
                    ? 'Separate multiple class names with spaces.'
                    : undefined
                }
              >
                <textarea
                  id={id('value')}
                  className={config.action === 'html' ? 'dxp-inspector-code' : ''}
                  rows={config.action === 'html' ? 5 : 3}
                  value={config.value ?? ''}
                  placeholder={
                    config.action === 'html' ? '<p>Your new content</p>' : 'Enter a value…'
                  }
                  onChange={(event) => update({ value: event.target.value })}
                  spellCheck={config.action !== 'html'}
                />
              </Field>
            )}
          </>
        )}

        {node.data.kind === 'delay' && (
          <>
            <Field
              label="Wait for"
              htmlFor={id('duration')}
              hint="1,000 milliseconds = 1 second. Maximum 24 hours."
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
                <span>ms</span>
              </div>
            </Field>
            <div className="dxp-inspector-note">
              <Clock3 size={15} />
              <p>The next connected step runs after this pause.</p>
            </div>
          </>
        )}

        {node.data.kind === 'fork' && (
          <>
            <Field label="Condition type" htmlFor={id('condition-type')}>
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
                <option value="selector">Element exists</option>
                <option value="device">User device</option>
                <option value="language">User language</option>
                <option value="referrer">Referrer domain</option>
                <option value="date-range">Within date range</option>
                <option value="query-param">URL search parameter</option>
                <option value="cookie">Cookies</option>
              </Select>
            </Field>
            {conditionType === 'selector' && (
              <Field
                label="Element exists"
                htmlFor={id('condition')}
                hint="True when this CSS selector matches an element."
              >
                <input
                  id={id('condition')}
                  className="dxp-inspector-code"
                  value={config.condition ?? ''}
                  placeholder="e.g. .logged-in"
                  onChange={(event) => update({ condition: event.target.value })}
                  spellCheck={false}
                />
              </Field>
            )}
            {conditionType === 'device' && (
              <Field
                label="Device is"
                htmlFor={id('condition-value')}
                hint="Uses the browser’s device information, with user agent detection as a fallback."
              >
                <Select
                  id={id('condition-value')}
                  value={config.conditionValue ?? ''}
                  onChange={(event) => update({ conditionValue: event.target.value })}
                >
                  <option value="" disabled>
                    Choose a device
                  </option>
                  <option value="desktop">Desktop</option>
                  <option value="mobile">Mobile</option>
                </Select>
              </Field>
            )}
            {conditionType === 'language' && (
              <Field
                label="Language is"
                htmlFor={id('condition-value')}
                hint="Checks the primary browser language. Use en for any English variant, or en-US for an exact locale."
              >
                <input
                  id={id('condition-value')}
                  value={config.conditionValue ?? ''}
                  placeholder="e.g. en, es, en-US"
                  onChange={(event) => update({ conditionValue: event.target.value })}
                  spellCheck={false}
                />
              </Field>
            )}
            {conditionType === 'referrer' && (
              <Field
                label="Referrer domain equals"
                htmlFor={id('condition-value')}
                hint="Matches the exact domain, ignoring protocol, port and path. Subdomains are distinct: example.com does not match www.example.com. A missing referrer takes the False path."
              >
                <input
                  id={id('condition-value')}
                  type="text"
                  value={config.conditionValue ?? ''}
                  placeholder="example.com"
                  onChange={(event) => update({ conditionValue: event.target.value })}
                  spellCheck={false}
                />
              </Field>
            )}
            {conditionType === 'date-range' && (
              <>
                <Field label="Date based on" htmlFor={id('condition-time-zone')}>
                  <Select
                    id={id('condition-time-zone')}
                    value={config.conditionTimeZone ?? 'local'}
                    onChange={(event) =>
                      update({
                        conditionTimeZone: event.target.value as StepConfig['conditionTimeZone'],
                      })
                    }
                  >
                    <option value="local">Visitor local date</option>
                    <option value="utc">UTC</option>
                  </Select>
                </Field>
                <Field label="Start date" htmlFor={id('condition-start-date')}>
                  <input
                    id={id('condition-start-date')}
                    type="date"
                    min="0001-01-01"
                    max={config.conditionEndDate || '9999-12-31'}
                    value={config.conditionStartDate ?? ''}
                    onChange={(event) => update({ conditionStartDate: event.target.value })}
                  />
                </Field>
                <Field label="End date" htmlFor={id('condition-end-date')}>
                  <input
                    id={id('condition-end-date')}
                    type="date"
                    min={config.conditionStartDate || '0001-01-01'}
                    max="9999-12-31"
                    value={config.conditionEndDate ?? ''}
                    onChange={(event) => update({ conditionEndDate: event.target.value })}
                  />
                </Field>
                <p className="dxp-inspector-hint">
                  True when the current date is within this range. Both dates are included, using{' '}
                  {config.conditionTimeZone === 'utc' ? 'UTC' : 'the visitor’s local time zone'}.
                </p>
              </>
            )}
            {variableCondition && (
              <>
                <Field
                  label={
                    conditionType === 'query-param' ? 'Parameter name' : 'Cookie or storage key'
                  }
                  htmlFor={id('condition-key')}
                >
                  <input
                    id={id('condition-key')}
                    className="dxp-inspector-code"
                    value={config.conditionKey ?? ''}
                    placeholder={
                      conditionType === 'query-param' ? 'e.g. utm_source' : 'e.g. audience'
                    }
                    onChange={(event) => update({ conditionKey: event.target.value })}
                    spellCheck={false}
                  />
                </Field>
                <Field
                  label="Value equals"
                  htmlFor={id('condition-value')}
                  hint="Exact, case-sensitive match. An empty value matches only a present, empty variable."
                >
                  <input
                    id={id('condition-value')}
                    value={config.conditionValue ?? ''}
                    placeholder="e.g. newsletter"
                    onChange={(event) => update({ conditionValue: event.target.value })}
                    spellCheck={false}
                  />
                </Field>
                <p className="dxp-inspector-hint">
                  {conditionType === 'query-param'
                    ? 'Checks the current page URL. Any matching value in a repeated parameter counts.'
                    : 'Checks cookies, localStorage and sessionStorage on this website. True if any source contains the name and value. Cookie names and values are URL-decoded. If none match, the False path runs.'}
                </p>
              </>
            )}
            <div className="dxp-inspector-branches">
              <div>
                <i className="dxp-inspector-dot-true" />
                <strong>True</strong>
                <span>Condition matches</span>
              </div>
              <div>
                <i className="dxp-inspector-dot-false" />
                <strong>False</strong>
                <span>Condition does not match</span>
              </div>
            </div>
            <p className="dxp-inspector-hint">
              Connect each output to the next step for that path.
            </p>
          </>
        )}

        {node.data.kind === 'loop' && (
          <>
            <Field label="Number of repetitions" htmlFor={id('iterations')}>
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
                <span>times</span>
              </div>
            </Field>
            <div className="dxp-inspector-branches">
              <div>
                <Repeat2 size={13} />
                <strong>Body</strong>
                <span>Runs each repetition</span>
              </div>
              <div>
                <ArrowDown size={13} />
                <strong>Done</strong>
                <span>Runs after the last one</span>
              </div>
            </div>
            <p className="dxp-inspector-hint">
              Connect the steps to repeat to Body. Connect the next step to Done.
            </p>
          </>
        )}

        {node.data.kind === 'popover' && (
          <>
            <Field label="Content type" htmlFor={id('content-type')}>
              <Select
                id={id('content-type')}
                value={config.contentType ?? 'html'}
                onChange={(event) =>
                  update({ contentType: event.target.value as StepConfig['contentType'] })
                }
              >
                <option value="html">Custom HTML</option>
                <option value="iframe">Embedded website</option>
              </Select>
            </Field>
            {config.contentType === 'iframe' ? (
              <Field
                label="Website URL"
                htmlFor={id('url')}
                hint="The website must allow embedding in an iframe."
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
              <Field label="HTML content" htmlFor={id('content')}>
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
            <Field label="Position" htmlFor={id('position')}>
              <Select
                id={id('position')}
                value={config.position ?? 'bottom-right'}
                onChange={(event) =>
                  update({ position: event.target.value as StepConfig['position'] })
                }
              >
                <option value="center">Center of screen</option>
                <option value="top-left">Top left</option>
                <option value="top-right">Top right</option>
                <option value="bottom-left">Bottom left</option>
                <option value="bottom-right">Bottom right</option>
                <option value="anchor">Next to an element</option>
              </Select>
            </Field>
            {config.position === 'anchor' && targetField('Anchor element')}
            <Field
              label="Popover width"
              htmlFor={id('width')}
              hint="Choose a width between 240 and 960 pixels."
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
                <span>px</span>
              </div>
            </Field>
            <div className="dxp-inspector-preview">
              <div>
                <span>CONTENT PREVIEW</span>
                <button
                  type="button"
                  className="dxp-inspector-preview-expand"
                  onClick={onPreviewContent}
                  aria-label="Open fullscreen content preview"
                  title="Preview on the demo website"
                >
                  <Maximize2 size={12} /> Fullscreen
                </button>
              </div>
              {(config.contentType ?? 'html') === 'html' && config.content ? (
                <iframe
                  title="Popover HTML preview"
                  sandbox=""
                  srcDoc={`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:system-ui,sans-serif;font-size:13px;color:#243c31;padding:8px;overflow-wrap:anywhere}h1,h2,h3{font-size:17px;margin:8px 0}p{line-height:1.6}img{max-width:100%}button{font:inherit}</style></head><body>${config.content}</body></html>`}
                />
              ) : (
                <p className="dxp-inspector-preview-hint">
                  Preview your popover in position on the demo website.
                </p>
              )}
            </div>
          </>
        )}
      </div>
      <footer className="dxp-inspector-footer">
        <button
          type="button"
          onClick={onDuplicate}
          title={isNote ? 'Duplicate note' : 'Duplicate step'}
        >
          <Copy size={14} /> Duplicate
        </button>
        <button
          type="button"
          className="dxp-inspector-delete"
          onClick={onDelete}
          title={isNote ? 'Delete note' : 'Delete step'}
        >
          <Trash2 size={14} /> Delete
        </button>
      </footer>
    </aside>
  );
}
