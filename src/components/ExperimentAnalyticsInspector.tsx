import { CircleOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { createExperimentTools } from '../lib/experiment';
import { formatBuilderError } from '../lib/i18n';
import { useBuilderI18n } from '../lib/i18nContext';
import type { StepConfig } from '../lib/types';
import { InfoBox } from './InfoBox';
import { Select } from './Select';

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

export function ExperimentAnalyticsInspector({
  config,
  update,
  id,
  targetField,
}: {
  config: StepConfig;
  update: (patch: Partial<StepConfig>) => void;
  id: (name: string) => string;
  targetField: ReactNode;
}) {
  const { t } = useBuilderI18n();
  const platform = config.experimentAnalytics ?? 'none';
  let error: string | undefined;
  try {
    createExperimentTools().validateAnalytics(config);
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
    <section className="dxp-experiment-analytics" aria-labelledby={id('analytics-heading')}>
      <h3 id={id('analytics-heading')}>{t('experiment.analytics')}</h3>
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
                if (value !== 'posthog') update({ experimentAnalytics: value });
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
      {platform === 'ga4' && (
        <>
          {field(
            'experimentId',
            t('experiment.id'),
            <input
              id={id('experimentId')}
              required
              value={config.experimentId ?? ''}
              placeholder="homepage-cta-v1"
              spellCheck={false}
              onChange={(event) => update({ experimentId: event.target.value })}
            />,
            t('experiment.idHint'),
          )}
          {targetField}
          {field(
            'experimentInteraction',
            t('experiment.interaction'),
            <Select
              id={id('experimentInteraction')}
              value={config.experimentInteraction ?? 'click'}
              onChange={(event) =>
                update({ experimentInteraction: event.target.value as 'click' | 'change' })
              }
            >
              <option value="click">{t('experiment.click')} (click)</option>
              <option value="change">{t('experiment.change')} (change)</option>
            </Select>,
            t(
              config.experimentInteraction === 'change'
                ? 'experiment.changeInteractionHint'
                : 'experiment.clickInteractionHint',
            ),
          )}
          {field(
            'experimentDelivery',
            t('experiment.delivery'),
            <Select
              id={id('experimentDelivery')}
              value={config.experimentDelivery ?? 'gtag'}
              onChange={(event) =>
                update({ experimentDelivery: event.target.value as 'gtag' | 'gtm' })
              }
            >
              <option value="gtag">{t('experiment.gtag')}</option>
              <option value="gtm">{t('experiment.gtm')}</option>
            </Select>,
            t(config.experimentDelivery === 'gtm' ? 'experiment.gtmHint' : 'experiment.gtagHint'),
          )}
          {config.experimentDelivery !== 'gtm' &&
            field(
              'experimentMeasurementId',
              t('experiment.measurementId'),
              <input
                id={id('experimentMeasurementId')}
                value={config.experimentMeasurementId ?? ''}
                placeholder="G-XXXXXXXXXX"
                spellCheck={false}
                onChange={(event) => update({ experimentMeasurementId: event.target.value })}
              />,
              t('experiment.measurementIdHint'),
            )}
          {error && (
            <p className="dxp-field-error" role="alert">
              {error}
            </p>
          )}
          <details className="dxp-analytics-guide">
            <summary>{t('experiment.reporting')}</summary>
            <ol>
              {(
                [
                  'guideInstall',
                  'guideId',
                  'guideDimensions',
                  'guideValues',
                  'guideExplore',
                  'guideDebug',
                ] as const
              ).map((key) => (
                <li key={key}>{t(`experiment.${key}`)}</li>
              ))}
            </ol>
            <p>{t('experiment.guideScope')}</p>
            <a
              href="https://developers.google.com/analytics/devguides/collection/ga4/integration"
              target="_blank"
              rel="noreferrer"
            >
              {t('experiment.guideIntegrationLink')}
            </a>
            <p>{t('experiment.guideIntegrationHint')}</p>
            <a
              href="https://support.google.com/analytics/answer/9327974?hl=en"
              target="_blank"
              rel="noreferrer"
            >
              {t('experiment.guideFunnelLink')}
            </a>
          </details>
          <InfoBox>{t('experiment.mapping')}</InfoBox>
        </>
      )}
    </section>
  );
}
