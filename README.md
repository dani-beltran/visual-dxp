# Forma DXP

An embeddable React 19 workflow editor powered by React Flow. Build website experiences visually, pick elements inside an iframe, test the journey, and export a standalone JavaScript file.

## Run the demo

Requires Node.js 22.12+ (tested with Node.js 24).

```sh
npm install
npm run dev
```

Open http://localhost:5173. The included Atelier demo website supports the element picker and live workflow testing without additional setup. The demo saves changes in local browser storage.

```sh
npm test       # Runtime, export, picker bridge, and import boundary tests
npm run build # Typecheck, demo-dist/, and reusable dist/ library with declarations
```

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

| Prop                 | Behavior                                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initialWorkflow`    | Initial workflow; defaults to the included welcome journey. Changes after mounting do not replace editor state; use a React `key` to open another workflow. |
| `onChange`           | Receives edits to nodes, edges, configuration, name, and website URL. Persist this with your own API when needed.                                           |
| `onExport`           | Receives the generated JavaScript and workflow when Download .js is selected.                                                                               |
| `persistenceKey`     | Optional localStorage key. A valid saved workflow takes precedence over `initialWorkflow`. Omit to disable browser persistence.                             |
| `className`, `style` | Customize the outer editor container. The parent must provide a height.                                                                                     |

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
- `public/picker-bridge.js` — standalone bridge deployed on the target website.
- `public/demo-site.html` — working sample website.

The library entry point is `src/index.ts`. Build outputs include ESM, UMD, TypeScript declarations, CSS, and both public demo/bridge assets. React Flow's custom node and provider APIs are documented at [reactflow.dev](https://reactflow.dev/learn/customization/custom-nodes).
