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

This approach kept per-connection selections close to routing, but placed executable data-selection behavior on connections and split configuration between connection and node inspectors. Separate consumed-value and forwarded-data scopes also made downstream behavior harder to follow. Adding transformations there would further hide workflow operations in connection settings. We discard connection-owned mappings in favor of visible Data Transform nodes that own extraction and ordered transformations together, with one explicit output for downstream steps. Connections carry data unchanged. The tradeoff is additional nodes on the canvas.

## Compatibility

The app has not been deployed to production. Legacy connection mappings, node selection fields, migration warnings, and migration entry points are removed. Editor load, imports, runtime, and exports use explicit Data Transform nodes and element templates directly. HTTP nodes forward the complete parsed JSON or text response; conditions compare their whole incoming value. No automatic conversion or JSON-only extraction mode is provided.

## Validation

Focused coverage includes nested/root/array extraction, missing/null/empty/false/zero distinctions, every operation, operation order, typed fallback, incompatible types, literal replacement, Unicode text, direct/exported downstream conditions and HTTP templates, sibling paths, overlapping invocations, JSON/AI persistence, inspector history, previews.
