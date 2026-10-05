import type { StepConfig } from './types';

/** Self-contained so the same implementation can be embedded in exported scripts. */
export function createExperimentTools() {
  const assignments = new Map<string, 'a' | 'b'>();

  function validate(config: StepConfig): void {
    const split = config.experimentSplit === undefined ? 50 : config.experimentSplit;
    if (!Number.isInteger(split) || split < 0 || split > 100)
      throw new Error('Experiment traffic for A must be a whole percentage from 0 to 100.');
    if (config.experimentKey !== undefined && typeof config.experimentKey !== 'string')
      throw new Error('Experiment ID must be text.');
  }

  function assign(nodeId: string, config: StepConfig, win: Window): 'a' | 'b' {
    validate(config);
    const key = `visual-dxp-experiment-v1:${config.experimentKey?.trim() || nodeId}`;
    const cached = assignments.get(key);
    if (cached) return cached;
    let storage: Storage | undefined;
    try {
      storage = win.localStorage;
      const saved = storage.getItem(key);
      if (saved === 'a' || saved === 'b') {
        assignments.set(key, saved);
        return saved;
      }
    } catch {
      // Sandboxed previews and browsers may deny storage. Keep this run consistent.
    }
    const variant = Math.random() * 100 < (config.experimentSplit ?? 50) ? 'a' : 'b';
    assignments.set(key, variant);
    try {
      storage?.setItem(key, variant);
    } catch {
      // Full or disabled storage must not prevent the experience from running.
    }
    return variant;
  }

  function validateAnalytics(config: StepConfig): void {
    const fail = (message: string, key: string) => {
      throw Object.assign(new Error(message), { messageKey: `experiment.${key}` });
    };
    if (!['none', 'ga4'].includes(config.experimentAnalytics ?? 'none'))
      fail('Choose a supported analytics platform.', 'invalidPlatform');
    if (config.experimentAnalytics !== 'ga4') return;
    if (typeof config.experimentKey !== 'string' || !config.experimentKey.trim())
      fail('Enter an Experiment ID for analytics.', 'requiredId');
    if (typeof config.experimentSelector !== 'string' || !config.experimentSelector.trim())
      fail('Choose a CTA element for analytics.', 'requiredSelector');
    if (!['click', 'change'].includes(config.experimentInteraction ?? 'click'))
      fail('Choose click or change for the CTA interaction.', 'invalidInteraction');
    if (!['gtag', 'gtm'].includes(config.experimentDelivery ?? 'gtag'))
      fail('Choose Google tag or Google Tag Manager delivery.', 'invalidDelivery');
    if (
      config.experimentDelivery !== 'gtm' &&
      config.experimentMeasurementId !== undefined &&
      (typeof config.experimentMeasurementId !== 'string' ||
        (config.experimentMeasurementId.trim() &&
          !/^G-[A-Z0-9]+$/.test(config.experimentMeasurementId.trim())))
    )
      fail(
        'Enter a valid GA4 measurement ID, such as G-XXXXXXXXXX, or leave it empty.',
        'invalidMeasurementId',
      );
  }

  return { validate, validateAnalytics, assign };
}
