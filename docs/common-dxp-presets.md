# Common DXP workflow presets

`commonDXPPresets` contains twelve independent examples, ordered by implementation complexity. Every preset is an editable, JSON-serializable object literal in its own file under `src/presets/`, checked with `satisfies WorkflowPreset`. The catalog covers all ten current node kinds. Static IDs remain stable when the workflow is applied; annotation IDs are never used in connections.

Each preset carries its setup instructions as editable, disconnected note nodes on the canvas, beside the steps they explain. Onboarding places these notes inside the corresponding stage frames. The common presets omit the optional `setupInstructions` metadata, so their cards show the scenario summary while setup guidance appears when applied. Other consumers can still supply that optional metadata for their own preset cards.

Every canvas also has a green overview note to the left of the workflow, containing the preset title in bold followed by its description.

```tsx
import { VisualDXPBuilder, commonDXPPresets } from 'dlb-dxp';

<VisualDXPBuilder presets={commonDXPPresets} />;
```

The demo explicitly passes the collection through `App` to `VisualDXPBuilder`. The builder imports no preset collection: omitting `presets`, or passing an empty array, leaves the Presets tab hidden. Each preset is also a named public export (for example, `campaignHeadlinePreset` and `segmentedOnboardingPreset`). The collection's array order and each preset's `order` agree.

Applying a preset replaces the graph and preserves the editor's current workflow name, website URL, and subpage scope. It deep-clones the graph, supports Undo, and never executes it automatically. The built-in `/demo-site.html` is a preview target; configure your own website before exporting. When previewing URL personalization, set the preview website URL to `/demo-site.html?utm_campaign=everyday-edit`. The exported scope ignores query strings, but the runtime condition reads the visitor's actual query parameters.

## Preset reference

The first three are ordered by their final implementation: two connected nodes, a linear delay, then conditional execution. Exit intent precedes the returning-visitor example because its true branch simply ends. Node types below are distinct types, rather than counts. Every preset also includes setup `note` nodes; these annotations add no execution complexity.

| Order | Preset / export | Complexity | Purpose and node types | Required setup |
| --- | --- | --- | --- | --- |
| 10 | Click-to-open help / `clickToOpenHelpPreset` | Beginner | Click a newsletter link to show help beside the form. `trigger`, `popover`. | Demo trigger `#collection .section-heading a`; anchor `#newsletter form`. Replace with your accessible help link/button and form. Adapt newsletter copy to your terms. |
| 20 | Delayed welcome / `delayedWelcomePreset` | Beginner | Page load → 2-second pause → welcome. `trigger`, `delay`, `popover`. | Update welcome copy and the `#collection` link. Runs on every page load. |
| 30 | Campaign headline / `campaignHeadlinePreset` | Beginner | Page load → current UTC campaign week → headline. False leaves the page alone. `trigger`, `fork`, `dom`. | Monday–Sunday dates are calculated when `campaign-headline.ts` loads; reload to refresh the available preset. Change `.hero h1` and copy. Text updates replace nested markup. |
| 40 | Engaged-reader invitation / `engagedReaderInvitationPreset` | Beginner | Downward scroll to 70% → invitation → display marker. `trigger`, `popover`, `cookie`. | A scrollable page with `#newsletter`; `dxp_reader_invitation=shown` lasts 7 days. This records display and does not suppress invitations on later page loads. |
| 50 | Mobile-specific messaging / `mobileSpecificMessagingPreset` | Intermediate | Page load → mobile/desktop → distinct hero copy. `trigger`, `fork`, `dom`. | Target `.hero .description`; test browser device hints/user agents. Resizing alone does not change the branch. |
| 60 | Campaign URL personalization / `campaignUrlPersonalizationPreset` | Intermediate | Page load → exact query match → campaign/default copy. `trigger`, `fork`, `dom`. | Set `utm_campaign=everyday-edit`, or replace the key/value. Target `.hero .description`. Values are case-sensitive. |
| 70 | Exit-intent offer with frequency control / `exitIntentOfferPreset` | Intermediate | Exit intent → prior display check → offer → session marker. Matching true ends silently. `trigger`, `fork`, `popover`, `cookie`. | Verify the sample shipping offer and `#collection` link. `dxp_exit_offer=shown` is a session cookie. Retest with a new runtime and cleared marker. |
| 80 | Returning-visitor experience / `returningVisitorExperiencePreset` | Intermediate | Prior welcome → returning copy; otherwise welcome and remember. `trigger`, `fork`, `dom`, `popover`, `cookie`. | `.hero .description`, `#collection`, and `dxp_visitor_welcome=shown` (30 days). The marker records welcome display, not visitor identity. |
| 90 | Inactivity assistance / `inactivityAssistancePreset` | Intermediate | 30 seconds idle → form existence → 1-second pause → anchored help; absent form → general help. `trigger`, `fork`, `delay`, `popover`. | `#newsletter form` must still exist after the pause. Remove it to test fallback. Activity can restart the inactivity timer but does not cancel an already-started delay. |
| 100 | Frustration recovery / `frustrationRecoveryPreset` | Advanced | Three nearby clicks → session gate → help → generic HTTP event → marker. `trigger`, `fork`, `popover`, `http`, `cookie`. | Configure the HTTP endpoint below. `#collection` link; `dxp_assistance_shown=shown` session marker. Detection uses three clicks within 1 second and 40 CSS pixels, across the document. |
| 110 | Bounded CTA attention sequence / `boundedCtaAttentionPreset` | Advanced | CTA click → two complete highlight/rest iterations → completion tip. `trigger`, `loop`, `dom`, `delay`, `popover`. | Trigger `#shop-now`, target `#collection h2`, and CSS below. The demo CTA scrolls to that heading. |
| 120 | Segmented onboarding journey / `segmentedOnboardingPreset` | Advanced | Page load → prior-delivery check → campaign/default copy → delayed contextual guidance → HTTP → completion marker. `trigger`, `fork`, `dom`, `delay`, `popover`, `http`, `cookie`, `frame`, `note`. | Configure HTTP; `.hero .description`, `#shop-now`, `#collection`; optional `utm_campaign=everyday-edit`. Marker `dxp_onboarding_delivered=yes` lasts 30 days. Campaign waits 1.5 seconds; default waits 2 seconds. |

## HTTP examples

The two request nodes use **`https://events.example.invalid/dxp-events`**, a reserved, non-serving placeholder. Replace it before running either HTTP example. There is no bundled event service or analytics integration.

For a local mock, supply `fetch` through `createRuntime` and return a successful response, without any network access:

```ts
import { createRuntime, frustrationRecoveryPreset } from 'dlb-dxp';

const runtime = createRuntime(frustrationRecoveryPreset.workflow, {
  fetch: async (_url, init) => {
    // Inspect only the fixed generic event body in this local mock.
    console.log(init?.body);
    return new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
});
runtime.start();
// Call runtime.destroy() when the host view unmounts.
```

For the demo preview or an exported script, edit the request node's URL to a local mock server or an endpoint you own. It must accept POST with `Content-Type: application/json` and return 2xx. If the endpoint is cross-origin, enable CORS for the actual website origin, POST, and the Content-Type header, including any preflight. No authentication headers or secrets are included. The only bodies are:

```json
{"event":"assistance_shown"}
{"event":"onboarding_guidance_displayed"}
```

Do not add visitor identifiers, email addresses, form values, page URLs, or other personal data. The presets do not collect those values. An actual HTTP connection may carry normal browser transport metadata and same-origin cookies; configure your own endpoint appropriately. The mock does not perform a connection.

A failed HTTP response or network error stops execution before the following cookie. There is no error branch or retry action in these graphs. Popovers have already rendered at that point. A 2xx response means the HTTP step succeeded; it does not prove durable server storage. The response is not interpolated into content or used for personalization.

## Loop and CSS

The demo includes this stylesheet rule. Add it to your own target site when adapting the attention example:

```css
.dxp-cta-attention {
  outline: 3px solid #697856;
  outline-offset: 6px;
}
```

`attention-loop` has `iterations: 2`. Its `body` handle runs add-class → 600 ms delay → remove-class → 600 ms delay, awaiting the complete path on each iteration. The final body node has no outgoing edge. Only the loop's `done` handle connects to the completion popover, which appears once after 2.4 seconds. No edge loops back, and no body node connects to the completion popover.

The effect uses no animation or layout shift. Completion describes the completed DOM sequence, not visitor engagement. Separate clicks can start overlapping runs; the runtime has no execution lock. Destroying it cancels delays but does not revert DOM edits. A host that interrupts the sequence should remove the class during cleanup.

## Runtime boundaries and onboarding semantics

- Campaign-week targeting uses an inclusive UTC `date-range`, calculated in `campaign-headline.ts` for the current Monday–Sunday week when the module loads. It handles month/year boundaries and stores plain date strings. Applied and exported workflows retain their saved dates; reload and reapply the preset or edit the dates to refresh them. There is no recurring day-of-week condition.
- A `fork` selects `true` or `false`; unconnected outputs end that path. An annotation never executes. Frames precede children in the array; child positions are relative to their frame, with room for its header. Three onboarding frames separate recognition, guidance, and delivery; their notes explain setup and branch behavior.
- “Cookie” conditions check exact matches in cookies, local storage, and session storage. Cookie nodes write host-only cookies at `/`, with SameSite=Lax and Secure on HTTPS. `cookieDays: 0` omits expiration. Browser session restoration may preserve session cookies. Use separate keys for these examples, and clear the same key from all three stores when retesting.
- Frequency control is best effort. Cookie access may be blocked, and multiple invocations can pass a gate before a pending HTTP request saves its marker. These examples do not implement an atomic rate limit.
- Popover steps complete after insertion into the DOM. They never wait for a close button, a link click, reading, signup, or a purchase. The reader/visitor markers record display. Onboarding's completion marker means its chosen DOM update and guidance rendered and its generic request returned 2xx. Returning visitors receive only updated copy; they do not replay guidance or HTTP.
- Device targeting uses client hints or user-agent detection. Selector conditions check existence, not visibility. An anchored popover errors if its anchor is missing when it executes; the inactivity fallback only handles absence at the preceding condition.
- Exit intent detects a pointer leaving the top edge once per runtime. Scroll depth requires downward movement across the configured percentage of scrollable distance and fires once per runtime. Rage clicks are document-wide. Inactivity can recur after new activity. None infers business intent with certainty.
- HTML copy is static and author-controlled. There is no user profile lookup, analytics SDK, conversion observation, or templated response interpolation in these presets. The demo newsletter form is itself a local demonstration, not a subscription service.

## Verification

`tests/common-presets.test.ts` checks catalog coverage, unique IDs/order, JSON round trips, both validators, export after target configuration, trigger reachability, demo selectors/links, separated card bounds, and valid frame containment. Browser events, device information, time, cookies, and HTTP are mocked to exercise branching, display frequency, exact loop sequencing, and request failure paths. No live requests are sent.

`tests/presets.test.tsx` applies every frozen source preset through the real Presets tab, edits it in the inspector, and mutates nested editor output to verify source isolation. It also retains the omitted/empty-tab regression checks. `tests/demo-activity.test.tsx` verifies that the demo displays the collection in order.
