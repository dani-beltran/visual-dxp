# Multi-provider AI verification

The implementation updates the active Next.js backend in `src/server/ai/` and `/api/ai/*`. The sibling `visual-dxp-server` project and `.env.local` were not edited.

## Automated coverage

- `tests/ai-settings-ui.test.tsx`: endpoint gating, main and compact settings, provider tab semantics/keyboard navigation, active badge independent of viewed tab, unsaved fields, save-and-activate, failed-save preservation, saved activation without key re-entry, local optional authentication, masking, origin/privacy text, unlock/lock/remove.
- `tests/ai-settings.test.ts`: real Web Crypto encryption, fresh salt/IV, reload locking, invalid passphrases, origin binding/confirmation, storage failures, cancellation, secret-free exports, reserved headers and redirect protection.
- `tests/ai-providers-settings.test.ts`: genuine v1 ciphertext migration, separately persisted selection/navigation/configurations, three independent configurations, local keyless operation without Web Crypto, optional key encryption, provider/destination authentication, cross-tab changes, failed saves preserving pending requests, same-provider removal, and isolated damaged-record recovery.
- `tests/server/providers.test.ts`: actual AI SDK provider serialization against mocked OpenAI Responses, Anthropic Messages and OpenAI-compatible Chat Completions APIs. Every provider reads workflow state, stages a note, receives its tool result and returns the existing contract. Covers concurrent provider credentials, server defaults, optional local authentication, malformed headers, unauthorized destinations, explicit loopback allowances, fixed cloud URLs, upstream errors/redirects, missing local tools, rejected later mutations, truncation, bounded loops, reflected credentials, cancellation, and unsupported remote combinations.
- `tests/server/agent.test.ts` and `browser-ai.test.ts`: existing OpenAI editing/connection behavior, request isolation and privacy (`store: false`), remote graph contract, origin protection and rate limits.
- `tests/chat.test.tsx`: atomic edit/Undo behavior, stale-canvas protection, tab browsing during a pending request, and cross-tab activation cancelling and rejecting a late response even when the mocked fetch ignores cancellation.

The full test suite passes: **773 tests across 36 files**. `npm run typecheck`, the Next production build and Vite library/declaration build pass. `npm run lint` passes with warnings; the focused Biome check reports no errors in changed implementation/test files. `git diff --check` passes. The production HTTP smoke test passes for the page, static assets, health, mock remote chat, missing configuration, malformed inputs, origin/method enforcement, upload limits, and disconnect cancellation.

## Browser inspection

The running application was inspected in the Codex browser at desktop size and 390 × 844. Provider icons, active/viewed separation, local server guidance, responsive tab wrapping, scrollable forms, and compact assistant settings were checked. An expanded-settings layout issue was fixed so the composer remains visible; the active provider remains visible in shorter assistant panels. No provider requests were sent from this inspection.

## Limits of verification

Provider HTTP responses and credentials in automated tests are fixtures. No live OpenAI, Anthropic, Ollama or LM Studio model/account was tested. Compatibility depends on the actual local model honoring tool choice and producing valid workflow calls; the application checks basic tool capability at request time and fails without committing partial edits. Saving settings validates format/storage, not connectivity.

Self-Hosted accepts any HTTP(S) model server URL reachable from the backend, including remote hosts and private network addresses; localhost is rewritten to 127.0.0.1 without DNS resolution. Remote LangGraph supports OpenAI server defaults only; other server-default provider selections fail explicitly, while all browser configurations use direct execution. Deployment HTTPS, ingress authentication if required, proxy credential redaction and network policies remain operator responsibilities. See [AI integration](ai-integration.md) and [execution modes](langchain.md).
