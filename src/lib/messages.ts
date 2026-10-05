import { aiEditFailures } from './aiErrors';

/** English defaults and the public translation contract. Keys remain stable when copy changes. */
export const englishMessages = {
  'analytics.payload': 'Payload (JSON)',
  'analytics.payloadHint':
    'Optional JSON object of event parameters. Do not include personal information.',
  'analytics.invalidPayload': 'Enter a valid JSON object for the event payload.',
  'analytics.invalidPayloadKey':
    'Payload parameter names must start with a letter, use up to 40 letters, numbers or underscores, and must not override reserved analytics fields.',
  'analytics.setupSuggestion':
    'Set up an analytics integration to understand how visitors progress through your workflows, compare experiments, and track milestones. Select Google Analytics above to configure the integration and view the setup guide.',
  'analytics.guide.title': 'Guide',
  'analytics.guide.intro':
    'Connect Visual DXP to Google Analytics 4 (GA4), then turn workflow events into useful reports.',
  'analytics.guide.conceptsTitle': '1. Understand what is being measured',
  'analytics.guide.concepts':
    'Visual DXP runs your workflow and emits events. The website’s Google tag or Google Tag Manager (GTM) delivers them to GA4. An event records something that happened; parameters describe it. A custom dimension makes a text parameter available in reports. Sending an event and configuring a report are separate steps.',
  'analytics.guide.identifiers':
    'The G- measurement ID identifies a GA4 web stream. Workflow ID identifies your journey; reporting version distinguishes revisions. Experiment ID identifies an A/B assignment and is separate from the measurement ID. Set stable IDs before publishing. If unset, workflow ID uses the workflow name, reporting version uses 1, and Experiment ID uses the node ID.',
  'analytics.guide.setupTitle': '2. Connect the website and choose one delivery method',
  'analytics.guide.prerequisites':
    'Use a GA4 property with a web data stream and a working Google tag on the target website. You need access to the website or its GTM container, and GA4 Editor access to configure custom definitions. Visual DXP does not install a tag or create a GA4 property.',
  'analytics.guide.configure':
    'Select Google Analytics above, set Workflow ID and Reporting version, and choose Google tag or Google Tag Manager. Use one route for these events to avoid duplicate collection. No tracking disables the shared integration.',
  'analytics.guide.milestones':
    'Place Track event nodes after actions or conditions that confirm meaningful milestones. Choose a static name such as offer_accepted: 1–40 ASCII letters, numbers, or underscores, starting with a letter. Names are case sensitive; reserved names and prefixes such as dxp_ are rejected. Experiment assignments are tracked automatically.',
  'analytics.guide.deploy':
    'Export the workflow and load its script on the configured target website. The script must match its target URL. Test a real trigger on that page; the editor preview only simulates analytics.',
  'analytics.guide.tagSetup':
    'Choose Google tag when the page exposes window.gtag. Visual DXP calls the existing event API. Leave the optional measurement ID empty to use existing destinations, or enter the intended G- stream ID to set send_to. This field routes events; it does not install or initialize Google Analytics. Load the existing tag before the workflow can fire.',
  'analytics.guide.gtmVariables':
    'In GTM, create Data Layer Variables for the parameters you will forward, using their exact names below. For example, name a variable DLV - workflow_id and set its Data Layer Variable Name to workflow_id.',
  'analytics.guide.gtmTrigger':
    'Create a separate Custom Event trigger for each of the three dxp_workflow_* event names and each milestone name. Use the exact name, including capitalization. For example, the start-event trigger matches dxp_workflow_started.',
  'analytics.guide.gtmTag':
    'Create a Google Analytics: GA4 Event tag for each event, select the intended measurement ID, and use the exact event name. Map its event parameters to your Data Layer Variables, then attach the matching Custom Event trigger. A dataLayer push alone does not send anything to GA4.',
  'analytics.guide.gtmOptional':
    'Only map parameters that belong to that event. For experiment-only fields on dxp_workflow_step, use a separate tag/trigger restricted to step_type = experiment and exclude those steps from the general step tag. This avoids duplicate events and stale optional values retained in the data layer.',
  'analytics.guide.gtmPublish':
    'Use GTM Preview / Tag Assistant to verify the event and tag firing, then submit and publish the container changes. Configure the GA4 destination in GTM; Visual DXP’s optional measurement ID is only used by Google tag delivery.',
  'analytics.guide.gtmExample':
    'Example exact event name for a Custom Event trigger. Create matching triggers for the other lifecycle and milestone events.',
  'analytics.guide.eventsTitle': '3. Know the events and their parameters',
  'analytics.guide.eventsCaption': 'Events emitted by the shared integration',
  'analytics.guide.event': 'Event',
  'analytics.guide.meaning': 'When it fires and what it means',
  'analytics.guide.started': 'Once for each trigger invocation, before executing its path.',
  'analytics.guide.step':
    'After a successful action or condition. Includes step_id, step_type and step_index. Conditions and experiments add branch; experiments also add experiment_id and variant_id (a or b).',
  'analytics.guide.completed':
    'After the run finishes without execution errors or cancellation. Adds step_count. This means the workflow ran successfully, not that a visitor converted. Failed HTTP requests suppress completion even if an error path continues.',
  'analytics.guide.custom':
    'Example name from a Track event node. Fires each time that node executes, with step_id and step_type. Define your own milestone names; only incoming values explicitly mapped in Payload are included.',
  'analytics.guide.commonParameters':
    'Every event above includes workflow_id, workflow_version, trigger_id and run_id. The run ID connects events from one trigger invocation, including overlapping runs. Node IDs are stable step identifiers, not their editable display labels. Find the emitted IDs in preview logs or DebugView.',
  'analytics.guide.repetition':
    'Triggers, notes and frames do not emit step events. Loop bodies and milestone nodes report every execution; the Loop step is reported after its body iterations. A Track event node emits both its custom event and the normal workflow step event.',
  'analytics.guide.verifyTitle': '4. Verify collection before building reports',
  'analytics.guide.preview':
    'Run the editor preview and check the simulated event names and parameters in its execution log. Preview sends no live analytics events.',
  'analytics.guide.liveTest':
    'Test the exported script on the target website with GTM Preview / Tag Assistant or GA4 debug mode enabled through your existing tag. Visual DXP does not enable debug_mode automatically. Open GA4 Admin → DebugView and select your test device.',
  'analytics.guide.inspect':
    'Fire the trigger, follow the intended path, and inspect the event order, workflow ID, step IDs and assigned variant. Verify custom milestones separately. “Queued” in a Visual DXP log means the browser API accepted the event, not that GA4 received it.',
  'analytics.guide.troubleshoot':
    'If events are missing, check the target URL, selected delivery method, tag availability, destination ID, published GTM triggers and parameter mappings. Consent settings, blockers and network failures can prevent collection. Missing analytics never stops workflow actions; do not disable the website’s consent controls to test.',
  'analytics.guide.dimensionsTitle': '5. Make parameters available in GA4 reports',
  'analytics.guide.dimensionsSetup':
    'In GA4 Admin → Custom definitions → Create custom dimension, give the dimension a readable name, choose Event scope, and enter the exact event parameter name. Start with the fields needed for your report; creating a dimension does not make Visual DXP send new data.',
  'analytics.guide.workflowDimensions':
    'Filter results to one workflow and one reporting revision.',
  'analytics.guide.stepDimensions':
    'Identify the action, its node type, and the trigger that started the run.',
  'analytics.guide.experimentDimensions':
    'Compare experiment assignments and selected paths. These fields are only present on the applicable workflow step events.',
  'analytics.guide.numericParameters':
    'Numeric order and successful-step count. If you need aggregated reporting, configure appropriate event-scoped custom metrics instead of text dimensions.',
  'analytics.guide.runParameter':
    'Unique per invocation. Avoid registering it as a custom dimension because of its high cardinality; keep it for raw event analysis.',
  'analytics.guide.dimensionValues':
    'Register parameter names, not every possible value: IDs and a/b arrive automatically. Allow 24–48 hours for newly configured custom dimensions to become available in reporting. Use DebugView for immediate collection checks.',
  'analytics.guide.reportingTitle': '6. Build a funnel and compare experiments',
  'analytics.guide.funnel':
    'In GA4 Explore → Funnel exploration, define steps by event name. Filter to workflow_id and workflow_version. Use custom milestone names, or dxp_workflow_step with a step_id condition. The example below requires you to add both milestone nodes to the appropriate paths.',
  'analytics.guide.funnelRules':
    'Use a closed funnel when users must start at the first step; use an open funnel when entry at later steps is meaningful. Prefer indirectly followed steps when other workflow events occur in between. Set a suitable time window. GA4 funnels count users, not exact runtime executions; use raw exports grouped by run_id for per-run analysis.',
  'analytics.guide.experiments':
    'An Experiment step sends experiment_id and variant_id automatically. Build comparison segments from its assignment event, then compare downstream milestones for A and B. Custom milestone events do not inherit variant_id; do not assume a simple variant breakdown on those events will work. Keep the Experiment ID stable during a test; changing it starts fresh browser assignments.',
  'analytics.guide.scope':
    'Visual DXP executes the experiment and GA4 reports the observations. This does not create a native GA experiment or automatically determine statistical significance. Google’s experiment integration guide covers “In-house and custom experiments”. A milestone should confirm a real outcome; workflow completion alone is not a conversion.',
  'analytics.guide.legacyTitle': '7. Existing workflows and data boundaries',
  'analytics.guide.legacy':
    'Older saved CTA configurations can still send experiment_view when the CTA is visible and experiment_cta after a matching click or change. They include experiment_id and variant_id; the CTA event also includes cta_type. If you use those legacy events, forward them in GTM, register the needed dimensions, and compare experiment_view → experiment_cta. New workflows use automatic assignment tracking and Track event milestones.',
  'analytics.guide.privacy':
    'Visual DXP sends built-in metadata and custom values explicitly mapped in Payload. Never map personal information or secrets. It reuses the website’s analytics and consent configuration. Use descriptive reporting IDs and milestone names, without personal information. Legacy per-node settings remain active when no shared configuration has been saved; explicitly choose No tracking here to turn tracking off.',
  'analytics.guide.tagLink': 'Google guide: send GA4 events',
  'analytics.guide.gtmLink': 'Google guide: configure GA4 event tags',
  'analytics.guide.dimensionsLink': 'Google guide: event-scoped custom dimensions',
  'analytics.guide.debugLink': 'Google guide: DebugView',
  'analytics.guide.funnelLink': 'Google guide: funnel exploration',
  'analytics.guide.experimentLink': 'Google guide: experiment integrations',
  'analytics.gtmHint':
    'Pushes workflow, milestone, and experiment events to the existing dataLayer. Configure GTM custom event triggers, data layer variables, and GA4 event tags for each event name you want to collect.',
  'nodes.track-event.label': 'Track event',
  'nodes.track-event.description':
    'Sends a custom event through the workflow’s analytics integration. Use it to mark a milestone on a chosen path.',
  'analytics.chooseEventName': 'Choose an event name',
  'analytics.eventName': 'Event name',
  'analytics.eventNameHint':
    'Use 1–40 letters, numbers, or underscores, starting with a letter. For example: offer_accepted. Names are case sensitive.',
  'analytics.invalidEventName':
    'Use an event name of 1–40 letters, numbers, or underscores, starting with a letter.',
  'analytics.reservedEventName':
    'Choose a custom event name that is not reserved by Google Analytics or Visual DXP.',
  'analytics.invalidIdentity': 'Workflow ID and reporting version must contain 1–100 characters.',
  'analytics.outputHint':
    'Continues to the next step, even if analytics is unavailable.',
  'analytics.milestoneHint':
    'This node requires an analytics integration to send events. Configure an integration in the Analytics tab.',
  'analytics.customDisabledHint':
    'Enable Google Analytics in the Analytics tab to send custom events.',
  'analytics.workflowId': 'Workflow ID',
  'analytics.workflowIdHint':
    'Stable reporting ID sent as workflow_id. If not configured, the workflow name is used. Keep this ID unchanged when renaming the workflow.',
  'analytics.workflowVersion': 'Reporting version',
  'analytics.workflowVersionHint':
    'Sent as workflow_version. Change it when revising your funnel so results can be compared by version.',
  'analytics.lifecycleHint':
    'Automatically sends dxp_workflow_started when a trigger fires, dxp_workflow_step after each successful action or condition, and dxp_workflow_completed when the run finishes without execution errors or cancellation. Loops report each executed iteration; completion does not mean a visitor converted.',
  'analytics.funnelGuide': 'Set up workflow funnel reporting',
  'analytics.funnelGuideBody':
    'Register event-scoped custom dimensions for workflow_id, workflow_version, step_id, step_type, trigger_id, and branch as needed. In GA4 Explorations, build a funnel from dxp_workflow_started through dxp_workflow_step filtered by step_id, or use your custom milestone events, to dxp_workflow_completed. In GTM, forward all three lifecycle events and your custom event names using custom event triggers, data layer variables, and GA4 event tags. Verify with DebugView.',
  'analytics.runIdHint':
    'run_id groups events from one trigger invocation, including overlapping runs. Avoid registering it as a custom dimension because each run has a unique value. GA4 funnels count users; use raw event exports for exact per-run analysis.',
  'builder.analytics': 'Analytics',
  'analytics.description':
    'Configure workflow progress, experiment assignments, and custom milestone events here.',
  'analytics.legacy':
    'This workflow uses saved per-experiment settings. Changing a setting here applies one shared configuration to all tracked experiments.',
  'analytics.trackExperiment': 'Track this experiment',
  'analytics.nodeHint': 'Delivery and measurement settings are managed in the Analytics tab.',
  'analytics.disabledHint':
    'Enable Google Analytics in the Analytics tab to send events for this experiment.',
  'analytics.openSettings': 'Open Analytics settings',
  'activity.analyticsUpdated': 'Updated analytics settings',
  'errors.ai.invalid_workflow_edit': aiEditFailures.invalid_workflow_edit,
  'errors.ai.repeated_tool_loop': aiEditFailures.repeated_tool_loop,
  'nodes.experiment.label': 'Experiment',
  'nodes.experiment.description':
    'Splits visitors between variants A and B. Use it to test two experiences with a configurable traffic split and consistent browser assignments.',
  'experiment.sharedAnalyticsHint':
    'This experiment is tracked automatically by the analytics platform configured in the Analytics tab. Tracking is off when no platform is enabled.',
  'experiment.analytics': 'Analytics',
  'experiment.none': 'No tracking',
  'experiment.premium': 'Premium',
  'experiment.id': 'Experiment ID',
  'experiment.idHint':
    'Required. Identifies this experiment in analytics. This is not the GA measurement ID.',
  'experiment.cta': 'CTA element',
  'experiment.interaction': 'CTA interaction',
  'experiment.click': 'Click',
  'experiment.change': 'Field value committed',
  'experiment.clickInteractionHint': 'Click tracks activation, including nested elements.',
  'experiment.changeInteractionHint':
    'Change tracks committed changes on inputs, selects, and checkboxes.',
  'experiment.interactionHint':
    'Click tracks activation, including nested elements. Change tracks committed changes on inputs, selects, and checkboxes.',
  'experiment.mapping':
    'Google Analytics uses the Experiment ID configured above as experiment_id. Variants are mapped to variant_id: Variant A → a; Variant B → b. These dimensions are sent with experiment_view and experiment_cta events.',
  'experiment.delivery': 'Event delivery',
  'experiment.gtag': 'Google tag',
  'experiment.gtm': 'Google Tag Manager',
  'experiment.gtagHint':
    'Calls the website’s existing window.gtag. Leave the measurement ID empty to use its existing destinations.',
  'experiment.gtmHint':
    'Pushes experiment_view and experiment_cta with experiment_id, variant_id, and cta_type (CTA only) to the existing window.dataLayer. The website owner must configure GTM custom event triggers, data layer variables for these parameters, and GA4 event tags to forward them.',
  'experiment.measurementId': 'GA4 measurement ID (optional)',
  'experiment.measurementIdHint':
    'When the website has multiple destinations, enter an ID to target a particular GA4 stream.',
  'experiment.privacyHint':
    'Uses only the selected delivery method. Visual DXP does not install another tag or change website consent. Queued events are not confirmed delivery; blocked or missing analytics will not stop the workflow. Editor previews simulate events in the execution log.',
  'experiment.reporting': 'Set up reporting in Google Analytics',
  'experiment.guideInstall':
    'Install or reuse the website’s GA4 tag. For Google Tag Manager, configure forwarding as described above.',
  'experiment.guideId': 'Choose an Experiment ID in Visual DXP, such as homepage-cta-v1.',
  'experiment.guideDimensions':
    'Create event-scoped custom dimensions for experiment_id and variant_id to compare experiment assignments.',
  'experiment.guideValues':
    'Values such as homepage-cta-v1, a, and b arrive automatically with events. You do not manually register each value.',
  'experiment.guideExplore':
    'In Explorations, filter dxp_workflow_step by experiment_id and compare variant_id. Add Track event milestones to measure progression or conversions.',
  'experiment.guideDebug':
    'Verify both events and their parameters in DebugView using your website’s GA4 debug mode or GTM Preview.',
  'experiment.guideScope':
    'Visual DXP runs the experiment; GA4 reports its results. This does not create a native Google Analytics experiment or automatically determine statistical significance.',
  'experiment.guideIntegrationLink': 'Create an experiment integration with Google Analytics',
  'experiment.guideIntegrationHint': 'Read “In-house and custom experiments”.',
  'experiment.guideFunnelLink': 'GA4 funnel exploration',
  'experiment.invalidPlatform': 'Choose a supported analytics platform.',
  'experiment.requiredId': 'Enter an Experiment ID for analytics.',
  'experiment.requiredSelector': 'Choose a CTA element for analytics.',
  'experiment.invalidInteraction': 'Choose click or change for the CTA interaction.',
  'experiment.invalidDelivery': 'Choose Google tag or Google Tag Manager delivery.',
  'experiment.invalidMeasurementId':
    'Enter a valid GA4 measurement ID, such as G-XXXXXXXXXX, or leave it empty.',
  'experiment.trafficA': 'Traffic to A (%)',
  'experiment.splitHint':
    'B receives the remaining traffic. Changes apply to new assignments; existing visitors keep their variant.',
  'experiment.key': 'Experiment ID',
  'experiment.keyHint':
    'Change the Experiment ID to start a fresh experiment. Leaving this empty uses the node’s ID',
  'experiment.assignmentHint':
    'Assignments are saved in this browser on this website. If storage is unavailable, including sandboxed previews, they last only until the workflow restarts. Connect A and B to the experiences you want to compare. Conversion tracking is not collected automatically.',
  'experiment.variantA': 'Variant A',
  'experiment.variantB': 'Variant B',
  'experiment.outputA': 'Runs for A.',
  'experiment.outputB': 'Runs for B.',
  'experiment.invalidOutput': 'Connect experiments using the A or B outputs.',
  'experiment.summary': ({ a, b }: { a: number; b: number }) => `A ${a}% · B ${b}%`,
  'nodes.transform.label': 'Data Transform',
  'nodes.transform.description':
    'Selects a field from incoming data and transforms its value. The result is passed to downstream steps.',
  'transform.dataPath': 'Data path',
  'transform.pathHint':
    'Leave empty to select the whole input. Use properties and array indexes, e.g. user.items[0].name. Without transformations, the extracted value passes through unchanged.',
  'transform.wholeValue': 'Whole value',
  'transform.transformations': 'Transformations',
  'transform.orderHint':
    'Runs from top to bottom. Text operations require text. Put a fallback first when a field may be missing or null.',
  'transform.capitalize': 'Capitalize',
  'transform.lowercase': 'Lowercase',
  'transform.uppercase': 'Uppercase',
  'transform.title-case': 'Title case',
  'transform.trim': 'Trim whitespace',
  'transform.prefix': 'Add prefix',
  'transform.suffix': 'Add suffix',
  'transform.replace': 'Find and replace',
  'transform.fallback': 'Fallback for missing or null',
  'transform.textToAdd': 'Text to add',
  'transform.find': 'Find',
  'transform.replacement': 'Replace with',
  'transform.replaceHint':
    'Replaces all exact matches. Text is literal; regular expressions are not used.',
  'transform.fallbackType': 'Fallback type',
  'transform.fallbackValue': 'Fallback value',
  'transform.text': 'Text',
  'transform.json': 'JSON value',
  'transform.invalidFallback':
    'Enter valid JSON, such as null, false, 0, "text", an object, or an array. This edit is saved when the JSON is valid.',
  'transform.add': 'Add transformation',
  'transform.outputHint': 'Passes the selected and transformed value to the next node',
  'transform.summary': ({ path, count }: { path: string; count: number }) =>
    `${path} · ${count} ${count === 1 ? 'transformation' : 'transformations'}`,
  'transform.operation': ({ number }: { number: number }) => `Transformation ${number}`,
  'transform.moveUp': ({ number }: { number: number }) => `Move transformation ${number} up`,
  'transform.moveDown': ({ number }: { number: number }) => `Move transformation ${number} down`,
  'transform.remove': ({ number }: { number: number }) => `Remove transformation ${number}`,
  'common.enterFullscreen': 'Enter full screen',
  'common.exitFullscreen': 'Exit full screen',
  'nodeInspector.requestTemplates':
    'Use incoming data in the URL, headers, or body with {{name}} or {{user.name}}. Array indexes such as {{items[0].id}} also work. Missing variables stop the request.',
  'errors.data.emptyRequestTemplatePath': 'Enter a data path inside request template braces.',
  'errors.data.unclosedRequestTemplate':
    'Close request template variables with two closing braces.',
  'errors.data.unresolvedRequestTemplatePath': ({ path }: { path: string }) =>
    `Request template data path “${path}” could not be resolved.`,
  'errors.data.emptyVariable':
    'Enter a variable name inside {{ }}; use {{$}} for the whole incoming value.',
  'errors.data.unclosedVariable': 'Close each variable with matching braces, for example {{name}}.',
  'errors.data.missingTargetVariable': ({ name }: { name: string }) =>
    `Variable “${name}” is missing in the element selector or attribute name.`,

  'aiSettings.assistantCredentials': 'Assistant credentials',
  'aiSettings.aiSettings': 'AI settings',
  'aiSettings.yourAiConnection': 'YOUR AI CONNECTION',
  'aiSettings.aiSettings2': 'AI Settings',
  'aiSettings.lockedUnlockToUseAi': 'Locked — unlock to use AI',
  'aiSettings.unavailableRestoreOrRemoveBrowserSettings':
    'Unavailable — restore or remove browser settings',
  'aiSettings.noSavedConfiguration': 'No saved configuration',
  'aiSettings.browserSettingsReady': 'Browser settings ready',
  'aiSettings.aiProviders': 'AI providers',
  'aiSettings.active': 'Active',
  'aiSettings.invalidEndpoint': 'Invalid endpoint',
  'aiSettings.settingsUnavailable': 'Settings unavailable.',
  'aiSettings.browserCredentialsRequireAnHttpsAiServer':
    'Browser credentials require an HTTPS AI server.',
  'aiSettings.labelBrowserSettingsAreLockedUnlockBeforeUsingOrActivatingThem': ({
    label,
  }: {
    label: string;
  }) => `${label} browser settings are locked. Unlock before using or activating them.`,
  'aiSettings.labelSavedConfigurationIsReadySavedModelModel': ({
    label,
    model,
  }: {
    label: string;
    model: string;
  }) => `${label} saved configuration is ready. Saved model: ${model}.`,
  'aiSettings.configureLabelBelowThenSaveAndActivateIt': ({ label }: { label: string }) =>
    `Configure ${label} below, then save and activate it.`,
  'aiSettings.selfHostedSetupInformation': 'Local setup information',
  'aiSettings.enterTheApiBaseUrlOfYourSelfHostedOpenaiCompatibleModel':
    'Local is for developers and debugging and only works when running the demo app locally. Run an OpenAI-compatible model server on the same machine as the demo backend, and enter a URL using localhost, 127.0.0.1, or [::1]. Requests come from the backend; the hosted demo cannot connect to a model on your computer. The model must support tool calls for workflow editing.',
  'aiSettings.unlockedUseActivateSavedConfigurationToSelectThisProvider':
    'Unlocked. Use Activate saved configuration to select this provider.',
  'aiSettings.labelSavedAndActivated': ({ label }: { label: string }) =>
    `${label} saved and activated.`,
  'aiSettings.selfHostedApiBaseUrl': 'Local API base URL',
  'aiSettings.enterAKeyToReplaceSettingsUseActivateForSavedSettings':
    'Enter a key to replace settings; use Activate for saved settings',
  'aiSettings.hideApiKey': 'Hide API key',
  'aiSettings.showApiKey': 'Show API key',
  'aiSettings.enterAnAvailableModelId': 'Enter an available model ID',
  'aiSettings.passphraseToUnlock': 'Passphrase to unlock',
  'aiSettings.encryptionPassphraseAtLeast12Characters':
    'Encryption passphrase (at least 12 characters)',
  'aiSettings.unlockBrowserSettings': 'Unlock browser settings',
  'aiSettings.saveAndActivate': 'Save and activate',
  'aiSettings.labelActivatedUsingSavedSettings': ({ label }: { label: string }) =>
    `${label} activated using saved settings.`,
  'aiSettings.activateSavedConfiguration': 'Activate saved configuration',
  'aiSettings.lock': 'Lock',
  'aiSettings.labelConfigurationRemovedConfigureItAgainBelowWhenYouReReady': ({
    label,
  }: {
    label: string;
  }) => `${label} configuration removed. Configure it again below when you’re ready.`,
  'aiSettings.removeBrowserSettings': 'Remove browser settings',
  'aiSettings.yourBrowserNormallyKeepsOtherWebsitesFromAccessingYourSavedApiKey':
    'Your browser normally keeps other websites from accessing your saved API key. While the key is unlocked, harmful code in this app or browser extensions with special permissions could still access it. Choose a strong passphrase you don’t use elsewhere, and keep it safe—we can’t recover it if you forget it.',
  'aiSettings.confirmNewServerOrigin': 'Confirm new server origin',
  'activityPanel.today': 'Today',
  'activityPanel.yesterday': 'Yesterday',
  'activityPanel.unknownDate': 'Unknown date',
  'activityPanel.recentActivity': 'Recent activity',
  'activityPanel.seeWhoChangedThisWorkflowAndWhen': 'See who changed this workflow and when.',
  'activityPanel.unknownTime': 'Unknown time',
  'activityPanel.youReAllCaughtUp': 'You’re all caught up',
  'activityPanel.noActivityYet': 'No activity yet',
  'activityPanel.changesToThisWorkflowWillAppearHere': 'Changes to this workflow will appear here.',
  'canvasChat.addAWelcomePopoverAfterA2SecondDelay': 'Add a welcome popover after a 2-second delay',
  'canvasChat.explainThisWorkflow': 'Explain what this workflow does',
  'canvasChat.changeTheSelectedStep': 'Change the selected step',
  'canvasChat.stoppedNoChangesWereMade': 'Stopped. No changes were made.',
  'canvasChat.valueNoChangesWereMade': ({ value }: { value: string }) =>
    `${value} No changes were made.`,
  'canvasChat.aiChat': 'AI chat',
  'canvasChat.yourWorkflowAssistant': 'Your workflow assistant',
  'canvasChat.startANewConversation': 'Start a new conversation',
  'canvasChat.newConversation': 'New conversation',
  'canvasChat.closeAiChat': 'Close AI chat',
  'canvasChat.unlockActiveproviderInSettingsBelowToUseAi': ({
    activeProvider,
  }: {
    activeProvider: string;
  }) => `Unlock ${activeProvider} in AI Settings to use AI`,
  'canvasChat.aiConfigurationIsIncorrectForActiveproviderCheckSettingsBelow': ({
    activeProvider,
  }: {
    activeProvider: string;
  }) => `AI configuration is incorrect for ${activeProvider}. Check AI Settings.`,
  'canvasChat.workingWithYourCurrentCanvas': 'Working with your current canvas',
  'canvasChat.aiConversation': 'AI conversation',
  'canvasChat.whatWouldYouLikeToCreate': 'What would you like to create?',
  'canvasChat.askMeToAddStepsAdjustTheirSettingsOrConnectYourJourney':
    'Ask me to add steps, adjust their settings, or connect your journey.',
  'canvasChat.connectYourAiAssistant': 'Connect your AI assistant',
  'canvasChat.aiChatIsReadyForSetupAskYourWorkspaceAdministratorToConnect':
    'AI chat is ready for setup. Ask your workspace administrator to connect the assistant service to enable it.',
  'canvasChat.you': 'You',
  'canvasChat.visualDxpAi': 'Visual DXP AI',
  'canvasChat.workingOnYourWorkflow': 'Working on your workflow…',
  'canvasChat.reasoningSummary': 'Reasoning summary',
  'canvasChat.messageTheWorkflowAssistant': 'Message the workflow assistant',
  'canvasChat.describeAChangeToYourWorkflow': 'Describe a change to your workflow…',
  'canvasChat.connectTheAssistantToStartChatting': 'Connect the assistant to start chatting',
  'canvasChat.stopGenerating': 'Stop generating',
  'canvasChat.sendMessage': 'Send message',
  'canvasChat.changesAreUndoableTestYourWorkflowBeforePublishing':
    'Changes are undoable. Test your workflow before publishing.',
  'canvasHelp.addAStep': 'Add a step',
  'canvasHelp.clickAnIconInTheNodeLibraryOrDragItOntoThe':
    'Click an icon in the node library or drag it onto the canvas. Hover over an icon to see its name. Start your journey with a Trigger.',
  'canvasHelp.arrangeAndConfigure': 'Arrange and configure',
  'canvasHelp.dragNodesToMoveThemClickANodeToOpenItsSettings':
    'Drag nodes to move them. Click a node to open its settings, where you can also duplicate or delete it.',
  'canvasHelp.leaveANote': 'Leave a note',
  'canvasHelp.addANoteAndTypeDirectlyOnTheCanvasSelectTextThen':
    'Add a Note and type directly on the canvas. Select text, then use its settings to make that selection bold, italic, or struck through. You can also change the background or choose transparency. Drag its header to move it.',
  'canvasHelp.groupNodesInAFrame': 'Group nodes in a frame',
  'canvasHelp.addAFrameAndGiveItANameInItsSettingsDrop':
    'Add a Frame and give it a name in its settings. Drop nodes fully inside, or resize the frame around them. Drag its header to move the whole group. Drag a node outside to remove it from the group; deleting a frame keeps its nodes.',
  'canvasHelp.connectYourSteps': 'Connect your steps',
  'canvasHelp.dragFromTheCircleOnTheRightOfOneNodeToThe':
    'Drag from the circle on the right of one node to the circle on the left of another. Click a connection to edit its name. A Condition uses its top output when the condition matches and its bottom output otherwise.',
  'canvasHelp.moveAroundTheCanvas': 'Move around the canvas',
  'canvasHelp.useVariables': 'Use variables',
  'canvasHelp.useVariablesDescription':
    'HTTP Request nodes produce data that flows from step to step along connections. In any node text parameter, variables are replaced with the data fields they point to when the workflow runs. Write Hello {{user.name}} to insert a name, {{items[0].name}} for the first item, or {{$}} for the whole incoming value.',
  'canvasHelp.dragEmptySpaceToPanScrollPinchOrUseTheZoomButtons':
    'Drag empty space to pan. Scroll, pinch, or use the zoom buttons to zoom. Fit all nodes brings the whole journey into view; the minimap gives you an overview.',
  'canvasHelp.canvasHelp': 'Canvas help',
  'canvasHelp.howToUseTheCanvas': 'How to use the canvas',
  'canvasHelp.closeCanvasHelp': 'Close canvas help',
  'canvasHelp.canvasInstructions': 'Canvas instructions',
  'common.undo': 'Undo',
  'canvasHelp.ctrlZ': '⌘ / Ctrl + Z',
  'common.redo': 'Redo',
  'canvasHelp.ctrlShiftZ': '⌘ / Ctrl + Shift + Z',
  'canvasHelp.removeSelected': 'Remove selected',
  'canvasHelp.deleteBackspace': 'Delete / Backspace',
  'edgeInspector.connectionConfiguration': 'Connection configuration',
  'edgeInspector.connectionDetails': 'CONNECTION DETAILS',
  'edgeInspector.closeConnectionDetails': 'Close connection details',
  'edgeInspector.connection': 'Connection',
  'edgeInspector.betweenWorkflowSteps': 'Between workflow steps',
  'edgeInspector.connectionName': 'Connection name',
  'edgeInspector.eGContinueToWelcome': 'e.g. Continue to welcome',
  'edgeInspector.shownOnTheConnectionLeaveEmptyToHideTheName':
    'Shown on the connection. Leave empty to hide the name.',
  'edgeInspector.deleteConnection': 'Delete connection',
  'elementPicker.elementFoundOnThePage': 'Element found on the page.',
  'elementPicker.noMatchingElementFoundYouCanStillUseThisSelector':
    'No matching element found. You can still use this selector.',
  'elementPicker.thisWebsiteCouldnTConnectToThePickerCheckTheSetupBelow':
    'This website couldn’t connect to the picker. Check the setup below, then try Load website again.',
  'elementPicker.selectAnElement': 'Select an element',
  'elementPicker.pointClickAndConnectYourExperience': 'Point, click, and connect your experience.',
  'elementPicker.closeElementPicker': 'Close element picker',
  'elementPicker.selectionModeIsOn': 'Selection mode is on',
  'elementPicker.connectingToWebsite': 'Connecting to website…',
  'elementPicker.connectionRequired': 'Connection required',
  'elementPicker.hoverToInspectClickToSelect': 'Hover to inspect · Click to select',
  'elementPicker.websiteSetup': 'Website setup',
  'elementPicker.websiteElementSelectionPreview': 'Website element selection preview',
  'elementPicker.enterAWebsiteUrlToGetStarted': 'Enter a website URL to get started.',
  'elementPicker.connectingElementPicker': 'Connecting element picker',
  'elementPicker.elementSelected': 'Element selected',
  'elementPicker.cssSelector': 'CSS selector',
  'elementPicker.clickAnElementOrEnterACssSelector': 'Click an element or enter a CSS selector',
  'elementPicker.enterAValidCssSelector': 'Enter a valid CSS selector.',
  'elementPicker.yourSelectorWillBeSavedToThisStep': 'Your selector will be saved to this step.',
  'common.cancel': 'Cancel',
  'elementPicker.useElement': 'Use element',
  'frameCard.dragToMoveThisFrameAndItsNodes': 'Drag to move this frame and its nodes',
  'frameCard.frame': 'Frame',
  'frameCard.dropNodesInsideToGroupThem': 'Drop nodes inside to group them',
  'isolatedPreview.theDemoCouldNotLoadReloadToTryAgain':
    'The demo could not load. Reload to try again.',
  'isolatedPreview.theIsolatedPreviewCouldNotRunThisWorkflow':
    'The isolated preview could not run this workflow.',
  'isolatedPreview.step': 'Step',
  'isolatedPreview.theWebsiteCouldNotLoad': 'The website could not load.',
  'nodeInspector.runsWhenTheSelectedEventOccurs': 'Runs when the selected event occurs',
  'nodeInspector.passesResponseDataOrAnErrorObjectToTheNextNode':
    'Passes response data or an error object to the next node',
  'nodeInspector.runsAfterTheElementsAreUpdated': 'Runs after the elements are updated',
  'nodeInspector.runsAfterTheCookieIsSaved': 'Runs after the cookie is saved',
  'nodeInspector.runsAfterThePause': 'Runs after the pause',
  'nodeInspector.runsAfterThePopoverIsDisplayed': 'Runs after the popover is displayed',
  'nodeInspector.targetElement': 'Target element',
  'nodeInspector.optionalWithoutAnAnchorChooseAFixedScreenPosition':
    'Optional. Without an anchor, choose a fixed screen position.',
  'nodeInspector.useACssSelectorOrPickAnElementFromYourWebsite':
    'Use a CSS selector or pick an element from your website.',
  'nodeInspector.eGSignupButton': 'e.g. #signup-button',
  'nodeInspector.pickAnElementFromYourWebsite': 'Pick an element from your website',
  'nodeInspector.selectOnWebsite': 'Select on website',
  'nodeInspector.labelConfiguration': ({ label }: { label: string }) => `${label} configuration`,
  'nodeInspector.closeItemnameDetails': ({ itemName }: { itemName: string }) =>
    `Close ${itemName} details`,
  'nodeInspector.canvasGroup': 'Canvas group',
  'nodeInspector.canvasAnnotation': 'Canvas annotation',
  'nodeInspector.workflowStep': 'Workflow step',
  'nodeInspector.frameName': 'Frame name',
  'nodeInspector.noteName': 'Note name',
  'nodeInspector.stepName': 'Step name',
  'nodeInspector.groupingNodes': 'Grouping nodes',
  'nodeInspector.textAppearance': 'Text & appearance',
  'nodeInspector.parameters': 'Parameters',
  'nodeInspector.dropNodesFullyInsideThisFrameToGroupThemDragItsHeader':
    'Drop nodes fully inside this frame to group them. Drag its header to move the group, or resize its edges to surround existing nodes. Drag a node outside to release it. Deleting the frame keeps its nodes and connections.',
  'nodeInspector.noteText': 'Note text',
  'nodeInspector.youCanAlsoEditThisTextDirectlyOnTheCanvas':
    'You can also edit this text directly on the canvas.',
  'nodeInspector.startWhen': 'Start when',
  'nodeInspector.chooseASupportedTriggerEvent': 'Choose a supported trigger event.',
  'nodeInspector.method': 'Method',
  'nodeInspector.requestUrl': 'Request URL',
  'nodeInspector.headers': 'Headers',
  'nodeInspector.enterAJsonObjectLeaveEmptyForDefaultHeaders':
    'Enter a JSON object with string values. Leave empty for default headers.',
  'nodeInspector.requestBody': 'Request body',
  'nodeInspector.sentAsTheRawRequestBody': 'Sent as the raw request body.',
  'nodeInspector.theApiMustAllowRequestsFromYourWebsiteThroughCors':
    'The API must allow requests from your website through CORS.',
  'nodeInspector.action': 'Action',
  'nodeInspector.changeText': 'Change text',
  'nodeInspector.replaceHtml': 'Replace HTML',
  'nodeInspector.addCssClass': 'Add CSS class',
  'nodeInspector.removeCssClass': 'Remove CSS class',
  'nodeInspector.hideElement': 'Hide element',
  'nodeInspector.showElement': 'Show element',
  'nodeInspector.setAttribute': 'Set attribute',
  'nodeInspector.attributeName': 'Attribute name',
  'nodeInspector.eGAriaLabel': 'e.g. aria-label',
  'nodeInspector.htmlContent': 'HTML content',
  'nodeInspector.cssClassNames': 'CSS class names',
  'nodeInspector.attributeValue': 'Attribute value',
  'nodeInspector.newText': 'New text',
  'nodeInspector.separateMultipleClassNamesWithSpaces':
    'Separate multiple class names with spaces.',
  'nodeInspector.enterAValue': 'Enter a value…',
  'nodeInspector.cookieName': 'Cookie name',
  'nodeInspector.eGAudience': 'e.g. audience',
  'nodeInspector.cookieValue': 'Cookie value',
  'nodeInspector.anEmptyValueIsAllowed': 'An empty value is allowed.',
  'nodeInspector.eGReturning': 'e.g. returning',
  'nodeInspector.expiration': 'Expiration',
  'nodeInspector.browserSession': 'Browser session',
  'nodeInspector.afterANumberOfDays': 'After a number of days',
  'nodeInspector.expiresAfter': 'Expires after',
  'nodeInspector.from1To400Days': 'From 1 to 400 days.',
  'nodeInspector.days': 'days',
  'nodeInspector.savesTheCookieForAllPagesOnThisWebsiteALaterCondition':
    'Saves the cookie for all pages on this website. A later Condition can check its name and value. Browser cookie settings may prevent it from being saved.',
  'nodeInspector.waitFor': 'Wait for',
  'nodeInspector.1000Milliseconds1SecondMaximum24Hours':
    '1,000 milliseconds = 1 second. Maximum 24 hours.',
  'nodeInspector.ms': 'ms',
  'nodeInspector.conditionType': 'Condition type',
  'nodeInspector.elementExists': 'Element exists',
  'nodeInspector.incomingData': 'Incoming data',
  'nodeInspector.userDevice': 'User device',
  'nodeInspector.userLanguage': 'User language',
  'nodeInspector.referrerDomain': 'Referrer domain',
  'nodeInspector.withinDateRange': 'Within date range',
  'nodeInspector.timeOfDay': 'Time of day',
  'nodeInspector.urlSearchParameter': 'URL search parameter',
  'nodeInspector.cookies': 'Cookies',
  'nodeInspector.evaluatesDataReceivedThroughTheIncomingConnectionSuchAsAnHttpResponse':
    'Evaluates data received through the incoming connection, such as an HTTP response. Choose a value and an operator to route execution through True or False.',
  'nodeInspector.operator': 'Operator',
  'nodeInspector.comparisonValue': 'Comparison value',
  'nodeInspector.trueWhenThisCssSelectorMatchesAnElement':
    'True when this CSS selector matches an element.',
  'nodeInspector.usesTheBrowserSDeviceInformationWithUserAgentDetectionAsA':
    'Uses the browser’s device information, with user agent detection as a fallback.',
  'nodeInspector.checksThePrimaryBrowserLanguageUseEnForAnyEnglishVariantOr':
    'Checks the primary browser language. Use en for any English variant, or en-US for an exact locale.',
  'nodeInspector.matchesTheExactDomainIgnoringProtocolPortAndPathSubdomainsAreDistinct':
    'Matches the exact domain, ignoring protocol, port and path. Subdomains are distinct: example.com does not match www.example.com. A missing referrer takes the False path.',
  'nodeInspector.checksTheCurrentPageUrlAnyMatchingValueInARepeatedParameter':
    'Checks the current page URL. Any matching value in a repeated parameter counts.',
  'nodeInspector.checksCookiesLocalstorageAndSessionstorageOnThisWebsiteTrueIfAnySource':
    'Checks cookies, localStorage and sessionStorage on this website. True if any source contains the name and value. Cookie names and values are URL-decoded. If none match, the False path runs.',
  'nodeInspector.exactCaseSensitiveMatchAnEmptyValueMatchesOnlyAPresentEmpty':
    'Exact, case-sensitive match. An empty value matches only a present, empty variable.',
  'nodeInspector.eGLoggedIn': 'e.g. .logged-in',
  'nodeInspector.deviceIs': 'Device is',
  'nodeInspector.chooseADevice': 'Choose a device',
  'nodeInspector.desktop': 'Desktop',
  'nodeInspector.mobile': 'Mobile',
  'nodeInspector.languageIs': 'Language is',
  'nodeInspector.eGEnEsEnUs': 'e.g. en, es, en-US',
  'nodeInspector.referrerDomainEquals': 'Referrer domain equals',
  'nodeInspector.exampleCom': 'example.com',
  'nodeInspector.dateBasedOn': 'Date based on',
  'nodeInspector.timeBasedOn': 'Time based on',
  'nodeInspector.visitorLocalDate': 'Visitor local date',
  'nodeInspector.visitorLocalTime': 'Visitor local time',
  'nodeInspector.utc': 'UTC',
  'nodeInspector.startDate': 'Start date',
  'nodeInspector.endDate': 'End date',
  'nodeInspector.startTime': 'Start time',
  'nodeInspector.endTime': 'End time',
  'nodeInspector.parameterName': 'Parameter name',
  'nodeInspector.cookieOrStorageKey': 'Cookie or storage key',
  'nodeInspector.eGUtmSource': 'e.g. utm_source',
  'nodeInspector.valueEquals': 'Value equals',
  'nodeInspector.eGNewsletter': 'e.g. newsletter',
  'nodeInspector.numberOfRepetitions': 'Number of repetitions',
  'nodeInspector.times': 'times',
  'nodeInspector.contentType': 'Content type',
  'nodeInspector.customHtml': 'Custom HTML',
  'nodeInspector.embeddedWebsite': 'Embedded website',
  'nodeInspector.websiteUrl': 'Website URL',
  'nodeInspector.theWebsiteMustAllowEmbeddingInAnIframe':
    'The website must allow embedding in an iframe.',
  'nodeInspector.popoverAnimation': 'Animation',
  'nodeInspector.animationNone': 'None',
  'nodeInspector.animationFade': 'Fade',
  'nodeInspector.animationSlide': 'Slide',
  'nodeInspector.animationZoom': 'Zoom',
  'nodeInspector.animationBounce': 'Bounce',
  'nodeInspector.animationHint':
    'Preview the animation in full screen. Direction follows the popover position.',
  'nodeInspector.position': 'Position',
  'nodeInspector.centerOfScreen': 'Center of screen',
  'nodeInspector.topLeft': 'Top left',
  'nodeInspector.topRight': 'Top right',
  'nodeInspector.bottomLeft': 'Bottom left',
  'nodeInspector.bottomRight': 'Bottom right',
  'nodeInspector.nextToAnElement': 'Next to an element',
  'nodeInspector.anchorElement': 'Anchor element',
  'nodeInspector.popoverWidth': 'Popover width',
  'nodeInspector.chooseAWidthBetween240And960Pixels': 'Choose a width between 240 and 960 pixels.',
  'nodeInspector.px': 'px',
  'nodeInspector.contentPreview': 'CONTENT PREVIEW',
  'nodeInspector.openFullscreenContentPreview': 'Open fullscreen content preview',
  'nodeInspector.previewOnTheDemoWebsite': 'Preview on the demo website',
  'nodeInspector.fullscreen': 'Fullscreen',
  'nodeInspector.popoverHtmlPreview': 'Popover HTML preview',
  'nodeInspector.previewYourPopoverInPositionOnTheDemoWebsite':
    'Preview your popover in position on the demo website.',
  'nodeInspector.outputs': 'Outputs',
  'nodeInspector.true': 'True',
  'nodeInspector.conditionMatches': 'Condition matches',
  'nodeInspector.conditionMatchesWithData': 'Forwards data when the condition matches',
  'nodeInspector.false': 'False',
  'nodeInspector.conditionDoesNotMatch': 'Condition does not match',
  'nodeInspector.conditionDoesNotMatchWithData': 'Forwards data when the condition does not match',
  'nodeInspector.body': 'Body',
  'nodeInspector.runsEachRepetition': 'Runs each repetition',
  'nodeInspector.done': 'Done',
  'nodeInspector.runsAfterTheLastOne': 'Runs after the last one',
  'nodeInspector.connectTheStepsToRepeatToBodyConnectTheNextStepTo':
    'Connect the steps to repeat to Body. Connect the next step to Done.',
  'nodeInspector.data': 'Data',
  'nodeInspector.next': 'Next',
  'nodeInspector.duplicateItemname': ({ itemName }: { itemName: string }) =>
    `Duplicate ${itemName}`,
  'nodeInspector.duplicate': 'Duplicate',
  'nodeInspector.deleteItemname': ({ itemName }: { itemName: string }) => `Delete ${itemName}`,
  'nodeInspector.delete': 'Delete',
  'nodeLibrary.nodeLibrary': 'Node library',
  'nodeLibrary.addLabel': ({ label }: { label: string }) => `Add ${label}`,
  'noteCard.dragToMoveNote': 'Drag to move note',
  'noteCard.note': 'Note',
  'noteCard.valueText': ({ value }: { value: string }) => `${value} text`,
  'noteControls.yellow': 'Yellow',
  'noteControls.green': 'Green',
  'noteControls.blue': 'Blue',
  'noteControls.purple': 'Purple',
  'noteControls.pink': 'Pink',
  'noteControls.white': 'White',
  'noteControls.transparent': 'Transparent',
  'noteControls.bold': 'Bold',
  'noteControls.italic': 'Italic',
  'noteControls.strikethrough': 'Strikethrough',
  'noteControls.textStyle': 'Text style',
  'noteControls.selectTextInTheNoteOrAboveThenChooseAStyle':
    'Select text in the note or above, then choose a style.',
  'noteControls.background': 'Background',
  'noteControls.labelBackground': ({ label }: { label: string }) => `${label} background`,
  'noteControls.customBackgroundColor': 'Custom background color',
  'noteControls.customColor': 'Custom color',
  'noteTextEditor.writeANote': 'Write a note…',
  'popoverPreview.centerOfScreen': 'Center of screen',
  'popoverPreview.topLeft': 'Top left',
  'popoverPreview.topRight': 'Top right',
  'popoverPreview.bottomLeft': 'Bottom left',
  'popoverPreview.bottomRight': 'Bottom right',
  'popoverPreview.nextToAnElement': 'Next to an element',
  'popoverPreview.fullscreenPopoverPreview': 'Fullscreen popover preview',
  'popoverPreview.contentPreview': 'CONTENT PREVIEW',
  'popoverPreview.popover': 'Popover',
  'popoverPreview.restartPreview': 'Restart preview',
  'popoverPreview.closePopoverPreview': 'Close popover preview',
  'popoverPreview.closePreviewEsc': 'Close preview (Esc)',
  'popoverPreview.demoWebsite': 'Demo website',
  'popoverPreview.px': 'px',
  'popoverPreview.loadingWebsite': 'Loading website…',
  'popoverPreview.popoverPreviewWebsite': 'Popover preview website',
  'presetsPanel.workflowPresets': 'Workflow presets',
  'presetsPanel.applyingAPresetReplacesAllCurrentNodesAndConnectionsYourWorkflowName':
    'Applying a preset replaces all current nodes and connections. Your workflow name, target website, and subpage settings stay the same. You can undo this change.',
  'presetsPanel.setupInstructions': 'Setup instructions',
  'presetsPanel.applyPresetName': ({ name }: { name: string }) => `Apply preset: ${name}`,
  'presetsPanel.applyPreset': 'Apply preset',
  'preview.previewWorkflow': 'Preview workflow',
  'preview.testYourExperience': 'TEST YOUR EXPERIENCE',
  'preview.seeYourJourneyInAction': 'See your journey in action',
  'preview.closePreview': 'Close preview',
  'preview.searchParams': 'Search parameters',
  'preview.reloadWebsite': 'Reload website',
  'preview.stopWorkflow': 'Stop workflow',
  'preview.restartWorkflow': 'Restart workflow',
  'preview.runWorkflow': 'Run workflow',
  'preview.workflowPreviewWebsite': 'Workflow preview website',
  'preview.executionLog': 'Execution log',
  'preview.listeningForYourTriggers': 'Listening for your triggers.',
  'preview.yourJourneyStepByStep': 'Your journey, step by step.',
  'preview.interactWithTheWebsiteToTriggerYourWorkflow':
    'Interact with the website to trigger your workflow.',
  'preview.runTheWorkflowToSeeEachActionHappenOnThePage':
    'Run the workflow to see each action happen on the page.',
  'preview.externalWebsitesNeedThePreviewBridgeConfiguredForThisBuilderOriginPreviews':
    'External websites need the preview bridge configured for this builder origin. Previews run in a separate sandbox origin. Page-load triggers run when you start. Other triggers respond to this website, just like the exported script. Reload to reset page changes.',
  'builder.theActivityCouldNotBeSavedYourWorkflowEditIsStillApplied':
    'The activity could not be saved. Your workflow edit is still applied.',
  'builder.browserStorageIsUnavailableExportYourWorkflowToKeepACopy':
    'Browser storage is unavailable. Export your workflow to keep a copy.',
  'builder.theChangeWasUndoneButItsActivityEntryCouldNotBeRemoved':
    'The change was undone, but its activity entry could not be removed.',
  'builder.connectThisStepToADifferentStep': 'Connect this step to a different step.',
  'builder.notesAreCanvasAnnotationsAndCannotBeConnected':
    'Notes are canvas annotations and cannot be connected.',
  'builder.connectTheStepsInsideAFrameToBuildYourWorkflow':
    'Connect the steps inside a frame to build your workflow.',
  'builder.triggersBeginAJourneyAndCannotReceiveConnections':
    'Triggers begin a journey and cannot receive connections.',
  'builder.labelAdded': ({ label }: { label: string }) => `${label} added`,
  'builder.invalidWorkflowStructure': 'Invalid workflow structure.',
  'builder.couldNotApplyNameValue': ({ name, value }: { name: string; value: string }) =>
    `Could not apply “${name}”. ${value}`,
  'builder.appliedNameUseUndoToRestoreYourPreviousWorkflow': ({ name }: { name: string }) =>
    `Applied “${name}”. Use Undo to restore your previous workflow.`,
  'builder.chooseAValidVisualDxpWorkflowJsonFile': 'Choose a valid Visual DXP workflow JSON file.',
  'builder.workflowImported': 'Workflow imported',
  'builder.couldNotImportThisFile': 'Could not import this file',
  'builder.targetWebsiteUpdated': 'Target website updated',
  'builder.connectTheAssistantServiceToStartChatting':
    'Connect the assistant service to start chatting.',
  'builder.theCanvasChangedWhileIWasWorkingSendYourMessageAgainTo':
    'The canvas changed while I was working. Send your message again to use the latest version.',
  'builder.aiUpdatedYourWorkflowUseUndoToRevertThisChange':
    'AI updated your workflow. Use Undo to revert this change.',
  'builder.builderViews': 'Builder views',
  'builder.canvas': 'Canvas',
  'builder.presets': 'Presets',
  'builder.activity': 'Activity',
  'builder.aiSettings': 'AI Settings',
  'builder.allChangesSaved': 'All changes saved',
  'builder.saving': 'Saving…',
  'builder.readyToBuild': 'Ready to build',
  'builder.changeTargetWebsite': 'Change target website',
  'builder.demoWebsite': 'Demo website',
  'builder.undoZ': 'Undo (⌘Z)',
  'builder.redoZ': 'Redo (⌘⇧Z)',
  'builder.importAWorkflowJsonFile': 'Import a workflow JSON file',
  'builder.import': 'Import',
  'canvas.zoomOut': 'Zoom out',
  'canvas.zoomIn': 'Zoom in',
  'builder.fitAllNodes': 'Fit all nodes',
  'builder.toggleMinimap': 'Toggle minimap',
  'builder.everyExperienceStartsSomewhere': 'Every experience starts somewhere.',
  'builder.addATriggerFromTheLibraryToBeginYourJourney':
    'Add a trigger from the library to begin your journey.',
  'builder.addYourFirstTrigger': 'Add your first trigger',
  'builder.step': 'Step',
  'builder.createdWithLoveByDanielJLBeltran': 'CREATED WITH LOVE BY DANIEL J.L. BELTRAN',
  'builder.reactFlowAttribution': 'BASED ON REACT FLOW',
  'builder.zToUndo': 'Z to undo',
  'builder.dismissNotification': 'Dismiss notification',
  'builder.targetElementSelected': 'Target element selected',
  'builder.targetWebsite': 'Target website',
  'builder.yourDigitalExperience': 'YOUR DIGITAL EXPERIENCE',
  'builder.chooseYourWebsite': 'Choose your website',
  'builder.closeDialog': 'Close dialog',
  'builder.thisExperienceWillRunOnlyOnThePageAtThisUrl':
    'This experience will run only on the page at this URL.',
  'builder.websiteUrl': 'Website URL',
  'builder.leaveEmptyToUseTheDemoWebsite': 'Leave empty to use the demo website',
  'builder.effectiveScope': 'Effective scope:',
  'builder.trailingSlashesQueryParametersAndFragmentsDoNotChangeTheScope':
    'Trailing slashes, query parameters, and fragments do not change the scope.',
  'builder.includeSubpages': 'Include subpages',
  'builder.alsoRunThisExperienceOnPagesBeneathThisUrl':
    'Also run this experience on pages beneath this URL.',
  'builder.useTheDemoWebsite': 'Use the demo website',
  'website.save': 'Save website',
  'websiteConnectionCheck.readingBranding': 'Reading website branding…',
  'websiteConnectionCheck.brandingUnavailable':
    'Website connected, but branding could not be read. Update bridge.js to the latest version and reopen this dialog to retry.',
  'websiteConnectionCheck.brandingStorageUnavailable':
    'Branding is available for this session, but could not be saved in this browser.',
  'websiteConnectionCheck.websiteConnectionCheck': 'Website connection check',
  'websiteConnectionCheck.connectingToYourWebsite': 'Connecting to your website…',
  'websiteConnectionCheck.websiteConnectedSuccessfully': 'Website connected successfully',
  'websiteConnectionCheck.connectionNeedsAttention': 'Your connection needs attention',
  'websiteConnectionCheck.couldnTConnectToYourWebsiteCompleteTheSetupBelow':
    'Couldn’t connect to your website. Complete the setup below.',
  'websiteSetup.connectYourWebsite': 'Connect your website',
  'websiteSetup.copied': 'Copied',
  'websiteSetup.copyScript': 'Copy script',
  'isolatedPreview.bridgeUnavailable':
    'The preview bridge did not connect. Install bridge.js on this website with data-parent-origin set to the exact editor origin, then reload. Check the browser console for blocked scripts or embedding errors.',
  'websiteSetup.couldnTCopyAutomaticallySelectTheScriptAboveAndCopyItManually':
    'Couldn’t copy automatically. Select the script above and copy it manually.',
  'workflowCard.incomingData': 'Incoming data',
  'workflowCard.usesIncomingData': 'Receives data',
  'workflowCard.producesData': 'Produces data',
  'workflowCard.forwardsData': 'Forwards data',
  'workflowCard.running': 'Running',
  'workflowCard.needsAttention': 'Needs attention',
  'workflowCard.completed': 'Completed',
  'workflowCard.configured': 'Configured',
  'workflowCard.2Paths': '2 PATHS',
  'workflowCard.dataOut': 'DATA OUT',
  'workflowCard.truePassesIncomingDataUnchanged': 'True — passes incoming data unchanged',
  'workflowCard.body': 'Body',
  'workflowCard.falsePassesIncomingDataUnchanged': 'False — passes incoming data unchanged',
  'workflowCard.done': 'Done',
  'workflowCard.responseDataOutput': 'Response data output',

  'activity.previewOpened': ({ name }: { name: string }) => `Opened a test preview of “${name}”`,
  'activity.workflowRenamed': ({ name }: { name: string }) => `Renamed the workflow to “${name}”`,
  'activity.settingsUpdated': ({ label }: { label: string }) => `Updated settings for “${label}”`,
  'activity.descriptionUpdated': ({ label }: { label: string }) =>
    `Updated the description of “${label}”`,
  'activity.nodeResized': ({ label }: { label: string }) => `Resized “${label}”`,
  'activity.nodeMoved': ({ label }: { label: string }) => `Moved “${label}” on the canvas`,
  'activity.nodesMoved': ({ count }: { count: number }) => `Moved ${count} steps on the canvas`,
  'activity.connected': ({ source, target }: { source: string; target: string }) =>
    `Connected “${source}” to “${target}”`,
  'activity.disconnected': ({ source, target }: { source: string; target: string }) =>
    `Disconnected “${source}” from “${target}”`,
  'activity.nodeAdded': ({ label }: { label: string }) => `Added “${label}”`,
  'activity.nodeDeleted': ({ label }: { label: string }) => `Deleted “${label}”`,
  'activity.nodeDuplicated': ({ label }: { label: string }) => `Duplicated “${label}”`,
  'activity.presetApplied': ({ name }: { name: string }) => `Applied preset “${name}”`,
  'activity.workflowImported': ({ name }: { name: string }) => `Imported workflow “${name}”`,
  'activity.websiteConfigured': ({
    url,
    includeSubpages,
  }: {
    url: string;
    includeSubpages: boolean;
  }) =>
    `Changed the target website to “${url}” (${includeSubpages ? 'including subpages' : 'this page only'})`,
  'activity.aiEditsApplied': ({ count }: { count: number }) =>
    `Applied ${count} ${count === 1 ? 'edit' : 'edits'} with the AI assistant`,
  'activity.deleted': ({
    count,
    label,
    connections,
  }: {
    count: number;
    label: string;
    connections: number;
  }) =>
    `${count === 1 ? `Deleted “${label}”` : `Deleted ${count} steps`}${connections ? ` and ${connections} ${connections === 1 ? 'connection' : 'connections'}` : ''}`,
  'activity.connectionsRemoved': ({ count }: { count: number }) => `Removed ${count} connections`,
  'activity.nodeRenamed': ({ kind, label }: { kind: string; label: string }) =>
    `Renamed a ${kind === 'frame' ? 'frame' : 'step'} to “${label}”`,
  'activity.connectionRenamed': ({
    source,
    target,
    label,
  }: {
    source: string;
    target: string;
    label: string;
  }) =>
    label
      ? `Renamed the connection from “${source}” to “${target}” to “${label}”`
      : `Removed the name of the connection from “${source}” to “${target}”`,
  'canvas.nodeCount': ({ count }: { count: number }) =>
    `${count} ${count === 1 ? 'node' : 'nodes'}`,
  'canvas.connectionCount': ({ count }: { count: number }) =>
    `${count} ${count === 1 ? 'connection' : 'connections'}`,
  'activity.actionCount': ({ count }: { count: number }) =>
    `${count} ${count === 1 ? 'action' : 'actions'}`,
  'errors.cookies.enterACookieNameWithoutSpacesOrSeparatorsSuchAs':
    'Enter a cookie name without spaces or separators such as = and ;.',
  'errors.cookies.missingNameVariable': ({ name }: { name: string }) =>
    `Variable “${name}” is missing in the cookie name.`,
  'errors.cookies.cookiesWithAnHttponlyNamePrefixMustBeSetBy':
    'Cookies with an HttpOnly name prefix must be set by a server.',
  'errors.cookies.enterACookieValueAnEmptyStringIsAllowed':
    'Enter a cookie value (an empty string is allowed).',
  'errors.cookies.cookieLifetimeMustBeAnIntegerFrom0SessionTo':
    'Cookie lifetime must be an integer from 0 (session) to 400 days.',
  'errors.cookies.cookieNamesAndValuesMustContainValidUnicodeText':
    'Cookie names and values must contain valid Unicode text.',
  'errors.cookies.theEncodedCookieAndItsSettingsMustFitWithin4':
    'The encoded cookie and its settings must fit within 4,096 bytes.',
  'errors.dateRange.chooseVisitorLocalTimeOrUtcForTheDateRange':
    'Choose visitor local time or UTC for the date range.',
  'errors.dateRange.chooseAValidLabelDateYyyyMmDd': ({ label }: { label: string }) =>
    `Choose a valid ${label} date (YYYY-MM-DD).`,
  'errors.dateRange.endDateMustBeOnOrAfterTheStartDate':
    'End date must be on or after the start date.',
  'errors.timeRange.chooseVisitorLocalTimeOrUtcForTheTimeOf':
    'Choose visitor local time or UTC for the time of day.',
  'errors.timeRange.chooseAValidLabelTimeHhMmFrom0000': ({ label }: { label: string }) =>
    `Choose a valid ${label} time (HH:MM, from 00:00 to 23:59).`,
  'errors.data.dataPathMustBeText': 'Data path must be text.',
  'errors.data.invalidDataPathPathUsePropertiesAndArrayIndexesE': ({ path }: { path: string }) =>
    `Invalid data path “${path}”. Use properties and array indexes, e.g. data.items[0].price.`,
  'errors.data.incomingCssClassesMustBeTextANumberABoolean':
    'Incoming CSS classes must be text, a number, a boolean, or an array of strings.',
  'errors.data.chooseASupportedIncomingDataConditionOperator':
    'Choose a supported Incoming data condition operator.',
  'errors.data.enterAComparisonValueForTheIncomingDataCondition':
    'Enter a comparison value for the Incoming data condition.',
  'errors.data.invalidRegularExpressionEnterAPatternSuchAsPremiumWithout':
    'Invalid regular expression. Enter a pattern such as ^premium, without / delimiters.',
  'errors.data.numericComparisonsRequireValidFiniteNumbersOnBothSides':
    'Numeric comparisons require valid finite numbers on both sides.',
  'errors.data.dataPathValue1CouldNotBeResolvedUseExistsOr': ({ value1 }: { value1: string }) =>
    `Data path “${value1}” could not be resolved. Use Exists or Does not exist to check missing data.`,
  'errors.data.value1IsNotSupportedForTypeData': ({
    value1,
    type,
  }: {
    value1: string;
    type: string;
  }) => `“${value1}” is not supported for ${type} data.`,
  'errors.data.booleanComparisonsRequireTrueOrFalse': 'Boolean comparisons require true or false.',
  'errors.data.arrayAndObjectEqualityRequiresAValidJsonComparisonValue':
    'Array and object equality requires a valid JSON comparison value.',
  'errors.data.enterAJsonTypeToCompareWithType2Data': ({
    type,
    type2,
  }: {
    type: string;
    type2: string;
  }) => `Enter a JSON ${type} to compare with ${type2} data.`,
  'errors.targeting.enterAWebsiteUrl': 'Enter a website URL.',
  'errors.targeting.encodeSpacesInTheWebsiteUrl': 'Encode spaces in the website URL.',
  'errors.targeting.enterAValidHttpOrHttpsUrlForARelative':
    'Enter a valid HTTP or HTTPS URL. For a relative path, provide the editor baseUrl.',
  'errors.targeting.enterAnHttpOrHttpsWebsiteUrlWithoutEmbeddedCredentials':
    'Enter an HTTP or HTTPS website URL without embedded credentials.',
  'errors.targeting.chooseYourOwnWebsiteInsteadOfTheBuiltInDemo':
    'Choose your own website instead of the built-in demo.',
  'errors.targeting.includeSubpagesMustBeABoolean': 'Include subpages must be a boolean.',
  'errors.aiSettings.webCryptoIsUnavailableUseASecureBrowserContext':
    'Web Crypto is unavailable. Use a secure browser context.',
  'errors.aiSettings.aiConfigurationChangedSendYourMessageAgain':
    'AI configuration changed. Send your message again.',
  'errors.aiSettings.browserSettingsCouldNotBeSavedEnableLocalstorageAndTry':
    'Browser settings could not be saved. Enable localStorage and try again. Previous active settings were preserved.',
  'errors.aiSettings.useAnHttpsAiServerBeforeSavingBrowserSettings':
    'Use an HTTPS AI server before saving browser settings.',
  'errors.aiSettings.enterAValidApiKeyAndModelId': 'Enter a valid API key and model ID.',
  'errors.aiSettings.keepCredentialsOutOfModelIdsAndUrls':
    'Keep credentials out of model IDs and URLs.',
  'errors.aiSettings.useAPassphraseWithAtLeast12Characters':
    'Use a passphrase with at least 12 characters.',
  'errors.aiSettings.settingsChangedSaveAgain': 'Settings changed. Save again.',
  'errors.aiSettings.browserSettingsAreUnavailableRestoreStorageAccessOrRemoveThem':
    'Browser settings are unavailable. Restore storage access or remove them.',
  'errors.aiSettings.couldNotUnlockSettingsCheckYourPassphraseOrRemoveSettings':
    'Could not unlock settings. Check your passphrase, or remove settings and save a new key.',
  'errors.aiSettings.unlockThisProviderBeforeActivatingIt':
    'Unlock this provider before activating it.',
  'errors.aiSettings.saveAConfigurationBeforeActivatingThisProvider':
    'Save a configuration before activating this provider.',
  'errors.aiSettings.browserCredentialsRequireAnHttpsAiServer':
    'Browser credentials require an HTTPS AI server.',
  'errors.aiSettings.unlockValue1InAiSettingsBeforeUsingAi': ({ value1 }: { value1: string }) =>
    `Unlock ${value1} in AI Settings before using AI.`,
  'errors.aiSettings.theAiServerOriginChangedConfirmTheNewDestinationIn':
    'The AI server origin changed. Confirm the new destination in AI settings or the assistant before sending.',
  'errors.aiCredentials.enterAValidHttpSLocalApiBaseUrlWithout':
    'Enter an HTTP(S) API base URL on localhost, 127.0.0.1, or [::1], without credentials, query, or fragment.',
  'errors.aiCredentials.configureAValidHttpOrHttpsAiEndpointWithoutEmbedded':
    'Configure a valid HTTP or HTTPS AI endpoint without embedded credentials.',
  'errors.ai.labelMustBeAnObject': ({ label }: { label: string }) => `${label} must be an object.`,
  'errors.ai.labelMustBeValue2OfAtMostMaxCharacters': ({
    label,
    value2,
    max,
  }: {
    label: string;
    value2: string;
    max: string;
  }) => `${label} must be ${value2} of at most ${max} characters.`,
  'errors.ai.idsCannotContainSurroundingWhitespaceOrControlCharacters':
    'IDs cannot contain surrounding whitespace or control characters.',
  'errors.ai.stepPositionsMustContainFiniteCoordinatesWithinTheCanvasLimits':
    'Step positions must contain finite coordinates within the canvas limits.',
  'errors.ai.stepConfigurationNumbersMustBeFinite': 'Step configuration numbers must be finite.',
  'errors.ai.noteTextFormattingMustContainBooleanValues':
    'Note text formatting must contain boolean values.',
  'errors.ai.noteTextFormattingMustUseSortedNonoverlappingRangesWithinThe':
    'Note text formatting must use sorted, nonoverlapping ranges within the note text.',
  'errors.ai.noteColorsMustBeASixDigitHexColorOr':
    'Note colors must be a six-digit hex color or transparent.',
  'errors.ai.chooseASupportedWorkflowStepType': 'Choose a supported workflow step type.',
  'errors.ai.frameDimensionsMustBePositiveNumbers': 'Frame dimensions must be positive numbers.',
  'errors.ai.connectionsMustUseASupportedOutputHandle':
    'Connections must use a supported output handle.',
  'errors.ai.connectionsCannotSpecifyTargetHandles': 'Connections cannot specify target handles.',
  'errors.ai.anAiResponseMayContainAtMostOperationsChanges': ({
    operations,
  }: {
    operations: string;
  }) => `An AI response may contain at most ${operations} changes.`,
  'errors.ai.anUpdateCannotChangeAStepTypeRemoveAndAdd':
    'An update cannot change a step type; remove and add a step instead.',
  'errors.ai.aStepUpdateMustContainAChange': 'A step update must contain a change.',
  'errors.ai.aConnectionUpdateMustContainAChange': 'A connection update must contain a change.',
  'errors.ai.theAiResponseContainsAnUnsupportedWorkflowChange':
    'The AI response contains an unsupported workflow change.',
  'errors.ai.includeSubpagesMustBeABoolean': 'Include subpages must be a boolean.',
  'errors.ai.thisWorkflowVersionIsNotSupported': 'This workflow version is not supported.',
  'errors.ai.aiEditingSupportsUpToNodesStepsAndEdgesConnections': ({
    nodes,
    edges,
  }: {
    nodes: string;
    edges: string;
  }) => `AI editing supports up to ${nodes} steps and ${edges} connections.`,
  'errors.ai.everyStepMustHaveAUniqueId': 'Every step must have a unique ID.',
  'errors.ai.nodesMustBelongToAnExistingTopLevelFrame':
    'Nodes must belong to an existing top-level frame.',
  'errors.ai.everyConnectionMustHaveAUniqueId': 'Every connection must have a unique ID.',
  'errors.ai.aConnectionRefersToAMissingStep': 'A connection refers to a missing step.',
  'errors.ai.notesCannotHaveWorkflowConnections': 'Notes cannot have workflow connections.',
  'errors.ai.framesCannotHaveWorkflowConnections': 'Frames cannot have workflow connections.',
  'errors.ai.triggersCannotReceiveIncomingConnections':
    'Triggers cannot receive incoming connections.',
  'errors.ai.aConnectionUsesAnInvalidOutputForItsSourceStep':
    'A connection uses an invalid output for its source step.',
  'errors.ai.duplicateConnectionsAreNotAllowed': 'Duplicate connections are not allowed.',
  'errors.ai.circularConnectionsAreNotSupportedUseARepeatStepInstead':
    'Circular connections are not supported. Use a Repeat step instead.',
  'errors.ai.aStepWithThatIdAlreadyExists': 'A step with that ID already exists.',
  'errors.ai.theStepToUpdateDoesNotExist': 'The step to update does not exist.',
  'errors.ai.theStepToRemoveDoesNotExist': 'The step to remove does not exist.',
  'errors.ai.aConnectionWithThatIdAlreadyExists': 'A connection with that ID already exists.',
  'errors.ai.theConnectionToUpdateDoesNotExist': 'The connection to update does not exist.',
  'errors.ai.theConnectionToRemoveDoesNotExist': 'The connection to remove does not exist.',
  'errors.ai.theProposedChangesAreIncompleteOrInvalidMessage': ({ message }: { message: string }) =>
    `The proposed changes are incomplete or invalid: ${message}`,
  'errors.ai.anAiRequestNeedsBetween1AndMessagesMessages': ({ messages }: { messages: string }) =>
    `An AI request needs between 1 and ${messages} messages.`,
  'errors.ai.chatMessagesMustHaveAUserOrAssistantRole':
    'Chat messages must have a user or assistant role.',
  'errors.ai.theLastChatMessageMustBeFromTheUser': 'The last chat message must be from the user.',
  'errors.ai.selectedStepsMustBeAnArrayOfStepIds': 'Selected steps must be an array of step IDs.',
  'errors.ai.selectedStepsMustIdentifyExistingStepsWithoutDuplicates':
    'Selected steps must identify existing steps without duplicates.',
  'errors.ai.thisWorkflowAndConversationAreTooLargeForAnAi':
    'This workflow and conversation are too large for an AI request.',
  'errors.ai.theAiAssistantReturnedAResponseThatIsTooLarge':
    'The AI assistant returned a response that is too large.',
  'errors.ai.theAiAssistantReturnedAnInvalidResponseTryAgain':
    'The AI assistant returned an invalid response. Try again.',
  'errors.ai.chooseASupportedAiProvider': 'Choose a supported AI provider.',
  'errors.ai.browserCredentialsRequireHttpsAndConfirmationOfThisServerOrigin':
    'Browser credentials require HTTPS and confirmation of this server origin.',
  'errors.ai.browserAiSettingsAreIncompleteOrInvalidSaveAComplete':
    'Browser AI settings are incomplete or invalid. Save a complete key and model pair.',
  'errors.ai.useBrowserAiSettingsForProviderCredentialsReserveAiHeaders':
    'Use browser AI settings for provider credentials; reserve ai.headers for application authentication.',
  'errors.ai.removeCredentialsFromYourConversationOrWorkflowBeforeSending':
    'Remove credentials from your conversation or workflow before sending.',
  'errors.ai.couldNotReachTheAiAssistantCheckTheConnectionAnd':
    'Could not reach the AI assistant. Check the connection and try again.',
  'errors.ai.aiServerRedirectsAreNotAllowedConfigureTheFinalHttps':
    'AI server redirects are not allowed. Configure the final HTTPS endpoint.',
  'errors.ai.theAiEndpointRejectedTheRequestCheckYourEndpointConfiguration':
    'The AI endpoint rejected the request. Check your endpoint configuration.',
  'errors.ai.thisProviderIsUnavailableInTheCurrentExecutionModeSave':
    'This provider is unavailable in the current execution mode. Save its configuration in AI Settings.',
  'errors.ai.theAiAssistantIsBusyTryAgainInAMoment':
    'The AI assistant is busy. Try again in a moment.',
  'errors.ai.theAiAssistantIsNotConfiguredOrIsTemporarilyUnavailable':
    'The AI assistant is not configured or is temporarily unavailable.',
  'errors.ai.checkYourApiKeyAndModelInAiSettings': 'Check your API key and model in AI Settings.',
  'errors.ai.theAiRequestFailedTryAgainOrCheckAiSettings':
    'The AI request failed. Try again or check AI Settings.',
  'errors.ai.theAiServerReturnedAnUnsafeResponseNoChangesWere':
    'The AI server returned an unsafe response. No changes were applied.',
  'errors.ai.theAiAssistantTookTooLongToRespondTryAgain':
    'The AI assistant took too long to respond. Try again.',
  'errors.picker.enterAWebsiteUrl': 'Enter a website URL.',
  'errors.picker.enterAnHttpOrHttpsWebsiteUrl': 'Enter an http:// or https:// website URL.',
  'errors.picker.useAWebsiteUrlWithoutEmbeddedCredentials':
    'Use a website URL without embedded credentials.',
  'errors.picker.theWebsiteIsNotReadyYet': 'The website is not ready yet.',
  'nodes.trigger.description':
    'Starts the workflow when a selected event occurs. Use it to respond to page activity or visitor actions.',
  'nodes.http.description': 'Sends an HTTP request to an API. Use it to call an external service.',
  'nodes.dom.description':
    'Updates matching elements on the page. Use it to change content, appearance, or visibility.',
  'nodes.cookie.description':
    'Saves a cookie on this website. Use it to remember a value for later steps or visits.',
  'nodes.delay.description':
    'Pauses the workflow before continuing. Use it to space out connected steps.',
  'nodes.fork.description':
    'Chooses a path based on a condition. Use it to tailor the workflow to the visitor or page.',
  'nodes.loop.description':
    'Repeats connected steps. Use it to run the same sequence more than once.',
  'nodes.popover.description':
    'Displays a panel over the page. Use it to show a message or an embedded website.',
  'nodes.note.description':
    'Adds text to the canvas. Use it to document ideas, context, or reminders.',
  'nodes.frame.description':
    'Groups nodes on the canvas so they move together. Use it to organize related parts of a workflow.',
  'nodes.trigger.label': 'Trigger',
  'nodes.http.label': 'HTTP request',
  'nodes.dom.label': 'Update element',
  'nodes.delay.label': 'Delay',
  'nodes.fork.label': 'Condition',
  'nodes.loop.label': 'Loop',
  'nodes.popover.label': 'Popover',
  'nodes.cookie.label': 'Set cookie',
  'nodes.note.label': 'Note',
  'nodes.frame.label': 'Frame',
  'triggers.thePageLoads': 'The page loads',
  'triggers.thisWorkflowStartsOnceThePageIsReady': 'This workflow starts once the page is ready.',
  'triggers.anElementIsClicked': 'An element is clicked',
  'triggers.startsEachTimeAVisitorClicksTheSelectedElementOr':
    'Starts each time a visitor clicks the selected element or anything inside it.',
  'triggers.anElementIsHovered': 'An element is hovered',
  'triggers.startsEachTimeThePointerMovesOntoTheSelectedElement':
    'Starts each time the pointer moves onto the selected element or one of its child elements. Moving between child elements can trigger it again.',
  'triggers.aFormIsSubmitted': 'A form is submitted',
  'triggers.startsEachTimeTheSelectedFormIsSubmittedChooseThe':
    'Starts each time the selected form is submitted. Choose the form as the target element.',
  'triggers.anInputChanges': 'An input changes',
  'triggers.startsWhenAVisitorCommitsAChangeToTheSelected':
    'Starts when a visitor commits a change to the selected field, such as choosing an option, toggling a checkbox, or leaving a text field after editing it.',
  'triggers.anElementIsZoomedInto': 'An element is zoomed into',
  'triggers.startsOncePerPinchOrCtrlWheelZoomInGesture':
    'Starts once per pinch or Ctrl+wheel zoom-in gesture over the selected element or anything inside it. Ordinary scrolling and zooming out are ignored.',
  'triggers.anElementIsSwiped': 'An element is swiped',
  'triggers.startsOnceWhenAFingerOrPenSwipeBeginsOn':
    'Starts once when a finger or pen swipe begins on the selected element or anything inside it and finishes at least 50 px away within one second, in any direction. Taps, slow drags, pinches, and cancelled gestures are ignored.',
  'triggers.exitIntention': 'Exit intention',
  'triggers.startsOnceWhenTheMouseLeavesThroughTheTopOf':
    'Starts once when the mouse leaves through the top of the page, toward the browser controls. For visitors using a mouse.',
  'triggers.rageClicking': 'Rage clicking',
  'triggers.detectsRapidClicksInTheSameAreaAnywhereOnThe':
    'Detects rapid clicks in the same area anywhere on the page. Each matching group of clicks starts the workflow.',
  'triggers.clickCount': 'Click count',
  'triggers.clickTimeWindowMs': 'Click time window (ms)',
  'triggers.clickRadiusPx': 'Click radius (px)',
  'triggers.inactivity': 'Inactivity',
  'triggers.startsAfterNoPointerKeyboardTouchOrScrollActivityRuns':
    'Starts after no pointer, keyboard, touch, or scroll activity. Runs once per idle period and resets when activity resumes. Pauses in hidden tabs.',
  'triggers.inactivityDurationMs': 'Inactivity duration (ms)',
  'triggers.scrollThrashing': 'Scroll thrashing',
  'triggers.detectsRapidUpDownDirectionChangesWhileScrollingThePage':
    'Detects rapid up/down direction changes while scrolling the page. Small movements are ignored. Each matching group starts the workflow.',
  'triggers.directionChanges': 'Direction changes',
  'triggers.scrollTimeWindowMs': 'Scroll time window (ms)',
  'triggers.minimumScrollTravelPx': 'Minimum scroll travel (px)',
  'triggers.scrollDownThreshold': 'Scroll down threshold',
  'triggers.startsOnceWhenTheVisitorScrollsDownToThisPercentage':
    'Starts once when the visitor scrolls down to this percentage of the page’s scrollable distance. 100% means the bottom of the page.',
  'triggers.scrollThreshold': 'Scroll threshold (%)',
  'validation.unsupportedTrigger': 'Choose a supported trigger event.',
  'validation.triggerRange': ({ label, min, max }: { label: string; min: number; max: number }) =>
    `${label} must be a whole number between ${min} and ${max}.`,
  'validation.aWorkflowMustContainArraysOfStepsAndConnections':
    'A workflow must contain arrays of steps and connections.',
  'validation.everyStepMustHaveAnIdTypeLabelAndConfiguration':
    'Every step must have an ID, type, label, and configuration object.',
  'validation.everyConnectionMustHaveAnIdSourceTargetAndValid':
    'Every connection must have an ID, source, target, and valid output handle.',
  'validation.invalidSelector': ({ value }: { value: string }) => `Invalid CSS selector: ${value}`,
  'validation.includeSubpagesMustBeABoolean': 'Include subpages must be a boolean.',
  'validation.thisWorkflowVersionIsNotSupported': 'This workflow version is not supported.',
  'validation.addATriggerAndAStepToGetStarted': 'Add a trigger and a step to get started.',
  'validation.addAtLeastOneTrigger': 'Add at least one trigger.',
  'validation.everyStepMustHaveAUniqueId': 'Every step must have a unique ID.',
  'validation.unknownStepType': 'Unknown step type.',
  'validation.nodesMustBelongToAnExistingTopLevelFrame':
    'Nodes must belong to an existing top-level frame.',
  'validation.frameDimensionsMustBePositiveNumbers': 'Frame dimensions must be positive numbers.',
  'validation.stepTextParametersMustContainStrings': 'Step text parameters must contain strings.',
  'validation.noteTextFormattingMustUseSortedNonoverlappingRangesWithinThe':
    'Note text formatting must use sorted, nonoverlapping ranges within the note text.',
  'validation.noteTextFormattingMustContainBooleanValues':
    'Note text formatting must contain boolean values.',
  'validation.noteColorsMustBeASixDigitHexColorOr':
    'Note colors must be a six-digit hex color or transparent.',
  'validation.chooseATargetElementForThisTrigger': 'Choose a target element for this trigger.',
  'validation.enterAValidHttpOrHttpsRequestUrl': 'Enter a valid HTTP or HTTPS request URL.',
  'validation.chooseASupportedHttpMethod': 'Choose a supported HTTP method.',
  'validation.headersMustBeAJsonObjectWithStringValues':
    'Headers must be a JSON object with string values.',
  'validation.chooseAnElementToUpdate': 'Choose an element to update.',
  'validation.chooseASupportedElementAction': 'Choose a supported element action.',
  'validation.enterAnAttributeName': 'Enter an attribute name.',
  'validation.delayMustBeBetween0And86400000Milliseconds':
    'Delay must be between 0 and 86,400,000 milliseconds.',
  'validation.chooseACssSelectorForTheBranchCondition':
    'Choose a CSS selector for the branch condition.',
  'validation.chooseDesktopOrMobileForTheDeviceCondition':
    'Choose desktop or mobile for the device condition.',
  'validation.enterALanguageCodeSuchAsEnEsOrEn': 'Enter a language code such as en, es, or en-US.',
  'validation.enterAValidReferrerDomainSuchAsExampleCom':
    'Enter a valid referrer domain such as example.com.',
  'validation.enterANameForTheConditionVariable': 'Enter a name for the condition variable.',
  'validation.enterAnExpectedValueForTheConditionAnEmptyString':
    'Enter an expected value for the condition (an empty string is allowed).',
  'validation.chooseASupportedConditionType': 'Choose a supported condition type.',
  'validation.repeatCountMustBeAnIntegerFrom1To1':
    'Repeat count must be an integer from 1 to 1,000.',
  'validation.chooseHtmlOrAnIframeForThePopoverContent':
    'Choose HTML or an iframe for the popover content.',
  'validation.chooseASupportedPopoverPosition': 'Choose a supported popover position.',
  'validation.enterAValidHttpOrHttpsUrlForThePopover':
    'Enter a valid HTTP or HTTPS URL for the popover iframe.',
  'validation.chooseAnAnchorElementForThePopover': 'Choose an anchor element for the popover.',
  'validation.popoverWidthMustBeBetween240And960Pixels':
    'Popover width must be between 240 and 960 pixels.',
  'validation.everyConnectionMustHaveAUniqueId': 'Every connection must have a unique ID.',
  'validation.aConnectionRefersToAMissingStep': 'A connection refers to a missing step.',
  'validation.notesCannotHaveWorkflowConnections': 'Notes cannot have workflow connections.',
  'validation.framesCannotHaveWorkflowConnections': 'Frames cannot have workflow connections.',
  'validation.triggersCannotReceiveIncomingConnections':
    'Triggers cannot receive incoming connections.',
  'validation.connectBranchesUsingTheYesOrNoOutputs':
    'Connect branches using the Yes or No outputs.',
  'validation.connectRepeatsUsingTheRepeatOrDoneOutputs':
    'Connect repeats using the Repeat or Done outputs.',
  'validation.circularConnectionsAreNotSupportedUseARepeatStepWith':
    'Circular connections are not supported. Use a Repeat step with separate Repeat and Done outputs.',
  'data.hint.1':
    'Strings: case-sensitive substring. Arrays: matching item (JSON or plain text; quote numeric strings, e.g. "42"). Objects: exact key.',
  'data.hint.2':
    'Uses the incoming type: numbers, true/false, exact case-sensitive text, or JSON for deep array/object equality. Numeric-looking strings stay text.',
  'data.hint.3':
    'Numeric comparison. Numbers and numeric strings are accepted only when both sides are valid finite numbers.',
  'data.hint.4':
    'Strings only. Enter a case-sensitive regular expression without / delimiters, e.g. ^premium or sale$.',
  'data.hint.5':
    'Empty means an empty string, array, or object. Whitespace, 0, and false are not empty. Null and missing data need their own checks.',
  'data.hint.6':
    'Exists includes null. Is null and Is not null require a resolved path; missing data matches neither.',
  'data.hint.7': 'Boolean data only; strings such as "true" are not booleans.',
  'data.hint.8': 'Strings only. Exact, case-sensitive text comparison.',
  'data.operator.equal': 'Equal',
  'data.operator.not-equal': 'Not equal',
  'data.operator.greater-than': 'Greater than',
  'data.operator.less-than': 'Less than',
  'data.operator.greater-than-or-equal': 'Greater than or equal',
  'data.operator.less-than-or-equal': 'Less than or equal',
  'data.operator.contains': 'Contains',
  'data.operator.not-contains': 'Does not contain',
  'data.operator.matches': 'Matches',
  'data.operator.not-matches': 'Does not match',
  'data.operator.starts-with': 'Starts with',
  'data.operator.ends-with': 'Ends with',
  'data.operator.is-empty': 'Is empty',
  'data.operator.is-not-empty': 'Is not empty',
  'data.operator.exists': 'Exists',
  'data.operator.not-exists': 'Does not exist',
  'data.operator.is-null': 'Is null',
  'data.operator.is-not-null': 'Is not null',
  'data.operator.is-true': 'Is true',
  'data.operator.is-false': 'Is false',
  'flow.node.a11yDescription.default':
    'Press enter or space to select a node. Press delete to remove it and escape to cancel.',
  'flow.node.a11yDescription.keyboardDisabled':
    'Press enter or space to select a node. You can then use the arrow keys to move the node around. Press delete to remove it and escape to cancel.',
  'flow.edge.a11yDescription.default':
    'Press enter or space to select an edge. You can then press delete to remove it or escape to cancel.',
  'flow.controls.ariaLabel': 'Control Panel',
  'flow.controls.zoomIn.ariaLabel': 'Zoom In',
  'flow.controls.zoomOut.ariaLabel': 'Zoom Out',
  'flow.controls.fitView.ariaLabel': 'Fit View',
  'flow.controls.interactive.ariaLabel': 'Toggle Interactivity',
  'flow.minimap.ariaLabel': 'Mini Map',
  'flow.handle.ariaLabel': 'Handle',
  'flow.nodeMoved': ({ direction, x, y }: { direction: string; x: number; y: number }) =>
    `Moved selected node ${direction}. New position, x: ${x}, y: ${y}`,

  'summary.chooseElement': 'Choose an element',
  'summary.pageLoad': 'When a visitor lands on your site',
  'summary.exitIntent': 'When a visitor intends to leave',
  'summary.rageClick': ({ count, seconds }: { count: number; seconds: number }) =>
    `${count} nearby clicks within ${seconds}s`,
  'summary.inactivity': ({ seconds }: { seconds: number }) => `After ${seconds}s of inactivity`,
  'summary.scrollThrashing': ({ count, seconds }: { count: number; seconds: number }) =>
    `${count} scroll reversals within ${seconds}s`,
  'summary.scrollDepth': ({ percent }: { percent: number }) => `Scroll down to ${percent}%`,
  'summary.elementEvent': ({ event, element }: { event: string; element: string }) =>
    `${event === 'zoom-in' ? 'Zoom in' : event === 'swipe' ? 'Swipe' : event} · ${element}`,
  'summary.http': ({ method, url }: { method: string; url: string }) => `${method}  ${url}`,
  'summary.configureUrl': 'Configure a URL',
  'summary.dom': ({
    action,
    element,
    incoming,
    path,
  }: {
    action: string;
    element: string;
    incoming: boolean;
    path: string;
  }) =>
    `${action === 'text' ? 'Change text' : action} · ${element}${incoming ? ` · Incoming data${path ? `: ${path}` : ''}` : ''}`,
  'summary.cookie': ({ name, value, days }: { name: string; value: string; days: number }) =>
    `${name} = ${value} · ${days ? `${days} days` : 'Session'}`,
  'summary.chooseCookie': 'Choose a cookie name',
  'summary.delay': ({ seconds }: { seconds: number }) => `Wait ${seconds} seconds`,
  'summary.data': ({ path, operator, value }: { path: string; operator: string; value: string }) =>
    `${path} · ${operator.toLowerCase()}${value ? ` ${value}` : ''}`,
  'summary.dataLabel': 'Data',
  'summary.time': ({ start, end, zone }: { start: string; end: string; zone: string }) =>
    `Time ${start}–${end} · ${zone === 'utc' ? 'UTC' : 'Visitor local'}`,
  'summary.date': ({ start, end, zone }: { start: string; end: string; zone: string }) =>
    `Within ${start} to ${end} · ${zone === 'utc' ? 'UTC' : 'Visitor local'}`,
  'summary.selector': ({ selector }: { selector: string }) => `${selector} exists on the page`,
  'summary.chooseSelector': 'Choose a selector',
  'summary.device': ({ value }: { value: string }) => `Device is ${value}`,
  'summary.language': ({ value }: { value: string }) => `Language is ${value}`,
  'summary.referrer': ({ value }: { value: string }) => `Referrer domain equals ${value}`,
  'summary.variable': ({ source, name, value }: { source: string; name: string; value: string }) =>
    `${source === 'cookie' ? 'Cookie' : 'URL parameter'} ${name} = ${value}`,
  'summary.chooseCondition': 'Choose a condition type',
  'summary.loop': ({ count }: { count: number }) => `Repeat ${count} times`,
  'summary.popover': ({ contentType, position }: { contentType: string; position: string }) =>
    `${contentType === 'iframe' ? 'Embedded page' : 'Custom HTML'} · ${position.replaceAll('-', ' ')}`,
  'summary.writeNote': 'Write a note…',
  'summary.frame': 'Move grouped nodes together',

  'website.exportTargetRequired':
    'Configure your website URL before exporting. The demo website is for preview only.',
  'aiSettings.activeProvider': ({ label }: { label: string }) => `Active provider: ${label}`,
  'aiSettings.apiKeyLabel': ({ provider, optional }: { provider: string; optional: boolean }) =>
    `${provider} API key${optional ? ' (optional)' : ''}`,
  'aiSettings.modelLabel': ({ provider }: { provider: string }) => `${provider} model ID`,
  'aiSettings.confirmDestination': ({ previous, next }: { previous: string; next: string }) =>
    `Saved destination: ${previous}. Allow this configuration to be sent to ${next} for this unlocked session?`,
  'nodeInspector.detailsHeading': ({ kind }: { kind: string }) => `${kind.toUpperCase()} DETAILS`,
  'nodeInspector.annotationOutputs': ({ kind }: { kind: string }) =>
    `No outputs. ${kind === 'note' ? 'Notes' : 'Frames'} organize the canvas and do not run workflow steps.`,
  'nodeInspector.dateRangeHelp': ({ zone }: { zone: string }) =>
    `True when the current date is within this range. Both dates are included, using ${zone === 'utc' ? 'UTC' : 'the visitor’s local time zone'}.`,
  'nodeInspector.timeRangeHelp': ({ zone }: { zone: string }) =>
    `Checks the current time using ${zone === 'utc' ? 'UTC' : 'the visitor’s local time zone'}. Both selected minutes are included. An earlier end time crosses midnight. Equal times match that one minute.`,
  'canvasChat.editsApplied': ({ count }: { count: number }) =>
    `${count} ${count === 1 ? 'edit' : 'edits'} applied · Undo on the canvas`,
  'canvasChat.unavailable': 'Unable to reach the AI assistant.',
  'websiteSetup.installInstructions': ({ filename }: { filename: string }) =>
    `Add this ${filename} script to your website’s pages to enable element selection and live previews.`,
  'websiteSetup.embeddingInstructions':
    'The website must also allow embedding via its CSP frame-ancestors and X-Frame-Options settings.',
  'aiSettings.privacy':
    'Your API key is stored encrypted in this browser’s localStorage. When you use the AI assistant, it is sent to the configured application AI server over HTTPS, which contacts the selected provider without saving it. It is never included in your published site or workflow exports.',

  'aiSettings.storageUnavailable':
    'Browser settings cannot be read. Restore storage access or remove the damaged settings before using AI.',
  'aiSettings.providerDamaged':
    'This provider’s browser settings are damaged. Remove or replace its configuration.',
  'canvasChat.selectedStep': ({ label }: { label: string }) => `Selected: ${label}`,
  'website.exportTargetFailure': ({ reason }: { reason: string }) =>
    `Configure your website URL before exporting. The demo website is for preview only. ${reason}`,
};
