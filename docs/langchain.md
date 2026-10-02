# AI execution and LangGraph deployment

The active backend is `src/server/ai/` in this Next.js project. Direct model execution now uses Vercel AI SDK Core for OpenAI, Claude and OpenAI-compatible local endpoints, with one shared bounded tool loop and the existing private workflow schemas/handlers. Browser configurations never enter LangGraph or checkpoints. There is no AI Gateway, streaming requirement, or second backend process. See [provider setup and contract](ai-integration.md).

## Direct execution

Copy `.env.example` to `.env.local`; use browser AI Settings for normal use. Server-side provider credentials are intended only for development and debugging. Leave `LANGGRAPH_API_URL` empty for direct server-default execution. OpenAI retains its Responses API and default model; Claude requires an Anthropic key/model; Local requires a loopback model server and a tool-capable model, and is intended for developers running the demo app locally for debugging. The 90-second route deadline includes the complete bounded tool loop and propagates cancellation. Provider redirects are rejected and automatic retries are disabled. Tools stage definitions only; they never browse, publish or execute workflows.

## Tracing

AI SDK telemetry is disabled for all direct execution, including browser credentials. `LANGSMITH_TRACING` no longer traces the direct model/tool loop. It may still trace a separately deployed LangGraph wrapper using server-only credentials; deployment traces can include workflow and conversation data. Browser keys always bypass that wrapper. Retained `@langchain/core` and `@langchain/langgraph` dependencies support the remote graph; unused `langchain`, `@langchain/openai`, and `openai` dependencies were removed.

## Remote Agent Server / LangSmith deployment

The repository's `langgraph.json` registers `./src/server/ai/graph.ts:graph` as `workflow_editor`. It has no embedded secrets or references to local environment files. Make this repository available to your deployment platform and select that configuration file. Supply `OPENAI_API_KEY` and optionally `OPENAI_MODEL` in the **deployment's** secret environment. Its graph always runs the shared AI SDK flow with OpenAI server defaults, independent of the Next.js proxy setting. The existing remote state contract supports only OpenAI server-default requests; Claude or Local server-default selections return 409 when remote mode is configured. Save a browser configuration for direct execution or disable remote mode to use those providers.

The graph's internal modules are framework-independent Node code and do not import the Next-only `server-only` marker; that marker guards the HTTP entrypoint. No Next server is started by the graph runner. The dependencies and lockfile are included at this repository's root.

To connect Next.js to the deployed graph, set in `.env.local` or your **application server's** environment:

```dotenv
LANGGRAPH_API_URL=https://your-agent-server.example
LANGGRAPH_ASSISTANT_ID=workflow_editor
LANGSMITH_API_KEY=<set privately in your environment>
```

Restart Next.js. The proxy sends `POST <LANGGRAPH_API_URL>/runs/wait`, supplies `X-Api-Key` only on the server when a LangSmith key is present, and sends:

```json
{
  "assistant_id": "workflow_editor",
  "input": { "request": { "messages": [], "workflow": {}, "selectedNodeIds": [] } },
  "on_disconnect": "cancel"
}
```

This illustrates the envelope; supply a valid chat request as described in [the API contract](ai-integration.md). Runs are stateless with no shared thread ID, so persistent graph history cannot replay undone edits. The deployed graph returns state containing `response: { message, operations }`; the proxy validates it and forwards only that response. Remote response bodies are bounded at 2 MiB, including streamed bodies. The browser's response limit remains 1 MiB.

Hosted deployments generally require `LANGSMITH_API_KEY`; a self-hosted Agent Server may not. The health endpoint reports the presence of the deployment URL and mode only, not that credentials were checked. In this mode the Next.js server does not need `OPENAI_API_KEY`; the remote graph does.

The included tests exercise both the real local agent/tool loop against mocked model HTTP responses and the deployment proxy against a mock Agent Server. Deploying to a real LangSmith workspace and testing live credentials are separate operational steps.
