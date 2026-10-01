/** Original English copy for the bundled presets. */
export const englishPresetMessages = {
  'complexity.beginner': 'beginner',
  'complexity.intermediate': 'intermediate',
  'complexity.advanced': 'advanced',
  'welcome-journey.name': 'Welcome journey',
  'welcome-journey.description':
    'Wait briefly after page load, then show a welcome offer when the shop button exists or personalize the newsletter heading otherwise.',
  'welcome-journey.welcome': 'Page visited',
  'welcome-journey.pause': 'Give it a moment',
  'welcome-journey.check': 'Find the right moment',
  'welcome-journey.offer': 'A little welcome gift',
  'welcome-journey.update': 'Make it personal',
  'welcome-journey.value': 'A little inspiration, just for you.',
  'welcome-journey.true': 'Element found',
  'welcome-journey.false': 'Otherwise',
  'welcome-journey.overview': 'Preset overview',
  'welcome-journey.setup': 'Setup: Welcome offer and fallback',
  'welcome-journey.instructions':
    'Check #shop-now and #newsletter h2 on your target website. Customize the welcome offer, discount code, and #collection link before publishing. Runs on every page load after 1.5 seconds.',
  'welcome-journey.content':
    '<div style="padding:28px;font-family:system-ui;color:#203a30"><span style="font-size:11px;letter-spacing:2px;color:#277457">A LITTLE SOMETHING FOR YOU</span><h2 style="font-size:29px;line-height:1.15;font-weight:500;margin:14px 0">Good things start here.</h2><p style="color:#6b7770;line-height:1.6">Welcome to Atelier. Enjoy 15% off your first order with code <strong>HELLO15</strong>.</p><a href="#collection" style="display:inline-block;background:#267456;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;margin-top:8px">Find your everyday favorite ↗</a></div>',
  'blank.name': 'Blank',
  'blank.description': 'Start from an empty canvas and build your own workflow.',
  'bounded-cta-attention.name': 'Bounded CTA attention sequence',
  'bounded-cta-attention.description':
    'Highlight the collection heading twice after the main CTA is clicked, then show a completion tip.',
  'bounded-cta-attention.workflow.name': 'Bounded CTA attention sequence',
  'bounded-cta-attention.workflow.nodes.attention-click.data.label': 'Click collection CTA',
  'bounded-cta-attention.workflow.nodes.attention-loop.data.label': 'Repeat twice',
  'bounded-cta-attention.workflow.nodes.attention-add.data.label': 'Highlight destination',
  'bounded-cta-attention.workflow.nodes.attention-on.data.label': 'Hold for 600 ms',
  'bounded-cta-attention.workflow.nodes.attention-remove.data.label': 'Remove highlight',
  'bounded-cta-attention.workflow.nodes.attention-off.data.label': 'Rest for 600 ms',
  'bounded-cta-attention.workflow.nodes.attention-done.data.label': 'Collection is ready',
  'bounded-cta-attention.workflow.nodes.attention-done.data.config.content':
    '<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">\n  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>\n  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">The everyday collection</p>\n  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">Explore at your own pace</h2>\n  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">The collection heading has been highlighted twice. Take a closer look at any object that catches your eye.</p>\n</div>',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-1.data.label':
    'Setup: Required CSS',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-1.data.config.noteText':
    'Uses #shop-now and #collection h2, the destination of the demo CTA scroll. The demo includes .dxp-cta-attention { outline: 3px solid #697856; outline-offset: 6px; }. Add that class to your own website stylesheet.',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-2.data.label':
    'Setup: Loop wiring',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-2.data.config.noteText':
    'The loop awaits the entire body twice (2.4 seconds total), then follows done once. Leave the final body delay unconnected: never connect it back to the loop or to done.',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-3.data.label':
    'Setup: Completion limits',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-3.data.config.noteText':
    'Completion means the class sequence finished, not that a visitor engaged. Repeated clicks may start overlapping runs. Destroying the runtime mid-body does not undo DOM changes; remove the class during host cleanup if necessary.',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-overview.data.label':
    'Preset overview',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-overview.data.config.noteText':
    'Highlight the collection heading twice after the main CTA is clicked, then show a completion tip.',
  'bounded-cta-attention.workflow.edges.attention-loop-to-attention-add.label': 'Repeat body',
  'bounded-cta-attention.workflow.edges.attention-loop-to-attention-done.label':
    'After both repetitions',
  'campaign-headline.name': 'Campaign headline',
  'campaign-headline.description':
    'Replace the hero headline during the current UTC week, Monday through Sunday; leave it unchanged otherwise.',
  'campaign-headline.workflow.name': 'Campaign headline',
  'campaign-headline.workflow.nodes.headline-load.data.label': 'Page loaded',
  'campaign-headline.workflow.nodes.headline-day.data.label': 'Campaign week (UTC)?',
  'campaign-headline.workflow.nodes.headline-update.data.label': 'Show campaign headline',
  'campaign-headline.workflow.nodes.headline-update.data.config.value':
    'A new season of everyday favorites.',
  'campaign-headline.workflow.nodes.campaign-headline-setup-1.data.label': 'Setup: Campaign week',
  'campaign-headline.workflow.nodes.campaign-headline-setup-1.data.config.noteText':
    'Uses the current UTC week (Monday–Sunday), calculated when this preset module loads. Reload the app to refresh; applied or exported workflows keep their saved dates. You can edit either date.',
  'campaign-headline.workflow.nodes.campaign-headline-setup-2.data.label': 'Setup: Headline target',
  'campaign-headline.workflow.nodes.campaign-headline-setup-2.data.config.noteText':
    'Uses .hero h1. Text replacement removes its nested markup. The false output intentionally ends without changing the page.',
  'campaign-headline.workflow.nodes.campaign-headline-overview.data.label': 'Preset overview',
  'campaign-headline.workflow.nodes.campaign-headline-overview.data.config.noteText':
    'Replace the hero headline during the current UTC week, Monday through Sunday; leave it unchanged otherwise.',
  'campaign-headline.workflow.edges.headline-day-to-headline-update.label': 'Campaign week',
  'campaign-url-personalization.name': 'Campaign URL personalization',
  'campaign-url-personalization.description':
    'Welcome everyday-edit campaign visitors with tailored copy while retaining a default message.',
  'campaign-url-personalization.workflow.name': 'Campaign URL personalization',
  'campaign-url-personalization.workflow.nodes.campaign-load.data.label': 'Page loaded',
  'campaign-url-personalization.workflow.nodes.campaign-check.data.label':
    'Everyday edit campaign?',
  'campaign-url-personalization.workflow.nodes.campaign-matched.data.label': 'Campaign message',
  'campaign-url-personalization.workflow.nodes.campaign-matched.data.config.value':
    'Welcome to the everyday edit: thoughtful objects for slower mornings.',
  'campaign-url-personalization.workflow.nodes.campaign-default.data.label': 'Default message',
  'campaign-url-personalization.workflow.nodes.campaign-default.data.config.value':
    'Discover thoughtful objects for everyday living.',
  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-setup-1.data.label':
    'Setup: Campaign parameter',
  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-setup-1.data.config.noteText':
    'Visit /demo-site.html?utm_campaign=everyday-edit to match. Query values are exact and case-sensitive; replace the parameter and value for your campaign.',
  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-setup-2.data.label':
    'Setup: Preview website',
  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-setup-2.data.config.noteText':
    'Uses .hero .description. Configure the builder website URL for the page you will test; applying a preset preserves the current website URL.',
  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-overview.data.label':
    'Preset overview',
  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-overview.data.config.noteText':
    'Welcome everyday-edit campaign visitors with tailored copy while retaining a default message.',
  'campaign-url-personalization.workflow.edges.campaign-check-to-campaign-matched.label':
    'Campaign match',
  'campaign-url-personalization.workflow.edges.campaign-check-to-campaign-default.label': 'Default',
  'click-to-open-help.name': 'Click-to-open help',
  'click-to-open-help.description':
    'Offer newsletter help next to the form when the newsletter link is clicked.',
  'click-to-open-help.workflow.name': 'Click-to-open help',
  'click-to-open-help.workflow.nodes.help-click.data.label': 'Click newsletter link',
  'click-to-open-help.workflow.nodes.help-popover.data.label': 'Newsletter help',
  'click-to-open-help.workflow.nodes.help-popover.data.config.content':
    '<style>[data-visual-dxp-popover="help-popover"] > div { background: #697856 !important; border-color: #697856 !important; } [data-visual-dxp-popover="help-popover"] > svg path { fill: #697856 !important; stroke: #697856 !important; } [data-visual-dxp-popover="help-popover"] button[aria-label="Close experience"] { color: #fff !important; }</style><p style="margin:-28px -24px -24px;padding:14px 40px 14px 16px;background:#697856;color:#fff;font:300 14px/1.5 Georgia,serif;letter-spacing:-0.15px;box-sizing:border-box;overflow-wrap:anywhere"><span aria-hidden="true">✉️</span> Enter your email, then select the arrow to subscribe.</p>',
  'click-to-open-help.workflow.nodes.click-to-open-help-setup-1.data.label': 'Setup: Help target',
  'click-to-open-help.workflow.nodes.click-to-open-help-setup-1.data.config.noteText':
    'Uses #collection .section-heading a as the demo click target and #newsletter form as the anchor. The demo link scrolls to the newsletter; use a keyboard-accessible link or help button on your site.',
  'click-to-open-help.workflow.nodes.click-to-open-help-setup-2.data.label': 'Setup: Help copy',
  'click-to-open-help.workflow.nodes.click-to-open-help-setup-2.data.config.noteText':
    'Edit the copy to match your newsletter terms. Opening help does not submit or confirm a subscription.',
  'click-to-open-help.workflow.nodes.click-to-open-help-overview.data.label': 'Preset overview',
  'click-to-open-help.workflow.nodes.click-to-open-help-overview.data.config.noteText':
    'Offer newsletter help next to the form when the newsletter link is clicked.',
  'delayed-welcome.name': 'Delayed welcome',
  'delayed-welcome.description':
    'Give visitors two seconds to settle in before a small welcome message.',
  'delayed-welcome.workflow.name': 'Delayed welcome',
  'delayed-welcome.workflow.nodes.welcome-load.data.label': 'Page loaded',
  'delayed-welcome.workflow.nodes.welcome-delay.data.label': 'Wait two seconds',
  'delayed-welcome.workflow.nodes.welcome-popover.data.label': 'Welcome to Atelier',
  'delayed-welcome.workflow.nodes.welcome-popover.data.config.content':
    '<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">\n  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>\n  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">Welcome to Atelier</p>\n  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">Make yourself at home</h2>\n  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">Explore considered objects for everyday living, at your own pace.</p>\n  <a href="#collection" style="display:flex;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box;min-height:44px;margin-top:22px;padding:13px 16px;border-radius:2px;background:#697856;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:400;line-height:1.5;text-decoration:none"><span>Browse the collection</span><span aria-hidden="true">↗</span></a>\n</div>',
  'delayed-welcome.workflow.nodes.delayed-welcome-setup-1.data.label': 'Setup: Welcome content',
  'delayed-welcome.workflow.nodes.delayed-welcome-setup-1.data.config.noteText':
    'The demo contains #collection. Update the link and welcome copy for your website.',
  'delayed-welcome.workflow.nodes.delayed-welcome-setup-2.data.label': 'Setup: Display frequency',
  'delayed-welcome.workflow.nodes.delayed-welcome-setup-2.data.config.noteText':
    'Runs once per page load; there is no cross-visit frequency gate.',
  'delayed-welcome.workflow.nodes.delayed-welcome-overview.data.label': 'Preset overview',
  'delayed-welcome.workflow.nodes.delayed-welcome-overview.data.config.noteText':
    'Give visitors two seconds to settle in before a small welcome message.',
  'engaged-reader-invitation.name': 'Engaged-reader invitation',
  'engaged-reader-invitation.description':
    'Invite visitors who scroll through 70% of the page to explore the newsletter.',
  'engaged-reader-invitation.workflow.name': 'Engaged-reader invitation',
  'engaged-reader-invitation.workflow.nodes.reader-scroll.data.label': 'Scroll down to 70%',
  'engaged-reader-invitation.workflow.nodes.reader-popover.data.label': 'A little inspiration',
  'engaged-reader-invitation.workflow.nodes.reader-popover.data.config.content':
    '<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">\n  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>\n  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">The Atelier journal</p>\n  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">Enjoying the collection?</h2>\n  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">Find occasional stories and new objects in our newsletter.</p>\n  <a href="#newsletter" style="display:flex;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box;min-height:44px;margin-top:22px;padding:13px 16px;border-radius:2px;background:#697856;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:400;line-height:1.5;text-decoration:none"><span>Explore the newsletter</span><span aria-hidden="true">↗</span></a>\n</div>',
  'engaged-reader-invitation.workflow.nodes.reader-cookie.data.label': 'Record invitation shown',
  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-setup-1.data.label':
    'Setup: Scroll and link',
  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-setup-1.data.config.noteText':
    'Requires a scrollable page and downward scrolling; #newsletter exists in the demo.',
  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-setup-2.data.label':
    'Setup: Invitation marker',
  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-setup-2.data.config.noteText':
    'Writes dxp_reader_invitation=shown for 7 days immediately after rendering. This records display, not signup, and does not gate future page loads.',
  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-overview.data.label':
    'Preset overview',
  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-overview.data.config.noteText':
    'Invite visitors who scroll through 70% of the page to explore the newsletter.',
  'exit-intent-offer.name': 'Exit-intent offer with frequency control',
  'exit-intent-offer.description':
    'Show a shipping reminder on exit intent only when its session marker is absent.',
  'exit-intent-offer.workflow.name': 'Exit-intent offer with frequency control',
  'exit-intent-offer.workflow.nodes.exit-trigger.data.label': 'Pointer leaves at top',
  'exit-intent-offer.workflow.nodes.exit-check.data.label': 'Offer already shown?',
  'exit-intent-offer.workflow.nodes.exit-popover.data.label': 'Before you go',
  'exit-intent-offer.workflow.nodes.exit-popover.data.config.content':
    '<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">\n  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>\n  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">A thoughtful delivery</p>\n  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">A thoughtful delivery</h2>\n  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">Complimentary shipping on orders over €75. Take another look whenever you are ready.</p>\n  <a href="#collection" style="display:flex;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box;min-height:44px;margin-top:22px;padding:13px 16px;border-radius:2px;background:#697856;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:400;line-height:1.5;text-decoration:none"><span>Back to the collection</span><span aria-hidden="true">↗</span></a>\n</div>',
  'exit-intent-offer.workflow.nodes.exit-cookie.data.label': 'Remember for this session',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-1.data.label': 'Setup: Offer terms',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-1.data.config.noteText':
    'Uses the demo shipping offer and #collection link; verify your own offer terms before use.',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-2.data.label': 'Setup: Session marker',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-2.data.config.noteText':
    'Writes dxp_exit_offer=shown as a session cookie (cookieDays: 0). Matching true ends silently. Clear the cookie and matching browser storage keys to retest.',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-3.data.label': 'Setup: Exit detection',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-3.data.config.noteText':
    'Exit intent is a pointer leaving the top edge, once per runtime installation; it is not a mobile back-navigation detector.',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-overview.data.label': 'Preset overview',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-overview.data.config.noteText':
    'Show a shipping reminder on exit intent only when its session marker is absent.',
  'exit-intent-offer.workflow.edges.exit-check-to-exit-popover.label': 'Not yet shown',
  'frustration-recovery.name': 'Frustration recovery',
  'frustration-recovery.description':
    'Offer browsing assistance after repeated nearby clicks and record a generic assistance event.',
  'frustration-recovery.workflow.name': 'Frustration recovery',
  'frustration-recovery.workflow.nodes.recovery-trigger.data.label': 'Three nearby clicks',
  'frustration-recovery.workflow.nodes.recovery-check.data.label': 'Assistance already shown?',
  'frustration-recovery.workflow.nodes.recovery-help.data.label': 'A little browsing help',
  'frustration-recovery.workflow.nodes.recovery-help.data.config.content':
    '<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">\n  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>\n  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">A little guidance</p>\n  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">Having trouble exploring?</h2>\n  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">Try the collection navigation, or take a break and return when you are ready.</p>\n  <a href="#collection" style="display:flex;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box;min-height:44px;margin-top:22px;padding:13px 16px;border-radius:2px;background:#697856;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:400;line-height:1.5;text-decoration:none"><span>View the collection</span><span aria-hidden="true">↗</span></a>\n</div>',
  'frustration-recovery.workflow.nodes.recovery-event.data.label': 'Record assistance shown',
  'frustration-recovery.workflow.nodes.recovery-cookie.data.label': 'Remember assistance shown',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-1.data.label':
    'Setup: Event endpoint',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-1.data.config.noteText':
    'Replace https://events.example.invalid/dxp-events with your own mock or event endpoint before running. Accept POST JSON with Content-Type: application/json and return 2xx; configure CORS if cross-origin. The reserved .invalid placeholder has no service.',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-2.data.label':
    'Setup: Generic event only',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-2.data.config.noteText':
    'The body is only {"event":"assistance_shown"}. Do not add personal data, page URLs, form values, credentials, or identifiers. This is not an analytics integration or support ticket.',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-3.data.label':
    'Setup: Rage-click scope',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-3.data.config.noteText':
    'Rage clicks are detected across the document, not scoped by a selector. Uses #collection in the support copy.',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-4.data.label':
    'Setup: Frequency limits',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-4.data.config.noteText':
    'dxp_assistance_shown is a session cookie written after the HTTP attempt, including failure. It records help display, not event delivery; concurrent triggers before the response can repeat requests. This is best-effort frequency control, not an atomic rate limit.',
  'frustration-recovery.workflow.nodes.frustration-recovery-overview.data.label': 'Preset overview',
  'frustration-recovery.workflow.nodes.frustration-recovery-overview.data.config.noteText':
    'Offer browsing assistance after repeated nearby clicks and record a generic assistance event.',
  'frustration-recovery.workflow.edges.recovery-check-to-recovery-help.label': 'Not yet shown',
  'inactivity-assistance.name': 'Inactivity assistance',
  'inactivity-assistance.description':
    'After 30 seconds without activity, offer newsletter guidance if the form exists or general guidance otherwise.',
  'inactivity-assistance.workflow.name': 'Inactivity assistance',
  'inactivity-assistance.workflow.nodes.idle-trigger.data.label': 'Idle for 30 seconds',
  'inactivity-assistance.workflow.nodes.idle-check.data.label': 'Newsletter form exists?',
  'inactivity-assistance.workflow.nodes.idle-delay.data.label': 'Wait one more second',
  'inactivity-assistance.workflow.nodes.idle-help.data.label': 'Newsletter guidance',
  'inactivity-assistance.workflow.nodes.idle-help.data.config.content':
    '<style>[data-visual-dxp-popover="idle-help"] > div { background: #697856 !important; border-color: #697856 !important; } [data-visual-dxp-popover="idle-help"] > svg path { fill: #697856 !important; stroke: #697856 !important; } [data-visual-dxp-popover="idle-help"] button[aria-label="Close experience"] { color: #fff !important; }</style><p style="margin:-28px -24px -24px;padding:14px 40px 14px 16px;background:#697856;color:#fff;font:300 14px/1.5 Georgia,serif;letter-spacing:-0.15px;box-sizing:border-box;overflow-wrap:anywhere"><span aria-hidden="true">✉️</span> Enter your email and use the arrow button to subscribe.</p>',
  'inactivity-assistance.workflow.nodes.idle-fallback.data.label': 'General browsing help',
  'inactivity-assistance.workflow.nodes.idle-fallback.data.config.content':
    '<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">\n  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>\n  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">At your own pace</p>\n  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">Take your time</h2>\n  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">Use the page navigation to keep exploring. You can close this tip whenever you like.</p>\n</div>',
  'inactivity-assistance.workflow.nodes.inactivity-assistance-setup-1.data.label':
    'Setup: Anchor and fallback',
  'inactivity-assistance.workflow.nodes.inactivity-assistance-setup-1.data.config.noteText':
    'Uses #newsletter form; remove it to exercise the fallback. The condition checks existence, not visibility, validity, or engagement.',
  'inactivity-assistance.workflow.nodes.inactivity-assistance-setup-2.data.label':
    'Setup: Timing behavior',
  'inactivity-assistance.workflow.nodes.inactivity-assistance-setup-2.data.config.noteText':
    'Activity resets the inactivity timer and can cause later assistance. Activity during the subsequent 1-second delay does not cancel it. The anchor must still exist after that delay.',
  'inactivity-assistance.workflow.nodes.inactivity-assistance-overview.data.label':
    'Preset overview',
  'inactivity-assistance.workflow.nodes.inactivity-assistance-overview.data.config.noteText':
    'After 30 seconds without activity, offer newsletter guidance if the form exists or general guidance otherwise.',
  'inactivity-assistance.workflow.edges.idle-check-to-idle-delay.label': 'Form available',
  'inactivity-assistance.workflow.edges.idle-check-to-idle-fallback.label': 'No form',
  'mobile-specific-messaging.name': 'Mobile-specific messaging',
  'mobile-specific-messaging.description':
    'Choose concise mobile copy or fuller desktop copy for the hero description.',
  'mobile-specific-messaging.workflow.name': 'Mobile-specific messaging',
  'mobile-specific-messaging.workflow.nodes.device-load.data.label': 'Page loaded',
  'mobile-specific-messaging.workflow.nodes.device-check.data.label': 'Mobile device?',
  'mobile-specific-messaging.workflow.nodes.device-mobile.data.label': 'Mobile message',
  'mobile-specific-messaging.workflow.nodes.device-mobile.data.config.value':
    'Everyday favorites, ready to explore on the go.',
  'mobile-specific-messaging.workflow.nodes.device-desktop.data.label': 'Desktop message',
  'mobile-specific-messaging.workflow.nodes.device-desktop.data.config.value':
    'Take a closer look at natural materials and thoughtful details in our everyday collection.',
  'mobile-specific-messaging.workflow.nodes.mobile-specific-messaging-setup-1.data.label':
    'Setup: Device detection',
  'mobile-specific-messaging.workflow.nodes.mobile-specific-messaging-setup-1.data.config.noteText':
    'Uses .hero .description. Device detection uses browser device hints or user agent, not viewport width; resizing the preview is not mobile emulation.',
  'mobile-specific-messaging.workflow.nodes.mobile-specific-messaging-overview.data.label':
    'Preset overview',
  'mobile-specific-messaging.workflow.nodes.mobile-specific-messaging-overview.data.config.noteText':
    'Choose concise mobile copy or fuller desktop copy for the hero description.',
  'mobile-specific-messaging.workflow.edges.device-check-to-device-mobile.label': 'Mobile',
  'mobile-specific-messaging.workflow.edges.device-check-to-device-desktop.label': 'Desktop',
  'returning-visitor-experience.name': 'Returning-visitor experience',
  'returning-visitor-experience.description':
    'Greet repeat visitors, or welcome new visitors and remember that the welcome was displayed.',
  'returning-visitor-experience.workflow.name': 'Returning-visitor experience',
  'returning-visitor-experience.workflow.nodes.visitor-load.data.label': 'Page loaded',
  'returning-visitor-experience.workflow.nodes.visitor-check.data.label': 'Welcomed before?',
  'returning-visitor-experience.workflow.nodes.visitor-returning.data.label':
    'Welcome back message',
  'returning-visitor-experience.workflow.nodes.visitor-returning.data.config.value':
    'Welcome back. Discover something thoughtful for your everyday.',
  'returning-visitor-experience.workflow.nodes.visitor-welcome.data.label': 'First-visit welcome',
  'returning-visitor-experience.workflow.nodes.visitor-welcome.data.config.content':
    '<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">\n  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>\n  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">Thoughtfully made</p>\n  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">Welcome to Atelier</h2>\n  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">Start with the everyday collection and discover objects made to be kept.</p>\n  <a href="#collection" style="display:flex;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box;min-height:44px;margin-top:22px;padding:13px 16px;border-radius:2px;background:#697856;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:400;line-height:1.5;text-decoration:none"><span>Explore the collection</span><span aria-hidden="true">↗</span></a>\n</div>',
  'returning-visitor-experience.workflow.nodes.visitor-cookie.data.label': 'Remember welcome shown',
  'returning-visitor-experience.workflow.nodes.returning-visitor-experience-setup-1.data.label':
    'Setup: Welcome and marker',
  'returning-visitor-experience.workflow.nodes.returning-visitor-experience-setup-1.data.config.noteText':
    'Uses .hero .description and #collection. dxp_visitor_welcome=shown lasts 30 days and records a displayed welcome, not identity or purchase history.',
  'returning-visitor-experience.workflow.nodes.returning-visitor-experience-setup-2.data.label':
    'Setup: Retest first visit',
  'returning-visitor-experience.workflow.nodes.returning-visitor-experience-setup-2.data.config.noteText':
    'Clear the cookie and matching local/session storage key to test the first-visit branch again.',
  'returning-visitor-experience.workflow.nodes.returning-visitor-experience-overview.data.label':
    'Preset overview',
  'returning-visitor-experience.workflow.nodes.returning-visitor-experience-overview.data.config.noteText':
    'Greet repeat visitors, or welcome new visitors and remember that the welcome was displayed.',
  'returning-visitor-experience.workflow.edges.visitor-check-to-visitor-returning.label':
    'Returning',
  'returning-visitor-experience.workflow.edges.visitor-check-to-visitor-welcome.label':
    'First welcome',
  'segmented-onboarding.name': 'Segmented onboarding journey',
  'segmented-onboarding.description':
    'Recognize prior visits; for new visitors, tailor guidance by campaign and record successful guidance delivery.',
  'segmented-onboarding.workflow.name': 'Segmented onboarding journey',
  'segmented-onboarding.workflow.nodes.onboarding-entry.data.label': '1 · Recognize the visit',
  'segmented-onboarding.workflow.nodes.onboarding-guidance.data.label': '2 · Contextual guidance',
  'segmented-onboarding.workflow.nodes.onboarding-record.data.label': '3 · Record delivery',
  'segmented-onboarding.workflow.nodes.onboarding-load.data.label': 'Page loaded',
  'segmented-onboarding.workflow.nodes.onboarding-seen.data.label': 'Guidance delivered before?',
  'segmented-onboarding.workflow.nodes.onboarding-return.data.label': 'Welcome back',
  'segmented-onboarding.workflow.nodes.onboarding-return.data.config.value':
    'Welcome back. Your collection is ready to explore.',
  'segmented-onboarding.workflow.nodes.onboarding-entry-note.data.label':
    'Setup: Frames and retesting',
  'segmented-onboarding.workflow.nodes.onboarding-entry-note.data.config.noteText':
    'Frames group recognition, guidance, and delivery stages. Notes are disconnected annotations. Cookie/storage matches may classify a visitor as returning; clear all matching keys to retest.',
  'segmented-onboarding.workflow.nodes.onboarding-campaign.data.label': 'Onboarding campaign?',
  'segmented-onboarding.workflow.nodes.onboarding-campaign-copy.data.label': 'Onboarding message',
  'segmented-onboarding.workflow.nodes.onboarding-campaign-copy.data.config.value':
    'Welcome to your onboarding. Start with the collection and get to know Atelier.',
  'segmented-onboarding.workflow.nodes.onboarding-default-copy.data.label': 'Discovery message',
  'segmented-onboarding.workflow.nodes.onboarding-default-copy.data.config.value':
    'Welcome. Discover natural materials and thoughtful details.',
  'segmented-onboarding.workflow.nodes.onboarding-campaign-delay.data.label':
    'Settle in for 1.5 seconds',
  'segmented-onboarding.workflow.nodes.onboarding-default-delay.data.label':
    'Settle in for 2 seconds',
  'segmented-onboarding.workflow.nodes.onboarding-campaign-help.data.label':
    'Explore your onboarding',
  'segmented-onboarding.workflow.nodes.onboarding-campaign-help.data.config.content':
    '<style>[data-visual-dxp-popover="onboarding-campaign-help"] > div { background: #697856 !important; border-color: #697856 !important; } [data-visual-dxp-popover="onboarding-campaign-help"] > svg path { fill: #697856 !important; stroke: #697856 !important; } [data-visual-dxp-popover="onboarding-campaign-help"] button[aria-label="Close experience"] { color: #fff !important; }</style><p style="margin:-28px -24px -24px;padding:14px 40px 14px 16px;background:#697856;color:#fff;font:300 14px/1.5 Georgia,serif;letter-spacing:-0.15px;box-sizing:border-box;overflow-wrap:anywhere"><span aria-hidden="true">🌿</span> Start here to explore the collection.</p>',
  'segmented-onboarding.workflow.nodes.onboarding-default-help.data.label':
    'Start with the collection',
  'segmented-onboarding.workflow.nodes.onboarding-default-help.data.config.content':
    '<style>[data-visual-dxp-popover="onboarding-default-help"] > div { background: #697856 !important; border-color: #697856 !important; } [data-visual-dxp-popover="onboarding-default-help"] > svg path { fill: #697856 !important; stroke: #697856 !important; } [data-visual-dxp-popover="onboarding-default-help"] button[aria-label="Close experience"] { color: #fff !important; }</style><p style="margin:-28px -24px -24px;padding:14px 40px 14px 16px;background:#697856;color:#fff;font:300 14px/1.5 Georgia,serif;letter-spacing:-0.15px;box-sizing:border-box;overflow-wrap:anywhere"><span aria-hidden="true">🌿</span> Browse all objects in the collection.</p>',
  'segmented-onboarding.workflow.nodes.onboarding-guidance-note.data.label':
    'Setup: Guidance targets',
  'segmented-onboarding.workflow.nodes.onboarding-guidance-note.data.config.noteText':
    'Uses .hero .description, #shop-now, and #collection. Test with and without ?utm_campaign=onboarding. Guidance anchors must exist when the delays finish.',
  'segmented-onboarding.workflow.nodes.onboarding-event.data.label': 'Record guidance displayed',
  'segmented-onboarding.workflow.nodes.onboarding-cookie.data.label': 'Mark delivery complete',
  'segmented-onboarding.workflow.nodes.onboarding-record-note.data.label': 'Setup: Event endpoint',
  'segmented-onboarding.workflow.nodes.onboarding-record-note.data.config.noteText':
    'Replace https://events.example.invalid/dxp-events with your own mock or event endpoint before running. Accept POST JSON with Content-Type: application/json and return 2xx; configure CORS if cross-origin. The reserved .invalid placeholder has no service.',
  'segmented-onboarding.workflow.nodes.onboarding-marker-note.data.label': 'Setup: Delivery marker',
  'segmented-onboarding.workflow.nodes.onboarding-marker-note.data.config.noteText':
    'dxp_onboarding_delivered=yes lasts 30 days. True skips guidance and HTTP; false chooses one campaign branch. The generic POST body is {"event":"onboarding_guidance_displayed"}.',
  'segmented-onboarding.workflow.nodes.onboarding-completion-note.data.label':
    'Setup: Completion meaning',
  'segmented-onboarding.workflow.nodes.onboarding-completion-note.data.config.noteText':
    'Completion means DOM copy updated, guidance rendered, and HTTP was attempted. It does not observe reading, dismissal, link clicks, signup, purchase, or server persistence. An HTTP failure still writes the completion cookie; it does not confirm event delivery.',
  'segmented-onboarding.workflow.nodes.segmented-onboarding-overview.data.label': 'Preset overview',
  'segmented-onboarding.workflow.nodes.segmented-onboarding-overview.data.config.noteText':
    'Recognize prior visits; for new visitors, tailor guidance by campaign and record successful guidance delivery.',
  'segmented-onboarding.workflow.edges.onboarding-seen-to-onboarding-return.label': 'Returning',
  'segmented-onboarding.workflow.edges.onboarding-seen-to-onboarding-campaign.label':
    'First guidance',
  'segmented-onboarding.workflow.edges.onboarding-campaign-to-onboarding-campaign-copy.label':
    'Onboarding',
  'segmented-onboarding.workflow.edges.onboarding-campaign-to-onboarding-default-copy.label':
    'Other visitors',
};

export type PresetMessages = { [K in keyof typeof englishPresetMessages]: string };
