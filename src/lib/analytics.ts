import type { createDataTools } from './data';
import type { AnalyticsSettings } from './types';

/** Accept incomplete measurement IDs while editing, but reject malformed imported settings. */
export function isAnalyticsSettings(value: unknown): value is AnalyticsSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const settings = value as Record<string, unknown>;
  return (
    ['none', 'ga4'].includes(settings.provider as string) &&
    (settings.workflowId === undefined || typeof settings.workflowId === 'string') &&
    (settings.workflowVersion === undefined || typeof settings.workflowVersion === 'string') &&
    (settings.delivery === undefined || ['gtag', 'gtm'].includes(settings.delivery as string)) &&
    (settings.measurementId === undefined || typeof settings.measurementId === 'string')
  );
}

/** Self-contained: also serialized into the standalone workflow runtime. */
export function createAnalyticsTools() {
  function fail(message: string, key: string): never {
    throw Object.assign(new Error(message), { messageKey: `analytics.${key}` });
  }
  function validateEventName(value: unknown): string {
    if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(value))
      fail(
        'Use an event name of 1–40 letters, numbers, or underscores, starting with a letter.',
        'invalidEventName',
      );
    // Reserve automatic GA4 web events and our own lifecycle/experiment events.
    const reserved = [
      'ad_impression',
      'app_remove',
      'app_store_refund',
      'app_store_subscription_cancel',
      'app_store_subscription_renew',
      'click',
      'error',
      'file_download',
      'first_open',
      'first_visit',
      'form_start',
      'form_submit',
      'in_app_purchase',
      'page_view',
      'scroll',
      'session_start',
      'user_engagement',
      'view_complete',
      'video_progress',
      'video_start',
      'view_search_results',
      'experiment_view',
      'experiment_cta',
    ];
    if (/^(dxp_|query_id|google_|ga_|firebase_)/.test(value) || reserved.includes(value))
      fail(
        'Choose a custom event name that is not reserved by Google Analytics or Visual DXP.',
        'reservedEventName',
      );
    return value;
  }
  function validateIdentity(settings: AnalyticsSettings): void {
    for (const value of [settings.workflowId, settings.workflowVersion]) {
      if (value !== undefined && (typeof value !== 'string' || !value.trim() || value.length > 100))
        fail('Workflow ID and reporting version must contain 1–100 characters.', 'invalidIdentity');
    }
  }
  function parsePayload(text = ''): Record<string, unknown> {
    if (!text.trim()) return {};
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      fail('Enter a valid JSON object for the event payload.', 'invalidPayload');
    }
    if (!value || typeof value !== 'object' || Array.isArray(value))
      fail('Enter a valid JSON object for the event payload.', 'invalidPayload');
    const reserved = [
      'event',
      'send_to',
      'event_callback',
      'event_timeout',
      'groups',
      'workflow_id',
      'workflow_version',
      'run_id',
      'trigger_id',
      'step_id',
      'step_type',
      'step_index',
      'step_count',
      'experiment_id',
      'variant_id',
      'branch',
      '__proto__',
      'constructor',
      'prototype',
    ];
    for (const key of Object.keys(value)) {
      if (
        !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(key) ||
        /^(google_|ga_|firebase_|dxp_)/.test(key) ||
        reserved.includes(key)
      )
        fail(
          'Payload parameter names must start with a letter, use up to 40 letters, numbers or underscores, and must not override reserved analytics fields.',
          'invalidPayloadKey',
        );
    }
    return value as Record<string, unknown>;
  }
  function validatePayload(
    template: string | undefined,
    dataTools: ReturnType<typeof createDataTools>,
  ): void {
    if (!template) return;
    dataTools.validateRequest({ method: 'POST', body: template });
    parsePayload(template.replace(/\{\{[\s\S]*?\}\}/g, '0'));
  }
  return { validateEventName, validateIdentity, parsePayload, validatePayload };
}
