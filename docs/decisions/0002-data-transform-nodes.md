# ADR 0002: Explicit Data Transform nodes

- Status: Accepted
- Date: 2026-10-02
- Updates input selection for [ADR 0001](0001-element-template-variables.md); element template interpolation remains accepted.

## Decision

Field extraction and transformation are explicit workflow operations. Connections represent data flow and retain only their ordinary names and graph endpoints. The node inspector no longer has Incoming mappings, and connection inspectors no longer configure source paths or destination inputs.

Data Transform uses `kind: 'transform'` with `dataPath` and an ordered `transformations` list. It reuses the project's property/index path parser. Empty paths select the root; an empty transformation list performs extraction only. Its output replaces the incoming value for all downstream steps. It supports capitalize, lowercase, uppercase, title case, whitespace trimming, prefix, suffix, literal replacement of all matches, and a typed JSON fallback for missing or null data. Text operations require strings. Missingness, explicit null, and empty strings remain distinct in extraction, preview, fallback, and downstream execution. Invalid paths, parameters, and input types report errors before downstream steps execute.

The same self-contained transform factory powers editor previews, runtime execution, and exported scripts. Config is preserved through JSON and frontend/server AI transport, validation, and semantic fingerprints. AI tools author explicit transform nodes rather than mappings. Runtime connection samples remain transient and bounded; the transform inspector displays each incoming sample separately. Transform edits retain those input samples and invalidate downstream samples. Operation keys remain in inspector memory and never enter saved workflow config.

## Discarded alternative: Connection-owned data mappings

The previous approach stored field selection in `edge.data.mapping` with a `sourcePath` and a `targetInput` of `data`, `value` (Update element), or `condition` (Incoming data conditions). Each outgoing connection could select independently. General data mappings replaced the data received and forwarded by the destination; value and condition mappings selected only what the destination consumed while preserving the original incoming data downstream. Imported HTTP paths used a compatibility `responseDataPath` field before source selection. The connection inspector and the destination node's Incoming mappings section edited the same mapping, with canvas labels and previews exposing the selection.

This approach kept per-connection selections close to routing, but placed executable data-selection behavior on connections and split configuration between connection and node inspectors. Separate consumed-value and forwarded-data scopes also made downstream behavior harder to follow. Adding transformations there would further hide workflow operations in connection settings. We discard connection-owned mappings in favor of visible Data Transform nodes that own extraction and ordered transformations together, with one explicit output for downstream steps. Connections carry data unchanged. The tradeoff is additional nodes on the canvas and manual review when migrating mappings that previously preserved the original downstream data.

## Compatibility and migration

`migrateDataTransforms` is non-mutating and idempotent. Editor load, restore, import, preset application, and commits use it. It inserts transform nodes for legacy edge mappings and active node paths, maintaining labels, branch handles, frame coordinates, sibling independence, and unrelated edge data. Imported HTTP paths become JSON-only transforms to preserve text/error bypass behavior, followed by ordinary extraction when a consumer also selected a field. Disconnected active selections become explicit nodes so future connections can use them. Dormant selections are reported for review. The old migration export aliases this implementation for callers.

Old `value` and `condition` mappings could consume a selection and forward the original object. An explicit transform cannot preserve that behavior automatically when the consumer has downstream connections and selects a non-root field. Such transforms keep a persistent migration warning explaining the path and old/new forwarding behavior. Inactive or incompatible mappings also require review. Validation, preview execution, and export block until the user reviews the destination/downstream config and confirms it, or rewires the flow. A warning is not silently cleared by unrelated edits or reloads.

Direct runtime and export normalize legacy edge mappings at their boundaries. For compatibility, programmatic consumers of legacy node fields still use the existing node helpers until their workflows pass through editor migration. New saved editor configurations contain explicit transform nodes and no mapping fields. Exported runtime source contains only execution modules; editor migration and frame layout logic are excluded.

## Validation

Focused coverage includes nested/root/array extraction, missing/null/empty/false/zero distinctions, every operation, operation order, typed fallback, incompatible types, literal replacement, Unicode text, direct/exported downstream conditions and HTTP templates, sibling paths, overlapping invocations, JSON/AI persistence, inspector history, previews, and safe/manual migration cases.
