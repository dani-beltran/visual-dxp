# AI Settings verification

The implementation adds endpoint-gated AI Settings with the existing Canvas/Activity tab pattern. The original sibling `dlb-dxp-server` project and `.env.local` were not changed.

## Automated coverage

- `tests/ai-settings-ui.test.tsx`: explicit endpoint gating (including whitespace and saved settings), `showSettings: false`, preserved storage, keyboard wrapping/Home/End, masking, destination/privacy text, and assistant unlock/lock/remove.
- `tests/ai-settings.test.ts`: real Web Crypto AES-GCM encryption/decryption, fresh salt/IV, passphrase failure, authenticated origin metadata, reload/lock, cancellation, removal, storage read/write/remove errors, unavailable crypto, origin confirmation/revocation, and separation from exports. Transport tests cover dedicated headers, application auth separation, HTTPS/relative-origin rejection before fetch, redirects, malformed overrides, and reflected-secret suppression.
- `tests/server/browser-ai.test.ts`: concurrent users and request precedence, unchanged environment, server-default restoration, independent application authorization, rate limits, origin/TLS/incomplete-pair rejection, safe errors/responses, and fixed OpenAI-only traffic with tracing/debug/remote configuration enabled.
- `tests/server/agent.test.ts`: browser and server-default requests both exercise the real multi-step workflow tool loop against a mock OpenAI Responses endpoint; the remote LangGraph path retains its original contract. Browser overrides share the same schemas and mutation handlers but never invoke LangGraph/Runnable tracing or checkpoints.
- Existing chat, Undo, stale-response, export, runtime, condition, and trigger suites remain passing. Preview tests now execute the isolated bridge over a simulated source/origin-checked transport; picker tests reject incorrect origins, sources, and stale navigation channels.

All 697 tests passed. TypeScript, the Vite library/declaration build, the Next production build, and the production HTTP smoke test passed. Lint passed with existing warnings. Repository-wide `npm run check` still reports ten pre-existing formatting/import-order errors in untouched note, workflow-validation and test files; the changed files pass the focused check. No unrelated formatting changes were retained.

## Browser verification

The local builder was inspected in the Codex browser: AI Settings appears after Activity, uses the existing colors and controls, masks key/passphrase inputs, displays the configured origin, and warns that an HTTP endpoint cannot receive browser credentials. The default workflow executed successfully inside the `sandbox="allow-scripts"` preview, including its delay, condition, popover, and execution log. The settings screenshot is saved in `output/ai-settings.png`.

Tests use fake keys and mock provider responses. No real OpenAI key was transmitted and no live provider/account validation was performed.

## Deployment checks

Operators must provision HTTPS, application session/workflow authorization (or the documented trusted gateway), credential redaction before logs/traces/replay ingestion, no-store proxies, a shared quota for multi-instance hosting, and separate builder/published-site origins. These external controls cannot be verified from this source checkout. See [AI integration](ai-integration.md) for the exact header contract, authorization adapter, TLS termination, redaction requirements, sandbox limitations, and privacy text.
