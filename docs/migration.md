# Next.js migration and verification

The application now runs with Next.js 16 App Router and TypeScript. `npm run dev` serves the page and its same-origin AI API together. `npm run build` / `npm start` build and serve the production app. `npm run build:lib` retains the Vite ESM/UMD library, declarations, CSS, and public assets. The package's public exports and the framework-independent runtime remain unchanged.

## Implementation

- `src/app/layout.tsx` supplies the original title, favicon, theme color, and global demo styles. `src/app/editor.tsx` is a client component using `next/dynamic` with `ssr: false`; it loads the existing host UI through `src/app/EditorApp.tsx`. React Flow, DOM measurements, localStorage restoration, picker, and preview first render in the browser. The original stylesheet rules and editor implementation remain intact.
- The demo retains its activity feed, username, and `visual-dxp-workflow-v1` storage key. It passes `ai={{ endpoint: '/api/ai/chat', credentials: 'same-origin' }}`. The Vite application entry and endpoint environment variable are removed; Vite remains for tests and the library.
- `src/server/ai/` contains the original backend agent, tools, graph, and independent JSON workflow validators. Frame dimensions, membership, validation, and frame-removal coordinates were brought into alignment with the current editor. The original sibling project is untouched and there are no runtime sibling imports.
- `src/server/ai/http.ts` adapts the old HTTP boundary to Web Request/Response objects. Next Route Handlers use the Node runtime; no standalone listener is started. The HTTP entrypoint uses `server-only`, and the provider packages are server externals. Plain Node graph modules remain usable by a LangGraph deployment. Vite declarations include only library modules.
- The server retains the 1 MiB streamed body cap, complete request and operation-batch validation, 180-second deadline, provider cancellation, safe errors, and no-store responses. API-wide headers also cover Next-generated method and OPTIONS replies. Requests from other browser origins are rejected; no CORS grants or login system are introduced.
- The existing chat, atomic commit/Undo, cancellation, and stale-canvas check were preserved. The note rich-text editor now explicitly has `tabIndex=0`, with a documented lint exception for its required contenteditable textbox role.

[Next's client lazy-loading documentation](https://nextjs.org/docs/app/guides/lazy-loading#skipping-ssr) describes the client-only boundary; [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) describes the API entrypoints. Also see [AI configuration and contract](ai-integration.md) and [LangChain/deployment setup](langchain.md).

## Repeatable checks

Requires Node.js 22.12+; verified on Node 24.19.0.

```sh
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm run build:lib
npm run smoke
```

`npm run smoke` starts temporary production Next processes and a local mock Agent Server, overrides provider settings with test-only values, checks real HTTP requests, and stops the processes afterward. It never calls a live model. Run `npm run smoke -- --keep-running` to keep its isolated fixture available for browser verification until Ctrl+C; it prints the temporary local page URL. Mock replies exist only in test code and are never part of the app fallback behavior.

## Verified results (2026-09-27)

| Check | Result |
| --- | --- |
| Type checking | Passed for app, backend, library, and tests |
| Lint | Passed with no errors; 125 non-blocking style warnings and 9 informational findings in retained/imported code |
| Vitest | 29 files, 657 tests passed |
| Next.js production build | Passed; static page and dynamic Node chat/health routes |
| Reusable Vite library build | Passed; ESM, UMD, declarations, CSS, and public assets |
| Development command | Page and health returned 200 from `npm run dev` |
| Production HTTP smoke | Page, byte-identical public assets, health, mocked chat, 400/403/405/413/503 paths, streamed bodies without Content-Length, no-store including automatic responses, and real socket-disconnect cancellation passed |
| Real local agent loop with mocked provider HTTP | Read workflow, add node, connect node, and final answer passed through both the Route Handler and deployable graph |
| Browser production smoke | Editor loaded; three mocked AI operations updated the canvas; one Undo restored all changes; Redo restored them; reload restored localStorage without hydration errors |
| Preview/export | Iframe preview completed the trigger/delay/condition/popover path; JSON and JavaScript export panels rendered; JavaScript extracted from the production export ran in an isolated JSDOM document and destroyed its runtime cleanly |
| Browser console | No errors or warnings in the checked production editor/preview/reload flow |
| Isolation | Provider setting names/agent prompt absent from browser JS and library bundles; library declarations exclude server modules; original backend and demo-site/picker-bridge files unchanged by hash |

Focused Route Handler tests include local and remote success, malformed input, media types, oversized declared and streamed bodies (including byte counting and misleading lengths), invalid operations, origin rejection, missing configuration, sanitized provider errors, deadline enforcement even with an uncooperative provider, stalled uploads, pre-aborted requests, cancellation, cleanup, health semantics, and frame compatibility. Existing frontend tests cover chat history, selected-node context, atomic Undo, stale-response rejection, notes, frames, activity, persistence, picking, JSON import/export, and standalone runtime behavior.

## Operational limits

The local app's health reported `{ configured: false, mode: 'local' }`. No live credentials were available to this app, and no secrets were read or copied from the sibling backend. Model behavior was verified with mocks; a live provider call and a real LangSmith deployment remain unverified. Set private credentials in `.env.local` or the hosting environment, then repeat the assistant edit/Undo check against your chosen model.

Origin checks do not authenticate callers. Neither original project supplied an authentication system. The chat route requires no app login in development or production and limits each client IP to 20 chat requests/minute per process using the trusted Cloudflare visitor header. A trusted reverse proxy must preserve Host and the public scheme, avoid caching `/api/ai/*`, and allow the 180-second request budget. Hosting limits can be shorter than the route's `maxDuration` hint. Cross-origin live workflow execution remains unsupported; the picker bridge and exported script retain their original roles.
