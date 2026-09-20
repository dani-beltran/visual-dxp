# Forma DXP

An embeddable React 19 workflow editor powered by React Flow. Build website experiences visually, pick elements inside an iframe, test the journey, and export a standalone JavaScript file.

## Run the demo

Requires Node.js 22.12+ (tested with Node.js 24).

```sh
npm install
npm run dev
```

Open http://localhost:5173. The included Atelier demo website supports the element picker and live workflow testing without additional setup. The demo saves workflow changes in local browser storage. Its Activity tab starts with illustrative actions from several users; activity stays in memory and resets when the page reloads.

```sh
npm test             # Runtime, export, picker bridge, and import boundary tests
npm run build        # Typecheck, demo-dist/, and reusable dist/ library with declarations
npm run lint         # Check Biome lint rules
npm run lint:fix     # Apply safe lint fixes
npm run format       # Format supported files with Biome
npm run format:check # Check formatting without changing files
npm run check        # Check lint rules, formatting, and import organization
npm run check:fix    # Apply safe lint fixes, formatting, and import organization
```

[Biome](https://biomejs.dev/) handles linting and formatting, configured in `biome.json`.
Generated output, dependencies, and `package-lock.json` are excluded.

## Use in another React project

Build and install this local package from your application (the package is not published to npm):

```sh
# In this repository
npm run build
npm pack

# In your application, using the archive produced above
npm install /absolute/path/to/forma-dxp-0.1.0.tgz
```

React and React DOM 19 are peer dependencies. React Flow and icons are included in the built library.

```tsx
import { DXPBuilder, type Workflow } from '@forma/dxp';
import '@forma/dxp/styles.css';

const initialWorkflow: Workflow = {
  version: 1,
  name: 'My first experience',
  websiteUrl: '/my-preview-page',
  nodes: [
    {
      id: 'visit',
      type: 'workflow',
      position: { x: 100, y: 200 },
      data: {
        kind: 'trigger',
        label: 'Page visited',
        config: { event: 'page-load' },
      },
    },
  ],
  edges: [],
};

export function ExperienceEditor() {
  return (
    <div style={{ height: '100vh', minHeight: 660 }}>
      <DXPBuilder
        initialWorkflow={initialWorkflow}
        onChange={(workflow) => console.log('Workflow updated', workflow)}
        onExport={(javascript, workflow) => console.log(workflow.name, javascript)}
        persistenceKey="my-experience"
      />
    </div>
  );
}
```

The builder includes its own `ReactFlowProvider`. It accepts `className` and `style`, uses scoped component styles, and does not require a router or backend. Render it on the client in SSR frameworks (for Next.js, use a client component; disable SSR for the editor if your environment requires it).

| Prop                 | Behavior                                                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initialWorkflow`    | Initial workflow; defaults to the included welcome journey. Changes after mounting do not replace editor state; use a React `key` to open another workflow.       |
| `onChange`           | Receives edits to nodes, edges, configuration, name, and website URL. Persist this with your own API when needed.                                                 |
| `onExport`           | Receives the generated JavaScript and workflow when Download .js is selected.                                                                                     |
| `persistenceKey`     | Optional localStorage key. A valid saved workflow takes precedence over `initialWorkflow`. Omit to disable browser persistence.                                   |
| `activityStore`      | Optional external activity store. Reads and subscribes to entries and appends new editor actions. Defaults to an empty in-memory store for this builder.         |
| `activityUser`       | Username attached to new activity entries; defaults to `"You"`. Pass the current user's display name.                                                             |
| `ai`                 | Optional `{ endpoint, headers?, credentials? }` for your authenticated chat API. The AI button remains visible with setup guidance until an endpoint is provided. |
| `className`, `style` | Customize the outer editor container. The parent must provide a height.                                                                                           |

The default journey points to `/demo-site.html`. To use it in another application, copy `dist/demo-site.html` to the application's public assets, or provide your own `initialWorkflow.websiteUrl`.

## Nodes and execution

| Node           | Configuration and behavior                                                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger        | Page ready, click, hover, submit, or input change. Element events use delegated listeners, so dynamically inserted elements work.                                                |
| HTTP request   | HTTP method, URL, JSON headers, and raw body. Non-success responses stop that run and produce an error. The target API must allow the site's origin through CORS.                |
| Update element | Change text/HTML, add/remove classes, hide/show, or set an attribute on all matching elements.                                                                                   |
| Delay          | Wait 0–86,400,000 milliseconds.                                                                                                                                                  |
| Condition      | Tests whether a CSS selector matches. The upper `true` output runs when found; the lower `false` output runs otherwise.                                                          |
| Loop           | Executes the complete `body` path 1–1,000 times, then executes the `done` path once. Do not connect the body back to the loop; graph cycles are rejected.                        |
| Popover        | Author-provided HTML or a sandboxed iframe, 240–960px wide, placed at screen center, any corner, or beneath a picked anchor. Anchored popovers reposition on scrolling/resizing. |

Connections from a step execute in order. An HTTP request currently performs the configured request; its response is not interpolated into later nodes. Branching is based on element existence, not arbitrary JavaScript expressions. An execution limit protects against excessive loops.

The canvas includes a floating node library: hover or focus an icon to see its name, then click or drag it onto the canvas to add a step. It also supports dragging, connecting, node duplication/deletion, undo/redo, zoom, fit-to-view, minimap, and JSON import/export. Delete selects/removes nodes or connections; ⌘/Ctrl+Z undoes changes.

## Activity

The **Activity** tab shows recent actions with the username, action, and time. It records workflow edits, undo/redo, imports, and exports. Typing is grouped into a single edit; selecting nodes, panning, and zooming do not add entries. JavaScript and JSON remain available through **Export workflow**.

Pass a stable store instance to connect the activity feed to your application. Create a separate store for each workflow so their histories remain separate:

```tsx
import { createActivityStore, DXPBuilder, type ActivityEntry } from '@forma/dxp';

const initialActivity: ActivityEntry[] = [];
const activityStore = createActivityStore(initialActivity);

export function ExperienceEditor() {
  return <DXPBuilder activityStore={activityStore} activityUser="Daniel Beltrán" />;
}

// When the host receives the latest activity from its server:
// activityStore.replaceEntries(serverEntries);
```

An `ActivityEntry` has `{ id: string, username: string, action: string, timestamp: string }`; `timestamp` is an ISO date string. The public `ActivityStore` contract is:

```ts
interface ActivityStore {
  getSnapshot(): readonly ActivityEntry[];
  subscribe(listener: () => void): () => void;
  append(entry: ActivityEntry): void;
}
```

`getSnapshot` must return the same array reference until entries change. Publish a new immutable snapshot and notify subscribers when local or server updates arrive; `subscribe` returns an unsubscribe function. `append` should update the local snapshot synchronously. A production adapter can then persist that entry asynchronously through the host's API, handling retries and reconciling server updates by entry ID. The included `createActivityStore` supplies these in-memory operations plus `replaceEntries` to accept a complete updated history from the server.

The builder does not contact an activity server or store activity in localStorage. The fake entries are supplied only by this project's demo; embedded builders start with an empty activity history unless the host supplies entries.

## AI workflow assistant

The **AI chat** button to the left of Canvas Help opens a conversation for creating, updating, removing, and connecting steps. It sends the current workflow and selected node with each message. Valid edits are applied together as one undoable change. If you edit the canvas while the assistant is working, its response is rejected so your changes are preserved. Chat history stays in memory and is not saved to browser storage.

This repository contains the frontend only. The LangChain agent, HTTP API, tools, and LangSmith deployment configuration live in the separate `dlb-dxp-server` project. Configure your host application's authenticated endpoint:

```tsx
<DXPBuilder ai={{ endpoint: '/api/ai/chat' }} />
```

For the local demo, copy `.env.example` to `.env`; its only setting is the public `VITE_DXP_AI_ENDPOINT=http://127.0.0.1:8787/api/ai/chat`. Run `npm run dev` here and start the backend from the sibling project in another terminal:

```sh
cd ../dlb-dxp-server
npm install
cp .env.example .env
# Set OPENAI_API_KEY in this backend .env file.
# Set AI_ALLOWED_ORIGIN=http://127.0.0.1:5173 for the local frontend.
npm run dev
```

Open `http://127.0.0.1:5173`. The frontend calls the backend directly, with no Vite proxy. The backend's `AI_ALLOWED_ORIGIN` must exactly match the frontend origin, including hostname and port. In production, use your API URL with its allowed frontend origin, or route a relative `/api/ai/chat` endpoint through your host's authenticated backend or reverse proxy. Keep model and LangSmith keys only in the backend's environment. Without an endpoint, the chat displays setup guidance; it does not simulate AI responses.

See [frontend AI integration](docs/ai-integration.md) for the HTTP contract, authentication options, and hosting setup. Backend setup and LangChain platform configuration are documented in the separate project's `README.md` and `docs/langchain.md` (locally, `../dlb-dxp-server/docs/langchain.md`).

## Visual element selection

Trigger events, Update element, and anchored Popover nodes expose **Select on website**. Enter a URL, hover to highlight elements, click to retain the selection, and choose **Use element**. You can also enter a CSS selector manually.

Browsers only permit direct iframe DOM access for same-origin pages. For websites on another origin, copy `dist/picker-bridge.js` to that website and include:

```html
<script src="/picker-bridge.js" data-parent-origin="https://your-editor.example"></script>
```

Use the exact editor origin, including its port when relevant, with no trailing slash. The bridge checks the parent window, exact origin, protocol, and session channel. It only operates while the authorized editor activates a picker session and removes selection listeners/outlines on stop.

The target website must permit embedding via its `Content-Security-Policy: frame-ancestors` and `X-Frame-Options` settings. Neither a React component nor this bridge can override browser framing policy. Remote sites that you cannot configure still support manual CSS selector entry.

See [MDN: iframe contentDocument](https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/contentDocument) and [MDN: postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) for the browser model.

**Live workflow preview requires a same-origin website.** The cross-origin bridge enables selection only. To execute on another origin, export the workflow and install the script on that target website.

## JavaScript export and runtime

Export produces a dependency-free script. Host the downloaded file and load it on the target website:

```html
<script src="/welcome-journey.js" defer></script>
```

It registers triggers, executes actions, and exposes `window.FormaDXP`. Reinjecting an exported script first disposes of the previous Forma runtime. Stop it with `window.FormaDXP.destroy()`.

You can also use the runtime directly:

```ts
import { createRuntime, exportWorkflow, validateWorkflow } from '@forma/dxp';

const issues = validateWorkflow(workflow);
if (issues.length) throw new Error(issues.map((issue) => issue.message).join('\n'));

const javascript = exportWorkflow(workflow);
const runtime = createRuntime(workflow, { onLog: console.log });
runtime.start(); // Install configured event/page-load triggers.
await runtime.run(); // Or manually run all triggers immediately.
runtime.destroy(); // Abort pending work and remove listeners/popovers.
```

Manual preview invokes `run()` to test the complete journey without waiting for its configured event. Closing preview aborts active work. DOM changes remain on the preview page until it is reloaded; `destroy()` does not revert page mutations or completed HTTP requests.

HTML and DOM actions are author-controlled content. Import workflows from trusted sources, and do not put server secrets in client-side request headers. HTML previews are sandboxed; the exported runtime intentionally inserts authored HTML on your website. This project is a client-side editor/runtime, with application authentication, server persistence, and publishing supplied by the host project.

## Source layout

- `src/DXPBuilder.tsx` — editor composition, state/history, import/export, persistence.
- `src/components/` — workflow cards, node inspector, picker, and live preview.
- `src/lib/runtime.ts` — self-contained workflow execution engine.
- `src/lib/export.ts` — graph/configuration validation and JavaScript generation.
- `src/lib/picker.ts` — selector generation and iframe highlighting.
- `src/lib/types.ts` — public workflow schema.
- `src/lib/ai.ts` — chat protocol, transport, and validated atomic workflow edits.
- `src/lib/activity.ts` — public activity entries and subscribable in-memory store.
- `docs/ai-integration.md` — connect the frontend to the separate AI backend.
- `public/picker-bridge.js` — standalone bridge deployed on the target website.
- `public/demo-site.html` — working sample website.

The library entry point is `src/index.ts`. Build outputs include ESM, UMD, TypeScript declarations, CSS, and both public demo/bridge assets. React Flow's custom node and provider APIs are documented at [reactflow.dev](https://reactflow.dev/learn/customization/custom-nodes).
