export const tutorialEnglish = {
  'tutorial.website.custom': ({ url }: { url: string }) =>
    `Workflows add experiences to a target website. Open the website control and save the practice target: ${url}. Your host provides this practice website and its preview bridge.`,
  'tutorial.restoreContent':
    'The default HTML changed. Use Undo to restore it, or delete this Popover and add a new one from the library.',
  'tutorial.selectSource': 'Select source node',
  'tutorial.chooseSource': 'Choose a source node',
  'tutorial.untitled': 'Untitled workflow',
  'tutorial.entry': 'Interactive tutorial',
  'tutorial.resume': 'Interactive tutorial · Resume',
  'tutorial.replay': 'Interactive tutorial · Replay',
  'tutorial.progress': ({ current, total }: { current: number; total: number }) =>
    `Step ${current} of ${total}`,
  'tutorial.back': 'Back',
  'tutorial.continue': 'Continue',
  'tutorial.exit': 'Exit',
  'tutorial.keepEditing': 'Keep editing',
  'tutorial.ready': 'Ready to continue',
  'tutorial.pending': 'Complete the instruction to continue',
  'tutorial.intro.title': 'Build your first digital experience.',
  'tutorial.intro.body': 'Name your workflow “My first workflow.” using the workflow name field.',
  'tutorial.intro.about':
    'A Digital Experience Platform (DXP) helps teams create, manage, and personalize experiences across digital channels. Visual DXP focuses on website experiences: you connect triggers and actions in a visual workflow to decide what visitors see and when.',
  'tutorial.intro.exercise':
    'You’ll build a workflow that shows a popover after a short delay, test it on the demo website, and discover tools to help you create more.',
  'tutorial.intro.orientation':
    'Build on the canvas, add steps from the node library at its top left, and select a node to open the settings inspector on the right. Exit at any time; your work stays on the canvas.',
  'tutorial.learnMore': 'About DXP and the editor',
  'tutorial.website.title': 'Choose the demo website',
  'tutorial.website.body':
    'Workflows add experiences to a target website. Open the website control, leave its demo input empty, and save. The included /demo-site.html needs no credentials or installation.',
  'tutorial.website.open': 'Choose website',
  'tutorial.website.demo': 'Use demo website',
  'tutorial.trigger.title': 'Add a trigger',
  'tutorial.trigger.body':
    'A trigger determines when the workflow starts. Click Trigger in the node library or drag it onto the canvas.',
  'tutorial.event.title': 'Confirm page load',
  'tutorial.event.body':
    'Select your Trigger and inspect Start when. Choose The page loads, then confirm below. This starts the workflow when the target page loads.',
  'tutorial.confirmEvent': 'Confirm page load',
  'tutorial.showSettings': 'Show node settings',
  'tutorial.delay.title': 'Wait one second',
  'tutorial.delay.body':
    'Add a Delay and open its settings. Set Wait for to 1000 ms (1 second). This controls the wait before showing the popover.',
  'tutorial.popover.title': 'Add a popover',
  'tutorial.popover.body':
    'Add Popover from the library and open its settings. A popover displays content over the website. Look at HTML content and Position; keep the default HTML content and all other settings unchanged for this exercise.',
  'tutorial.connect.title': 'Connect the workflow',
  'tutorial.connect.body':
    'Move the nodes apart on the canvas. Drag from the output circle on the right of Trigger to the input circle on the left of Delay, then connect Delay to Popover. For keyboard access, select each source node and use Connect to in its inspector.',
  'tutorial.connectionHint': 'Trigger → Delay → Popover',
  'tutorial.test.title': 'Test your workflow',
  'tutorial.test.body':
    'Open Test workflow. Opening the preview does not run it: press Run workflow inside. After about one second, the default popover should appear over the demo website.',
  'tutorial.openTest': 'Test workflow',
  'tutorial.result.title': 'Your popover worked',
  'tutorial.result.body':
    'Build and test complete! Look at the visible popover and its Success entry in the execution log. Restart runs the workflow again; Stop ends the run and removes its effects. Close the preview to return to the editor and discover more tools.',
  'tutorial.closePreview': 'Return to editor',
  'tutorial.ai.title': 'Discover AI chat',
  'tutorial.ai.body':
    'Open AI chat. Ask AI to generate a popover for any content you need—a promotion, announcement, newsletter invitation, or something else. It can use the target website’s branding to keep the result on brand.',
  'tutorial.ai.example':
    '“Create a popover announcing our autumn collection, using this website’s branding.”',
  'tutorial.ai.branding':
    'Branding is used only when a matching website profile has been captured by the website connection check. Your own site needs the Visual DXP bridge configured for this editor. The built-in demo does not capture a branding profile. No message or generation is needed here.',
  'tutorial.ai.unavailable':
    'AI uses a configured assistant endpoint. If it is unavailable, configure or unlock a provider in AI Settings, or ask the host to configure the service. You can continue without credentials or a request.',
  'tutorial.help.title': 'Discover Canvas Help',
  'tutorial.help.body':
    'Open Canvas Help to inspect guidance on adding, arranging, configuring and connecting nodes, canvas controls, and keyboard shortcuts. Return here any time to resume or replay this interactive tutorial.',
  'tutorial.export.title': 'Discover workflow export',
  'tutorial.export.body':
    'Open Export workflow. JavaScript exports a standalone script for your target website; Workflow JSON saves an editable definition. Copy and Download are available for export. Inspect the options, then close the dialog; no download is required. The demo is for practice: real deployment requires configuring and validating your intended website target.',
  'tutorial.openExport': 'Open export',
  'tutorial.closeExport': 'Close export',
  'tutorial.presets.title': 'Discover Presets',
  'tutorial.presets.body':
    'Open Presets. Presets are editable starting points for common website experiences. Explore the available examples listed below. Applying a preset replaces the workflow name, nodes and connections as an undoable edit, keeping the website target. Inspect them without applying one to keep your work.',
  'tutorial.finish.title': 'You built a digital experience',
  'tutorial.finish.body':
    'You created nodes, configured a page-load trigger and a one-second delay, connected the workflow and tested the default popover. Keep building with the tools you just explored. Canvas Help is always the place to return to this tutorial.',
  'tutorial.recovery':
    'A prerequisite changed. Return to the indicated step to repair it; your work is preserved.',
  'tutorial.repair': 'Review required step',
  'tutorial.runtimeError':
    'The preview could not complete this run. Check the execution log, confirm the demo website and required settings, then reload the preview and run again.',
  'tutorial.reset.title': 'Start a new tutorial?',
  'tutorial.reset.body':
    'Your canvas contains work. Save a copy using workflow export before resetting. Starting over clears the canvas in one undoable edit. Cancel keeps everything unchanged.',
  'tutorial.restart': 'Reset canvas and start',
  'tutorial.backup': 'Save workflow JSON',
  'tutorial.mismatch.title': 'Review saved tutorial progress',
  'tutorial.mismatch.body':
    'This workflow differs from the saved tutorial. Resume and repair missing steps on this canvas, or start over after saving your current work.',
  'tutorial.resumeRepair': 'Resume and repair',
  'tutorial.startOver': 'Start over…',
  'tutorial.workflowName': 'Workflow name',
  'tutorial.connectTo': 'Connect to',
  'tutorial.chooseTarget': 'Choose a target node',
  'tutorial.connectAction': 'Connect nodes',
  'tutorial.backupNote':
    'Workflow JSON preserves this canvas, including its practice or unfinished website target. JavaScript deployment requires a valid production target.',
};
