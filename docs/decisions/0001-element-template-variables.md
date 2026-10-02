# ADR 0001: Update element uses template variables

- Status: Accepted for templates; connection selection is superseded by [ADR 0002](0002-data-transform-nodes.md)
- Date: 2026-10-01

## Decision

Remove the Use incoming data toggle. Update element content is always editable for actions that consume a value. Resolve `{{name}}`, nested paths (`{{user.name}}`, `{{items[0].price}}`), and `{{$}}` (the entire mapped input) at execution time. Optional whitespace inside braces is allowed. `$.name` and `$[0]` explicitly select from the input root. Multiple variables may be mixed with literal text.

Support variables in the selector for all seven actions, and in the attribute name for Set attribute. Hide and Show have no content value; they use variables through their selector. The Uses incoming data badge, socket color, node summary, and default connection input derive from variables in active fields. Inactive content/attribute fields do not enable the badge. Removing the last variable removes the badge automatically.

At introduction, connections selected the input scope and controlled forwarding. Templates composed the node's content from that scope without changing data forwarded to later nodes. For example, a connection could map `user` to Element value with content `Hello {{name}}`, or map `user.name` with content `Hello {{$}}`. General data mappings replaced forwarded data, while Element value mappings preserved the original data downstream. [ADR 0002](0002-data-transform-nodes.md) replaces connection selection with explicit Data Transform nodes; templates continue composing content from the incoming value without changing it downstream.

## Rationale and alternatives

The toggle forced users to choose between a constant and an entire incoming value. Variables allow natural composition, multiple values, and a single consistent content editor. Keeping a toggle alongside variables would create conflicting activation states. Activation is therefore derived, with no new persisted boolean.

A node may reference fields within its received input when composing content. Operators, actions, and static settings remain on nodes. Source selection was initially stored on connections; [ADR 0002](0002-data-transform-nodes.md) records that discarded alternative and the move to explicit Data Transform nodes. No expressions, JavaScript evaluation, loops, or recursive expansion are introduced.

## Runtime behavior

The browser runtime, exported scripts, and server validators use matching interpolation rules. String/number/boolean values render as text; null/missing content variables render as empty text. Arrays/objects render as JSON except CSS class actions, where arrays of strings join with spaces and unsupported compound values fail. HTML actions continue interpreting the resulting content as HTML. Returned data containing braces is inserted literally, with no second interpolation pass.

Invalid or unfinished placeholders produce configuration errors. Selectors are checked after interpolation at runtime; static selectors retain editor validation. Missing/null selector or attribute-name variables fail before mutation, rather than selecting an unintended fallback target. Hide/Show ignore dormant content, including its malformed variables.

## Compatibility

The builder first runs `migrateDataTransforms`, as described in [ADR 0002](0002-data-transform-nodes.md), then `migrateElementTemplates`. Legacy incoming-data nodes become content templates, usually `{{$}}`, and lose the legacy valueSource/valueDataPath fields. Active legacy paths become explicit Data Transform nodes. Legacy manual nodes retain their content and lose the obsolete mode fields. Inactive manual fallback text from an incoming-data node is replaced by its active incoming-value template, since there is no longer a mode to switch back to. Dormant Hide/Show content remains inactive. Unknown legacy modes remain validation errors.

Both migrations are non-mutating and idempotent. Initial state, browser restoration, import, presets, and committed edits use them. Programmatic direct runtime/export callers can continue supplying old version-1 JSON. AI tools accept templates as normal string configuration; their instructions discourage writing deprecated mode/path fields.

## Validation

Tests cover substitution, nested paths, root values, repeated variables, null/missing/false/zero handling, one-pass expansion, malformed syntax, class conversion, required selector variables, each action in direct/exported runtime, preserved downstream data, migration, synchronized incoming-data indicators, removal of the toggle, undo, and server tool/transport validation. Built ESM/UMD tests also exercise migrated templates.

Verification on 2026-10-01 after integrating HTTP request templates from main: type checking, lint (no errors), Next production build, and Vite library build passed. All 70 focused template/mapping/HTTP/builder tests passed, including direct and exported execution combining migrated response selection, connection mappings, HTTP request templates, and element templates. The full suite passed 1,242 tests with seven pre-existing failures (AI settings UI, AI error copy, preset loop timing, condition summary copy, and export-scope copy). Built ESM and UMD exports passed 20 targeting cases and 24 data-flow cases, including migrated templates.
