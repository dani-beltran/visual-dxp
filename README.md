# Visual DXP

A Next.js App Router application and embeddable React 19 workflow editor powered by React Flow. Build website experiences visually, pick elements inside an iframe, test the journey, and export a standalone JavaScript file.

## Common DXP presets

Import `commonDXPPresets` from `visual-dxp` and pass it as `<VisualDXPBuilder presets={commonDXPPresets} />` to enable Blank followed by twelve editable examples, ordered from basic help to segmented onboarding. The demo opts in explicitly; builders without presets still have no Presets tab. See the [preset reference and setup guide](docs/common-dxp-presets.md) for every scenario, selectors, HTTP placeholders, CSS, and runtime limits.

## Run the demo

Requires Node.js 22.12+ (tested with Node.js 24).

```sh
npm install
cp .env.example .env.local
# Optional: set OPENAI_API_KEY for development, or configure a provider in AI Settings.
npm run dev
```

Open http://127.0.0.1:3000. The page and AI API run in the same Next.js process; no sibling backend process is needed. The included demo website supports the element picker and live workflow testing without additional setup. The demo saves workflow changes and activity history in local browser storage and restores them when the page reloads. Its Activity tab starts empty until you make changes.

```sh
npm test             # Frontend, integrated backend, and mocked Route Handler tests
npm run typecheck    # App, server, library, and test types
npm run build        # Production Next.js application (.next/)
npm start            # Serve the production application on port 3000
npm run build:lib    # Reusable dist/ library with declarations and public assets
node tests/export-library.mjs # Execute targeting tests against both built library bundles
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
npm install /absolute/path/to/visual-dxp-0.1.0.tgz
```

React and React DOM 19 are peer dependencies. React Flow and icons are included in the built library.

```tsx
import { useState } from 'react';
import VisualDXPBuilder, { type VisualDXPBuilderApi, type Workflow } from 'visual-dxp';
import 'visual-dxp/styles.css';

const initialWorkflow: Workflow = {
  version: 1,
  name: 'My first experience',
  websiteUrl: '/my-preview-page',
  includeSubpages: false,
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
      {/* Validate the target before exporting; see URL targeting below. */}
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
| `i18n` | Optional `{ locale, direction, messages }`. The host supplies languages and translations; missing messages fall back to English. See [Internationalization](docs/i18n.md). |
| `presets`            | Optional `readonly WorkflowPreset[]`. A nonempty array enables Presets; omitted or empty hides the tab and panel. |
| `initialWorkflow`    | Initial workflow; defaults to the included welcome journey. Changes after mounting do not replace editor state; use a React `key` to open another workflow.       |
| `onChange`           | Receives the initial or restored workflow and all subsequent edits as a JSON-serializable `Workflow` object. Use it for persistence or your own export dialog.                                                 |
| `onReady`            | Receives a `VisualDXPBuilderApi` with `getWorkflow()`, `configureWebsite(options?)`, `testWorkflow()`, `renameWorkflow(name)`, `fitView()`, and `flushActivity()`. Receives `null` on cleanup; use a stable callback such as a state setter.                                                                                     |
| `persistenceKey`     | Optional localStorage key. A valid saved workflow takes precedence over `initialWorkflow`. Omit to disable browser persistence.                                   |
| `activityStore`      | Optional external activity store. Reads and subscribes to entries and appends new editor actions. Defaults to an empty in-memory store for this builder.         |
| `activityUser`       | Username attached to new activity entries; defaults to `"You"`. Pass the current user's display name.                                                             |
| `ai`                 | Optional `{ endpoint, showSettings?, headers?, credentials? }` for your chat API. A nonempty endpoint enables the assistant and AI Settings; `showSettings: false` hides only the settings tab. Omit the endpoint to hide both. |
| `className`, `style` | Customize the outer editor container. The parent must provide a height.                                                                                           |

`VisualDXPBuilder` is both the default and a named package export. Import `visual-dxp/styles.css` once in your application; it includes React Flow and all builder, inspector, dialog, picker, and activity styles. The package exposes the same stylesheet through its `style` field and marks CSS as a side effect so bundlers retain the import.

### Optional workflow presets

Import the public `WorkflowPreset` type from `visual-dxp`. It uses the existing `Workflow` schema:

```ts
interface WorkflowPreset {
  id: string;
  name: string;
  description: string;
  complexity: 'beginner' | 'intermediate' | 'advanced';
  order: number;
  tags?: string[];
  setupInstructions?: string[];
  workflow: Workflow;
}
```

Bundled examples of increasing complexity live in [`src/presets`](src/presets). Start with [click-to-open help](src/presets/click-to-open-help.ts), which connects a click trigger to an anchored popover and includes setup notes. See the [common DXP presets reference](docs/common-dxp-presets.md) for all thirteen presets and their required setup.

Pass a bundled preset explicitly from your host:

```tsx
import VisualDXPBuilder, { clickToOpenHelpPreset } from 'visual-dxp';
import 'visual-dxp/styles.css';

export function ExperienceEditor() {
  return <VisualDXPBuilder presets={[clickToOpenHelpPreset]} style={{ height: 600 }} />;
}
```

The builder never loads a collection automatically. Pass `commonDXPPresets` to offer the full bundled collection, or supply your own `WorkflowPreset[]`. Configure the target website and adapt the preset's selectors and content before publishing.

For custom presets, store each definition in its own `.ts` file and check the object with `satisfies WorkflowPreset`. Use fixed node/edge IDs and keep the resulting preset JSON-serializable, without functions or JSX in its data. The bundled definitions use factories and locale messages to produce plain objects; the campaign headline preset also calculates its current UTC week at module load and stores only the resulting date strings.

Choose ascending `order` values from least to most complex; this field determines display order without changing your array. Removing all presets while Presets is active returns to Canvas.

The first bundled preset, `blankPreset`, clears the canvas so you can start from scratch. Add a trigger and steps before previewing or exporting. Applying a nonempty preset validates the workflow structure, graph, and configuration before replacing all nodes and connections. Invalid presets display an error and leave the editor unchanged. The current workflow's `name`, `websiteUrl`, and `includeSubpages` are preserved. Preset data is deep-cloned, editor selections and transient state are cleared, and the applied graph is fitted on Canvas. Application uses the normal commit path: one undoable edit, one activity entry, and the usual `onChange` and optional localStorage persistence. It does not execute the workflow or make network requests. Setup instructions describe any site-specific changes required before testing or publishing.

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
import VisualDXPBuilder from 'visual-dxp';
import 'visual-dxp/styles.css';
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

Call `builder.testWorkflow()` from your own button to open the built-in preview. Use `exportWorkflow(workflow)` to generate JavaScript in your host. For JSON, call `validateExportTarget(workflow)` first, then serialize the workflow with its returned absolute URL and `includeSubpages: workflow.includeSubpages ?? false`. Export UI and the `onExport` callback now belong to the demo `App`, not `VisualDXPBuilder`. `renameWorkflow(name)` participates in undo/redo and activity; `flushActivity()` publishes pending edits when a host input loses focus.

The default journey points to `/demo-site.html`. To use it in another application, copy `dist/demo-site.html` to the application's public assets, or provide your own `initialWorkflow.websiteUrl`.

## URL targeting and export requirements

The **Target website** dialog controls where the exported experience runs. **Include subpages** is unchecked by default. Its effective scope preview shows the normalized target and whether descendants are included:

| Target | Include subpages | Where the script runs |
| --- | --- | --- |
| `https://example.com` | Off | Homepage only |
| `https://example.com` | On | Homepage and all paths on that origin |
| `https://example.com/products` | Off | `/products` only |
| `https://example.com/products` | On | `/products`, `/products/item`, and deeper descendants; never `/products-sale` or unrelated paths |

Targeting uses parsed URLs and path-segment boundaries. The protocol, hostname, and effective port must match: subdomains, different ports, and HTTP versus HTTPS are separate origins. Standard URL parsing normalizes hostname case, default ports, and dot segments. Paths remain case-sensitive; percent-encoded path characters are not decoded for matching (an encoded slash is not a descendant boundary). All trailing slashes are ignored, so `/products`, `/products/`, and `/products///` have the same scope. Query parameters and fragments are ignored on both the target and the executing page. URL-parameter condition nodes can still distinguish query values within that scope.

Relative preview URLs remain supported, including `/products`, `./products`, and `products.html`; preview keeps the entered URL and its normal iframe resolution. **For production export**, relative targets resolve from the editor origin's root, regardless of the editor route or any HTML `<base>` tag. Both the demo app's JSON export and generated JavaScript embed the normalized absolute target. A script exported for `https://editor.example/products` stays restricted to that origin even when loaded elsewhere. Enter an absolute URL when targeting a separate production website.

The generated standalone JavaScript reads the actual page's `window.location.href` before replacing an existing `window.visualDXP`, creating a runtime, registering listeners, starting timers, or running actions. On a nonmatching page it exits without side effects. The URL configuration and self-contained matching function are embedded; the editor is not required. This check happens when the script loads; it does not monitor client-side SPA navigation. The low-level `createRuntime`/`executeWorkflow` API remains usable for explicit preview/test execution without the production target gate.

**Export workflow**, **Copy**, and **Download** require a nonempty HTTP(S) target URL, without embedded credentials, that is not the built-in demo. `/demo-site.html` is for preview only, including equivalent relative paths and same-editor-origin absolute URLs with queries, fragments, or trailing slashes. An external site's `demo-site.html` or a different path with that filename is allowed. Invalid export targets reopen the builder's existing configuration dialog. Saving a valid target returns to the export dialog; cancellation discards the draft and never exports. JavaScript also requires a valid executable graph. JSON retains the existing ability to export an incomplete graph once its target is configured.

`exportWorkflow(workflow, { baseUrl? })` enforces the same target eligibility for direct callers. `baseUrl` defaults to the browser's editor origin; outside a browser, pass the editor's URL/origin to resolve relative targets and identify same-origin absolute demo URLs. Without a base, Node callers must supply an absolute production URL. `validateWorkflow(workflow)` checks editable graph configuration and deliberately does not block building or testing on the demo.

Workflow schema version 1 remains compatible. `includeSubpages` is an optional boolean in the public TypeScript types so older workflows still load; missing values mean `false`. The builder, restored/imported workflows, AI request parsers, and exports default it to false. Both frontend and server AI parsers validate and preserve the field, and response operations preserve it. Changes use the existing save/restore, undo/redo, and activity history paths.

Hosts can reuse the configuration dialog with `builder.configureWebsite({ requireExportable: true, onSave: (workflow) => { /* reopen export UI */ } })`. The callback runs only after a valid save, never on cancellation. `builder.getWorkflow()` returns a copy of the latest committed workflow so action handlers can recheck `validateExportTarget` or `exportWorkflow` without relying on possibly stale host UI state.

## Nodes and execution

| Node           | Configuration and behavior                                                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger        | Page ready, click, hover, submit, input change, element zoom-in, element swipe, exit intention, rage clicking, inactivity, scroll thrashing, or scroll down threshold. Element events use delegated listeners. |
| HTTP request   | HTTP method, URL, JSON headers, raw request body, and optional response data path in Outputs. Failed requests pass error data downstream and continue the run. The target API must allow the site's origin through CORS.                |
| Update element | Change text/HTML, add/remove classes, hide/show, or set an attribute on all matching elements. Value-based actions accept a manual value or incoming data with an optional data path. |
| Set cookie     | Creates or updates a cookie on the current website using a name, value, and session or persistent expiration. The next step runs after the value can be read back. |
| Delay          | Wait 0–86,400,000 milliseconds.                                                                                                                                                  |
| Condition      | Tests incoming data, element existence, device, language, referrer, date ranges, time of day, URL parameters, or cookies (including local and session storage). The upper `true` output runs on a match; otherwise the lower `false` output runs.                                                          |
| Loop           | Executes the complete `body` path 1–1,000 times, then executes the `done` path once. Do not connect the body back to the loop; graph cycles are rejected.                        |
| Popover        | Author-provided HTML or a sandboxed iframe, 240–960px wide, placed at screen center, any corner, or beneath a picked anchor. Anchored popovers reposition on scrolling/resizing. |
| Note           | Editable canvas text with bold, italic, and strikethrough formatting, preset or custom background colors, and a transparent option. Notes have no connections and do not run. |

Connections from a step execute in order. HTTP requests output their response body as incoming data for downstream nodes, including Conditions. Other nodes preserve that data. Each outgoing path receives the same input independently; requests on one path do not overwrite sibling paths or concurrent runs. Repeat sends its incoming data to each body iteration and its Done branch. Conditions do not evaluate JavaScript expressions. An execution limit protects against excessive loops.

Select a node to see its setup guidance and **Outputs** in the step details panel. Outputs explain when the next step runs: **Next** for triggers and actions, **Data** for HTTP responses, **True**/**False** for conditions, and **Body**/**Done** for loops. Notes and frames show that they have no outputs. Trigger choices also include event-specific hints, and condition descriptions explain what each check matches.

On the canvas, HTTP nodes show a blue output socket and **DATA OUT** label. Conditions configured for **Incoming data** and Update element nodes with **Use incoming data** show a blue input socket and **Uses incoming data** badge. A direct connection from an HTTP data output to either of these inputs is highlighted blue; changing the receiving node's configuration updates the highlighting automatically. Other connections can still pass data through intermediate steps, but only these direct data connections receive the blue highlight.

Failed HTTP requests output `{ "error": { "message": "Request failed: HTTP 503 Unavailable.", "code": 503 } }` and continue downstream. The code is the numeric HTTP status, or `"NETWORK_ERROR"` for network or response-body read failures; the message describes the failure. Errors bypass **Response data path**, so conditions can always inspect `error.code` or `error.message`. The execution log still records the HTTP error. Invalid node configuration still reports an error and stops execution, and stopping the workflow still cancels pending requests.

Successful HTTP responses always parse valid JSON into native values and otherwise preserve the complete body as text. **Response data path** lives in **Outputs** and selects a value from parsed JSON; non-JSON responses ignore the path. Previously saved response format settings are ignored. Empty paths output the whole body. Paths support properties and zero-based array indexes, such as `user.name`, `data.items[0].price`, `items[2].tags`, or `[0].name`. Properties use letters, digits, `_`, `$`, or `-` (starting with a letter, `_`, or `$`); quoted keys and wildcards are unsupported. Missing response paths pass `undefined` downstream without stopping the run; an explicit `null` stays `null`. Downstream Incoming data conditions can use Does not exist to check for missing output. Malformed path syntax still reports an error.

**Update element** uses a manual value by default. Turn on **Use incoming data** to use connected data for text, HTML, CSS class, and attribute-value actions. Incoming mode shows a blue input socket and a **Uses incoming data** badge on the canvas. An optional **Incoming data path** selects a nested response value; leave it empty when HTTP already selected the value. Strings pass directly, numbers and booleans become text, and null or missing values become empty text. Arrays and objects become JSON text; CSS class actions instead accept arrays of class-name strings. Hide and Show do not need values. Targets and attribute names remain manually configured, and the original incoming data continues downstream unchanged.

The **Incoming data** condition uses an optional **Incoming data path** with the same syntax; empty means all incoming data. Comparisons adapt to the actual value: numeric equality/order accepts finite decimal numbers (including exponents); strings use exact case-sensitive text and stay strings unless ordering requires numeric comparison. Boolean equality accepts `true`/`false`. Array and object equality uses JSON and compares deeply, ignoring object key order while preserving array order. Contains checks a substring, a deep-equal array item (JSON or plain text; quote numeric strings), or an exact own object key. Matches uses a case-sensitive regular expression without slash delimiters. Unsupported comparisons and invalid patterns stop the run and appear in the execution log.

Exists checks whether the path resolves, including `null`. Is null and Is not null both require a resolved path; missing values match neither. Other operators report missing-path errors. Is empty checks empty strings, arrays, or objects; whitespace, `0`, and `false` are not empty. Use null operators for `null` and true/false operators for boolean data. Unary operators hide the comparison field. All new settings are retained by JSON persistence, AI editing, preview, and standalone export.

For example, connect **HTTP request → Condition → Update element** to show a customer's name only when it exists. If the API returns `{ "user": { "name": "Ada" } }`, leave the HTTP response data path empty, set the condition to **Incoming data** with path `user.name` and operator **Exists**, then connect its **True** output to Update element. Choose the text action, enable **Use incoming data**, set its incoming data path to `user.name`, and target the element to update. The HTTP-to-condition connection is blue, and the condition preserves the response for Update element to display `Ada`.

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
import { createActivityStore, VisualDXPBuilder, type ActivityEntry } from 'visual-dxp';

const initialActivity: ActivityEntry[] = [];
const activityStore = createActivityStore(initialActivity);

export function ExperienceEditor() {
  return <VisualDXPBuilder activityStore={activityStore} activityUser="Daniel Beltrán" />;
}

// When the host receives the latest activity from its server:
// activityStore.replaceEntries(serverEntries);
```

An `ActivityEntry` has `{ id: string, username: string, action: string, timestamp: string }` and an optional structured `message: { key, params }`. Builder-generated entries include `message` so the activity panel can render them in the viewer’s language; persist it together with the English `action` snapshot. `timestamp` is an ISO date string. See [Internationalization](docs/i18n.md). The public `ActivityStore` contract is:

```ts
interface ActivityStore {
  getSnapshot(): readonly ActivityEntry[];
  subscribe(listener: () => void): () => void;
  append(entry: ActivityEntry): void;
  remove(id: string): void;
}
```

`getSnapshot` must return the same array reference until entries change. Publish a new immutable snapshot and notify subscribers when local or server updates arrive; `subscribe` returns an unsubscribe function. `append` and `remove` should update the local snapshot synchronously. A production adapter can then persist entries or their deletion asynchronously through the host's API, handling retries and reconciling server updates by entry ID. Undo targets the original entry's ID and store, leaving unrelated activity untouched. Edits undone before their activity is saved cancel the pending entry. The included `createActivityStore` supplies these in-memory operations plus `replaceEntries` to accept a complete updated history from the server.

The builder does not contact an activity server or store activity in localStorage itself; embedded builders start with an empty in-memory activity history unless the host supplies a store. This project's demo supplies a localStorage-backed store under `visual-dxp-activity-v1`, alongside the workflow saved under `visual-dxp-workflow-v1`. Activity updates, including Undo removals and Redo restorations, are saved automatically. Missing or invalid saved history starts empty; if browser storage is unavailable or full, activity continues in memory.

## AI workflow assistant

The **AI chat** button to the left of Canvas Help opens a conversation for creating, updating, removing, and connecting steps. It sends the current workflow and selected node with each message. Valid edits are applied together as one undoable change. If you edit the canvas while the assistant is working, its response is rejected so your changes are preserved. Chat history stays in memory and is not saved to browser storage.

The demo configures the reusable builder with the same-origin endpoint:

```tsx
<VisualDXPBuilder ai={{ endpoint: '/api/ai/chat', credentials: 'same-origin' }} />
```

AI is enabled **only** by an explicitly supplied, nonempty `ai.endpoint`. There is no implicit endpoint or environment-based opt-in. Omit `ai`, or pass an empty endpoint, to hide both the assistant and AI Settings; saved browser settings do not enable either feature.

```tsx
// Assistant and AI Settings tab (default when endpoint is supplied).
<VisualDXPBuilder ai={{ endpoint: '/api/ai/chat', credentials: 'same-origin' }} />

// Assistant only. Existing settings stay saved; unlock/lock/remove remain in chat.
<VisualDXPBuilder ai={{ endpoint: 'https://builder.example/api/ai/chat', showSettings: false }} />

// No AI UI or AI requests, even if encrypted browser settings already exist.
<VisualDXPBuilder />
```

AI Settings has accessible **OpenAI**, **Claude**, and **Self-Hosted** tabs with brand/computer icons. Viewing a tab and activating a provider are independent. **Save and activate** persists valid settings before switching providers; failed saves preserve the previous configuration. An unlocked saved configuration can be activated without re-entering its key. The active badge and assistant header identify the selected provider, while readiness/lock errors are shown separately. The compact assistant settings use the same controls.

Each provider retains its own editable model ID and encrypted credentials. Self-Hosted uses an OpenAI-compatible API base URL and optional API key; no encryption passphrase is needed without a key. Local model servers must be reachable from the application backend, explicitly allowed by `AI_LOCAL_ALLOWED_BASE_URLS`, and support workflow tool calls. Localhost refers to the backend machine. See [provider and local runtime setup](docs/ai-integration.md).

Browser settings require HTTPS except on localhost, 127.0.0.1 and [::1]. Version-2 settings safely migrate existing OpenAI ciphertext under the historical `visual-dxp-ai-settings-v1` key. Active provider, viewed tab and non-secret configurations are stored separately from workflow data; API keys use AES-256-GCM/PBKDF2-SHA-256 encryption with provider/destination binding. No plaintext keys or passphrases are persisted. Reload locks credentials. Origin changes need session confirmation. Unsaved edits and tab browsing do not affect requests; effective configuration changes cancel requests and block stale edits.

> Your API key is stored encrypted in this browser. The application backend uses it only for the selected provider. It is never included in published sites or workflow exports.

Removing settings preserves provider selection; configure the provider again in AI Settings when needed. Direct provider execution uses Vercel AI SDK Core with request-scoped instances, fixed cloud destinations, local allowlisting, no redirects, disabled telemetry and OpenAI `store: false`. Development and debugging execution modes are documented separately in [backend setup](docs/langchain.md). All providers use the same workflow tools and atomic validated edit batches. `ai.headers` remains reserved for application authentication/CSRF; provider headers come from saved settings.

The integrated chat route works without app login in development and production. It accepts browser AI Settings or the server’s configured provider credentials and retains same-origin checks and rate limiting. See [AI integration and deployment requirements](docs/ai-integration.md) and [server execution modes](docs/langchain.md).

## Visual element selection

Trigger events, Update element, and anchored Popover nodes expose **Select on website**. Enter a URL, hover to highlight elements, click to retain the selection, and choose **Use element**. You can also enter a CSS selector manually.

The builder uses opaque sandbox origins for all untrusted previews, including same-origin URLs. It never accesses their DOM directly. For external websites, copy `dist/picker-bridge.js` to that website and include:

```html
<script src="/picker-bridge.js" data-parent-origin="https://your-editor.example"></script>
```

Use the exact editor origin, including its port when relevant, with no trailing slash. The bridge checks the parent window, exact origin, protocol, and session channel. It only operates while the authorized editor activates a picker session and removes selection listeners/outlines on stop.

The target website must permit embedding via its `Content-Security-Policy: frame-ancestors` and `X-Frame-Options` settings. Neither a React component nor this bridge can override browser framing policy. Remote sites that you cannot configure still support manual CSS selector entry.

See [MDN: iframe contentDocument](https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/contentDocument) and [MDN: postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) for the browser model.

**Live previews run in an isolated sandbox origin.** The included demo works automatically. On an external preview website, install the runtime bridge in that website's bundle:

```ts
import { installPreviewBridge } from 'visual-dxp';
installPreviewBridge('https://your-editor.example');
```

The bridge accepts workflow run/stop commands only from the exact parent origin. Parent messages validate the iframe source, sandbox origin (`null`), protocol and random channel; they carry no settings or credentials. Sandboxing disables access to cookies/localStorage and some integrations, so storage conditions take their unavailable-data branch. Test those integrations on a dedicated preview origin outside the builder. Serve published sites on a different origin from the builder; paths and storage prefixes do not isolate browser storage. Never install the builder or its settings code into a published site.

## JavaScript export and runtime

Export produces a dependency-free script. Host the downloaded file and load it on the target website:

```html
<script src="/welcome-journey.js" defer></script>
```

It registers triggers, executes actions, and exposes `window.visualDXP`. Reinjecting an exported script first disposes of the previous Visual DXP runtime. Stop it with `window.visualDXP.destroy()`.

You can also use the runtime directly:

```ts
import { createRuntime, exportWorkflow, validateWorkflow } from 'visual-dxp';

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
