# AI settings verification

The settings UI now shows ChatGPT identity connection states. Hosted approval/configuration is pending, so live sign-in is disabled by default. See [the integration limitations](chatgpt-auth.md).

Automated coverage:

- `tests/ai-settings-ui.test.tsx`: full/compact surfaces, disabled setup, sign-in and sign-out transitions, failures, safe redirects, endpoint opt-in, obsolete browser records, unavailable storage and stripped provider headers.
- `tests/server/chatgpt-auth.test.ts`: documented PKCE/OIDC protocol, real signed JWT validation against mocked JWKS, replay/missing/mismatched/expired transactions, denied consent, secure cookies, confidential client authentication, isolated sessions and revocation.
- `tests/server/environment-ai.test.ts`: provider selection/defaults/aliases, health readiness, invalid selection, ignored legacy transport headers.
- `tests/server/providers.test.ts`: all provider SDK serialization, remote precedence, workflow tools, bounded loops, local destination restrictions, errors, secret reflection, cancellation and atomic edits.
- `tests/chat.test.tsx`, `tests/server/routes.test.ts`, `tests/server/agent.test.ts` and `tests/server/streaming.test.ts`: existing editing, stale-canvas checks, cancellation, streaming and remote execution; storage changes do not affect pending AI requests.

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` and `npm run build:lib`. No live model calls or approved ChatGPT client are required for automated tests. A real hosted sign-in smoke test remains necessary after approval and deployment configuration.
