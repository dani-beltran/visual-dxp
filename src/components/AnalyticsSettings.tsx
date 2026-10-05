import { CircleOff } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { createAnalyticsTools } from '../lib/analytics';
import { createExperimentTools } from '../lib/experiment';
import { formatBuilderError } from '../lib/i18n';
import { useBuilderI18n } from '../lib/i18nContext';
import type { AnalyticsSettings as Settings, Workflow } from '../lib/types';
import { AnalyticsGuide } from './AnalyticsGuide';
import { InfoBox } from './InfoBox';
import { Select } from './Select';
import '../styles/analytics.css';

// Locally bundled vector marks. PostHog path: Simple Icons (CC0).
function PlatformIcon({ platform }: { platform: 'ga4' | 'posthog' }) {
  return platform === 'ga4' ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24">
      <rect x="16" y="2" width="6" height="20" rx="3" fill="#F9AB00" />
      <rect x="9" y="9" width="6" height="13" rx="3" fill="#E37400" />
      <circle cx="5" cy="19" r="3" fill="#E37400" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M9.854 14.5 5 9.647.854 5.5A.5.5 0 0 0 0 5.854V8.44a.5.5 0 0 0 .146.353L5 13.647l.147.146L9.854 18.5l.146.147v-.049c.065.03.134.049.207.049h2.586a.5.5 0 0 0 .353-.854L9.854 14.5zm0-5-4-4a.487.487 0 0 0-.409-.144.515.515 0 0 0-.356.21.493.493 0 0 0-.089.288V8.44a.5.5 0 0 0 .147.353l9 9a.5.5 0 0 0 .853-.354v-2.585a.5.5 0 0 0-.146-.354l-5-5zm1-4a.5.5 0 0 0-.854.354V8.44a.5.5 0 0 0 .147.353l4 4a.5.5 0 0 0 .853-.354V9.854a.5.5 0 0 0-.146-.354l-4-4zm12.647 11.515a3.863 3.863 0 0 1-2.232-1.1l-4.708-4.707a.5.5 0 0 0-.854.354v6.585a.5.5 0 0 0 .5.5H23.5a.5.5 0 0 0 .5-.5v-.6c0-.276-.225-.497-.499-.532zm-5.394.032a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6zM.854 15.5a.5.5 0 0 0-.854.354v2.293a.5.5 0 0 0 .5.5h2.293c.222 0 .39-.135.462-.309a.493.493 0 0 0-.109-.545L.854 15.501zM5 14.647.854 10.5a.5.5 0 0 0-.854.353v2.586a.5.5 0 0 0 .146.353L4.854 18.5l.146.147h2.793a.5.5 0 0 0 .353-.854L5 14.647z" />
    </svg>
  );
}

export function AnalyticsSettings({
  workflow,
  onChange,
}: {
  workflow: Workflow;
  onChange: (settings: Settings) => void;
}) {
  const { t } = useBuilderI18n();
  const prefix = useId();
  const id = (name: string) => `${prefix}-${name}`;
  const legacy = workflow.nodes.find(
    (node) => node.data.kind === 'experiment' && node.data.config.experimentAnalytics === 'ga4',
  )?.data.config;
  const config: Settings = workflow.analytics ?? {
    provider: legacy ? 'ga4' : 'none',
    delivery: legacy?.experimentDelivery ?? 'gtag',
    measurementId: legacy?.experimentMeasurementId ?? '',
  };
  const platform = config.provider;
  const update = (patch: Partial<Settings>) => onChange({ ...config, ...patch });
  let error: string | undefined;
  try {
    createExperimentTools().validateSettings(config);
    createAnalyticsTools().validateIdentity(config);
  } catch (issue) {
    error = formatBuilderError(issue, t);
  }
  const field = (key: string, label: string, children: ReactNode, hint?: string) => (
    <div className="dxp-inspector-field">
      <label htmlFor={id(key)}>{label}</label>
      {children}
      {hint && <p className="dxp-inspector-hint">{hint}</p>}
    </div>
  );
  return (
    <section className="dxp-analytics-settings dxp-inspector" aria-labelledby={id('heading')}>
      <h2 id={id('heading')}>{t('builder.analytics')}</h2>
      <p className="dxp-inspector-hint">{t('analytics.description')}</p>
      {workflow.analytics === undefined && legacy && <InfoBox>{t('analytics.legacy')}</InfoBox>}
      <fieldset className="dxp-analytics-platforms">
        <legend className="dxp-sr-only">{t('experiment.analytics')}</legend>
        {(['none', 'ga4', 'posthog'] as const).map((value) => (
          <label
            key={value}
            className={`dxp-analytics-card${value === 'posthog' ? ' dxp-analytics-card-disabled' : ''}`}
          >
            <input
              type="radio"
              name={id('analytics-platform')}
              value={value}
              checked={platform === value}
              disabled={value === 'posthog'}
              onChange={() => {
                if (value !== 'posthog') update({ provider: value });
              }}
            />
            {value === 'none' ? (
              <CircleOff size={24} aria-hidden="true" />
            ) : (
              <PlatformIcon platform={value} />
            )}
            <span>
              {value === 'none'
                ? t('experiment.none')
                : value === 'ga4'
                  ? 'Google Analytics'
                  : 'PostHog'}
            </span>
            {value === 'posthog' && (
              <span className="dxp-analytics-premium">{t('experiment.premium')}</span>
            )}
          </label>
        ))}
      </fieldset>
      {platform === 'none' && <InfoBox>{t('analytics.setupSuggestion')}</InfoBox>}
      {platform === 'ga4' && (
        <>
          {field(
            'workflowId',
            t('analytics.workflowId'),
            <input
              id={id('workflowId')}
              value={config.workflowId ?? workflow.name}
              maxLength={100}
              spellCheck={false}
              onChange={(event) => update({ workflowId: event.target.value })}
            />,
            t('analytics.workflowIdHint'),
          )}
          {field(
            'workflowVersion',
            t('analytics.workflowVersion'),
            <input
              id={id('workflowVersion')}
              value={config.workflowVersion ?? '1'}
              maxLength={100}
              spellCheck={false}
              onChange={(event) => update({ workflowVersion: event.target.value })}
            />,
            t('analytics.workflowVersionHint'),
          )}
          <InfoBox>{t('analytics.lifecycleHint')}</InfoBox>
          {field(
            'delivery',
            t('experiment.delivery'),
            <Select
              id={id('delivery')}
              value={config.delivery ?? 'gtag'}
              onChange={(event) => update({ delivery: event.target.value as 'gtag' | 'gtm' })}
            >
              <option value="gtag">{t('experiment.gtag')}</option>
              <option value="gtm">{t('experiment.gtm')}</option>
            </Select>,
            t(config.delivery === 'gtm' ? 'analytics.gtmHint' : 'experiment.gtagHint'),
          )}
          {config.delivery !== 'gtm' &&
            field(
              'measurementId',
              t('experiment.measurementId'),
              <input
                id={id('measurementId')}
                value={config.measurementId ?? ''}
                placeholder="G-XXXXXXXXXX"
                spellCheck={false}
                onChange={(event) => update({ measurementId: event.target.value })}
              />,
              t('experiment.measurementIdHint'),
            )}
          <InfoBox>{t('experiment.privacyHint')}</InfoBox>
        </>
      )}
      {error && (
        <p className="dxp-field-error" role="alert">
          {error}
        </p>
      )}
      {platform === 'ga4' && <AnalyticsGuide />}
    </section>
  );
}
