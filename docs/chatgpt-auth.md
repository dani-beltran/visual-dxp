# Hosted ChatGPT sign-in

OpenAI approval and deployment configuration are pending. Sign-in is disabled by default; the settings screen states this. No registered client or live authentication has been tested. The integration implements **hosted identity sign-in only**. AI requests continue to use the environment-configured provider whether signed in or signed out. Identity tokens never become provider API keys.

The supplied [cookbook](https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt) describes a local app with a loopback callback and separately authorized plan usage. This repository is a hosted Next.js app, so it uses the documented [website identity flow](https://developers.openai.com/siwc/website). Hosted ChatGPT plan usage requires approval and its applicable contract before implementation. It is not enabled by setting an environment variable here.

## Configure after approval

Set the server-only values in `.env.example`: `CHATGPT_CLIENT_ID`, the exact registered HTTPS `CHATGPT_REDIRECT_URI` ending in `/api/auth/chatgpt/callback`, `CHATGPT_TOKEN_AUTH_METHOD` (`none` or `client_secret_basic`, as provisioned), and `CHATGPT_CLIENT_SECRET` only for confidential clients. Do not expose these through NEXT_PUBLIC variables. The app retrieves OpenAI's official discovery document and validates its issuer and endpoint origins.

Set `CHATGPT_AUTH_STORAGE_DIR` to an absolute, private persistent directory outside the source tree and web-served paths. The built-in store creates mode-0600 records inside a mode-0700 directory. Deploy it on a trusted filesystem with atomic rename support, shared by every app worker. Ephemeral/serverless filesystems or workers with independent disks are unsupported. Mount private persistent storage or replace the store with a transactional database before deploying to such environments. Set directory ownership and permissions for the application user; do not share it with other applications.

Transactions expire in 10 minutes and are atomically consumed once. Application sessions expire in 8 hours and are revoked on sign-out. Expired records are rejected and stale records are removed on subsequent sign-in attempts. No refresh tokens, access tokens, or raw ID tokens are retained. Session identity uses issuer + client ID + verified subject; names/emails are display data, never account-linking keys. This optional connection does not create application roles or protect the public AI route. Apply deployment access controls independently as described in [AI integration](ai-integration.md).

## Routes and browser behavior

- `GET /api/auth/chatgpt`: availability and public account display data; no tokens.
- `POST /api/auth/chatgpt/sign-in`: fresh state, PKCE S256, nonce, and server-side transaction; returns the documented OpenAI authorization URL.
- `GET /api/auth/chatgpt/callback`: consumes the transaction, exchanges the code, verifies signature/issuer/audience/expiry/nonce, rotates the first-party session, and returns to `/`.
- `POST /api/auth/chatgpt/sign-out`: revokes this app's session and pending transaction. It does not sign out of ChatGPT itself.

The browser holds only opaque `__Host-` cookies with Secure, HttpOnly, SameSite=Lax and Path=/. POST routes require the configured same-origin Origin. Authorization codes, PKCE verifiers, client secrets, and ID tokens never enter React or localStorage. Use HTTPS even for sign-in testing; a provisioned callback must match exactly. Callback responses and AI/auth APIs are not cached. Keep callback query strings, cookies and token traffic out of access logs and tracing.

Library hosts opt in using `ai.authEndpoint` pointing to a same-origin API implementing this contract. The demo supplies it explicitly. Both settings surfaces share session state. Loading, signed-out, signing-in, signed-in, signing-out, unavailable, and recoverable errors are shown. The UI refreshes on window focus/pageshow and offers manual recovery. There is no provider, key, model, or passphrase editor.

## AI precedence

1. If `LANGGRAPH_API_URL` is configured, use the remote execution service and its own provider environment.
2. Otherwise use `AI_PROVIDER` and that provider's server credentials/model.
3. ChatGPT identity sign-in never changes either path and is not required for them.

A future approved hosted plan-usage implementation must add explicit consent and granted-scope checks, account-specific model discovery, token storage/refresh, completed Responses streaming, usage management and an explicit precedence policy. Identity-only success is not proof of model entitlement.

Mocked tests exercise the complete code exchange using cryptographically signed JWTs and JWKS, callback replay/mismatch/expiry, confidential-client authentication, cross-origin rejection, session isolation and logout. After approval, verify actual sign-in/sign-out with the registered hosted client before enabling it for users.
