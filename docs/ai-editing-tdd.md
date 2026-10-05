# AI trigger editing regression record

All behavior changes began with focused failing tests. Dependencies were initially reused from the existing checkout; Vitest's `--configLoader runner` avoided writing its config cache into that checkout. They were later copied into this worktree because Turbopack rejects external dependency symlinks. No dependency manifest or lockfile changed. Missing dependencies and the initial cache permission error were setup issues and did not count as red runs.

| Cycle | Behavioral red evidence | Green verification |
| --- | --- | --- |
| Configuration ownership | `tests/server/trigger-edits.test.ts`: 4 failures. Malformed trigger add/update payloads returned `ok: true`; server and client accepted newly supplied inactive/cross-kind fields. | Shared ownership checks added only to AI writes; 9 relevant suites, 224 tests passed. Historical configuration remains editable. |
| Trigger conversion | Trigger editing and runtime suites: 4 failures. Rage-click settings and selector survived conversion in both replay paths. | Shared event-change normalization; 6 relevant suites, 107 tests passed. Transport/replay agree, same-event patches remain partial, selectors remain required, and runtime defaults remain 4/2000/50. |
| Mutation progress | Trigger editing suite: 2 failures. Tool results lacked `changed` and resulting state; equivalent nested configuration was staged again. | Semantic comparison and target state results; 5 relevant suites, 92 tests passed. Note formatting, metadata and position changes still stage operations. |
| Agent loop and classification | `tests/server/agent-progress.test.ts`: 4 failures across mocked streaming/non-streaming responses. Repeated read/update calls reached a success response; invalid mutations were mislabeled `provider_failed`. | One no-op correction opportunity per normalized mutation, then rejection without progress; explicit edit failure codes. Agent/provider/streaming suites: 53 tests passed. Different edits and meaningful repeats remain allowed. |
| Failure transport | Agent progress suite: 6 failures. Streaming omitted codes, the client mislabeled JSON edit errors as credential failures, and recognized codes could carry unsafe upstream messages. | Fixed code-to-message mapping through HTTP and client paths; 6 relevant suites, 122 tests passed. Raw errors and credentials are never reflected by the new reporting paths. |
| Catalog defaults | Trigger editing suite: 1 failure. Copying the catalog's page-load defaults into `add_node` supplied an inactive selector and was rejected by the new ownership check. | Catalog responses now expose applicable defaults, matching node creation. Trigger editing and agent suites: 22 tests passed. |

Each red run used `npx vitest run --configLoader runner` with the indicated test files, before its production change. Green runs included the focused tests and related compatibility suites. Assertions were corrected during green verification for a runtime movement sequence and a mutable mocked message reference; both initial red runs had already demonstrated the intended production failures.

Additional deterministic tests cover successful selected-trigger edits, client replay matching the server draft, empty final output, interrupted generation, cancellation after staging, and the existing 90-second HTTP deadline with fake timers and a provider that ignores cancellation. These existing failure boundaries required no production behavior changes. No live LLM or real timeout was used.

## Final verification

| Command | Result |
| --- | --- |
| `npm test` | Passed: 65 files, 1492 tests, including 33 new tests. The initial sandboxed full run could not open the existing OTLP test's local receiver; the final run passed with local-listener access. |
| `npm run typecheck` | Passed. |
| `npm run build` | Passed with standard Turbopack after copying dependencies into the worktree. |
| `npm run build:lib` | Passed: ESM, UMD, declarations and CSS. |
| `node tests/export-library.mjs` | Passed: 48 targeting, HTTP/conditions, experiments and analytics cases. |
| `npm run smoke` | Passed: production HTTP, mocked chat, validation/error boundaries, public assets and disconnect cancellation. |
| `npm run lint` | Passed with existing non-blocking style warnings. |
| `npx biome check` on the 13 changed TypeScript files | Passed, with 16 existing warnings. All new files pass without warnings. |
| `npm run check` | Three pre-existing errors in untouched files: formatting in `src/components/VisualDXPBuilder.tsx` and `src/components/WebsiteConnectionCheck.tsx`, import ordering in `tests/server/workflow.test.ts`. Verified these files have no diff against the starting commit. |
| `git diff --check` | Passed. |

Compatibility is deliberately scoped: AI writes enforce ownership and explicit trigger event changes normalize configuration; imports and manual inspector edits keep their existing rules. The existing operation transport is unchanged. Historical inactive fields remain editable until an event change removes inapplicable configuration. Read-only loops retain the existing 40-turn cap; the new policy targets repeated unchanged mutations. Generic remote deployment/provider failures retain their existing sanitized reporting.
