# Visual DXP

A Next.js App Router application and embeddable React 19 workflow editor powered by React Flow. Build website experiences visually, pick elements inside an iframe, test the journey, and export a standalone JavaScript file.

## Run the demo

Requires Node.js 22.12+ (tested with Node.js 24).

```sh
npm install
cp .env.example .env.local
# Set OPENAI_API_KEY in .env.local to enable local AI execution.
npm run dev
```

Open http://127.0.0.1:3000. The page and AI API run in the same Next.js process; no sibling backend process is needed. The included demo website supports the element picker and live workflow testing without additional setup. The demo saves workflow changes in local browser storage. Its Activity tab starts with illustrative actions from several users; activity stays in memory and resets when the page reloads.

```sh
npm test             # Frontend, integrated backend, and mocked Route Handler tests
npm run typecheck    # App, server, library, and test types
npm run build        # Production Next.js application (.next/)
npm start            # Serve the production application on port 3000
npm run build:lib    # Reusable dist/ library with declarations and public assets
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
npm run build:lib
npm pack

# In your application, using the archive produced above
npm install /absolute/path/to/dlb-dxp-0.1.0.tgz
```

React and React DOM 19 are peer dependencies. React Flow and icons are included in the built library.

```tsx
import { useState } from 'react';
import VisualDXPBuilder, { type VisualDXPBuilderApi, type Workflow } from 'dlb-dxp';
import 'dlb-dxp/styles.css';

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
  const [builder, setBuilder] = useState<VisualDXPBuilderApi | null>(null);
  const [workflow, setWorkflow] = useState(initialWorkflow);

  return (
    <>
      <button disabled={!builder} onClick={() => builder?.testWorkflow()}>
        Test workflow
      </button>
      {/* Use workflow in your own export dialog; JSON.stringify(workflow) produces JSON. */}
      <span>{workflow.name}</span>
      <div style={{ height: 600 }}>
        <VisualDXPBuilder
          initialWorkflow={initialWorkflow}
          onReady={setBuilder}
          onChange={setWorkflow}
          persistenceKey="my-experience"
        />
      </div>
    </>
  );
}
```

The builder owns the toolbar, canvas, inspector, activity view, footer, element picker, and test preview, including its own `ReactFlowProvider`. The hosting page owns its project header, test button, and export dialog. `src/app.tsx` demonstrates this split. It accepts `className` and `style`, uses scoped component styles, and does not require a router or backend. Render it on the client in SSR frameworks (for Next.js, use a client component; disable SSR for the editor if your environment requires it).

| Prop                 | Behavior                                                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initialWorkflow`    | Initial workflow; defaults to the included welcome journey. Changes after mounting do not replace editor state; use a React `key` to open another workflow.       |
| `onChange`           | Receives the initial or restored workflow and all subsequent edits as a JSON-serializable `Workflow` object. Use it for persistence or your own export dialog.                                                 |
| `onReady`            | Receives a `VisualDXPBuilderApi` with `testWorkflow()`, `renameWorkflow(name)`, `fitView()`, and `flushActivity()`. Receives `null` on cleanup; use a stable callback such as a state setter.                                                                                     |
| `persistenceKey`     | Optional localStorage key. A valid saved workflow takes precedence over `initialWorkflow`. Omit to disable browser persistence.                                   |
| `activityStore`      | Optional external activity store. Reads and subscribes to entries and appends new editor actions. Defaults to an empty in-memory store for this builder.         |
| `activityUser`       | Username attached to new activity entries; defaults to `"You"`. Pass the current user's display name.                                                             |
| `ai`                 | Optional `{ endpoint, headers?, credentials? }` for your authenticated chat API. The AI button remains visible with setup guidance until an endpoint is provided. |
| `className`, `style` | Customize the outer editor container. The parent must provide a height.                                                                                           |

`VisualDXPBuilder` is both the default and a named package export. Import `dlb-dxp/styles.css` once in your application; it includes React Flow and all builder, inspector, dialog, picker, and activity styles. The package exposes the same stylesheet through its `style` field and marks CSS as a side effect so bundlers retain the import.

### Brand colors with theme.css

Create a `theme.css` file in your application and define the three CSS custom properties below. Setting them on `:root` applies your brand to every builder on the page:

```css
/* theme.css */
:root {
  --dxp-primary: #2457a7;
  --dxp-secondary: #167d8d;
  --dxp-tertiary: #a34b85;
}
```

Import your theme after the package stylesheet in your application's entry point or global stylesheet entry. No color props are needed on `VisualDXPBuilder`:

```tsx
import VisualDXPBuilder from 'dlb-dxp';
import 'dlb-dxp/styles.css';
import './theme.css';

export function ExperienceEditor() {
  return <VisualDXPBuilder style={{ height: 600 }} />;
}
```

| CSS custom property | Default | Applies to |
| --- | --- | --- |
| `--dxp-primary` | `#247252` | Editor actions, focus, and surface tints |
| `--dxp-secondary` | `#648bc4` | Supporting activity avatar accents |
| `--dxp-tertiary` | `#9d80c5` | Additional activity avatar accents |

Values can be any valid CSS color, including references to your existing design tokens such as `var(--brand-primary)`. Omit a property to use its inherited value or the default above. The package already includes its derived theme styles; only your application's `theme.css` needs customization.

To give part of your application a different palette, add a wrapper class to the same `theme.css`:

```css
.campaign-theme {
  --dxp-primary: #a32a56;
  --dxp-secondary: #a16616;
  --dxp-tertiary: #6b4ba8;
}
```

```tsx
<div className="campaign-theme" style={{ height: 600 }}>
  <VisualDXPBuilder />
</div>
```

Builders inherit the closest theme, including their dialogs and picker. Changing the CSS variables or wrapper class updates the colors without resetting the workflow. Node library icons, node cards, connection handles, notes, and frames retain their original colors regardless of the brand palette.

The palette derives hover colors, borders, backgrounds, shadows, and canvas colors with CSS `color-mix()`. Use brand colors with sufficient contrast for text on light surfaces. Solid primary buttons use white text by default; set `--dxp-on-primary` in your `theme.css` when your primary color needs a different foreground. Status indicators retain semantic success/warning/error colors. User-authored note colors, popover content, and preview websites remain part of the workflow rather than the editor theme.

Call `builder.testWorkflow()` from your own button to open the built-in preview. Use `exportWorkflow(workflow)` to generate JavaScript in your host, or `JSON.stringify(workflow, null, 2)` for JSON. Export UI and the `onExport` callback now belong to the demo `App`, not `VisualDXPBuilder`. `renameWorkflow(name)` participates in undo/redo and activity; `flushActivity()` publishes pending edits when a host input loses focus.

The default journey points to `/demo-site.html`. To use it in another application, copy `dist/demo-site.html` to the application's public assets, or provide your own `initialWorkflow.websiteUrl`.

## Nodes and execution

| Node           | Configuration and behavior                                                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger        | Page ready, click, hover, submit, input change, element zoom-in, element swipe, exit intention, rage clicking, inactivity, scroll thrashing, or scroll down threshold. Element events use delegated listeners. |
| HTTP request   | HTTP method, URL, JSON headers, and raw body. Non-success responses stop that run and produce an error. The target API must allow the site's origin through CORS.                |
| Update element | Change text/HTML, add/remove classes, hide/show, or set an attribute on all matching elements.                                                                                   |
| Set cookie     | Creates or updates a cookie on the current website using a name, value, and session or persistent expiration. The next step runs after the value can be read back. |
| Delay          | Wait 0–86,400,000 milliseconds.                                                                                                                                                  |
| Condition      | Tests element existence, device, language, referrer, date ranges, time of day, URL parameters, or cookies (including local and session storage). The upper `true` output runs on a match; otherwise the lower `false` output runs.                                                          |
| Loop           | Executes the complete `body` path 1–1,000 times, then executes the `done` path once. Do not connect the body back to the loop; graph cycles are rejected.                        |
| Popover        | Author-provided HTML or a sandboxed iframe, 240–960px wide, placed at screen center, any corner, or beneath a picked anchor. Anchored popovers reposition on scrolling/resizing. |
| Note           | Editable canvas text with bold, italic, and strikethrough formatting, preset or custom background colors, and a transparent option. Notes have no connections and do not run. |

Connections from a step execute in order. An HTTP request currently performs the configured request; its response is not interpolated into later nodes. Conditions compare the configured visitor or page data; they do not evaluate JavaScript expressions. An execution limit protects against excessive loops.

**Set cookie** (`kind: 'cookie'`) uses `cookieName`, `cookieValue`, and `cookieDays`. The name must be nonempty and contain no spaces or cookie separators; the value may be empty. `cookieDays` is a whole number from 0 to 400: zero or omitted uses a browser-session cookie, and a positive value sets `Max-Age` to that many days from execution. The inspector offers **Browser session** or **After a number of days**. For example, `{ "cookieName": "audience", "cookieValue": "returning", "cookieDays": 30 }` stores a value that a later Cookies condition can match with `conditionKey: 'audience'` and `conditionValue: 'returning'`.

Cookie names and values are percent-encoded, with a 4,096-byte limit including settings. Writes use the current host, `Path=/`, `SameSite=Lax`, and `Secure` on HTTPS. Preview writes to the embedded website's document; exported scripts write to the target page. Cookies remain after the runtime stops. If the browser rejects the write or the value cannot be read back, the node reports an error and stops that execution. Browser cookie settings and expiration limits still apply, and HttpOnly cookies require a server. See the [document.cookie reference](https://developer.mozilla.org/en-US/docs/Web/API/Document/cookie) for browser behavior.

Choose **Trigger → Start when → An element is zoomed into** and pick a **Target element** to detect zoom-in gestures over that element or its descendants (`event: 'zoom-in'`, `selector: '#product-image'`). Outward two-finger pinches and Safari scale gestures fire after a small 5% movement threshold; Ctrl+wheel zoom-in (including trackpad pinch where the browser emits it) fires once per wheel burst, rearming after a 300 ms pause. Pinches use their starting midpoint to identify the target. Native visual viewport scale changes can also complete an active pinch. Each gesture fires at most once, ordinary scrolling and zoom-out gestures are ignored, and dynamic target elements are supported.

Zoom detection observes browser gestures without preventing native zoom. It detects intent even if the host page prevents magnification; keyboard/menu zoom and application-specific zoom buttons or CSS transforms are not detected. Hidden tabs reset gesture tracking, and stopping the runtime removes all gesture and viewport listeners. The same detection runs in preview and exported JavaScript. Browser event behavior is described in the [wheel event](https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event), [GestureEvent](https://developer.mozilla.org/en-US/docs/Web/API/GestureEvent), and [VisualViewport.scale](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport/scale) references.

Choose **Trigger → Start when → An element is swiped** and pick a **Target element** (`event: 'swipe'`, `selector: '#product-image'`). A single finger or pen gesture must start on the target or a descendant and finish at least 50 CSS pixels from its starting point within 1,000 ms. Any direction counts, including diagonals, and the gesture may finish outside the target. It fires once on release. Taps, slow drags, mouse dragging, wheel/trackpad scrolling, pinches, and cancelled gestures do not count. Detection preserves native scrolling; a qualifying touch swipe that also scrolls can count if the browser delivers its completion. Touch and pointer reports of the same contact are deduplicated. Hidden tabs and window blur clear active gestures, and stopping the runtime removes all listeners. Preview, exported JavaScript, JSON, and AI editing support this event. See the [Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events) and [Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) references for browser delivery details.

Behavioral triggers are available in **Trigger → Start when** and watch the whole page without requiring an element selector:

| Event | Default configuration | Detection and repeat behavior |
| --- | --- | --- |
| `exit-intent` | No additional settings | Mouse exits through the top of the viewport toward browser controls. Fires once per runtime; intended for mouse users. |
| `rage-click` | `rageClickCount: 3`, `rageClickWindow: 1000` (ms), `rageClickRadius: 50` (px) | Rapid primary clicks within the time window and radius of the first click. Keyboard activation is ignored. Resets after each detected group. |
| `inactivity` | `duration: 30000` (ms) | No pointer, keyboard, touch, click, wheel, or scroll activity for the configured duration. Fires once per idle period, then rearms on activity. Hidden tabs pause the timer; returning starts a fresh interval. |
| `scroll-thrashing` | `scrollDirectionChanges: 4`, `scrollThrashWindow: 2000` (ms), `scrollMinDistance: 50` (px) | Rapid page scroll direction reversals within the time window. Movements below the minimum travel do not count as reversals. Resets after each detected group. |
| `scroll-depth` | `scrollThreshold: 75` (%) | Fires once on downward page scrolling at or beyond this percentage of the scrollable distance. 100 means the bottom. Does not fire on startup, upward scrolling, or pages that cannot scroll. |

All behavioral triggers ignore hidden-tab activity. Scroll thrashing and depth use the page scroll position, excluding nested scroll containers. These are browser-event heuristics; programmatic scrolling can also satisfy scroll triggers. `destroy()` removes their listeners and cancels inactivity timers. The editor, preview, exported JavaScript, and AI workflow tools use the same configuration. Counts accept integers from 2–100, time windows 100–60,000 ms, pixel distances 1–1,000 px, inactivity 1,000–86,400,000 ms, and scroll thresholds 1–100%.

Condition configuration uses `conditionType` (omitted in older workflows means `selector`):

| Type | Configuration | Match behavior |
| --- | --- | --- |
| `selector` | `condition`: CSS selector | At least one matching element exists. |
| `device` | `conditionValue`: `desktop` or `mobile` | Browser mobile hints when available; otherwise user agent detection, including touch-enabled iPads. Detection is best effort, independent of viewport width. |
| `language` | `conditionValue`: language tag | Primary browser language, case-insensitive. `en` matches `en-US` and `en-GB`; `en-US` matches only that locale. |
| `referrer` | `conditionValue`: domain, e.g. `example.com` | Exact, case-insensitive hostname equality. Protocol, port, path, query, and fragment are ignored; subdomains remain distinct. Existing HTTP(S) URL values are accepted and only their hostname is used. Missing referrers do not match. |
| `date-range` | `conditionStartDate`, `conditionEndDate`: `YYYY-MM-DD`; `conditionTimeZone`: `local` (default) or `utc` | **Within date range:** the current date in the selected time zone falls between the start and end dates, including both entire days. `local` uses the visitor's local date; `utc` uses the UTC date for all visitors. Both dates must be valid, with the end on or after the start; equal dates match that one day. |
| `time-of-day` | `conditionStartTime`, `conditionEndTime`: 24-hour `HH:MM`; `conditionTimeZone`: `local` (default) or `utc` | **Time of day:** the current time falls within the daily range, including both entire selected minutes. An end earlier than the start crosses midnight. Equal times match only that minute; `00:00`–`23:59` matches the whole day. |
| `query-param` | `conditionKey`, `conditionValue` | Current URL has a parameter with this exact name and decoded value. Any matching repeated value counts. |
| `cookie` | `conditionKey`, `conditionValue` | **Cookies (including local and session storage):** matches if a readable cookie, localStorage entry, or sessionStorage entry has this exact name and value. Cookie names and values are percent-decoded; localStorage and sessionStorage strings are compared as stored. HttpOnly cookies are unavailable. |

Named variables use case-sensitive string equality, including whitespace and empty values. An absent variable never matches an empty expected value. Missing referrers take the `false` path. The combined cookie condition takes `false` only when no source matches; access to each source is independent, so a blocked source does not prevent a match in another. Values are read each time the node runs. Preview uses the embedded page's context; exported scripts use the target page's context.

Example: `{ "conditionType": "query-param", "conditionKey": "utm_source", "conditionValue": "newsletter" }` takes the `true` path on `?utm_source=newsletter`.

Choose **Condition → Condition type → Within date range** to set **Date based on** to **Visitor local date** or **UTC**, then set **Start date** and **End date**. For example, `{ "conditionType": "date-range", "conditionStartDate": "2026-09-01", "conditionEndDate": "2026-09-30", "conditionTimeZone": "utc" }` takes the `true` path throughout September 2026 in UTC. Omitting `conditionTimeZone` preserves the visitor-local behavior of existing workflows. The date is checked whenever the node runs; this condition does not schedule or start a workflow by itself.

Choose **Condition → Condition type → Time of day** to set **Time based on** to **Visitor local time** or **UTC**, then choose **Start time** and **End time**. For example, `{ "conditionType": "time-of-day", "conditionStartTime": "22:00", "conditionEndTime": "06:00", "conditionTimeZone": "utc" }` matches from 22:00 through 06:00:59.999 UTC, crossing midnight. Both times are required in `00:00`–`23:59` format. The visitor's local clock is used when `conditionTimeZone` is omitted. The time is checked each time the node runs; the condition does not schedule a run or wait for its start time. Chain date-range and time-of-day conditions to require both a date and a daily time window.

The canvas includes a floating node library: hover or focus an icon to see its name, then click or drag it onto the canvas to add a step. It also supports dragging, connecting, node duplication/deletion, undo/redo, zoom, fit-to-view, minimap, and JSON import. The host handles export using the current workflow. Delete selects/removes nodes or connections; ⌘/Ctrl+Z undoes changes.

Add a **Note** from the library and type directly on it. Select text on the note or in its details panel, then choose bold, italic, or strikethrough to format just that selection. The details panel also controls the background color. Drag the note's header to move it. Notes are saved in workflow JSON, including mixed text formatting, but are excluded from exported JavaScript.

Add a **Frame** to group related nodes. Set its name in the details panel, drop nodes fully inside it, or resize its edges around existing nodes. Drag the frame's header to move all its contents together. Drag a node outside to ungroup it. Deleting a frame keeps its nodes and connections; duplicating it copies its contents and internal connections. Frames and membership are saved in workflow JSON and support undo/redo. Frames are top-level canvas containers and are excluded from exported JavaScript.

## Activity

The **Activity** tab shows recent actions with the username, action, and time. The builder records workflow edits, imports, and test previews. The demo host records exports in the same activity store. Undo removes the reverted edit's activity entry; Redo restores that original entry, including its username and timestamp. Typing and repeated keyboard moves are grouped into a single undoable edit and activity entry. Selecting nodes, panning, and zooming do not add entries. JavaScript and JSON remain available through **Export workflow**.

Pass a stable store instance to connect the activity feed to your application. Create a separate store for each workflow so their histories remain separate:

```tsx
import { createActivityStore, VisualDXPBuilder, type ActivityEntry } from 'dlb-dxp';

const initialActivity: ActivityEntry[] = [];
const activityStore = createActivityStore(initialActivity);

export function ExperienceEditor() {
  return <VisualDXPBuilder activityStore={activityStore} activityUser="Daniel Beltrán" />;
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
  remove(id: string): void;
}
```

`getSnapshot` must return the same array reference until entries change. Publish a new immutable snapshot and notify subscribers when local or server updates arrive; `subscribe` returns an unsubscribe function. `append` and `remove` should update the local snapshot synchronously. A production adapter can then persist entries or their deletion asynchronously through the host's API, handling retries and reconciling server updates by entry ID. Undo targets the original entry's ID and store, leaving unrelated activity untouched. Edits undone before their activity is saved cancel the pending entry. The included `createActivityStore` supplies these in-memory operations plus `replaceEntries` to accept a complete updated history from the server.

The builder does not contact an activity server or store activity in localStorage. The fake entries are supplied only by this project's demo; embedded builders start with an empty activity history unless the host supplies entries.

## AI workflow assistant

The **AI chat** button to the left of Canvas Help opens a conversation for creating, updating, removing, and connecting steps. It sends the current workflow and selected node with each message. Valid edits are applied together as one undoable change. If you edit the canvas while the assistant is working, its response is rejected so your changes are preserved. Chat history stays in memory and is not saved to browser storage.

The demo configures the reusable builder with the same-origin endpoint:

```tsx
<VisualDXPBuilder ai={{ endpoint: '/api/ai/chat', credentials: 'same-origin' }} />
```

Set `OPENAI_API_KEY` in `.env.local` to use the integrated local LangChain agent. `OPENAI_MODEL` defaults to `gpt-4.1-mini`. Alternatively set `LANGGRAPH_API_URL`, `LANGGRAPH_ASSISTANT_ID` (default `workflow_editor`), and `LANGSMITH_API_KEY` for a remote deployment. The remote graph needs its own `OPENAI_API_KEY`; the Next.js proxy does not. Optional `LANGSMITH_TRACING`, `LANGSMITH_PROJECT`, `LANGSMITH_ENDPOINT`, and `LANGSMITH_WORKSPACE_ID` configure tracing. All provider settings stay server-side; none belong in `NEXT_PUBLIC_*`, `VITE_*`, client props, or browser request headers.

`GET /api/ai/health` reports `{ configured, mode }` based on configuration presence, not verified credentials. Without configuration the editor still works and chat returns a safe 503 error. No AI responses are simulated by the app. This migration does not read or copy secrets from the original backend.

The application rejects browser requests from other origins. This is an origin protection, not authentication: neither original project supplies login or workflow authorization. Keep private deployments behind your host's existing access controls and quotas. The development and start scripts bind to loopback; when required, use `npm start -- --hostname 0.0.0.0` behind your hosting access controls. See [AI integration](docs/ai-integration.md), [LangChain/deployment setup](docs/langchain.md), and [migration verification](docs/migration.md).

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

It registers triggers, executes actions, and exposes `window.dlbDXP`. Reinjecting an exported script first disposes of the previous Visual DXP runtime. Stop it with `window.dlbDXP.destroy()`.

You can also use the runtime directly:

```ts
import { createRuntime, exportWorkflow, validateWorkflow } from 'dlb-dxp';

const issues = validateWorkflow(workflow);
if (issues.length) throw new Error(issues.map((issue) => issue.message).join('\n'));

const javascript = exportWorkflow(workflow);
const runtime = createRuntime(workflow, { onLog: console.log });
runtime.start(); // Install configured event/page-load triggers.
await runtime.run(); // Or manually run all triggers immediately.
runtime.destroy(); // Abort pending work and remove listeners/popovers.
```

**Run workflow** in the test preview installs the current workflow with `start()`, just like the exported script. Page-load triggers run immediately on the loaded page; clicks, form events, inactivity, and other behavioral triggers respond to interactions inside the preview website. The execution log shows the actions and branches that actually run. **Restart workflow** replaces the active runtime with a fresh run, and **Stop workflow** removes its listeners, cancels pending work, and closes its popovers. Editing the workflow, reloading or navigating the preview website, and closing the modal also stop the active runtime. DOM changes remain on the preview page until it is reloaded; `destroy()` does not revert page mutations or completed HTTP requests.

HTML and DOM actions are author-controlled content. Import workflows from trusted sources, and do not put server secrets in client-side request headers. HTML previews are sandboxed; the exported runtime intentionally inserts authored HTML on your website. The reusable editor/runtime remains independent of Next.js. Application authentication, server persistence, and publishing are supplied by the host.

## Source layout

- `src/app/` — Next.js layout, client-only editor entry, and Node API Route Handlers.
- `src/demo/Demo.tsx` — demo activity, persistence, and same-origin AI configuration.
- `src/app.tsx` — reusable demo host UI, project header, test trigger, and export dialog.
- `src/components/VisualDXPBuilder.tsx` — independent editor, state/history, import, persistence, and test preview.
- `src/components/` — workflow cards, node inspector, picker, and live preview.
- `src/lib/runtime/` — workflow execution, conditions, popovers, and trigger modules; `index.ts` exposes the runtime API.
- `src/lib/export.ts` — graph/configuration validation and JavaScript generation.
- `src/lib/picker.ts` — selector generation and iframe highlighting.
- `src/lib/types.ts` — public workflow schema.
- `src/lib/ai.ts` — chat protocol, transport, and validated atomic workflow edits.
- `src/lib/activity.ts` — public activity entries and subscribable in-memory store.
- `src/server/ai/` — integrated agent, tools, independent server workflow validation, HTTP boundary, and deployable graph.
- `docs/ai-integration.md` — same-origin API contract and hosting guidance.
- `public/picker-bridge.js` — standalone bridge deployed on the target website.
- `public/demo-site.html` — working sample website.

The library entry point is `src/index.ts`. Build outputs include ESM, UMD, TypeScript declarations, CSS, and both public demo/bridge assets. React Flow's custom node and provider APIs are documented at [reactflow.dev](https://reactflow.dev/learn/customization/custom-nodes).
