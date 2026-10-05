/** Original English copy for the bundled presets. */
export const englishPresetMessages = {
  'complexity.beginner': 'beginner',
  'complexity.intermediate': 'intermediate',
  'complexity.advanced': 'advanced',
  'contextual-support.name': 'Contextual support by opening hours',
  'contextual-support.description':
    'Hover over Help to reveal the demo support chat during opening hours or show an offline message outside them.',
  'contextual-support.workflow.name': 'Contextual support by opening hours',
  'contextual-support.workflow.nodes.support-hover.data.label': 'Hover over Help',
  'contextual-support.workflow.nodes.support-hours.data.label': 'Support hours (UTC)',
  'contextual-support.workflow.nodes.support-online.data.label': 'Support center',
  'contextual-support.workflow.nodes.support-offline.data.config.content':
    '<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere"><div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;letter-spacing:-1px">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px">®</span></span></div><p style="margin:22px 0 12px;font-size:10px;letter-spacing:1.7px;text-transform:uppercase;color:#697856">Here to help</p><h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15">We’ll be back soon</h2><p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">Our support hours are 09:00–17:00 UTC daily. Please visit again during those hours. In the meantime, explore the collection at your own pace.</p><a href="#collection" style="display:inline-block;margin-top:22px;padding:12px 20px;background:#697856;color:#fff;border-radius:6px;text-decoration:none;font-size:13px">Explore the collection ↗</a></div>',
  'contextual-support.workflow.nodes.support-offline.data.label': 'Outside support hours',
  'contextual-support.workflow.nodes.support-trigger-note.data.config.noteText':
    'Choose the Help link that starts this journey. In the demo, move the mouse over Help in the footer to show chat during opening hours or an away message outside them. Clicking the link still works as usual.',
  'contextual-support.workflow.nodes.support-trigger-note.data.label': 'Setup: Help link',
  'contextual-support.workflow.nodes.support-hours-note.data.config.noteText':
    'The demo offers chat every day from 09:00 to 17:00 UTC, a worldwide reference time. The last selected minute is included: 16:59 means it closes at 17:00. Update the hours, time zone, and away message together. Local time means the visitor’s time zone. Holidays, weekdays, and staff availability are not checked.',
  'contextual-support.workflow.nodes.support-hours-note.data.label': 'Setup: Opening hours',
  'contextual-support.workflow.nodes.support-embed-note.data.config.noteText':
    'The demo reveals a chat icon. Click it to open a sample conversation; no support agent receives these messages. For your website, ask your website team to connect your own chat tool. Update the away message and its collection link.',
  'contextual-support.workflow.nodes.support-embed-note.data.label': 'Setup: Support chat',
  'contextual-support.workflow.nodes.contextual-support-overview.data.config.noteText':
    'Hover over Help to reveal the demo support chat during opening hours or show an offline message outside them.',
  'contextual-support.workflow.nodes.contextual-support-overview.data.label': 'Preset overview',
  'contextual-support.workflow.edges.support-hours-to-support-online.label': 'Open',
  'contextual-support.workflow.edges.support-hours-to-support-offline.label': 'Closed',
  'welcome-journey.name': 'Welcome journey',
  'welcome-journey.description':
    'When the page opens, check whether the visitor has received the welcome gift. Wait a moment before showing the gift, or welcome returning visitors back in the newsletter heading.',
  'welcome-journey.welcome': 'Page visited',
  'welcome-journey.pause': 'Give it a moment',
  'welcome-journey.check': 'Already received the gift?',
  'welcome-journey.offer': 'A little welcome gift',
  'welcome-journey.cookie': 'Remember the welcome gift',
  'welcome-journey.update': 'Welcome back',
  'welcome-journey.value': 'Welcome back! It’s lovely to see you again.',
  'welcome-journey.true': 'Gift already shown',
  'welcome-journey.false': 'First welcome gift',
  'welcome-journey.overview': 'Preset overview',
  'welcome-journey.setup': 'Setup: Welcome message and page content',
  'welcome-journey.instructions':
    'Choose the newsletter heading on your website and customize the welcome-back message. Update the welcome offer, discount code, and collection link before publishing. The journey checks the cookie on every page opening or reload and waits 1.5 seconds only before showing the gift. After showing the gift, it sets dxp_welcome_gift=shown for 30 days. Keep the condition and cookie node names and values in sync.',
  'welcome-journey.content':
    '<div style="padding:28px;font-family:system-ui;color:#203a30"><span style="font-size:11px;letter-spacing:2px;color:#277457">A LITTLE SOMETHING FOR YOU</span><h2 style="font-size:29px;line-height:1.15;font-weight:500;margin:14px 0">Good things start here.</h2><p style="color:#6b7770;line-height:1.6">Welcome to Atelier. Enjoy 15% off your first order with code <strong>HELLO15</strong>.</p><a href="#collection" style="display:inline-block;background:#267456;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;margin-top:8px">Find your everyday favorite ↗</a></div>',
  'blank.name': 'Blank',
  'blank.description': 'Start from an empty canvas and build your own workflow.',
  'bounded-cta-attention.name': 'Bounded CTA attention sequence',
  'bounded-cta-attention.description':
    'After someone clicks the main shop button, highlight the collection heading three times and show a final tip.',
  'bounded-cta-attention.workflow.name': 'Bounded CTA attention sequence',
  'bounded-cta-attention.workflow.nodes.attention-click.data.label': 'Click collection CTA',
  'bounded-cta-attention.workflow.nodes.attention-loop.data.label': 'Repeat three times',
  'bounded-cta-attention.workflow.nodes.attention-add.data.label': 'Highlight destination',
  'bounded-cta-attention.workflow.nodes.attention-on.data.label': 'Hold for 600 ms',
  'bounded-cta-attention.workflow.nodes.attention-remove.data.label': 'Remove highlight',
  'bounded-cta-attention.workflow.nodes.attention-off.data.label': 'Rest for 600 ms',
  'bounded-cta-attention.workflow.nodes.attention-done.data.label': 'Collection is ready',
  'bounded-cta-attention.workflow.nodes.attention-done.data.config.content':
    '<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">\n  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>\n  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">The everyday collection</p>\n  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">Explore at your own pace</h2>\n  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">The collection heading has been highlighted three times. Take a closer look at any object that catches your eye.</p>\n</div>',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-1.data.label':
    'Setup: Highlight appearance',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-1.data.config.noteText':
    'The demo highlights the collection heading after someone clicks Shop now. Choose the button and heading for your website. Ask your website team to add the same outline effect; it needs a website style named dxp-cta-attention.',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-2.data.label':
    'Setup: Repeat the highlight',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-2.data.config.noteText':
    'The highlight sequence repeats three times, taking 3.6 seconds in total, then shows the final tip. Keep the last wait step inside the sequence without an outgoing connection. The repeat step already controls when to repeat and when to finish.',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-3.data.label':
    'Setup: When the highlight ends',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-setup-3.data.config.noteText':
    'Finishing only means the highlight sequence has ended; it does not mean the visitor noticed it. Clicking again can start another sequence before the first ends. If you stop the journey early, the highlight may stay visible; ask your website team to clear it when needed.',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-overview.data.label':
    'Preset overview',
  'bounded-cta-attention.workflow.nodes.bounded-cta-attention-overview.data.config.noteText':
    'After someone clicks the main shop button, highlight the collection heading three times and show a final tip.',
  'bounded-cta-attention.workflow.edges.attention-loop-to-attention-add.label': 'Repeat body',
  'bounded-cta-attention.workflow.edges.attention-loop-to-attention-done.label':
    'After both repetitions',
  'campaign-headline.name': 'Campaign headline',
  'campaign-headline.description':
    'Show a campaign heading during the selected dates. Keep the usual heading outside those dates.',
  'campaign-headline.workflow.name': 'Campaign headline',
  'campaign-headline.workflow.nodes.headline-load.data.label': 'Page loaded',
  'campaign-headline.workflow.nodes.headline-day.data.label': 'Campaign week (UTC)?',
  'campaign-headline.workflow.nodes.headline-update.data.label': 'Show campaign headline',
  'campaign-headline.workflow.nodes.headline-update.data.config.value':
    'A new season of everyday favorites.',
  'campaign-headline.workflow.nodes.campaign-headline-setup-1.data.label': 'Setup: Campaign dates',
  'campaign-headline.workflow.nodes.campaign-headline-setup-1.data.config.noteText':
    'Choose the first and last day of your campaign. The suggested dates cover Monday to Sunday of the current week in UTC, a worldwide reference time.',
  'campaign-headline.workflow.nodes.campaign-headline-setup-2.data.label': 'Setup: Page heading',
  'campaign-headline.workflow.nodes.campaign-headline-setup-2.data.config.noteText':
    'Choose the main page heading to replace and write your campaign message. Replacing it may remove special formatting within the heading. Outside the campaign dates, the page stays as it is.',
  'campaign-headline.workflow.nodes.campaign-headline-overview.data.label': 'Preset overview',
  'campaign-headline.workflow.nodes.campaign-headline-overview.data.config.noteText':
    'Show a campaign heading during the selected dates. Keep the usual heading outside those dates.',
  'campaign-headline.workflow.edges.headline-day-to-headline-update.label': 'Campaign week',
  'campaign-url-personalization.name': 'Campaign URL personalization',
  'campaign-url-personalization.description':
    'Show a special welcome to visitors arriving through the Summer Sale campaign link, and a standard message to everyone else.',
  'campaign-url-personalization.workflow.name': 'Campaign URL personalization',
  'campaign-url-personalization.workflow.nodes.campaign-load.data.label': 'Page loaded',
  'campaign-url-personalization.workflow.nodes.campaign-check.data.label': 'Summer Sale campaign?',
  'campaign-url-personalization.workflow.nodes.campaign-matched.data.label': 'Campaign message',
  'campaign-url-personalization.workflow.nodes.campaign-matched.data.config.value':
    'Welcome to Summer Sale: thoughtful objects for slower mornings.',
  'campaign-url-personalization.workflow.nodes.campaign-default.data.label': 'Default message',
  'campaign-url-personalization.workflow.nodes.campaign-default.data.config.value':
    'Discover thoughtful objects for everyday living.',
  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-setup-1.data.label':
    'Setup: Campaign link',
  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-setup-1.data.config.noteText':
    'To try the demo, add ?utm_campaign=summer-sale to the end of its page address. This part of the link identifies the campaign. Change the campaign name and value to match your own links, including capital and lowercase letters.',
  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-setup-2.data.label':
    'Setup: Page to preview',
  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-setup-2.data.config.noteText':
    'This journey changes the introduction below the main page heading. Choose the text to change on your website and set the page address you want to preview. Adding this preset keeps the page address you already selected.',
  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-overview.data.label':
    'Preset overview',
  'campaign-url-personalization.workflow.nodes.campaign-url-personalization-overview.data.config.noteText':
    'Show a special welcome to visitors arriving through the Summer Sale campaign link, and a standard message to everyone else.',
  'campaign-url-personalization.workflow.edges.campaign-check-to-campaign-matched.label':
    'Campaign match',
  'campaign-url-personalization.workflow.edges.campaign-check-to-campaign-default.label': 'Default',
  'click-to-open-help.name': 'Draw attention to newsletter',
  'click-to-open-help.description':
    'Draw attention to the newsletter on page load by showing a popover beside the signup form only when the form exists.',
  'click-to-open-help.workflow.name': 'Draw attention to newsletter',
  'click-to-open-help.workflow.nodes.help-load.data.label': 'Page loaded',
  'click-to-open-help.workflow.nodes.help-check.data.label': 'Newsletter form exists',
  'click-to-open-help.workflow.nodes.help-popover.data.label': 'Newsletter help',
  'click-to-open-help.workflow.nodes.help-popover.data.config.content':
    '<style>[data-visual-dxp-popover="help-popover"] > div { background: #697856 !important; border-color: #697856 !important; } [data-visual-dxp-popover="help-popover"] > svg path { fill: #697856 !important; stroke: #697856 !important; } [data-visual-dxp-popover="help-popover"] button[aria-label="Close experience"] { color: #fff !important; }</style><p style="margin:-28px -24px -24px;padding:14px 40px 14px 16px;background:#697856;color:#fff;font:300 14px/1.5 Georgia,serif;letter-spacing:-0.15px;box-sizing:border-box;overflow-wrap:anywhere"><span aria-hidden="true">✉️</span> Enter your email, then select the arrow to subscribe.</p>',
  'click-to-open-help.workflow.nodes.click-to-open-help-setup-1.data.label':
    'Setup: Newsletter form check',
  'click-to-open-help.workflow.nodes.click-to-open-help-setup-1.data.config.noteText':
    'On page load, the condition checks whether #newsletter form exists. If it does, the true branch opens the popover; otherwise, the flow ends. Set the condition selector and popover anchor to the same newsletter form on your site.',
  'click-to-open-help.workflow.nodes.click-to-open-help-setup-2.data.label':
    'Setup: Newsletter message',
  'click-to-open-help.workflow.nodes.click-to-open-help-setup-2.data.config.noteText':
    'Edit the popover message to draw attention to your newsletter and explain its signup terms. The message appears automatically when the form exists; it does not sign anyone up or confirm a subscription.',
  'click-to-open-help.workflow.nodes.click-to-open-help-overview.data.label': 'Preset overview',
  'click-to-open-help.workflow.nodes.click-to-open-help-overview.data.config.noteText':
    'Draw attention to the newsletter on page load by showing a popover beside the signup form only when the form exists.',
  'click-to-open-help.workflow.edges.help-check-to-help-popover.label': 'Form exists',
  'delayed-welcome.name': 'Delayed welcome',
  'delayed-welcome.description':
    'Give visitors two seconds to settle in before a small welcome message.',
  'delayed-welcome.workflow.name': 'Delayed welcome',
  'delayed-welcome.workflow.nodes.welcome-load.data.label': 'Page loaded',
  'delayed-welcome.workflow.nodes.welcome-delay.data.label': 'Wait two seconds',
  'delayed-welcome.workflow.nodes.welcome-popover.data.label': 'Welcome to Atelier',
  'delayed-welcome.workflow.nodes.welcome-popover.data.config.content':
    '<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">\n  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>\n  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">Welcome to Atelier</p>\n  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">Make yourself at home</h2>\n  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">Explore considered objects for everyday living, at your own pace.</p>\n  <a href="#collection" style="display:flex;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box;min-height:44px;margin-top:22px;padding:13px 16px;border-radius:2px;background:#697856;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:400;line-height:1.5;text-decoration:none"><span>Browse the collection</span><span aria-hidden="true">↗</span></a>\n</div>',
  'delayed-welcome.workflow.nodes.delayed-welcome-setup-1.data.label': 'Setup: Welcome message',
  'delayed-welcome.workflow.nodes.delayed-welcome-setup-1.data.config.noteText':
    'Update the welcome message and choose where its link should take visitors. In the demo, it leads to the collection section.',
  'delayed-welcome.workflow.nodes.delayed-welcome-setup-2.data.label':
    'Setup: How often it appears',
  'delayed-welcome.workflow.nodes.delayed-welcome-setup-2.data.config.noteText':
    'The welcome appears each time someone opens or reloads the page. It can appear again on later visits.',
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
    'Setup: Scrolling and destination',
  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-setup-1.data.config.noteText':
    'Test on a page long enough to scroll down. The invitation appears after the visitor scrolls down through 70% of the available scrolling distance. Choose where its link should lead; the demo uses the newsletter section.',
  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-setup-2.data.label':
    'Setup: Remembering the invitation',
  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-setup-2.data.config.noteText':
    'The browser remembers for 7 days that the invitation appeared. This does not mean the visitor signed up, and it does not stop the invitation from appearing after the page is opened again.',
  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-overview.data.label':
    'Preset overview',
  'engaged-reader-invitation.workflow.nodes.engaged-reader-invitation-overview.data.config.noteText':
    'Invite visitors who scroll through 70% of the page to explore the newsletter.',
  'exit-intent-offer.name': 'Exit-intent offer',
  'exit-intent-offer.description':
    'Show a shipping reminder when the mouse leaves the top of the page, unless it has already appeared during this browsing session.',
  'exit-intent-offer.workflow.name': 'Exit-intent offer',
  'exit-intent-offer.workflow.nodes.exit-trigger.data.label': 'Pointer leaves at top',
  'exit-intent-offer.workflow.nodes.exit-check.data.label': 'Offer already shown?',
  'exit-intent-offer.workflow.nodes.exit-popover.data.label': 'Before you go',
  'exit-intent-offer.workflow.nodes.exit-popover.data.config.content':
    '<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">\n  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>\n  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">A thoughtful delivery</p>\n  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">A thoughtful delivery</h2>\n  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">Complimentary shipping on orders over €75. Take another look whenever you are ready.</p>\n  <a href="#collection" style="display:flex;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box;min-height:44px;margin-top:22px;padding:13px 16px;border-radius:2px;background:#697856;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:400;line-height:1.5;text-decoration:none"><span>Back to the collection</span><span aria-hidden="true">↗</span></a>\n</div>',
  'exit-intent-offer.workflow.nodes.exit-cookie.data.label': 'Remember for this session',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-1.data.label': 'Setup: Offer details',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-1.data.config.noteText':
    'Replace the sample shipping offer with your own and check its terms before using it. Choose where the offer link should lead; the demo links to the collection.',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-2.data.label':
    'Setup: Showing the offer once',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-2.data.config.noteText':
    'The browser remembers that the offer has appeared for the current browsing session and skips it afterward. To test it again, clear the saved data for this website in your browser settings.',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-3.data.label':
    'Setup: When someone may leave',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-setup-3.data.config.noteText':
    'The journey starts when the mouse leaves the top edge of the page. It can start once each time the journey is loaded. It does not detect someone using the Back button on a phone.',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-overview.data.label': 'Preset overview',
  'exit-intent-offer.workflow.nodes.exit-intent-offer-overview.data.config.noteText':
    'Show a shipping reminder when the mouse leaves the top of the page, unless it has already appeared during this browsing session.',
  'exit-intent-offer.workflow.edges.exit-check-to-exit-popover.label': 'Not yet shown',
  'frustration-recovery.name': 'Frustration recovery',
  'frustration-recovery.description':
    'Offer help when someone clicks repeatedly or scrolls back and forth quickly, then record that help was shown.',
  'frustration-recovery.workflow.name': 'Frustration recovery',
  'frustration-recovery.workflow.nodes.recovery-trigger.data.label': 'Three nearby clicks',
  'frustration-recovery.workflow.nodes.recovery-scroll-trigger.data.label': 'Scroll thrashing',
  'frustration-recovery.workflow.nodes.recovery-check.data.label': 'Assistance already shown?',
  'frustration-recovery.workflow.nodes.recovery-help.data.label': 'A little browsing help',
  'frustration-recovery.workflow.nodes.recovery-help.data.config.content':
    '<div style="margin:-28px -24px -24px;padding:36px 24px 28px;background:#f8f6f1;color:#353b32;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow-wrap:anywhere">\n  <div style="padding:0 0 16px;border-bottom:1px solid #dedfd4"><span style="font-family:Georgia,serif;font-size:25px;font-weight:400;letter-spacing:-1px;line-height:1">atelier<span aria-hidden="true" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;vertical-align:top;margin-left:3px;letter-spacing:0">®</span></span></div>\n  <p style="margin:22px 0 12px;font-size:10px;font-weight:400;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;color:#697856">A little guidance</p>\n  <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:29px;font-weight:400;line-height:1.15;letter-spacing:-0.7px;color:#353b32">Having trouble exploring?</h2>\n  <p style="margin:0;font-size:13px;line-height:1.75;color:#626b59">Try the collection navigation, or take a break and return when you are ready.</p>\n  <a href="#collection" style="display:flex;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box;min-height:44px;margin-top:22px;padding:13px 16px;border-radius:2px;background:#697856;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:400;line-height:1.5;text-decoration:none"><span>View the collection</span><span aria-hidden="true">↗</span></a>\n</div>',
  'frustration-recovery.workflow.nodes.recovery-event.data.label': 'Record assistance shown',
  'frustration-recovery.workflow.nodes.recovery-cookie.data.label': 'Remember assistance shown',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-1.data.label':
    'Setup: Where to record help',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-1.data.config.noteText':
    'This journey sends a message to record that guidance was shown. The sample service address does not work. Before using it, ask your website team to replace it with a working address and check that the website can send messages there.',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-2.data.label':
    'Setup: What gets recorded',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-2.data.config.noteText':
    'The message only says that help was shown. Keep personal details, page addresses, form answers, passwords, and visitor identifiers out of it. It does not contact a support agent or create a support request.',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-3.data.label':
    'Setup: When help appears',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-3.data.config.noteText':
    'Help can start in either of two ways: three nearby clicks within 1 second, or four changes in scrolling direction within 2 seconds. Each scroll change needs at least 50 pixels of movement, so tiny movements do not count. Both watch the whole page. Update the help message and its collection link for your website.',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-4.data.label':
    'Setup: Avoiding repeated help',
  'frustration-recovery.workflow.nodes.frustration-recovery-setup-4.data.config.noteText':
    'After trying to send the record, the browser remembers that help appeared for this browsing session, even if sending failed. Until that attempt finishes, more clicks or scrolling can show help again and send another record.',
  'frustration-recovery.workflow.nodes.frustration-recovery-overview.data.label': 'Preset overview',
  'frustration-recovery.workflow.nodes.frustration-recovery-overview.data.config.noteText':
    'Offer help when someone clicks repeatedly or scrolls back and forth quickly, then record that help was shown.',
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
    'Setup: Where help appears',
  'inactivity-assistance.workflow.nodes.inactivity-assistance-setup-1.data.config.noteText':
    'Choose the newsletter form that the help should appear beside. If the form is missing, the journey shows a general message instead. It only checks whether the form is on the page, not whether it is visible, filled in correctly, or being used.',
  'inactivity-assistance.workflow.nodes.inactivity-assistance-setup-2.data.label':
    'Setup: When help appears',
  'inactivity-assistance.workflow.nodes.inactivity-assistance-setup-2.data.config.noteText':
    'Visitor activity restarts the 30-second waiting time, so help can appear again after another quiet period. If the form is found, there is one extra second before help appears. Activity during that extra second does not cancel the message, and the form must still be on the page.',
  'inactivity-assistance.workflow.nodes.inactivity-assistance-overview.data.label':
    'Preset overview',
  'inactivity-assistance.workflow.nodes.inactivity-assistance-overview.data.config.noteText':
    'After 30 seconds without activity, offer newsletter guidance if the form exists or general guidance otherwise.',
  'inactivity-assistance.workflow.edges.idle-check-to-idle-delay.label': 'Form available',
  'inactivity-assistance.workflow.edges.idle-check-to-idle-fallback.label': 'No form',
  'mobile-specific-messaging.name': 'Mobile-specific messaging',
  'mobile-specific-messaging.description':
    'Show a shorter introduction on phones and a more detailed one on computers.',
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
    'Setup: Phone or computer',
  'mobile-specific-messaging.workflow.nodes.mobile-specific-messaging-setup-1.data.config.noteText':
    'Choose the introduction below the main page heading and write a version for phones and another for computers. The journey uses device information from the browser. Making the preview window narrower does not turn it into a phone; test on a phone too.',
  'mobile-specific-messaging.workflow.nodes.mobile-specific-messaging-overview.data.label':
    'Preset overview',
  'mobile-specific-messaging.workflow.nodes.mobile-specific-messaging-overview.data.config.noteText':
    'Show a shorter introduction on phones and a more detailed one on computers.',
  'mobile-specific-messaging.workflow.edges.device-check-to-device-mobile.label': 'Mobile',
  'mobile-specific-messaging.workflow.edges.device-check-to-device-desktop.label': 'Desktop',
  'segmented-onboarding.name': 'Segmented onboarding journey',
  'segmented-onboarding.description':
    'Welcome new visitors with guidance based on their campaign link, and remember that the guidance was shown so it is not repeated on later visits.',
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
    'Setup: Understanding the journey',
  'segmented-onboarding.workflow.nodes.onboarding-entry-note.data.config.noteText':
    'The boxes group the journey into stages: recognizing a visitor, showing guidance, and recording it. These notes explain the steps and do not run any actions. To test as a new visitor again, clear the saved data for this website in your browser settings.',
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
    'Setup: Choosing the page content',
  'segmented-onboarding.workflow.nodes.onboarding-guidance-note.data.config.noteText':
    'Choose the introduction, shop button, and collection section for your website. Test the page with and without ?utm_campaign=onboarding at the end of its address to see both welcome paths. The button and section must still be on the page when each waiting step ends.',
  'segmented-onboarding.workflow.nodes.onboarding-event.data.label': 'Record guidance displayed',
  'segmented-onboarding.workflow.nodes.onboarding-cookie.data.label': 'Mark delivery complete',
  'segmented-onboarding.workflow.nodes.onboarding-record-note.data.label':
    'Setup: Where to record guidance',
  'segmented-onboarding.workflow.nodes.onboarding-record-note.data.config.noteText':
    'This journey sends a message to record that guidance was shown. The sample service address does not work. Before using it, ask your website team to replace it with a working address and check that the website can send messages there.',
  'segmented-onboarding.workflow.nodes.onboarding-marker-note.data.label':
    'Setup: Remembering shown guidance',
  'segmented-onboarding.workflow.nodes.onboarding-marker-note.data.config.noteText':
    'The browser remembers for 30 days that guidance was shown. During that time, this journey skips the guidance and sends no new record. Otherwise, it chooses a welcome based on the campaign link and sends a message saying that guidance appeared.',
  'segmented-onboarding.workflow.nodes.onboarding-completion-note.data.label':
    'Setup: What finished means',
  'segmented-onboarding.workflow.nodes.onboarding-completion-note.data.config.noteText':
    'Finished means the page text was changed, guidance appeared, and the journey tried to send a record. It does not mean the visitor read it, clicked, signed up, or bought anything. The browser remembers completion even if the record could not be sent or saved by the receiving service.',
  'segmented-onboarding.workflow.nodes.segmented-onboarding-overview.data.label': 'Preset overview',
  'segmented-onboarding.workflow.nodes.segmented-onboarding-overview.data.config.noteText':
    'Welcome new visitors with guidance based on their campaign link, and remember that the guidance was shown so it is not repeated on later visits.',
  'segmented-onboarding.workflow.edges.onboarding-seen-to-onboarding-return.label': 'Returning',
  'segmented-onboarding.workflow.edges.onboarding-seen-to-onboarding-campaign.label':
    'First guidance',
  'segmented-onboarding.workflow.edges.onboarding-campaign-to-onboarding-campaign-copy.label':
    'Onboarding',
  'segmented-onboarding.workflow.edges.onboarding-campaign-to-onboarding-default-copy.label':
    'Other visitors',
};

export type PresetMessages = { [K in keyof typeof englishPresetMessages]: string };
