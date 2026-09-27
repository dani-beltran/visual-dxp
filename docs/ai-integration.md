# Same-origin AI integration

The Next.js App Router serves the demo and `/api/ai/*` in one process. `src/server/ai/` contains the copied LangChain agent, tools, workflow validation, and optional remote deployment graph. The original `dlb-dxp-server` directory is untouched and is not needed to build, test, or run this application.

## Local setup

```sh
npm install
cp .env.example .env.local
# Set OPENAI_API_KEY in .env.local.
npm run dev
```

Open http://127.0.0.1:3000. `OPENAI_MODEL` defaults to `gpt-6-luna`. See [LangChain and deployment setup](langchain.md) for remote execution and tracing. Restart after changing environment variables. The demo no longer reads `VITE_DXP_AI_ENDPOINT`; old Vite settings can be removed from your local environment. Do not copy secrets into any public variable.

The demo passes exactly:

```tsx
<VisualDXPBuilder ai={{ endpoint: '/api/ai/chat', credentials: 'same-origin' }} />
```

Open **AI chat** next to Canvas Help. Each request includes the latest workflow and selected node IDs plus recent conversation. A complete valid operation batch is applied in one history commit; one Undo restores all of it, and Redo reapplies it. If the canvas changes while a request is pending, the response is rejected. Chat history stays in memory. Closing chat preserves an ongoing request; Stop and unmount cancel it.

The library remains reusable without Next.js or a backend. Other hosts can pass their own endpoint, `credentials`, and application authentication/CSRF `headers`. These settings are browser-visible: never use provider or LangSmith credentials here or in workflow configuration. The integrated API intentionally supports only same-origin hosting.

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

Origin checks are not authentication. Non-browser requests without Origin are accepted, just as in the original backend. Neither project supplied authentication, so no login system was invented. Use the host's authentication, workflow access controls, rate limits, and quotas before exposing a credentialed API. Do not cache `/api/ai/*` at a reverse proxy. Provider credentials never go through the browser.

See [migration and verification](migration.md) for checks and reproducible mock smoke testing.
