# Same-origin AI integration

The Next.js App Router serves the demo and `/api/ai/*` in one process. `src/server/ai/` contains the copied LangChain agent, tools, workflow validation, and optional remote deployment graph. The original `dlb-dxp-server` directory is untouched and is not needed to build, test, or run this application.

## Local setup

```sh
npm install
cp .env.example .env.local
# Set OPENAI_API_KEY in .env.local, or save a key and model in AI Settings.
npm run dev
```

Open http://127.0.0.1:3000. `OPENAI_MODEL` defaults to `gpt-6-luna`. See [LangChain and deployment setup](langchain.md) for remote execution and tracing. Restart after changing environment variables. Browser AI Settings updates apply immediately and never change these files. The demo no longer reads `VITE_DXP_AI_ENDPOINT`; old Vite settings can be removed from your local environment. Do not copy secrets into any public variable.

The demo passes exactly:

```tsx
<VisualDXPBuilder ai={{ endpoint: '/api/ai/chat', credentials: 'same-origin' }} />
```

Open **AI chat** next to Canvas Help. Each request includes the latest workflow and selected node IDs plus recent conversation. A complete valid operation batch is applied in one history commit; one Undo restores all of it, and Redo reapplies it. If the canvas changes while a request is pending, the response is rejected. Chat history stays in memory. Closing chat preserves an ongoing request; Stop and unmount cancel it.

The library remains reusable without Next.js or a backend. Other hosts can pass their own endpoint, `credentials`, and application authentication/CSRF `headers`. These settings are browser-visible: never use provider or LangSmith credentials in ai.headers or workflow configuration. Browser provider keys use the encrypted AI Settings interface and reserved transport headers described below. The integrated API intentionally supports only same-origin hosting.

## HTTP contract

The client sends `POST` to the configured endpoint with JSON and expects a JSON response. Public TypeScript types are exported from `dlb-dxp`:

```ts
import type { AIChatRequest, AIChatResponse } from 'dlb-dxp';
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
| 422 | Browser provider key/model rejected or local tool loop failed; no fallback |
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

An unlocked browser override supplies all three reserved headers:

| Header | Value | Logging policy |
| --- | --- | --- |
| `X-DXP-AI-Override` | `browser` | May log the presence of an override only |
| `X-DXP-OpenAI-Key` | The unlocked key | Always redact/omit, case-insensitively |
| `X-DXP-OpenAI-Model` | User-selected model ID | Prefer omission from request logging |

The body remains exactly `{ messages, workflow, selectedNodeIds }`. A missing marker, missing key/model, invalid characters or empty fields yields 400 before provider work. No application authorization is required; quota failures yield 429. Provider rejection yields a safe 422 with no fallback; clients should prompt the user to check/unlock/update their settings. Raw provider errors and reflected keys are never returned. Responses are `no-store`.

For browser overrides, relative endpoints resolve against the real builder origin; HTTPS and the saved/confirmed destination origin are checked before constructing the credential-bearing request. Browser and OpenAI fetches use `redirect: 'error'`. Configure the final HTTPS URL; even same-origin redirects are rejected. The server verifies its effective request URL is HTTPS, with HTTP allowed only on localhost, 127.0.0.1, or [::1] for local use. The trusted TLS terminator must correctly reconstruct that URL, strip untrusted forwarding headers, and keep all credential-bearing hops encrypted. Do not add a client-controlled upstream URL. The request-scoped OpenAI client is fixed to `https://api.openai.com/v1/responses`, sets `store: false`, disables SDK logging, and never sends browser keys to LangGraph or LangSmith. It uses the existing workflow schemas, private tool draft, and full-operation validation. Environment and shared clients are not mutated.

The complete pair overrides `OPENAI_API_KEY` and `OPENAI_MODEL` for this request alone. No key/model mixing or fallback is allowed. Subsequent requests immediately observe saved/removed settings. Without a browser override, the existing local/remote server configuration applies. Removing browser settings restores that behavior; a reload locks them instead of disabling the override.

## Encryption and isolation

`dlb-dxp-ai-settings-v1` contains a versioned JSON envelope of model, HTTPS server origin, 16 random salt bytes, 12 random IV bytes, and AES-GCM ciphertext/tag bytes. The cipher uses AES-256-GCM and a non-extractable key derived with Web Crypto PBKDF2-HMAC-SHA-256, 600,000 iterations; salt and IV are fresh on every save. Model and original origin are authenticated additional data, so changing either invalidates decryption. The passphrase and derived key exist only during save/unlock; neither is saved. Numeric arrays encode ciphertext bytes; this encoding is not the security mechanism. The KDF work factor follows [OWASP guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

The key remains only in the builder's credential store while unlocked. Lock, pagehide, unmount, disabling AI, or detecting external storage changes clears those references and aborts pending AI requests. Storage errors and damaged/unsupported records fail closed with actionable UI. Changing origins requires explicit confirmation for that unlocked session; locking/reloading revokes it. Origin confirmation is not silently persisted. Hiding the tab preserves saved credentials, and assistant controls allow unlocking, confirmation, locking and removal.

Workflow JSON, exports, previews, activity entries, URLs and graph/checkpoint inputs do not receive the settings store. Demo/fullscreen/picker frames use `sandbox="allow-scripts"` without `allow-same-origin`, creating a separate opaque origin even for a resource served under the builder's URL. No credentials are sent via postMessage. Inbound parent messages check exact builder origin and source; inbound iframe messages check the iframe Window, origin `null`, protocol and random channel. Outbound messages to opaque origins necessarily use `*` and contain only credential-free workflow/picker data. Published sites must be hosted on a distinct origin; different paths or storage prefixes are not isolation. Do not host untrusted executable content as a top-level page on the builder origin.

> Your API key is stored encrypted in this browser’s localStorage. When you use the AI assistant, it is sent over HTTPS to the configured AI server, which uses it to contact OpenAI without saving it. It is never included in your published site or workflow exports.

Origin isolation prevents ordinary cross-origin storage/DOM access. It cannot protect an unlocked key from malicious builder scripts, compromised same-origin dependencies, or privileged extensions. JavaScript string memory cannot be reliably overwritten; locking removes references. Encryption does not make a weak passphrase resistant to offline guessing. There is no passphrase recovery.

## Required deployment redaction

Before enabling browser credentials in production, configure the entire request path to omit `X-DXP-OpenAI-Key` (including lowercase/reformatted variants), Authorization, Cookies and all provider Authorization headers. Prefer allowlisting safe metadata such as request ID, status and duration. Disable raw request/header/body capture in reverse proxies, load balancers, APM, OpenTelemetry HTTP instrumentation, error reporters, analytics and browser session replay; exclude the key/passphrase fields from replay. Redaction must run before ingestion, not only in a log viewer. Disable caching and request/response recording for `/api/ai/*`.

The application does not log credentialed requests or SDK errors, and the browser override tool loop does not invoke tracing/checkpoint frameworks. Host-installed instrumentation runs outside this code and must be configured by the operator. Never persist browser keys in databases, files, caches, sessions, queues, or checkpoints. Restrict outbound credentialed provider traffic to the fixed OpenAI HTTPS destination. For custom cross-origin servers, allow only exact trusted builder origins and required headers. The supplied Next API deliberately supports same-origin requests only.
