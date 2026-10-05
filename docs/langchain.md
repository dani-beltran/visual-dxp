# AI execution and LangGraph deployment

The active backend is `src/server/ai/` in this Next.js project. Direct model execution now uses Vercel AI SDK Core for OpenAI, Claude and OpenAI-compatible local endpoints, with one shared bounded tool loop and the existing private workflow schemas/handlers. Browser configurations never enter LangGraph or checkpoints. There is no AI Gateway, streaming requirement, or second backend process. See [provider setup and contract](ai-integration.md).

## Direct execution

Copy `.env.example` to `.env.local`. Set `AI_PROVIDER` to `openai` (default), `anthropic` (`claude` alias), or `local`, then configure that provider's server credentials and model. Leave `LANGGRAPH_API_URL` empty for direct execution. These settings work without ChatGPT sign-in. The 90-second deadline includes the bounded tool loop and propagates cancellation. Provider redirects are rejected and automatic retries are disabled. Tools stage edits only; they never publish or execute workflows.

## Tracing

Server-side OpenTelemetry instruments the shared AI SDK loop and LangGraph entrypoint. SDK automatic telemetry stays disabled to avoid duplicate spans. Opt-in full conversation capture is redacted and exported as Loki log bodies, independent of trace sampling. See [Grafana setup, capture controls and inspection](observability.md). Keep `LANGSMITH_TRACING=false` for this demo. Browser keys bypass the remote wrapper and are redacted from captured content. Retained `@langchain/core` and `@langchain/langgraph` dependencies support the remote graph.

## Remote Agent Server / LangSmith deployment

The repository's `langgraph.json` registers `./src/server/ai/graph.ts:graph` as `workflow_editor`. It has no embedded secrets or references to local environment files. Make this repository available to your deployment platform and select that configuration file. Supply `AI_PROVIDER` and the selected provider's credentials/model in the **deployment's** secret environment. The graph runs the same AI SDK workflow tools with its own environment configuration. When `LANGGRAPH_API_URL` is set in the Next.js proxy, remote execution takes precedence over that proxy's provider settings. No provider credentials are sent through graph input or checkpoints.

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
  "on_disconnect": "cancel",
  "config": { "configurable": { "dxpTelemetry": { "traceparent": "<W3C context>", "x-dxp-run-id": "<UUID>", "x-dxp-workflow-id": "<hash>" } } }
}
```

This illustrates the envelope; supply a valid chat request as described in [the API contract](ai-integration.md). Runs are stateless with no shared thread ID, so persistent graph history cannot replay undone edits. The deployed graph returns state containing `response: { message, operations }`; the proxy validates it and forwards only that response. Remote response bodies are bounded at 2 MiB, including streamed bodies. The browser's response limit remains 1 MiB.

Hosted deployments generally require `LANGSMITH_API_KEY`; a self-hosted Agent Server may not. The health endpoint reports the presence of the deployment URL and mode only, not that credentials were checked. In this mode the Next.js server does not need `OPENAI_API_KEY`; the remote graph does.

The included tests exercise both the real local agent/tool loop against mocked model HTTP responses and the deployment proxy against a mock Agent Server. Deploying to a real LangSmith workspace and testing live credentials are separate operational steps.
