# ADR 0001: Connections own data mappings

- Status: Accepted; the manual/incoming toggle is superseded by [ADR 0002](0002-element-template-variables.md).
- Date: 2026-10-01

## Context

Data paths previously lived in HTTP (`responseDataPath`), element-update (`valueDataPath`), and condition (`conditionDataPath`) node configuration. Selecting a source value for a destination is a relationship between steps. Node-level paths made independent outgoing selections harder to discover and made reusable nodes depend on upstream response structure.

## Decision

Store mappings in `edge.data.mapping`:

```json
{
  "sourcePath": "user.name",
  "targetInput": "value"
}
```

`sourcePath` uses the existing property/index syntax. `targetInput` is `data`, `value` (DOM steps), or `condition` (fork steps). A data mapping replaces incoming/forwarded data. A value or condition mapping selects only the value consumed by that step and preserves the original incoming data downstream. Each incoming edge invokes the target separately; this feature does not introduce joins or multi-input aggregation. HTTP steps use the selected incoming data for their URL/body templates, then produce their own response. Nodes retain actions, operators, comparison constants, and manual/incoming value mode. Inactive value/condition inputs retain mappings and explain how to activate them.

Connections without mappings retain full pass-through behavior. A future extraction node may own its extraction path because selecting data is that node's explicit operation; no new extraction node is required for this change.

The connection inspector and destination node's Incoming mappings section share one controlled editor and update the same edge object through the builder's history and activity mechanism. Both views support the same selection, validation, and preview behavior. Derived canvas labels expose mappings without modifying user-supplied edge names; long paths are shortened on the canvas and remain fully editable in the inspector. Configured connections are highlighted.

## Alternatives and tradeoffs

Keeping paths on nodes is initially easy to find, but couples behavior to source structure and hides per-connection differences. Keeping them only on connections expresses ownership correctly but hides configuration behind thin lines. Duplicating configuration across nodes and edges creates synchronization and precedence problems. We choose connection ownership with a second editing entry point on the destination node and visible canvas labels.

General data selection deliberately changes downstream data. Element/condition selection deliberately preserves it. These separate inputs are necessary to migrate existing workflows without silently changing later steps. Users see the forwarding consequence beside the destination selector.

## Compatibility and migration

Workflow version remains 1 with additive optional edge data. `migrateConnectionMappings` is non-mutating and idempotent. The builder normalizes initial workflows, browser restoration, imports, presets, and committed edits. Direct runtime and export execution still accept legacy node settings for programmatic consumers.

- Active `valueDataPath` and `conditionDataPath` values move to every incoming connection's mapping, with the corresponding destination input.
- An HTTP `responseDataPath` moves to every outgoing mapping as the optional compatibility field `responseDataPath`. It runs before `sourcePath`, only for successful JSON responses. This preserves the old handling of non-JSON text, JSON string responses, missing values, null, and request-error payloads, including when a destination also had its own path.
- The compatibility field is visible and editable as Imported response selection. New mappings do not create it.
- Connected, migrated legacy fields are removed from node config. Unconnected or inactive consumer settings remain dormant until applicable connections/behavior exist, avoiding loss of saved configuration. Existing explicit edge fields take precedence in mixed documents.
- AI transport sanitizes and preserves semantic mapping fields; connection tools can create/update mappings and clear them with `data: {}`. Node-path fields remain accepted for legacy transport but new AI instructions direct mapping changes to connections.

JSON persistence, AI fingerprints, semantic validation, runtime execution, and standalone exports all include mappings. Presentation labels and preview samples are not semantic mapping data.

## Preview and validation

Path resolution retains `{exists, value}`, distinguishing absent data from explicit null, false, and zero. Path syntax and destination compatibility are validated without samples. When samples exist, the inspector uses the runtime's selection and conversion/comparison rules to identify incompatible values.

Runtime observers publish per-connection source samples. The isolated preview checks the frame, opaque origin, channel, execution identifier, edge ID, and sample shape. Samples larger than 32,768 serialized characters are omitted. Samples remain in builder memory only; they never enter workflow JSON, activity records, AI requests, or exported configuration. Starting another test or changing node behavior clears samples. A mapping edit keeps only its own unchanged source sample and clears other samples. A sample is the latest observed traversal, not a complete history of concurrent runs. External sites need the current preview bridge to provide samples; older bridges show unavailable previews.

## Validation

Focused tests cover sibling mappings, deliberate downstream replacement, consumed-value pass-through, direct/exported parity, combined HTTP/consumer migration, non-JSON responses, HTTP errors, migration idempotence, multiple incoming connections, disconnected/dormant settings, missing/null/scalar resolution, invalid paths/inputs, JSON and AI contracts, mapping fingerprints, synchronized inspector edits, undo/redo, and distinct preview states. Existing runtime and preview tests continue to exercise legacy contracts.

Verification on 2026-10-01: TypeScript, lint (no errors), Next production build, and Vite library build passed. The full suite passed 1,186 tests with seven failures also reproduced from unchanged HEAD (AI settings UI, AI error copy, preset loop timing, condition summary copy, and export-scope copy). All 101 focused mapping/runtime/preview/serialization/AI/history tests passed. Built ESM and UMD exports passed 20 targeting cases and 16 data-flow cases, including migrated mappings.
