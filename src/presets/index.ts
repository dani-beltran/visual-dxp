import type { WorkflowPreset } from '../lib/types';
import { boundedCtaAttentionPreset } from './bounded-cta-attention';
import { campaignHeadlinePreset } from './campaign-headline';
import { campaignUrlPersonalizationPreset } from './campaign-url-personalization';
import { clickToOpenHelpPreset } from './click-to-open-help';
import { delayedWelcomePreset } from './delayed-welcome';
import { engagedReaderInvitationPreset } from './engaged-reader-invitation';
import { exitIntentOfferPreset } from './exit-intent-offer';
import { frustrationRecoveryPreset } from './frustration-recovery';
import { inactivityAssistancePreset } from './inactivity-assistance';
import { mobileSpecificMessagingPreset } from './mobile-specific-messaging';
import { returningVisitorExperiencePreset } from './returning-visitor-experience';
import { segmentedOnboardingPreset } from './segmented-onboarding';

export {
  boundedCtaAttentionPreset,
  campaignHeadlinePreset,
  campaignUrlPersonalizationPreset,
  clickToOpenHelpPreset,
  delayedWelcomePreset,
  engagedReaderInvitationPreset,
  exitIntentOfferPreset,
  frustrationRecoveryPreset,
  inactivityAssistancePreset,
  mobileSpecificMessagingPreset,
  returningVisitorExperiencePreset,
  segmentedOnboardingPreset,
};

/** Curated examples in ascending implementation complexity; opt in through the presets prop. */
export const commonDXPPresets: readonly WorkflowPreset[] = [
  clickToOpenHelpPreset,
  delayedWelcomePreset,
  campaignHeadlinePreset,
  engagedReaderInvitationPreset,
  mobileSpecificMessagingPreset,
  campaignUrlPersonalizationPreset,
  exitIntentOfferPreset,
  returningVisitorExperiencePreset,
  inactivityAssistancePreset,
  frustrationRecoveryPreset,
  boundedCtaAttentionPreset,
  segmentedOnboardingPreset,
];
