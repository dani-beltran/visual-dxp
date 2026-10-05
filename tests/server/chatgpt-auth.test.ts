// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  authConfig,
  finishChatGPTSignIn,
  getChatGPTSession,
  signOutChatGPT,
  startChatGPTSignIn,
} from '../../src/server/auth/chatgpt';

const origin = 'https://builder.test';
const callback = `${origin}/api/auth/chatgpt/callback`;
const issuer = 'https://auth.openai.com';
const endpoints = {
  issuer,
  authorization_endpoint: `${issuer}/api/accounts/authorize`,
  token_endpoint: `${issuer}/api/accounts/oauth/token`,
  jwks_uri: `${issuer}/.well-known/jwks.json`,
};
let directory: string;
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
const pair = await generateKeyPair('RS256');
const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'test', alg: 'RS256' };
const cookies = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((item) => item.split(';')[0])
    .join('; ');
const request = (
  url = `${origin}/api/auth/chatgpt`,
  cookie = '',
  method = 'GET',
  requestOrigin = origin,
) =>
  new Request(url, {
    method,
    headers: { Cookie: cookie, Origin: requestOrigin, 'Sec-Fetch-Site': 'same-origin' },
  });
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'dxp-auth-'));
  vi.stubEnv('CHATGPT_CLIENT_ID', 'oaiapp_test');
  vi.stubEnv('CHATGPT_REDIRECT_URI', callback);
  vi.stubEnv('CHATGPT_TOKEN_AUTH_METHOD', 'none');
  vi.stubEnv('CHATGPT_CLIENT_SECRET', '');
  vi.stubEnv('CHATGPT_AUTH_STORAGE_DIR', directory);
  fetcher = vi.fn(async (url: string | URL | Request) => {
    if (String(url).endsWith('openid-configuration')) return Response.json(endpoints);
    if (String(url) === endpoints.jwks_uri) return Response.json({ keys: [jwk] });
    throw new Error('Unexpected fetch');
  });
  vi.stubGlobal('fetch', fetcher);
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});
async function start() {
  const response = await startChatGPTSignIn(
    request(`${origin}/api/auth/chatgpt/sign-in`, '', 'POST'),
  );
  expect(response.status).toBe(200);
  const url = new URL((await response.json()).authorizationUrl);
  const id = response.headers
    .getSetCookie()
    .find((value) => value.startsWith('__Host-dxp-chatgpt-transaction='))!
    .split(';')[0]
    .split('=')[1];
  const filename = `transaction-${createHash('sha256').update(id).digest('hex')}.json`;
  const transaction = JSON.parse(await readFile(join(directory, filename), 'utf8'));
  return { url, cookie: cookies(response), filename, transaction };
}
async function token(nonce: string, changes: Record<string, unknown> = {}) {
  return new SignJWT({ sub: 'subject-1', name: 'Alex', nonce, ...changes })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setIssuer(issuer)
    .setAudience('oaiapp_test')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(pair.privateKey);
}
function useToken(idToken: string) {
  const defaultFetch = fetcher.getMockImplementation()!;
  fetcher.mockImplementation(async (url, init) =>
    String(url) === endpoints.token_endpoint
      ? Response.json({ id_token: idToken, access_token: 'must-not-be-retained' })
      : defaultFetch(url, init),
  );
}
it('stays disabled without approved configuration and does not contact OpenAI', async () => {
  vi.stubEnv('CHATGPT_CLIENT_ID', '');
  expect(authConfig()).toBeUndefined();
  expect(await (await getChatGPTSession(request())).json()).toEqual({
    available: false,
    account: null,
  });
  expect((await startChatGPTSignIn(request())).status).toBe(503);
  expect(fetcher).not.toHaveBeenCalled();
});
it.each([
  'http://builder.test/api/auth/chatgpt/callback',
  'https://builder.test/other',
  'https://builder.test/api/auth/chatgpt/callback?secret=x',
])('rejects an unsafe/unregistered callback configuration: %s', (url) => {
  vi.stubEnv('CHATGPT_REDIRECT_URI', url);
  expect(authConfig()).toBeUndefined();
});
it('requires the provisioned token auth method and its secret', () => {
  vi.stubEnv('CHATGPT_TOKEN_AUTH_METHOD', 'client_secret_basic');
  expect(authConfig()).toBeUndefined();
  vi.stubEnv('CHATGPT_CLIENT_SECRET', 'secret');
  expect(authConfig()).toBeDefined();
  vi.stubEnv('CHATGPT_TOKEN_AUTH_METHOD', 'guess');
  expect(authConfig()).toBeUndefined();
});
it('rejects cross-origin login and logout before storage/network work', async () => {
  for (const handle of [startChatGPTSignIn, signOutChatGPT])
    expect((await handle(request(undefined, '', 'POST', 'https://evil.test'))).status).toBe(403);
  expect(fetcher).not.toHaveBeenCalled();
});
it('uses fresh PKCE, nonce, identity-only scopes, secure cookies, and protected files', async () => {
  const a = await start();
  const b = await start();
  expect(a.url.searchParams.get('scope')).toBe('openid profile email');
  expect(a.url.searchParams.get('code_challenge_method')).toBe('S256');
  expect(a.url.searchParams.get('redirect_uri')).toBe(callback);
  expect(a.transaction.verifier).not.toBe(a.url.searchParams.get('code_challenge'));
  expect(a.transaction.state).not.toBe(b.transaction.state);
  expect(a.transaction.nonce).not.toBe(b.transaction.nonce);
  expect((await stat(join(directory, a.filename))).mode & 0o777).toBe(0o600);
  const result = await startChatGPTSignIn(request(undefined, '', 'POST'));
  expect(result.headers.get('set-cookie')).toContain('HttpOnly; Secure; SameSite=Lax');
});
it.each(['missing', 'mismatch', 'expired', 'denied'])(
  'rejects %s state without exchanging a code',
  async (failure) => {
    const a = await start();
    if (failure === 'expired')
      await writeFile(
        join(directory, a.filename),
        JSON.stringify({ ...a.transaction, expiresAt: 0 }),
      );
    const state = failure === 'mismatch' ? 'wrong' : a.transaction.state;
    const result = await finishChatGPTSignIn(
      request(
        `${callback}?state=${state}&code=code${failure === 'denied' ? '&error=access_denied' : ''}`,
        failure === 'missing' ? '' : a.cookie,
      ),
    );
    expect(result.headers.get('set-cookie')).toContain('__Host-dxp-chatgpt-error=1');
    expect(fetcher.mock.calls.some(([url]) => String(url) === endpoints.token_endpoint)).toBe(
      false,
    );
  },
);
it('verifies identity, issues an isolated opaque session, consumes callbacks once, and revokes on logout', async () => {
  const a = await start();
  useToken(await token(a.transaction.nonce));
  const result = await finishChatGPTSignIn(
    request(`${callback}?state=${a.transaction.state}&code=code`, a.cookie),
  );
  expect(result.status).toBe(303);
  expect(result.headers.get('set-cookie')).toMatch(/__Host-dxp-chatgpt-session=[\w-]{43}/);
  const sessionCookie = cookies(result);
  expect(await (await getChatGPTSession(request(undefined, sessionCookie))).json()).toEqual({
    available: true,
    account: { name: 'Alex' },
  });
  expect(await (await getChatGPTSession(request())).json()).toEqual({
    available: true,
    account: null,
  });
  const stored = await Promise.all(
    (await readdir(directory)).map((name) => readFile(join(directory, name), 'utf8')),
  );
  expect(stored.join('')).not.toContain('must-not-be-retained');
  expect(stored.join('')).not.toContain('id_token');
  const replay = await finishChatGPTSignIn(
    request(`${callback}?state=${a.transaction.state}&code=code`, a.cookie),
  );
  expect(replay.headers.get('set-cookie')).toContain('__Host-dxp-chatgpt-error=1');
  expect(
    fetcher.mock.calls.filter(([url]) => String(url) === endpoints.token_endpoint),
  ).toHaveLength(1);
  expect((await signOutChatGPT(request(undefined, sessionCookie, 'POST'))).status).toBe(200);
  expect(await (await getChatGPTSession(request(undefined, sessionCookie))).json()).toEqual({
    available: true,
    account: null,
  });
});
it.each(['nonce', 'audience', 'issuer', 'expired', 'signature'])(
  'rejects invalid JWT %s',
  async (failure) => {
    const a = await start();
    const key =
      failure === 'signature' ? (await generateKeyPair('RS256')).privateKey : pair.privateKey;
    const jwt = await new SignJWT({
      sub: 'user',
      nonce: failure === 'nonce' ? 'wrong' : a.transaction.nonce,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test' })
      .setIssuedAt()
      .setIssuer(failure === 'issuer' ? 'https://evil.test' : issuer)
      .setAudience(failure === 'audience' ? 'different-client' : 'oaiapp_test')
      .setExpirationTime(failure === 'expired' ? 1 : '5m')
      .sign(key);
    useToken(jwt);
    const result = await finishChatGPTSignIn(
      request(`${callback}?state=${a.transaction.state}&code=code`, a.cookie),
    );
    expect(result.headers.get('set-cookie')).toContain('__Host-dxp-chatgpt-error=1');
    expect(result.headers.get('set-cookie')).not.toContain('__Host-dxp-chatgpt-session=');
  },
);
it('uses confidential client Basic authentication with the original PKCE verifier', async () => {
  vi.stubEnv('CHATGPT_TOKEN_AUTH_METHOD', 'client_secret_basic');
  vi.stubEnv('CHATGPT_CLIENT_SECRET', 'private secret');
  const a = await start();
  useToken(await token(a.transaction.nonce));
  await finishChatGPTSignIn(
    request(`${callback}?state=${a.transaction.state}&code=code`, a.cookie),
  );
  const [, init] = fetcher.mock.calls.find(([url]) => String(url) === endpoints.token_endpoint)!;
  expect(new Headers(init?.headers).get('authorization')).toBe(
    `Basic ${Buffer.from('oaiapp_test:private+secret').toString('base64')}`,
  );
  const body = new URLSearchParams(String(init?.body));
  expect(body.get('code_verifier')).toBe(a.transaction.verifier);
  expect(body.get('redirect_uri')).toBe(callback);
  expect(body.has('client_secret')).toBe(false);
});
