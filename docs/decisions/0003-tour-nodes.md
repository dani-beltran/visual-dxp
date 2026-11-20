# ADR 0003: Tour nodes reuse Popover behavior

- Status: Accepted
- Date: 2026-11-17

## Decision

A Tour is one node, `kind: 'tour'`, whose `config.tourSteps` is an ordered list of popover settings. Each step has exactly the fields that configure a Popover node (`contentType`, `content`, `url`, `position`, `selector`, `width`, `popoverAnimation`), typed as `PopoverSettings`. Optional `tourNextLabel`, `tourPreviousLabel` and `tourDoneLabel` replace the visitor-facing button text. Steps have no IDs, following `PageChange` lists: their order is their identity. The node has one output. It continues when the visitor finishes (**Done**) or closes the tour, passing incoming data through unchanged.

Because a step *is* a popover configuration, Popover code is shared rather than copied:

| Concern | Shared implementation | What Tour adds |
| --- | --- | --- |
| DOM, styles, close button, iframe sandboxing | `createPopoverElements` | Optional control row (progress and buttons), used only when controls are passed |
| Display, placement, anchors, scroll/resize tracking, animations, form interception, replacement, cleanup | `showPopover` | `controls` parameter: the popover settles when a control is chosen; optional focus of the primary control; optional scrolling of an out-of-view anchor into view (tours only, because a popover that appears on its own should not move the page) |
| Step sequencing | — | `runTour`: loops over steps through `showPopover`, keyed by the tour node ID so each step replaces the previous one |
| Validation | `popoverIssues` (extracted from the Popover case) | Runs per step, prefixing messages with `Step N:` |
| Settings form | `PopoverSettingsFields` (extracted from `PopoverEditorPanel`) | Bound to the selected step, with a Tour-specific form hint |
| Fullscreen editor: draft, undo/redo, device, picking, discard, live preview, Save | `PopoverEditorDialog` (extracted from `PopoverPreview`) | Step list, button labels, and the preview start step |
| Inspector summary labels | `popoverLabels.ts` (replaces inline maps in `NodeInspector`) | Step positions in the step list |

To support the Tour without changing Popover behavior, `showPopover` now distinguishes how a popover closed: the close button settles with `action: 'close'`, while replacement or runtime destruction settles without an action. Popover nodes treat both as dismissal, as before. Tours continue downstream after a visitor closes them, but end silently when replaced. Otherwise a second run of the same trigger would release the first run's downstream steps.

Editor previews open at the selected step through a preview-only runtime option, `tourStartSteps`, carried by the preview bridge message in the same way as `searchParams`. It is never stored in the workflow or exported.

## Where duplication remains, and why

- **Runtime button defaults.** `runTour` repeats the literals Next, Previous and Done that `tourButtonDefaults` exports to the editor. Runtime modules are serialized with `Function.prototype.toString()` into exported scripts and cannot reference module-scope values. A test asserts that both stay equal.
- **Bridge payload sanitizing.** `installPreviewBridge` defines its own `startSteps` check inline for the same serialization reason.
- **Server AI model.** `src/server/ai/workflow` keeps a parallel copy of the node model and validator. Tour support there is limited to the kind, the fields and parsing, using the shared `isTourSteps` from `src/lib/tour.ts`. The Tour semantic checks were not copied into the server validator: AI tools cannot write Tour configuration (see below), and the client re-validates every AI proposal with the full validator.

## Discarded alternatives

- **A Tour as a chain of Popover nodes with a "wait for Next" mode.** Steps would be scattered on the canvas, Previous would need backward edges (the graph rejects cycles), and "continue only when the tour ends" could not be expressed by a single node.
- **Copying the Popover editor and runtime for Tours.** This would mean two copies of placement, animation, form interception and cleanup that must stay in sync.
- **A persisted `startStep` config field for previews.** It would leak an editor concern into exported runtime configuration.

## AI authoring

AI tools preserve, read, connect, move, relabel and remove tours. They do not create tours or edit steps or labels. The policy for `tour` exposes no writable fields, the `add_node`/`insert_node` schemas do not list it, and the system prompt explains this. Authoring nested step lists needs its own tool schema and prompt guidance (for example, anchored step arrows), evaluated against real providers like other AI behavior. Without this support, any workflow containing a tour would have been rejected by AI request parsing and by `applyWorkflowOperations`.

## Validation

Runtime coverage includes navigation, progress, Previous/Next/Done availability, custom and blank labels, focus movement, close versus completion, data pass-through, replacement by a newer run, destruction, anchors and missing anchors, forms within steps, preview start steps, and exported scripts. Editor coverage includes the inspector, previewing the selected step through the serialized bridge, step add/reorder/delete with selection tracking, undo, per-step validation blocking Save, per-step anchor picking, and canvas save/undo. AI coverage includes client/server parsing, fingerprints, relabeling, and rejected authoring.
