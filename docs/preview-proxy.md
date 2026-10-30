# Public website preview proxy

The Next.js app uses a server-side proxy for external target websites in the element picker, workflow preview, popover preview, and website connection/branding check. Public pages do not need to install `bridge.js` or change their framing headers. The built-in demo and local same-origin pages retain their existing isolated preview behavior.

## Local setup

```dotenv
PREVIEW_EDITOR_ORIGIN=http://localhost:3000
PREVIEW_PROXY_ORIGIN=http://127.0.0.1:3000
PREVIEW_PROXY_SECRET=<at-least-32-random-characters>
```

The origin variables have the defaults shown above. Set `PREVIEW_PROXY_SECRET` explicitly before using previews; it has no default or generated fallback, including in development. Run `npm run dev` and open **http://localhost:3000**. `localhost` and `127.0.0.1` are distinct browser origins, although they reach the same local Next.js server. The preview host must differ from the editor host. Origins must include their scheme and any nonstandard port, without a trailing slash or path. Never derive the authorized editor origin from a target URL or a query parameter.

Missing, blank, or shorter-than-32-character signing secrets cause preview requests to fail in every environment. Changing the secret invalidates existing preview sessions; reload the picker or preview to reconnect. If you use a different port, update both origin variables and the Next.js port together.

## Production

```dotenv
PREVIEW_EDITOR_ORIGIN=https://editor.example.com
PREVIEW_PROXY_ORIGIN=https://preview.example.net
PREVIEW_PROXY_SECRET=<at-least-32-random-characters>
```

Route both hostnames to the same Next.js deployment and preserve the original `Host` header at the reverse proxy. Use a dedicated preview host without editor cookies or other applications. The server refuses to serve proxied content on the editor host. The same signing secret must be present on every instance; it stays on the server. Missing/short keys and identical origins fail closed.

The session endpoint uses an exact editor-origin check and per-IP rate limiting. As with the existing application APIs, deployments that require application login must enforce that authentication at their ingress or session endpoint. Origin checks are not authentication. The quota uses the existing trusted single-IP header configuration (`AI_RATE_LIMIT_IP_HEADER`); only use a header overwritten by your reverse proxy. Unidentified clients share a fallback bucket.

## Transport and isolation

1. `POST /api/preview/sessions` accepts `{ "url": "https://public-site.example/page" }` from the configured editor and returns a signed iframe URL plus `expiresAt`.
2. The URL encodes a capability for one upstream origin and resource kind, expiring after 15 minutes. Paths and queries remain separate from the token. Rewritten links and assets receive capabilities for their own origins with the same expiry.
3. The content endpoint resolves public DNS afresh and pins the validated addresses to the outbound connection. It rejects private/reserved addresses, mixed public/private DNS answers, nonstandard upstream ports, URL credentials, and non-HTTP(S) targets. Redirect destinations undergo the same checks when requested.
4. Only GET/HEAD are proxied. Signed OPTIONS preflights from the opaque sandbox authorize GET/HEAD reads with custom headers without contacting upstream or allowing credentials. Editor request headers, cookies, and authorization are not forwarded; upstream cookies and cache validators are not returned. Requests have a 12-second deadline, an 8 MiB resource limit, a 2 MiB HTML/CSS limit, and a 16 MiB transformed-response limit. Transformations allow up to 5,000 URL references. Session creation is limited to 20 requests/minute and resource loading to 600 requests/minute per quota key.
5. HTML and CSS parsers rewrite ordinary resource URLs, responsive images, stylesheet imports, document links, and import-map addresses/scopes. HTTP redirects remain on the proxy. Existing bases are resolved against the upstream page before replacement. The bridge is injected once, with the configured parent origin and original document/base URLs.
6. Every enforced upstream CSP policy has its framing directive replaced by the proxy policy, and `X-Frame-Options` is omitted. Resource directives are adapted for delivery through the proxy; the bridge is authorized by its exact script URL or a nonce when the upstream policy already uses nonces/hashes. A second policy enforces `frame-ancestors 'self' <editor-origin>; sandbox allow-scripts; object-src 'none'`. Upstream CSP reporting is removed to avoid disclosing capability URLs. HTTP development previews also remove upgrade directives that would force the loopback server to HTTPS.

Both iframe attributes and response CSP retain sandboxing without `allow-same-origin`. Messages still validate their iframe source, opaque `null` origin, protocol, and random channel. Framing permission alone does not grant DOM access to the editor. Workflows, branding storage keys, and exported target URLs keep the real website URL. Workflow HTTP steps resolve relative URLs against the original upstream document base and remain subject to normal browser CORS rules.

## Reusable library

The React library retains direct connections by default and has no Next.js dependency:

```tsx
import { createProxyPreviewTransport, VisualDXPBuilder } from 'visual-dxp';

const previewTransport = createProxyPreviewTransport('/api/preview/sessions');

<VisualDXPBuilder previewTransport={previewTransport} />;
```

Hosts may implement the `PreviewTransport.resolve(url, { signal })` interface to use a different server. `PreviewTransportProvider` supports independently rendered preview components; the exported `ElementPicker` also accepts a `previewTransport` prop. Keep transport objects stable across renders. Cancellation discards stale session results when the target changes or a dialog closes. Reloading a picker/preview creates a fresh session.

## Manual verification

Use **https://daniel-beltran.myshopify.com/** as the target website. It currently redirects to `/password`; both responses return `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'`.

1. Configure the target and confirm the connection/branding check succeeds.
2. Apply the **Campaign headline** preset. Select **Show campaign headline**, then **Select on website**. Click the store heading and choose **Use element**.
3. Open **Test workflow** and wait for **Run workflow** to enable. Run it with the campaign condition dates covering today. The password page's heading changes to the configured text, and the execution log reports successful steps.
4. Reload the website to restore the upstream heading. Close and reopen the preview and picker to confirm fresh sessions reconnect. Check that the saved target and exports use the Shopify URL.
5. For popovers, apply **Delayed welcome** and open its popover content preview. It should render over the same proxied password page.

The public password page is a valid framing/bridge test. This version does not authenticate into the storefront or submit its password form.

## Compatibility boundaries

### Nuxt framework workarounds

Nuxt documents identified by their `__NUXT_DATA__` script receive the compatibility adapter in `src/lib/preview/nuxtFrameworkFixes.ts`; server detection lives in `src/server/preview/nuxtFrameworkFixes.ts`. The injected bridge installs it before upstream scripts execute. It intercepts Nuxt's runtime config assignment to adapt the router base and asset CDN base to signed document/asset paths. This keeps the proxy prefix out of application routes and lets relative JavaScript chunk imports retain their normal resolution. Upstream JavaScript text is not rewritten.

The adapter also maps JavaScript fetch GET/HEAD requests for upstream origins already signed by the server to asset proxy URLs. Queries, Request headers and cancellation signals are retained locally; credentials are omitted and browser headers are not forwarded upstream. Unknown origins and write requests keep their existing browser behavior. This supports public API reads without supporting authenticated APIs or mutations.

When sandboxed storage access throws, `src/lib/preview/sandboxStorage.ts` supplies document-local memory for localStorage/sessionStorage methods. Values are isolated from both the editor and real website and disappear on document reload. This lets Nuxt plugins initialize without enabling `allow-same-origin`. Real cookies and persistent login state remain unavailable. Third-party integrations that access cookies or the parent frame may still report sandbox errors.

Workflow previews stop after five document loads within ten seconds and report a reload-loop error. **Reload website** creates a new preview and resets that guard. Client-side history updates do not count as document loads.

Automated regression tests use synthetic Nuxt HTML and reserved example domains without contacting a live website. For manual verification, use a controlled public Nuxt test deployment with a heading, a public API read, and a second route. Confirm the heading can be updated by a workflow, data loads through signed preview URLs, and route navigation does not repeatedly request the document.

This is a public, read-only page proxy. Login sessions, real cookies/persistent storage, form submissions, service workers, WebSockets, API mutation traffic, and complete SPA behavior are outside its scope. Outside the Nuxt adapter, JavaScript-generated root-relative URLs, dynamic imports, and client-side navigation can bypass static HTML/CSS rewriting and fail. Meta refresh is removed. Nested third-party frames are not pickable through the main document bridge. Some sites also reject server-side clients or rely on integrations that cannot run in an opaque sandbox.

The proxy changes preview responses only. Published workflows still execute directly on their configured production target and use its normal security policy.
