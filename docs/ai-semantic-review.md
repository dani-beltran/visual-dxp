# Final workflow review

The editing harness reviews both technical validity and whether the resulting workflow makes sense for the user's intent. A graph that validates can still measure the wrong milestone, take an unintended branch, repeat an effect, or pass the wrong data downstream.

## Completion flow

1. Tools stage requested operations in a private draft.
2. The harness finalizes [local structural layout](ai-layout.md), including any required position operations in the same batch. `applyWorkflowOperations` replays and validates the batch using the existing graph/configuration rules. Existing unrelated validation issues retain their existing policy; validation findings are also supplied to the reviewer, so it must not claim a clean pass when issues remain.
3. A separate, read-only model call receives the original workflow, actual final draft, staged changes, conversation, selected nodes, branding context, technical findings, workflow versions, and supported runtime behavior. It also receives concise experiment/analytics facts and per-experiment evidence derived with the runtime's assignment-key function. It does not receive the editor's proposed final answer and has no editing tools.
4. The harness parses and validates the structured review. It checks bounded fields, referenced node IDs, required questions, completion status, and credentials before accepting it.
5. Implementation errors return the draft to the editor. Design concerns and missing context become explanations and proposals, without applying an alternative.
6. Only an accepted review allows `workflow-ready` and the reviewed response to reach the client. The existing canvas fingerprint check still rejects applying a batch if the user changed the canvas during the request.

This gate covers ordinary text completion, `finish_workflow`, and the supported local-model textual finish marker. A finish tool in a parallel batch waits until every mutation in that batch has been processed. Failed/unresolved tool calls cannot reach commitment. Every structural repair runs layout again before technical validation and review. Every repair receives a new review of the resulting draft; there is no reusable stale review cache.

All direct providers and the repository's LangGraph deployment use this harness. Redeploy the graph when updating a remote deployment; the proxy cannot add semantic review to an older external graph.

## What the review checks

The reviewer evaluates intent, reachability and branch meaning, execution order, incoming data, failure paths, repeated triggers, redundant effects, and analytics timing. Findings must connect concrete behavior to a consequence and a supported alternative. They should prioritize the requested changes and their effects, without turning a narrow edit into unrelated cleanup.

Read-only explanation requests, including “what is this workflow?”, receive a factual explanation with no proposal unless the supplied graph demonstrates a material defect or essential missing context needed to answer. Optional custom keys, personalization, and unobserved website timing are not missing requirements. The same rule applies to suggestions hidden in the summary. A supported edit explicitly accepted by the user remains permitted.

The reviewer receives concise runtime facts independently of the longer editing prompt:

- Empty experiment keys use the stable node ID. LocalStorage assignments persist within the visitor browser and website origin; runtime memory is the fallback when storage is unavailable. Workflow versions and redeployments alone do not change the bucket.
- Changing the key selects a different bucket without migrating or clearing the old one. The new bucket can reuse an existing assignment. Changing traffic splits affects only new assignments.
- Each experiment invocation selects A or B exclusively. Variant paths targeting the same headline are intentional, not evidence that both paths execute.
- Notes never execute or collect analytics. Displaying a headline/popover is exposure, not a confirmed conversion; tracking should follow a signal that actually confirms the milestone.

`experimentFacts` supplies each draft experiment's current and previous storage keys, whether its storage key changed, whether it uses the node-ID fallback, traffic percentages, and branch targets. Storage keys come from the same helper used by runtime assignment. Node IDs, keys and other authored text remain untrusted data.

The structured result contains:

- `summary`: concise user-facing response in the user's language.
- `findings`: up to five entries containing `category`, `nodeIds`, `evidence`, `consequence`, and `alternative`.
- `question`: an approval or clarification question when design/context findings exist; empty for a passing review.

Categories control the next step:

| Category | Meaning | Harness behavior |
| --- | --- | --- |
| `implementation` | The editor did not implement an explicit user requirement | Return findings for repair, then validate and review again |
| `design` | The requested behavior itself has a material problem | Commit the technically valid requested changes, explain the issue, and ask whether to implement the alternative |
| `context` | Essential facts are unknown | State the uncertainty and ask a focused question; do not invent facts or apply a guessed alternative |

Two semantic repair opportunities are allowed per request, separate from the existing tool-argument correction budget. Persistent implementation errors fail without committing. Invalid JSON, malformed findings, unknown node references, interrupted generations, unavailable review providers, and unsafe outputs also fail closed. Reviews use the selected provider/model and existing cancellation, timeout, output-token, and telemetry settings. No fallback model is introduced.

## User-facing behavior

Editor text is withheld until review finishes. Reasoning summaries still use the existing progress channel. The final answer is assembled from validated review fields, so an additional explanation call cannot omit the findings or silently replace the recommendation. A passing review gives a brief summary without unnecessary suggestions.

For example:

> I created the requested workflow. One issue: “purchase completed” fires when the offer appears, so it would count offer views as purchases. I recommend tracking “offer viewed” here and tracking purchases from a confirmed purchase signal. Would you like me to make that change?

No proposed purchase-tracking alternative is included in the committed operation batch. A later explicit approval starts a new editing request.

## Approval and changed canvases

Responses with findings include optional `reviewProposal` metadata: the readable proposal and a SHA-256 digest of the canonical reviewed workflow. Client/server parsers preserve this bounded metadata; CanvasChat retains it in assistant history. It is context, not an executable patch or proof of authorization.

On follow-up, the harness provides the proposal and current workflow version to the editor, and the reviewer receives the actual current baseline and its version. Instructions require explicit user acceptance, rereading the current workflow, reassessing changed versions, and asking again when scope or consequences materially changed. Operations are newly generated and validated against the current canvas; stale operations are never replayed. Metadata is untrusted and cannot itself authorize a change. This is a model-mediated conversational approval flow, not a cryptographic approval protocol.

History is bounded and session-local. If a proposal is no longer in chat history, the assistant must obtain enough context from the user rather than assume an old approval.

## Limits and verification

Review adds one model call to a normal completion, with additional calls for bounded repairs. It is an assessment based on supplied evidence, not a guarantee of business correctness or a live website/API execution. Unknown response shapes, selectors, external events, and business goals must remain explicit uncertainties. Category accuracy and recommendation quality still depend on the model.

`tests/server/semantic-review.test.ts` exercises the real review parser and harness with mocked model outputs: all completion paths, finish/edit batching, bounded repairs, unapplied alternatives, proposal transport, changed-canvas context, missing information, invalid results, and technical failures. Existing provider/tool-loop tests isolate the reviewer and retain their original provider responsibilities. Streaming tests assert that unreviewed final text is withheld while reasoning and observability continue to work.


The headline experiment regression tests verify the supplied facts and review/commitment behavior for the explanation and accepted custom-key edit. Runtime tests verify storage-key parity and persistence across restarts/redeployment and reporting version changes, including exported scripts. These deterministic tests do not establish model factual accuracy.

For real-model checks, configure the existing server provider environment and run:

```sh
DXP_PROVIDER_EVAL=1 pnpm exec vitest run tests/server/experiment-review-provider.test.ts tests/server/experiment-key-provider.test.ts
```

These evaluations are skipped in normal CI and make real provider requests. The review grounding evaluation runs the reviewer and a separate semantic judge against explicit runtime facts. A grounded positive control and schema-valid negative controls cover false version/reset claims, invented branch conflicts, notes as tracking, and exposure described as conversion. Generated-review cases cover the headline experiment explanation, tracking questions, and the accepted key edit. The judge checks meaning across all response fields, including suggestions in summaries, rather than relying on keyword matches. As a model-based evaluation, its results are evidence rather than a proof of correctness; an unavailable provider is a validation limitation, not a passing evaluation.
