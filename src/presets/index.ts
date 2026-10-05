import type { WorkflowPreset } from '../lib/types';
import { blankPreset, createBlankPreset } from './blank';
import {
  boundedCtaAttentionPreset,
  createBoundedCtaAttentionPreset,
} from './bounded-cta-attention';
import { campaignHeadlinePreset, createCampaignHeadlinePreset } from './campaign-headline';
import {
  campaignUrlPersonalizationPreset,
  createCampaignUrlPersonalizationPreset,
} from './campaign-url-personalization';
import { contextualSupportPreset, createContextualSupportPreset } from './contextual-support';
import { createDelayedWelcomePreset, delayedWelcomePreset } from './delayed-welcome';
import {
  createDrawAttentionToNewsletterPreset,
  drawAttentionToNewsletterPreset,
} from './draw-attention-to-newsletter';
import {
  createEngagedReaderInvitationPreset,
  engagedReaderInvitationPreset,
} from './engaged-reader-invitation';
import { createExitIntentOfferPreset, exitIntentOfferPreset } from './exit-intent-offer';
import { createFrustrationRecoveryPreset, frustrationRecoveryPreset } from './frustration-recovery';
import {
  createInactivityAssistancePreset,
  inactivityAssistancePreset,
} from './inactivity-assistance';
import { englishPresetMessages, type PresetMessages } from './locale/en';
import { spanishPresetMessages } from './locale/es';
import {
  createMobileSpecificMessagingPreset,
  mobileSpecificMessagingPreset,
} from './mobile-specific-messaging';
import { createSegmentedOnboardingPreset, segmentedOnboardingPreset } from './segmented-onboarding';
import { createWelcomeJourneyPreset, welcomeJourneyPreset } from './welcome-journey';

export {
  blankPreset,
  boundedCtaAttentionPreset,
  campaignHeadlinePreset,
  campaignUrlPersonalizationPreset,
  contextualSupportPreset,
  delayedWelcomePreset,
  drawAttentionToNewsletterPreset,
  engagedReaderInvitationPreset,
  exitIntentOfferPreset,
  frustrationRecoveryPreset,
  inactivityAssistancePreset,
  mobileSpecificMessagingPreset,
  segmentedOnboardingPreset,
  welcomeJourneyPreset,
};

/** Curated examples in ascending implementation complexity; opt in through the presets prop. */
export const commonDXPPresets: readonly WorkflowPreset[] = [
  blankPreset,
  drawAttentionToNewsletterPreset,
  delayedWelcomePreset,
  campaignHeadlinePreset,
  engagedReaderInvitationPreset,
  mobileSpecificMessagingPreset,
  campaignUrlPersonalizationPreset,
  welcomeJourneyPreset,
  exitIntentOfferPreset,
  inactivityAssistancePreset,
  contextualSupportPreset,
  frustrationRecoveryPreset,
  boundedCtaAttentionPreset,
  segmentedOnboardingPreset,
];

export { englishPresetMessages, type PresetMessages } from './locale/en';
export { spanishPresetMessages } from './locale/es';

const spanishPresets: readonly WorkflowPreset[] = [
  createWelcomeJourneyPreset(spanishPresetMessages),
  createBlankPreset(spanishPresetMessages),
  createBoundedCtaAttentionPreset(spanishPresetMessages),
  createCampaignHeadlinePreset(spanishPresetMessages),
  createCampaignUrlPersonalizationPreset(spanishPresetMessages),
  createDrawAttentionToNewsletterPreset(spanishPresetMessages),
  createContextualSupportPreset(spanishPresetMessages),
  createDelayedWelcomePreset(spanishPresetMessages),
  createEngagedReaderInvitationPreset(spanishPresetMessages),
  createExitIntentOfferPreset(spanishPresetMessages),
  createFrustrationRecoveryPreset(spanishPresetMessages),
  createInactivityAssistancePreset(spanishPresetMessages),
  createMobileSpecificMessagingPreset(spanishPresetMessages),
  createSegmentedOnboardingPreset(spanishPresetMessages),
].sort((a, b) => a.order - b.order);

/** Select bundled preset content by BCP 47 locale; unsupported languages use English. */
export function getCommonDXPPresets(locale = 'en'): readonly WorkflowPreset[] {
  return getPresetMessages(locale) === spanishPresetMessages ? spanishPresets : commonDXPPresets;
}

/** Only translate bundled objects, preserving host-authored or customized presets. */
export function localizeCommonDXPPreset(preset: WorkflowPreset, locale: string): WorkflowPreset {
  const index = commonDXPPresets.indexOf(preset);
  const bundledIndex = index === -1 ? spanishPresets.indexOf(preset) : index;
  return bundledIndex === -1 ? preset : getCommonDXPPresets(locale)[bundledIndex];
}

/** Resolve bundled preset copy independently of editor chrome translations. */
export function getPresetMessages(locale = 'en'): PresetMessages {
  return locale.toLowerCase().split('-')[0] === 'es'
    ? spanishPresetMessages
    : englishPresetMessages;
}
