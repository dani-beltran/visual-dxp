import { useId } from 'react';
import type { BuilderMessageKey } from '../lib/i18n';
import { useBuilderI18n } from '../lib/i18nContext';

export function AnalyticsGuide() {
  const { t } = useBuilderI18n();
  const headingId = useId();
  const paragraph = (key: Extract<BuilderMessageKey, `analytics.guide.${string}`>) => (
    <p>{t(key)}</p>
  );
  const source = (
    href: string,
    key: 'tagLink' | 'gtmLink' | 'dimensionsLink' | 'debugLink' | 'funnelLink' | 'experimentLink',
  ) => (
    <a href={href} target="_blank" rel="noreferrer">
      {t(`analytics.guide.${key}`)}
    </a>
  );
  return (
    <section className="dxp-analytics-documentation" aria-labelledby={headingId}>
      <h3 id={headingId}>{t('analytics.guide.title')}</h3>
      {paragraph('analytics.guide.intro')}
      <details className="dxp-analytics-chapter">
        <summary>
          <h4>{t('analytics.guide.conceptsTitle')}</h4>
        </summary>
        {paragraph('analytics.guide.concepts')}
        {paragraph('analytics.guide.identifiers')}
      </details>
      <details className="dxp-analytics-chapter">
        <summary>
          <h4>{t('analytics.guide.setupTitle')}</h4>
        </summary>
        <ol>
          {(['prerequisites', 'configure', 'milestones', 'deploy'] as const).map((key) => (
            <li key={key}>{t(`analytics.guide.${key}`)}</li>
          ))}
        </ol>
        <div className="dxp-analytics-delivery-guide">
          <h5>{t('experiment.gtag')}</h5>
          {paragraph('analytics.guide.tagSetup')}
          {source(
            'https://developers.google.com/analytics/devguides/collection/ga4/events',
            'tagLink',
          )}
        </div>
        <div className="dxp-analytics-delivery-guide">
          <h5>{t('experiment.gtm')}</h5>
          <ol>
            {(['gtmVariables', 'gtmTrigger', 'gtmTag', 'gtmOptional', 'gtmPublish'] as const).map(
              (key) => (
                <li key={key}>{t(`analytics.guide.${key}`)}</li>
              ),
            )}
          </ol>
          <pre>
            <code>{'dxp_workflow_started'}</code>
          </pre>
          {paragraph('analytics.guide.gtmExample')}
          {source('https://support.google.com/tagmanager/answer/13034206?hl=en', 'gtmLink')}
        </div>
      </details>
      <details className="dxp-analytics-chapter">
        <summary>
          <h4>{t('analytics.guide.eventsTitle')}</h4>
        </summary>
        <div className="dxp-analytics-reference-table">
          <table>
            <caption>{t('analytics.guide.eventsCaption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('analytics.guide.event')}</th>
                <th scope="col">{t('analytics.guide.meaning')}</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['dxp_workflow_started', 'started'],
                  ['dxp_workflow_step', 'step'],
                  ['dxp_workflow_completed', 'completed'],
                  ['offer_accepted', 'custom'],
                ] as const
              ).map(([event, key]) => (
                <tr key={event}>
                  <th scope="row">
                    <code>{event}</code>
                  </th>
                  <td>{t(`analytics.guide.${key}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {paragraph('analytics.guide.commonParameters')}
        {paragraph('analytics.guide.repetition')}
      </details>
      <details className="dxp-analytics-chapter">
        <summary>
          <h4>{t('analytics.guide.verifyTitle')}</h4>
        </summary>
        <ol>
          {(['preview', 'liveTest', 'inspect', 'troubleshoot'] as const).map((key) => (
            <li key={key}>{t(`analytics.guide.${key}`)}</li>
          ))}
        </ol>
        {source('https://support.google.com/analytics/answer/7201382?hl=en', 'debugLink')}
      </details>
      <details className="dxp-analytics-chapter">
        <summary>
          <h4>{t('analytics.guide.dimensionsTitle')}</h4>
        </summary>
        {paragraph('analytics.guide.dimensionsSetup')}
        <dl className="dxp-analytics-parameter-list">
          {(
            [
              ['workflow_id, workflow_version', 'workflowDimensions'],
              ['step_id, step_type, trigger_id', 'stepDimensions'],
              ['experiment_id, variant_id, branch', 'experimentDimensions'],
              ['step_index, step_count', 'numericParameters'],
              ['run_id', 'runParameter'],
            ] as const
          ).map(([names, key]) => (
            <div key={names}>
              <dt>
                <code>{names}</code>
              </dt>
              <dd>{t(`analytics.guide.${key}`)}</dd>
            </div>
          ))}
        </dl>
        {paragraph('analytics.guide.dimensionValues')}
        {source('https://support.google.com/analytics/answer/14239696?hl=en', 'dimensionsLink')}
      </details>
      <details className="dxp-analytics-chapter">
        <summary>
          <h4>{t('analytics.guide.reportingTitle')}</h4>
        </summary>
        {paragraph('analytics.guide.funnel')}
        <p className="dxp-analytics-funnel-example">
          <code>dxp_workflow_started → offer_accepted → lead_confirmed</code>
        </p>
        {paragraph('analytics.guide.funnelRules')}
        {paragraph('analytics.guide.experiments')}
        {paragraph('analytics.guide.scope')}
        <p>
          {source('https://support.google.com/analytics/answer/9327974?hl=en', 'funnelLink')}
          {' · '}
          {source(
            'https://developers.google.com/analytics/devguides/collection/ga4/integration',
            'experimentLink',
          )}
        </p>
      </details>
      <details className="dxp-analytics-chapter">
        <summary>
          <h4>{t('analytics.guide.legacyTitle')}</h4>
        </summary>
        {paragraph('analytics.guide.legacy')}
        {paragraph('analytics.guide.privacy')}
      </details>
    </section>
  );
}
