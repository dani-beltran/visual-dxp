# Same-origin AI integration

The Next.js App Router serves the demo and `/api/ai/*` in one process. `src/server/ai/` contains the Vercel AI SDK Core provider factory, shared tool loop, workflow validation, and optional remote LangGraph deployment graph. The original `visual-dxp-server` directory is untouched and is not needed to build, test, or run this application.

## Local setup

```sh
npm install
cp .env.example .env.local
# Set OPENAI_API_KEY in .env.local, or save a key and model in AI Settings.
npm run dev
```

Open http://127.0.0.1:3000. `OPENAI_MODEL` defaults to `gpt-6-luna`. See [execution and deployment setup](langchain.md) for remote execution. Claude uses ANTHROPIC_API_KEY and ANTHROPIC_MODEL; Self-Hosted uses the settings below. Restart after changing environment variables. Browser AI Settings updates apply immediately and never change these files. The demo no longer reads `VITE_DXP_AI_ENDPOINT`; old Vite settings can be removed from your local environment. Do not copy secrets into any public variable.

The demo passes exactly:

```tsx
<VisualDXPBuilder ai={{ endpoint: '/api/ai/chat', credentials: 'same-origin' }} />
```

Open **AI chat** next to Canvas Help. Each request includes the latest workflow and selected node IDs plus recent conversation. A complete valid operation batch is applied in one history commit; one Undo restores all of it, and Redo reapplies it. If the canvas changes while a request is pending, the response is rejected. Chat history stays in memory. Closing chat preserves an ongoing request; Stop and unmount cancel it.

The library remains reusable without Next.js or a backend. Other hosts can pass their own endpoint, `credentials`, and application authentication/CSRF `headers`. These settings are browser-visible: never use provider or LangSmith credentials in ai.headers or workflow configuration. Browser provider keys use the encrypted AI Settings interface and reserved transport headers described below. The integrated API intentionally supports only same-origin hosting.

## HTTP contract

The client sends `POST` to the configured endpoint with JSON and expects a JSON response. Public TypeScript types are exported from `visual-dxp`:

```ts
import type { AIChatRequest, AIChatResponse } from 'visual-dxp';
```

The request contains:

- `messages`: recent `{ role: 'user' | 'assistant', content: string }` messages, ending with the current user message.
- `workflow`: the current version-1 `Workflow`, containing its name, website URL, nodes, and edges.
- `selectedNodeIds`: IDs of currently selected nodes.

The response contains a nonempty `message` and an `operations` array. For example, when the current workflow contains a node with ID `welcome`:

```json
{
  "message": "Renamed the step to Welcome back.",
  "operations": [{ "type": "update_node", "id": "welcome", "label": "Welcome back" }]
}
```

An empty operations array represents a conversational reply. Supported operations are `add_node`, `update_node`, `remove_node`, `add_edge`, `update_edge`, and `remove_edge`; see `WorkflowOperation` in `src/lib/ai.ts` for their fields. Updates merge supplied node configuration fields. Removing a node also removes its connections. The client validates the entire resulting workflow before applying any changes.

Requests support up to 40 messages, 500 nodes, and 1,000 connections. Responses allow up to 100 operations. Browser request and response bodies are limited to 1 MB, and requests time out after 120 seconds. The UI handles unauthorized (`401`/`403`), busy (`429`), and unconfigured or unavailable (`503`) responses without displaying raw server error bodies.

## Server boundary

Both routes declare `runtime = 'nodejs'` and `dynamic = 'force-dynamic'`. The Next entry imports a `server-only` HTTP module; no standalone HTTP listener starts in Next. The agent tools and JSON workflow modules are also usable by the standalone LangGraph runner, so they do not import the Next-only marker. Import server code only through server entrypoints; the public library entry and declaration build exclude it.

The chat route requires the exact `application/json` media type (parameters such as charset are accepted). It checks Content-Length as an early rejection, then counts actual streamed bytes and cancels the reader above 1,048,576 bytes, even when the header is missing or incorrect. Body reading and provider work share a 90-second server deadline. The frontend timeout remains 120 seconds. Request aborts propagate to the model/deployment and cancel upload reading. The deadline returns even if a provider ignores cancellation. Timers and listeners are removed on completion.

Requests, response shapes, and the complete proposed operation batch are validated before success. Server validation is DOM-independent and supports frames and child coordinates; the browser performs its existing additional selector validation and validates again before committing. Tools operate on private drafts and never execute workflows, browse target URLs, or publish anything.

| Status | Meaning |
| --- | --- |
| 200 | Valid `{ message, operations }` response |
| 400 | Malformed JSON, invalid request/graph/selection, or contract limit |
| 403 | Disallowed origin or fetch metadata |
| 409 | Unsupported provider/remote execution combination |
| 422 | Provider request/tool capability failure or invalid tool operation; no changes or fallback |
| 429 | Application request quota exceeded |
| 405 | Unsupported HTTP method (provided by Next) |
| 413 | Wire body exceeds 1 MiB |
| 415 | Unsupported content type |
| 499 | Request cancelled; a disconnected browser generally receives no response |
| 502 | Provider failure, malformed provider output, or invalid operation batch |
| 503 | Missing local key or invalid deployment URL configuration |
| 504 | Server deadline exceeded |

Chat and health responses set `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`. Provider error bodies and stack traces are not sent to the browser. Expected configuration errors use safe messages. The health response contains only `{ configured: boolean, mode: 'local' | 'deployment' }`. `configured` means a nonempty local key or deployment URL exists; it does not check a URL's reachability, required deployment credentials, or credential validity.

## Production hosting

```sh
npm run build
npm start
```

Deploy as a Node application, not a static export. Set secrets in the hosting environment. Configure the host's request duration above the 90-second application deadline; the chat route declares a 120-second `maxDuration` hint, but hosting platforms may impose shorter limits. The default command binds to 127.0.0.1. For a container or public listener behind your access controls, use `npm start -- --hostname 0.0.0.0`. Port can be set with `PORT` or `--port`.

The API requires an exact Origin match against the request protocol and Host, rejects cross-site/same-site fetch metadata, and does not grant cross-origin CORS access. A trusted reverse proxy must preserve the public Host and set the request protocol correctly (including trusted `X-Forwarded-Proto` for TLS termination). `X-Forwarded-Host` is not used for origin authorization. The old cross-origin `AI_ALLOWED_ORIGIN` setting is unused.

The chat API does not require app login, a session, or an application token in any environment, including production. Both server-configured provider credentials and browser overrides work without application authentication. `AI_APPLICATION_TOKEN` is no longer used. Origin checks still reject requests from other browser origins; non-browser callers may omit Origin.

The server allows **20 chat requests per IP address per 60-second window** using Cloudflare's `CF-Connecting-IP` header by default. IPv6 spellings are normalized, including IPv4-mapped addresses. Each IP has an independent quota; users sharing a public IP share that quota. Missing or invalid IPs share an `unknown` bucket. The API returns 429 when the quota is exhausted.

Keep the origin reachable only through Cloudflare (for example, a Cloudflare Tunnel or origin firewall rules). The App Router does not expose the socket peer, so it cannot verify that a header came from Cloudflare itself. Never expose the origin directly while trusting this header. `X-Forwarded-For` is not used as a fallback. Cloudflare must preserve its visitor-IP header; keep Pseudo IPv4 off or in Add Header mode to retain real IPv6 addresses. See [Cloudflare's header documentation](https://developers.cloudflare.com/fundamentals/reference/http-headers/).

`AI_RATE_LIMIT_IP_HEADER` can override the header name for another trusted proxy that overwrites it with a single IP. An empty setting disables header trust and uses the shared unknown bucket. Comma-separated chains, ports, and scoped IPv6 values are rejected. Local requests without the proxy header share the fallback quota.

Counters live in memory and expire after 60 seconds or a process restart. Multi-instance deployments need shared storage or a Cloudflare rate-limit rule for a deployment-wide quota. Do not cache `/api/ai/*` at any proxy.

See [migration and verification](migration.md) for checks and reproducible mock smoke testing.


## Browser settings protocol and precedence

With an explicit nonempty endpoint, `showSettings` defaults to true. Set `ai.showSettings: false` to hide only the tab. With no endpoint both the tab and assistant are absent and no AI request occurs, regardless of localStorage contents. No environment setting or default URL enables the library's AI features. See README for embedding examples.

The active provider is independent of the viewed settings tab. OpenAI is the default for new and existing users. Opening a tab or editing a field changes no request configuration. **Save and activate** validates format, encrypts any key, and atomically persists the configuration and selection before activation. It does not test upstream connectivity. Failed saves preserve the previous selection and effective settings. **Activate saved configuration** uses an already unlocked configuration without key re-entry. Locked providers must be unlocked first. Compact assistant settings share the same store and controls.

The active badge indicates selection, not connectivity. Locked/damaged settings block requests. With no browser configuration, only that provider’s server defaults are considered; absence or rejection is an actionable error, never a fallback to another provider. Removing a configuration preserves provider selection. Server-side credentials are intended only for development and debugging and are not advertised or selectable in the product UI.

| Header | Value | Logging policy |
| --- | --- | --- |
| `X-DXP-AI-Provider` | `openai`, `claude`, or `local`; omitted legacy requests mean OpenAI | Non-secret |
| `X-DXP-AI-Override` | `browser` when using saved browser configuration | May log presence only |
| `X-DXP-OpenAI-Key` / `X-DXP-OpenAI-Model` | OpenAI browser key/model; legacy protocol retained | Always redact key |
| `X-DXP-AI-Key` / `X-DXP-AI-Model` | Claude or Local browser key/model | Always redact key |
| `X-DXP-AI-Base-URL` | Local provider base URL only | Prefer omission |

The local key header is absent when authentication is not configured. Cloud keys and model IDs are mandatory for browser overrides. The server also accepts generic key/model headers for OpenAI but rejects mixing the legacy and generic pairs, or using OpenAI headers with another provider. Incomplete overrides, unknown providers, and cloud destination overrides fail before provider work. All of these headers are reserved and cannot be supplied via `ai.headers`.

The body remains `{ messages, workflow, selectedNodeIds }`, and the response remains `{ message, operations }`. Provider configuration never enters workflow data. No application authorization is required; quotas and same-origin checks still apply. Raw provider errors and reflected credentials are never returned. Responses are `no-store`.

Browser settings bind to the application API’s origin. HTTPS is required except on localhost, 127.0.0.1, or [::1]. Changing that origin requires confirmation for the unlocked session. Browser and upstream fetches reject redirects, including same-origin redirects. A trusted TLS terminator must correctly reconstruct the request URL and keep credential-bearing hops encrypted.

### Provider execution and development/debugging defaults

Direct execution uses explicit request-scoped instances of `@ai-sdk/openai`, `@ai-sdk/anthropic`, and `@ai-sdk/openai-compatible` with AI SDK Core `generateText`; no AI Gateway is required. The lockfile pins a compatible stable SDK 7 family (Core 7.0.118, OpenAI 4.0.78, Anthropic 4.0.65, OpenAI-compatible 3.0.57). Provider clients, keys and drafts are never shared or changed globally.

| Provider | Fixed API / protocol | Same-provider server defaults |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1/responses`, `store: false`, encrypted reasoning continuation | `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-6-luna`); existing optional LangGraph mode |
| Claude | `https://api.anthropic.com/v1/messages` | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (both required) |
| Self-Hosted | Allowlisted base URL + `/chat/completions` | `LOCAL_LLM_BASE_URL`, `LOCAL_LLM_MODEL`, optional `LOCAL_LLM_API_KEY` |

Browser overrides replace the complete configuration for their selected provider. An empty local browser key means no authentication, even if server environment keys exist. No cross-provider credential mixing, model mixing, or retry/fallback occurs. Cloud environment base URL overrides are ignored.

All direct execution uses one bounded loop (40 model calls, at most 100 calls per turn, at most 100 staged mutations, 8,192 output tokens per call, no automatic retries, 2 MiB per upstream response). It adapts the existing tool schemas and private mutation functions. Local models must honor a forced `read_workflow` call first. An endpoint/model that rejects tools or ignores that choice fails clearly. Unknown tools, malformed arguments, invalid mutations, truncation, cancellation and exhausted bounds discard the entire batch, including earlier staged edits. There is no partial commit. A capability check demonstrates basic tool calling, not comprehensive model quality.

AI SDK telemetry is explicitly disabled for all direct executions. Browser credentials never enter LangGraph state/checkpoints or LangSmith. If `LANGGRAPH_API_URL` is set, OpenAI server-default requests retain the existing stateless remote contract; Claude/Local server-default requests return 409. Browser configurations for all providers still execute directly. See [remote deployment](langchain.md).

### Local model setup

Start an OpenAI-compatible runtime and load a model that supports tool calls. For example:

```dotenv
# Explicit exact base URLs; no implicit localhost permission or wildcards.
AI_LOCAL_ALLOWED_BASE_URLS=http://127.0.0.1:11434/v1,http://127.0.0.1:1234/v1
# Optional development/debugging defaults:
LOCAL_LLM_BASE_URL=http://127.0.0.1:11434/v1
LOCAL_LLM_MODEL=your-installed-tool-capable-model
LOCAL_LLM_API_KEY=
```

Ollama commonly exposes `/v1` on port 11434; LM Studio commonly uses port 1234. Enter the actual base URL and loaded model ID in **Self-Hosted**, then save and activate. Model IDs are editable and accept repository-style IDs and runtime tags. Model availability and tool support depend on the runtime and model; compatible API formatting alone is insufficient.

The model base URL is separate from the browser’s application endpoint (`/api/ai/chat`). It must be reachable from the **application backend**. Localhost identifies the backend machine/container, not the visitor’s computer. Hosted Next servers normally cannot reach a model running on a visitor’s laptop.

The server canonicalizes URLs and compares the entire base URL against `AI_LOCAL_ALLOWED_BASE_URLS`. The default allowance is empty, including loopback. It rejects credentials, queries, fragments, unsupported protocols, unauthorized paths/ports/hosts, and redirects. Only server administrators can change the allowlist. Allow only model servers you control; an allowed hostname’s DNS and network destination must also be administrator-controlled (the application does not pin DNS answers). Do not allow metadata services or arbitrary user-controlled hosts. Set network egress restrictions appropriate to the deployment.

## Encryption and isolation

The historical `visual-dxp-ai-settings-v1` localStorage key now holds a version-2 document with `activeProvider`, `viewedProvider`, and independent provider records. Non-secret records hold model, application origin, and optional local base URL. A credential envelope holds 16 random salt bytes, 12 random IV bytes and AES-GCM ciphertext. Keyless local configurations contain no credential envelope and require neither a passphrase nor Web Crypto.

Legacy version-1 OpenAI envelopes are read without alteration, defaulting both selection fields to OpenAI. The next successful store write atomically wraps the legacy envelope in version 2, preserving its ciphertext and original authenticated metadata. It remains decryptable with the existing passphrase. New keys use AES-256-GCM with a non-extractable Web Crypto PBKDF2-HMAC-SHA-256 key, 600,000 iterations, and fresh salt/IV. Version-2 authenticated data binds provider, model, application origin and local destination; moving ciphertext to another provider/destination invalidates decryption. No API key or passphrase is persisted in plaintext or exposed in React snapshots.

Reload locks encrypted credentials. Lock/pagehide/unmount/disabling AI clear in-memory keys and origin confirmations. Saved effective configuration changes and provider activation cancel pending requests; a final abort check prevents a late response from applying edits even if fetch ignores cancellation. Browsing tabs and unsaved edits do not cancel requests. Cross-tab navigation preserves unlocked keys; cross-tab configuration replacement clears the changed provider’s key and cancels requests only if it affects the active configuration. Storage failures block requests, failed writes preserve previous saved state, and damaged provider records can be replaced/removed without deleting healthy provider records. Hiding the main settings screen preserves configuration; the assistant offers the same controls.

Workflow JSON, exports, previews, activity entries, URLs and graph/checkpoint inputs do not receive the settings store. Demo/fullscreen/picker frames use `sandbox="allow-scripts"` without `allow-same-origin`, creating a separate opaque origin even for a resource served under the builder's URL. No credentials are sent via postMessage. Inbound parent messages check exact builder origin and source; inbound iframe messages check the iframe Window, origin `null`, protocol and random channel. Outbound messages to opaque origins necessarily use `*` and contain only credential-free workflow/picker data. Published sites must be hosted on a distinct origin; different paths or storage prefixes are not isolation. Do not host untrusted executable content as a top-level page on the builder origin.

> Your API key is stored encrypted in this browser’s localStorage. When you use the AI assistant, it is sent over HTTPS to the configured AI server, which uses it to contact the selected provider without saving it. It is never included in your published site or workflow exports.

Origin isolation prevents ordinary cross-origin storage/DOM access. It cannot protect an unlocked key from malicious builder scripts, compromised same-origin dependencies, or privileged extensions. JavaScript string memory cannot be reliably overwritten; locking removes references. Encryption does not make a weak passphrase resistant to offline guessing. There is no passphrase recovery.

## Required deployment redaction

Before enabling browser credentials in production, configure the entire request path to omit `X-DXP-OpenAI-Key`, `X-DXP-AI-Key`, upstream `X-Api-Key` (including lowercase/reformatted variants), Authorization, Cookies and all provider Authorization headers. Prefer allowlisting safe metadata such as request ID, status and duration. Disable raw request/header/body capture in reverse proxies, load balancers, APM, OpenTelemetry HTTP instrumentation, error reporters, analytics and browser session replay; exclude the key/passphrase fields from replay. Redaction must run before ingestion, not only in a log viewer. Disable caching and request/response recording for `/api/ai/*`.

The application does not log credentialed requests or SDK errors, and the browser override tool loop does not invoke tracing/checkpoint frameworks. Host-installed instrumentation runs outside this code and must be configured by the operator. Never persist browser keys in databases, files, caches, sessions, queues, or checkpoints. Restrict outbound traffic to the fixed cloud HTTPS APIs and administrator-approved local model servers. For custom cross-origin servers, allow only exact trusted builder origins and required headers. The supplied Next API deliberately supports same-origin requests only.
