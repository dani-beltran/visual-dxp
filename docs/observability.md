# LLM observability with Grafana Cloud Free

The Next.js Node server exports OpenTelemetry traces, metrics and structured logs directly to Grafana's OTLP gateway. Tempo holds traces, Loki holds conversation content, and Cloud Metrics holds counters/histograms. No database, collector, conversation-history UI or additional hosted service is required. **When capture is enabled with a remote endpoint, prompts, responses and workflow tool data leave this application and are stored in Grafana Cloud. Free-plan telemetry expires after 14 days; this is not permanent conversation storage.**

## Architecture and coverage

The active backend is `src/server/ai` in this repository. The former separate backend was deleted; no additional backend process is required. Coverage is intentionally limited to server-side AI workflows.

A workflow run here is one AI editing request, including its entire bounded tool loop. `workflow.execute` contains `workflow.step` spans for `edit_workflow` and each `turn-N`, one `chat <provider>` span for each actual SDK generation, and `execute_tool` spans. Workflow IDs are a stable hash of name + website URL, because the existing workflow schema has no persistent ID. Run IDs are UUIDs; step IDs and LLM call UUIDs disambiguate repeated calls. Renaming a workflow changes its derived workflow ID. The separate browser runtime for executing DOM/HTTP/cookie workflows in previews and exported scripts is not an LLM execution path and does not send telemetry.

AI SDK 7 calls are instrumented at the existing explicit `generateText`/`streamText` boundaries. Built-in SDK telemetry remains disabled to avoid duplicate spans and unredacted content attributes. LangGraph's single `edit_workflow` node uses the same implementation, without generic LangChain callbacks duplicating its spans. Browser-provider configurations remain private to the direct execution path. Keep `LANGSMITH_TRACING=false` (and do not enable `LANGCHAIN_TRACING_V2`) for the Grafana-only demo.

W3C `traceparent`/`tracestate` are accepted by the route and forwarded across the deployment boundary. The browser client forwards an embedding host's active OTel context when the host has configured one; this demo does not install a browser tracer. Otherwise the server creates the root trace. Responses expose `X-DXP-Run-Id` and `X-DXP-Trace-Id` for executed JSON and streamed requests, including failures. The proxy also places a **credential-free** carrier in `config.configurable.dxpTelemetry`, because a LangGraph node does not necessarily receive its HTTP headers. Deploy the updated graph code and configure telemetry there too (`OTEL_SERVICE_NAME=visual-dxp-agent`). A remote child does not increment workflow counters again. Other backends must extract the same carrier to continue the trace; changing only this proxy cannot instrument an old deployment.

Spans record provider, requested/actual model when returned, maximum output tokens, finish reasons, usage, errors, timings and streaming time to first text/reasoning/tool-input token. Provider-default temperature/top-p are not fabricated. Arbitrary model IDs and tool names are excluded from metric dimensions. Current `gen_ai.*` semantic names are used where applicable; these conventions remain in development. Operational events are `workflow.started`, `workflow.completed`, `llm.completed` and remote workflow equivalents. Raw SDK exceptions, authorization headers and response headers are never logged. Provider HTTP status is retained when available; other errors use a safe category.

Automatic retries were already disabled and remain disabled (`maxRetries=0`, `streamRetries=0`): there are no hidden retry calls or synthetic retry spans. Every content record and generation span has retry attempt zero. A manual user retry is a new workflow run. If automatic retries are introduced later, instrument each attempt explicitly instead of turning on opaque SDK retries.

## Local setup

Use Node >=22.12, `npm install`, then copy `.env.example` to `.env.local` if it does not already exist. Preserve existing private settings. Run:

```sh
CAPTURE_LLM_CONTENT=true OTEL_TRACES_SAMPLER_ARG=1 npm run dev
```

Leave all OTLP endpoints unset for console exporters. Use AI Settings or existing server provider configuration to make an AI request. Console output includes correlated spans, structured log bodies and metrics, and obeys the same capture/redaction controls. `CAPTURE_LLM_CONTENT=false` (the default) exports metadata only. `OTEL_SDK_DISABLED=true` disables export and content capture. Restart after environment changes. Never put Grafana credentials in `NEXT_PUBLIC_*`, `VITE_*`, `ai.headers` or workflow configuration.

For credential-free checks with fixture model responses:

```sh
npx vitest run tests/server/observability.test.ts tests/server/observability-otlp.test.ts
```

These exercise successful/failed workflows, tool calls, stream completion/disconnection/cancellation, and actual HTTP/JSON exports to a lightweight local receiver. They do not call a paid model or cloud service.

## Grafana Free setup

1. Use a **Free** Grafana Cloud stack. Do not enable Pro, paid features, evaluations, guards or automatic upgrades for this demo.
2. In the Cloud portal, open the stack's OpenTelemetry tile and obtain its **OTLP** endpoint and authentication variables. Create a stack-scoped Cloud Access Policy token with `logs:write`, `traces:write`, `metrics:write` only. The OTLP instance ID can differ from the Loki/Tempo instance IDs.
3. Set `OTEL_EXPORTER_OTLP_ENDPOINT` to the supplied base URL (usually ending in `/otlp`) and `OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic%20<base64-instance-id-colon-token>` in the server's private environment. The HTTP/JSON exporters append `/v1/traces`, `/v1/logs`, `/v1/metrics`. Per-signal `OTEL_EXPORTER_OTLP_*_ENDPOINT` values must include the full signal path. Per-signal header overrides are supported. This implementation selects HTTP/JSON explicitly; a gRPC endpoint or protocol variable will not switch it to gRPC.
4. Set `CAPTURE_LLM_CONTENT=true` intentionally and restart. With remote mode, configure both processes and deploy the updated graph. The proxy does not see the remote system prompt or individual generations.
5. Make one request, wait a few seconds, then open Explore using your Cloud Logs and Cloud Traces data sources. Import [grafana/workflow-observability.json](grafana/workflow-observability.json) through Dashboards → New → Import. Select your Cloud Metrics, Logs and Traces sources in the dashboard variables. The default service selector includes `visual-dxp` and `visual-dxp-agent`.

Official pricing checked on **2026-10-02** lists 10,000 metric series, 50 GB logs/month and 50 GB traces/month with 14-day telemetry retention for Free. Limits are stack-specific: check Cost Management and Billing and Explore's `grafanacloud-usage` source. The usage-limits page includes defaults for other plans; its 31-day examples do not change Free's 14-day retention. Cloud Loki's maximum log line is 256 KiB and its documented default ingestion rate is 5 MB/s. The small batches here reduce bursts but cannot guarantee an account-wide quota. [Pricing](https://grafana.com/pricing/), [usage limits](https://grafana.com/docs/grafana-cloud/platform/pricing-and-usage/usage-limits/), [OTLP setup](https://grafana.com/docs/grafana-cloud/send-data/otlp/send-data-otlp/).

## Resource attributes and Grafana connection test

`OTEL_RESOURCE_ATTRIBUTES` is parsed by OpenTelemetry's environment detector and applied to traces, logs and metrics. Explicit attributes override app defaults. `OTEL_SERVICE_NAME` takes precedence over `service.name` inside that list. Percent-encode commas and equals signs inside values; malformed input follows the SDK parser's behavior (the attribute list is discarded).

To match the Grafana onboarding test exactly, set these in `.env.local` and restart the server:

```dotenv
OTEL_SERVICE_NAME=my-app
OTEL_RESOURCE_ATTRIBUTES=service.namespace=my-application-group,deployment.environment=production
```

Run an AI workflow before testing the connection. The legacy `deployment.environment` attribute is preserved for Grafana's query and also supplies the current `deployment.environment.name` attribute unless explicitly configured. `OTEL_DEPLOYMENT_ENVIRONMENT` remains a fallback when neither is provided. For local development, prefer `development` and adjust Grafana's query accordingly.

When using `my-app`, change the imported dashboard's service selector and the Explore query examples below from `visual-dxp` to `my-app`. Resource attributes are attached to every signal and may become indexed labels or metric dimensions: do not put credentials, conversation content, run IDs or other unbounded values in them.

## Find a run and read the conversation

In Explore → Loki, find runs (select a recent time range):

```logql
{service_name=~"visual-dxp(-agent)?"} | json | event_type="workflow.completed"
```

Copy `workflow_run_id` from a record, or `X-DXP-Run-Id` from the browser's Network panel. Failed streamed requests still have a run ID even though the HTTP status is 200; inspect the workflow's `status` for the actual outcome.

```logql
{service_name=~"visual-dxp(-agent)?"} | json | workflow_run_id="PASTE-RUN-UUID"
```

Conversation only, in ascending display order:

```logql
{service_name=~"visual-dxp(-agent)?"} | json | workflow_run_id="PASTE-RUN-UUID" | event_type=~"llm.input|llm.output|tool.input|tool.result"
```

Expand a log line to inspect `content_json`. The dashboard's conversation panel supports the same run filter. Use `llm_call_id` to inspect one model request and its tools; `message_index` orders the system prompt and input history for that request. Inputs include history again on subsequent generations intentionally: each call's exact ordered conversation is independently inspectable. Tool input/result events represent execution, not another model call.

For large records, group by `record_id`, check that every `chunk_index` from 0 through `chunk_count-1` is present, concatenate **decoded** `content_json` strings in numeric chunk order, then JSON-parse the result. Sort records numerically by `sequence` within the run. Grafana's timestamp ordering is convenient but sequence/chunk indices are authoritative. Download the filtered results from Explore if needed; do not concatenate the escaped JSON display text. `truncated=true` means the concatenated prefix may not be valid JSON. Missing chunks mean incomplete delivery; do not treat the record as complete. `partial=true` / `interrupted=true` identify interrupted model output. Interrupted records contain an ordered array of available text, reasoning and tool-input fragments; completed records contain assembled SDK response messages.

To find partial/truncated records:

```logql
{service_name=~"visual-dxp(-agent)?"} | json | partial="true"
{service_name=~"visual-dxp(-agent)?"} | json | truncated="true"
```

In Explore → Tempo, paste `trace_id` into Trace ID search, or use TraceQL:

```traceql
{ span.workflow.run.id = "PASTE-RUN-UUID" }
```

### Click between logs and traces

In the **Loki data source → Derived fields**, add `TraceID`, use the regex `"trace_id"\s*:\s*"([a-f0-9]{32})"`, enable an internal link to your Tempo source, and set the query to `${__value.raw}`. Keep the raw JSON log body available for regex matching.

In **Tempo → Trace to logs**, select Loki, use a custom query, allow a ±1-minute time shift, and set:

```logql
{service_name=~"visual-dxp(-agent)?"} | json | trace_id="${__span.traceId}"
```

Use the custom query instead of requiring a span-ID match to see the entire conversation. If Grafana's provisioned sources are read-only, clone them as described in the official docs and select the clones in the dashboard. [Trace to logs and derived fields](https://grafana.com/docs/grafana/latest/datasources/tempo/configure-tempo-data-source/configure-trace-to-logs/).

## Capture, limits and delivery

- `CAPTURE_LLM_CONTENT` defaults to false and accepts exactly `true` to enable. Capture is independent of sampling: logs may refer to a sampled-out or undelivered Tempo trace. `OTEL_TRACES_SAMPLER_ARG=1` is the demo default; e.g. `0.1` samples 10% of locally rooted traces. Valid incoming parent sampling decisions are respected, including an unsampled parent.
- `LLM_CONTENT_MAX_BYTES` defaults to 262,144 redacted UTF-8 bytes **per logical content record**, clamped to 256–1,048,576. Every record carries `original_bytes`, `captured_bytes`, `truncated`. Redaction happens before truncation and chunking. Stream capture retains a bounded prefix plus a 4 KiB redaction margin; if its raw prefix was capped, `truncated=true` and the byte counts describe the retained redacted prefix, not the unknown full response.
- Chunk payloads are at most 48 KiB after JSON escaping; complete log bodies stay below 64 KiB, leaving a conservative margin under Loki's 256 KiB limit. Chunks include record ID, index and count. Content exists only in **log bodies**, never span attributes, indexed labels or metrics. Loki stringifies structured OTLP bodies into JSON; trace/span IDs also travel as OTLP correlation fields. Default resource attributes are bounded service/environment values; keep any configured resource attributes bounded too. Do not promote run/call/step IDs, models, or content to Loki index labels.
- Known environment secrets, the active request's provider key, credential-shaped strings, sensitive object keys and nested JSON/header fields are redacted. Header objects are not collected. This is defense in depth, not a general PII detector: private user data without a recognizable secret pattern is captured. Disable capture when that is inappropriate. Proxy/access logs are configured outside this code and must not log credential transport headers.
- Traces and logs each use a bounded 256-record batch queue, at most 16 records per export, and a 2-second export timeout. Traces/logs flush about every second, metrics about every 60 seconds; the route also uses Next's `after()` to flush after a streamed response completes. Standalone graph runs flush at completion. SIGTERM/SIGINT trigger a best-effort flush, but hosts can terminate earlier. No exporter runs synchronously on the token delivery path.
- Export is **best-effort**. Queue overflow, timeouts, rejected payloads, network failures, abrupt crashes and process freezing can lose records or chunks. There is no disk spool, guaranteed delivery, replay database or permanent conversation archive. Export failures never fail the application request. Bad exporter initialization falls back to no-export providers. Remote failure diagnosis requires checking the Cloud usage/ingestion views; no raw exporter diagnostics are added that could expose credentials.

## Quota-conscious demo settings

Start with one app instance, 100% traces, default content limit, and a few requests. Metrics use only bounded provider/status/token-type dimensions (no user, model or run IDs), with a 64-combination SDK cardinality cap per instrument. The dashboard uses counters and latency histograms; counters labeled "since process start" reset on restarts. Rate/percentile graphs need multiple metric exports before showing useful data.

For larger demos, reduce `LLM_CONTENT_MAX_BYTES` (for example 65536), disable content outside debugging sessions, and reduce trace sampling. **Sampling traces does not reduce content logs.** Repeated input history and large `read_workflow` results can dominate log volume. The existing 40-turn agent bound and chat rate limit are not monthly Grafana budget enforcement. Watch usage for the whole stack, including other applications; keep the stack on Free and stop capture/export before reaching the quota. Nothing in this implementation activates a paid product or upgrades the account.

## Agent Observability evaluation and compatibility sources

Grafana Agent Observability currently includes 30,000 generations/month on Free and supports TypeScript/AI SDK/LangGraph. Its native Conversations view requires a separate `@grafana/agento11y` generation exporter, endpoint and `sigil:write` scope; it is not a reader for arbitrary Loki conversation log bodies. For this Loki-based implementation, Explore provides the requested inspection without a second copy of the conversation in that generation store. No claim is made that its native conversation viewer consumes these logs, or that Free lacks the product. [Agent Observability setup](https://grafana.com/docs/grafana-cloud/observe-and-act/agent-observability/get-started/grafana-cloud/), [TypeScript integration](https://grafana.com/docs/grafana-cloud/observe-and-act/agent-observability/get-started/javascript/), [generation pricing](https://grafana.com/docs/grafana-cloud/platform/pricing-and-usage/agent-observability/).

Compatibility was checked against the installed Next 16, AI SDK 7 and LangGraph 1 APIs and current official documentation: [Next instrumentation](https://nextjs.org/docs/app/guides/instrumentation), [AI SDK 7 telemetry changes](https://vercel.com/changelog/ai-sdk-7), [OpenTelemetry Node SDK](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/), [GenAI conventions](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md), [Loki OTLP mapping](https://grafana.com/docs/loki/latest/send-data/otel/).

Cloud credentials were unavailable during implementation. Local in-memory and actual OTLP receiver validation do not establish that a specific Grafana stack accepts ingestion, that its quotas allow it, or that its navigation links are configured. Verify the successful/failed run queries and both link directions after supplying credentials.

## Debug missing telemetry

Run `npm run dev` as usual. Telemetry diagnostics use `console.debug` with an `[otel-debug]` prefix and require no environment toggle. In Node.js these messages appear in the server terminal by default; they are not sent to the browser or Loki.

Look for `initializing` / `initialized`, then `operation` when you send an AI request, `content.queued` when content capture is enabled, and per-signal `export.started` / `export.succeeded` / `export.failed`. Startup reports the export mode and sanitized destinations plus whether auth headers are configured; it never prints header values or conversation content. `console` mode means no OTLP endpoint is configured. A signal showing `default localhost:4318` means its endpoint is missing while another signal has an endpoint; set the shared endpoint or all three signal endpoints. `initialization.failed` followed by disabled fallback explains configuration errors that would otherwise be silent.

Failure diagnostics report numeric HTTP status when available (401/403 indicate credentials or permissions), allowlisted network error codes, or a timeout/generic error category. Raw error messages and response bodies are deliberately omitted because they can contain secrets. `flush.completed` alone does not prove delivery; check `export.succeeded` for each signal. Export success confirms the exporter completed successfully, not that Grafana queries or dashboard data sources are configured correctly. After startup, make an AI request to generate telemetry; logs/traces normally export within a second, metrics on flush or their 60-second interval. Diagnostics do not change sampling or enable content capture.
