# Frontend AI integration

`dlb-dxp` contains the editor, chat interface, HTTP client, and client-side validation of proposed workflow edits. The LangChain agent and tools run in the separate `dlb-dxp-server` project. That project's `README.md` and `docs/langchain.md` describe provider credentials, LangSmith configuration, deployment, and server verification.

## Local demo

In `dlb-dxp`:

```sh
npm install
cp .env.example .env
npm run dev
```

The frontend environment file contains only this public value:

```dotenv
VITE_DXP_AI_ENDPOINT=http://127.0.0.1:8787/api/ai/chat
```

Restart Vite after changing it. An unset endpoint leaves the AI button visible with setup guidance. If an existing `.env` uses `/api/ai/chat`, replace it with the direct API URL unless your host already routes that path to the backend.

In a second terminal, start the sibling backend:

```sh
cd ../dlb-dxp-server
npm install
cp .env.example .env
# Set OPENAI_API_KEY in this backend .env file.
# Set AI_ALLOWED_ORIGIN=http://127.0.0.1:5173.
npm run dev
```

Open the frontend at `http://127.0.0.1:5173`. It calls the separate backend directly; Vite has no API proxy configuration. The backend permits cross-origin requests only from its exact configured `AI_ALLOWED_ORIGIN`. If you use `localhost`, a different port, or another hostname for the frontend, update that backend setting to match. If the API host or port changes, update `VITE_DXP_AI_ENDPOINT` too. Open **AI chat** to the left of Canvas Help and request a node or connection change. Each valid response is one undoable edit. Responses based on an older canvas revision are rejected, and chat history remains in memory.

## Embed in a host application

Configure the endpoint through the builder's `ai` prop:

```tsx
<VisualDXPBuilder
  ai={{
    endpoint: '/api/ai/chat',
    credentials: 'same-origin',
  }}
/>
```

The relative endpoint above requires routing from the host application to the API. You can instead pass a full API URL; configure the backend's allowed origin for that frontend.

`credentials` follows the browser Fetch API and defaults to `same-origin`. Optional `headers` can carry your application's authentication or CSRF headers. These settings are visible to the browser: never put model provider or LangSmith keys in them, in `VITE_*` variables, or in workflow configuration. The backend receives workflow configuration, including node headers and HTML, together with the conversation.

The demo's environment variable configures only the demo. Applications embedding the library supply their own `ai` prop.

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

## Production hosting

`npm run build` produces the static demo in `demo-dist/` and the reusable library in `dist/`. Neither output includes the AI server. Deploy `dlb-dxp-server` separately and configure its full API URL in the frontend, or route the host application's `/api/ai/chat` endpoint to it through an authenticated backend or reverse proxy. API routing and access settings belong to the host and backend.

Use the host's application authentication, workflow access checks, and request limits. For direct cross-origin requests, set the backend's `AI_ALLOWED_ORIGIN` to the exact frontend origin. Its CORS policy allows `POST` requests with `Content-Type`, `Authorization`, and `X-CSRF-Token` headers. For a same-origin reverse proxy, preserve the original `Host` header or configure the allowed origin explicitly. Cross-origin cookie authentication also requires `ai.credentials: 'include'` and appropriate cookie and CSRF settings in the host. Provider credentials stay in the backend environment.

Run `npm test` and `npm run build` here to verify the frontend. Run backend checks from `dlb-dxp-server` as described in its README.
