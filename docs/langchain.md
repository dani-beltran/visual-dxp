# LangChain and LangSmith setup

The integrated backend lives in `src/server/ai/`. `agent.ts` uses the original LangChain `createAgent` / `ChatOpenAI` tool loop. `tools.ts` stages validated changes in a private workflow draft. `graph.ts` supplies the optional `workflow_editor` deployment. The browser calls its explicitly configured API endpoint. Browser key/model overrides always use the local request-scoped OpenAI client and the same workflow tool schemas/handlers, bypassing LangChain invocation, remote LangGraph, tracing, conversation stores, and checkpoints. Server-default requests retain the original execution modes described below.

## Local model mode

Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY`. Leave `LANGGRAPH_API_URL` empty. `OPENAI_MODEL` defaults to `gpt-6-luna`; use an account-accessible model with tool calling. Run `npm run dev`. There is no second backend process. `.env.example` is only a template and is not loaded; put actual credentials in the ignored `.env.local` file. The agent uses the OpenAI Responses API so reasoning models such as `gpt-6-luna` can call workflow tools. API keys in the original sibling project's environment are not loaded or copied automatically.

The OpenAI SDK call has a 60-second timeout and one retry; the enclosing route enforces 90 seconds across the entire request. Every invocation receives the current workflow and bounded conversation, and creates its own tools. There are no browsing, execution, filesystem, or arbitrary HTTP tools. Workflow URLs are data and are never visited by the assistant.

## Optional tracing

Local execution does not require a LangSmith account. To enable tracing for server-default requests only, configure these server environment variables:

```dotenv
LANGSMITH_TRACING=true
LANGSMITH_PROJECT=dlb-dxp-workflow-editor
LANGSMITH_API_KEY=<set privately in your environment>
```

Optionally use `LANGSMITH_ENDPOINT` for your region and `LANGSMITH_WORKSPACE_ID` for workspace selection. Traces can include messages, workflow HTML/headers, and tool results. Keep secrets out of workflows and select suitable workspace access and retention policies. Keep tracing disabled for isolated mock tests.

## Remote Agent Server / LangSmith deployment

The repository's `langgraph.json` registers `./src/server/ai/graph.ts:graph` as `workflow_editor`. It has no embedded secrets or references to local environment files. Make this repository available to your deployment platform and select that configuration file. Supply `OPENAI_API_KEY` and optionally `OPENAI_MODEL` in the **deployment's** secret environment. Its graph always runs the local model implementation, independent of the Next.js proxy setting.

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
