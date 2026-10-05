# Same-origin AI integration

The Next.js App Router serves the demo and `/api/ai/*` in one process. `src/server/ai/` contains the Vercel AI SDK Core provider factory, shared tool loop, workflow validation, and optional remote LangGraph deployment graph. The former separate backend was deleted and is not needed to build, test, or run this application.

## Local setup

```sh
npm install
cp .env.example .env.local
# Set AI_PROVIDER and its server credentials/model in .env.local.
npm run dev
```

Open http://127.0.0.1:3000. `OPENAI_MODEL` defaults to `gpt-6-luna`. See [execution and deployment setup](langchain.md) for remote execution. Claude uses ANTHROPIC_API_KEY and ANTHROPIC_MODEL; Local uses the settings below. Restart after changing environment variables. Set AI_PROVIDER=openai, anthropic (or claude), or local to select the server provider. The demo no longer reads `VITE_DXP_AI_ENDPOINT`; old Vite settings can be removed from your local environment. Do not copy secrets into any public variable.

The demo passes exactly:

```tsx
<VisualDXPBuilder ai={{ endpoint: '/api/ai/chat', credentials: 'same-origin' }} />
```

Open **AI chat** next to Canvas Help. Each request includes the latest workflow and selected node IDs plus recent conversation. A complete valid operation batch is applied in one history commit; one Undo restores all of it, and Redo reapplies it. If the canvas changes while a request is pending, the response is rejected. Chat history stays in memory. Closing chat preserves an ongoing request; Stop and unmount cancel it.

The library remains reusable without Next.js or a backend. Other hosts can pass their own endpoint, `credentials`, and application authentication/CSRF `headers`. These settings are browser-visible: never use provider or LangSmith credentials in ai.headers or workflow configuration. Provider credentials stay exclusively on the server. The integrated API intentionally supports only same-origin hosting.

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

Chat and health responses set `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`. Provider error bodies and stack traces are not sent to the browser. Expected configuration errors use safe messages. The health response contains only `{ configured: boolean, mode: 'local' | 'deployment' }`. `configured` means the selected provider has valid configuration or a deployment URL exists; it does not check a URL's reachability, required deployment credentials, or credential validity.

## Production hosting

```sh
npm run build
npm start
```

Deploy as a Node application, not a static export. Set secrets in the hosting environment. Configure the host's request duration above the 90-second application deadline; the chat route declares a 120-second `maxDuration` hint, but hosting platforms may impose shorter limits. The development command binds to 127.0.0.1; `npm start` binds to 0.0.0.0 for hosting behind your access controls. Port can be set with `PORT` or `--port`.

The API requires an exact Origin match against the request protocol and Host, rejects cross-site/same-site fetch metadata, and does not grant cross-origin CORS access. A trusted reverse proxy must preserve the public Host and set the request protocol correctly (including trusted `X-Forwarded-Proto` for TLS termination). `X-Forwarded-Host` is not used for origin authorization. The old cross-origin `AI_ALLOWED_ORIGIN` setting is unused.

The chat API does not require app login, a session, or an application token in any environment, including production. Server-configured providers work without ChatGPT authentication. `AI_APPLICATION_TOKEN` is no longer used. Origin checks still reject requests from other browser origins; non-browser callers may omit Origin.

The server allows **20 chat requests per IP address per 60-second window** using Cloudflare's `CF-Connecting-IP` header by default. IPv6 spellings are normalized, including IPv4-mapped addresses. Each IP has an independent quota; users sharing a public IP share that quota. Missing or invalid IPs share an `unknown` bucket. The API returns 429 when the quota is exhausted.

Keep the origin reachable only through Cloudflare (for example, a Cloudflare Tunnel or origin firewall rules). The App Router does not expose the socket peer, so it cannot verify that a header came from Cloudflare itself. Never expose the origin directly while trusting this header. `X-Forwarded-For` is not used as a fallback. Cloudflare must preserve its visitor-IP header; keep Pseudo IPv4 off or in Add Header mode to retain real IPv6 addresses. See [Cloudflare's header documentation](https://developers.cloudflare.com/fundamentals/reference/http-headers/).

`AI_RATE_LIMIT_IP_HEADER` can override the header name for another trusted proxy that overwrites it with a single IP. An empty setting disables header trust and uses the shared unknown bucket. Comma-separated chains, ports, and scoped IPv6 values are rejected. Local requests without the proxy header share the fallback quota.

Counters live in memory and expire after 60 seconds or a process restart. Multi-instance deployments need shared storage or a Cloudflare rate-limit rule for a deployment-wide quota. Do not cache `/api/ai/*` at any proxy.

See [migration and verification](migration.md) for checks and reproducible mock smoke testing.


## Environment configuration and precedence

`LANGGRAPH_API_URL` takes precedence over direct execution. Configure the remote graph's own `AI_PROVIDER` and credentials in its deployment. Otherwise `AI_PROVIDER` selects `openai` (default), `anthropic` (`claude` alias), or `local`. Invalid values fail with 503 rather than falling back. OpenAI uses `OPENAI_API_KEY` and `OPENAI_MODEL`; Anthropic uses `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`; local uses `LOCAL_LLM_BASE_URL`, `LOCAL_LLM_MODEL`, and an optional `LOCAL_LLM_API_KEY`.

Environment-configured AI remains usable without ChatGPT sign-in. Identity-only authentication does not grant model access or change provider selection. A hosted plan-usage integration needs its separately approved authorization and inference contract before ChatGPT tokens can power requests.

The application never reads the legacy `visual-dxp-ai-settings-v1` record. Locked, corrupted, and inaccessible browser settings cannot block requests or override environment configuration. Existing records are left untouched and can be removed using browser storage controls. All legacy X-DXP provider/key/model/base-URL headers are ignored by the server and stripped from browser requests, including headers supplied by an embedding host. `ai.headers` remains available for application authentication/CSRF.

## Local models

Use a tool-capable OpenAI-compatible model on the backend machine/container. Only HTTP(S) URLs on localhost, 127.0.0.1, or [::1] without URL credentials, query, or fragment are accepted. Localhost is pinned to 127.0.0.1 before fetching. Redirects and arbitrary remote destinations are rejected. The hosted app cannot connect to a model on a visitor's laptop. The model must support workflow tool calls; conversational output alone is insufficient.

## Secrets and isolation

Provider secrets are server-side only and excluded from browser bundles, workflow JSON, exports, previews, graph inputs, and activity history. Keep Authorization, Cookie, upstream X-Api-Key, OAuth codes and tokens out of proxy/APM logs and session replay. Disable request/response recording on AI and authentication routes. Existing sandboxed previews retain their opaque origins. Provider error payloads are not returned to the browser.

Connections represent unchanged data flow. For field selection or transformation, add a node with `kind: "transform"`, `config.dataPath`, and an ordered `config.transformations` list. Supported transformation types are `capitalize`, `lowercase`, `uppercase`, `title-case`, `trim`, `prefix`/`suffix` (string `value`), `replace` (`find` and `replacement`), and `fallback` (JSON `value`). An empty list performs extraction only. Connection mappings and legacy node path fields are unsupported; there is no automatic migration. See [ADR 0002](decisions/0002-data-transform-nodes.md).

Update element content accepts `{{name}}`, nested paths, and `{{$}}` for the entire selected input. The selector supports variables for every action; attribute names also support them. Incoming-data indicators are derived from variables in active fields. See [ADR 0001](decisions/0001-element-template-variables.md).

### Streaming replies

The chat requests `Accept: application/x-ndjson, application/json`. The integrated route streams newline-delimited JSON records as text becomes available:

```json
{"type":"text","text":"Hello"}
{"type":"result","response":{"message":"Hello","operations":[]}}
```

The final `result` contains the validated reply and complete operation batch. A `{"type":"error"}` record or a stream ending without a result fails the request without applying edits. Partial text is removed on failure or cancellation. Existing custom endpoints that return `application/json` remain supported; they display the complete reply when it arrives. Requests without the streaming Accept header retain the JSON response contract.

Direct providers use the AI SDK streaming API. LangGraph uses `/runs/stream` with custom text events and final state values; redeploy the graph from this revision to enable incremental text on existing deployments. Reverse proxies should forward chunks without buffering; the route sends `Cache-Control: no-store, no-transform` and `X-Accel-Buffering: no`.
