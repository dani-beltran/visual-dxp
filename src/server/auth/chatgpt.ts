import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { aiRateLimitKey, allowAIRequest } from '../ai/access';

const issuer = 'https://auth.openai.com';
const transactionCookie = '__Host-dxp-chatgpt-transaction';
const sessionCookie = '__Host-dxp-chatgpt-session';
const errorCookie = '__Host-dxp-chatgpt-error';
const transactionTTL = 10 * 60 * 1000;
const sessionTTL = 8 * 60 * 60 * 1000;
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function signingKeys(uri: string) {
  let keys = keySets.get(uri);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(uri));
    keySets.set(uri, keys);
  }
  return keys;
}
const random = () => randomBytes(32).toString('base64url');
interface AuthConfig {
  clientId: string;
  redirectUri: string;
  origin: string;
  method: 'none' | 'client_secret_basic';
  secret: string;
  directory: string;
}
interface Transaction {
  state: string;
  verifier: string;
  nonce: string;
  clientId: string;
  redirectUri: string;
  expiresAt: number;
}
interface Session {
  issuer: string;
  clientId: string;
  subject: string;
  name: string;
  expiresAt: number;
}

/** Disabled until the operator supplies an approved hosted identity client. */
export function authConfig(): AuthConfig | undefined {
  const clientId = process.env.CHATGPT_CLIENT_ID?.trim();
  const redirectUri = process.env.CHATGPT_REDIRECT_URI?.trim();
  const directory = process.env.CHATGPT_AUTH_STORAGE_DIR?.trim();
  const method = process.env.CHATGPT_TOKEN_AUTH_METHOD?.trim();
  const secret = process.env.CHATGPT_CLIENT_SECRET ?? '';
  if (!clientId || !redirectUri || !directory || !isAbsolute(directory)) return;
  if (method !== 'none' && method !== 'client_secret_basic') return;
  if (method === 'client_secret_basic' && !secret) return;
  try {
    const url = new URL(redirectUri);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/api/auth/chatgpt/callback'
    )
      return;
    return { clientId, redirectUri, origin: url.origin, method, secret, directory };
  } catch {
    return;
  }
}
function cookie(request: Request, name: string) {
  return (
    request.headers
      .get('cookie')
      ?.split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? ''
  );
}
function setCookie(response: Response, name: string, value: string, maxAge: number) {
  response.headers.append(
    'Set-Cookie',
    `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`,
  );
}
function response(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
function path(config: AuthConfig, kind: string, id: string) {
  if (!/^[\w-]{43}$/.test(id)) throw new Error('Invalid session.');
  const hash = createHash('sha256').update(id).digest('hex');
  return join(config.directory, `${kind}-${hash}.json`);
}
async function save(config: AuthConfig, kind: string, id: string, value: Transaction | Session) {
  await mkdir(config.directory, { recursive: true, mode: 0o700 });
  await writeFile(path(config, kind, id), JSON.stringify(value), { mode: 0o600, flag: 'wx' });
}
async function remove(config: AuthConfig, kind: string, id: string) {
  if (!/^[\w-]{43}$/.test(id)) return;
  await unlink(path(config, kind, id)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
}
async function read<T extends { expiresAt: number }>(
  config: AuthConfig,
  kind: string,
  id: string,
): Promise<T | undefined> {
  if (!/^[\w-]{43}$/.test(id)) return;
  try {
    const value = JSON.parse(await readFile(path(config, kind, id), 'utf8')) as T;
    if (value.expiresAt > Date.now()) return value;
    await remove(config, kind, id);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
async function consume(config: AuthConfig, id: string): Promise<Transaction> {
  // Atomic rename ensures a callback is consumed at most once across workers.
  const original = path(config, 'transaction', id);
  const consumed = `${original}.${random()}.used`;
  await rename(original, consumed);
  try {
    const value = JSON.parse(await readFile(consumed, 'utf8')) as Transaction;
    if (value.expiresAt <= Date.now()) throw new Error('Expired transaction.');
    return value;
  } finally {
    await unlink(consumed);
  }
}
function validOrigin(request: Request, config: AuthConfig) {
  const site = request.headers.get('sec-fetch-site');
  return (
    new URL(request.url).origin === config.origin &&
    request.headers.get('origin') === config.origin &&
    (!site || site === 'same-origin')
  );
}
async function discovery() {
  const result = await fetch(`${issuer}/.well-known/openid-configuration`, {
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!result.ok) throw new Error('Discovery failed.');
  const data = await result.json();
  if (data.issuer !== issuer) throw new Error('Invalid issuer.');
  for (const key of ['authorization_endpoint', 'token_endpoint', 'jwks_uri']) {
    const url = new URL(data[key]);
    if (url.origin !== issuer || url.username || url.password || url.hash)
      throw new Error('Invalid discovery.');
  }
  return data as {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    jwks_uri: string;
  };
}

export async function getChatGPTSession(request: Request): Promise<Response> {
  const config = authConfig();
  if (!config) return response({ available: false, account: null });
  try {
    const session = await read<Session>(config, 'session', cookie(request, sessionCookie));
    const current =
      session?.clientId === config.clientId && session.issuer === issuer ? session : undefined;
    const result = response({
      available: true,
      account: current ? { name: current.name } : null,
      ...(cookie(request, errorCookie) ? { error: 'sign_in_failed' } : {}),
    });
    setCookie(result, errorCookie, '', 0);
    if (!current) setCookie(result, sessionCookie, '', 0);
    return result;
  } catch {
    return response({ error: 'session_unavailable' }, 503);
  }
}

export async function startChatGPTSignIn(request: Request): Promise<Response> {
  const config = authConfig();
  if (!config) return response({ error: 'not_configured' }, 503);
  if (!validOrigin(request, config)) return response({ error: 'invalid_origin' }, 403);
  try {
    if (!allowAIRequest(`chatgpt:${aiRateLimitKey(request)}`))
      return response({ error: 'rate_limited' }, 429);
    const endpoints = await discovery();
    await mkdir(config.directory, { recursive: true, mode: 0o700 });
    // Remove abandoned records without parsing or retaining their contents.
    for (const file of await readdir(config.directory)) {
      if (!/^(transaction|session)-[a-f0-9]{64}\.json(?:\.[\w-]{43}\.used)?$/.test(file)) continue;
      const location = join(config.directory, file);
      const info = await stat(location).catch(() => undefined);
      const ttl = file.startsWith('transaction-') ? transactionTTL : sessionTTL;
      if (info && info.mtimeMs + ttl < Date.now()) await unlink(location).catch(() => {});
    }
    await remove(config, 'transaction', cookie(request, transactionCookie));
    const id = random();
    const transaction: Transaction = {
      state: random(),
      verifier: random(),
      nonce: random(),
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      expiresAt: Date.now() + transactionTTL,
    };
    await save(config, 'transaction', id, transaction);
    const url = new URL(endpoints.authorization_endpoint);
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
      state: transaction.state,
      nonce: transaction.nonce,
      code_challenge_method: 'S256',
      code_challenge: createHash('sha256').update(transaction.verifier).digest('base64url'),
    }).toString();
    const result = response({ authorizationUrl: url.href });
    setCookie(result, transactionCookie, id, transactionTTL / 1000);
    setCookie(result, errorCookie, '', 0);
    return result;
  } catch {
    return response({ error: 'sign_in_failed' }, 502);
  }
}

export async function finishChatGPTSignIn(request: Request): Promise<Response> {
  const config = authConfig();
  if (!config) return response({ error: 'not_configured' }, 503);
  const result = new Response(null, {
    status: 303,
    headers: {
      Location: `${config.origin}/`,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
  setCookie(result, transactionCookie, '', 0);
  try {
    const url = new URL(request.url);
    const transaction = await consume(config, cookie(request, transactionCookie));
    if (
      url.origin !== config.origin ||
      transaction.state !== url.searchParams.get('state') ||
      transaction.clientId !== config.clientId ||
      transaction.redirectUri !== config.redirectUri ||
      url.searchParams.has('error') ||
      !url.searchParams.get('code')
    )
      throw new Error('Invalid callback.');
    const endpoints = await discovery();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (config.method === 'client_secret_basic') {
      const encode = (value: string) => new URLSearchParams({ value }).toString().slice(6);
      headers.Authorization = `Basic ${Buffer.from(`${encode(config.clientId)}:${encode(config.secret)}`).toString('base64')}`;
    }
    const tokenResponse = await fetch(endpoints.token_endpoint, {
      method: 'POST',
      headers,
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        code: url.searchParams.get('code')!,
        code_verifier: transaction.verifier,
        redirect_uri: transaction.redirectUri,
      }),
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenResponse.ok) throw new Error('Token exchange failed.');
    const tokens = await tokenResponse.json();
    if (typeof tokens.id_token !== 'string') throw new Error('Missing identity.');
    const { payload } = await jwtVerify(tokens.id_token, signingKeys(endpoints.jwks_uri), {
      issuer,
      audience: config.clientId,
      requiredClaims: ['sub', 'exp', 'iat'],
      clockTolerance: 5,
    });
    if (payload.nonce !== transaction.nonce || typeof payload.sub !== 'string' || !payload.sub)
      throw new Error('Invalid identity.');
    const id = random();
    const name =
      typeof payload.name === 'string'
        ? payload.name
        : typeof payload.email === 'string'
          ? payload.email
          : 'ChatGPT';
    await save(config, 'session', id, {
      issuer,
      clientId: config.clientId,
      subject: payload.sub,
      name: name.slice(0, 200),
      expiresAt: Date.now() + sessionTTL,
    });
    await remove(config, 'session', cookie(request, sessionCookie));
    setCookie(result, sessionCookie, id, sessionTTL / 1000);
    setCookie(result, errorCookie, '', 0);
  } catch {
    setCookie(result, errorCookie, '1', 60);
  }
  return result;
}

export async function signOutChatGPT(request: Request): Promise<Response> {
  const config = authConfig();
  if (!config) return response({ error: 'not_configured' }, 503);
  if (!validOrigin(request, config)) return response({ error: 'invalid_origin' }, 403);
  try {
    await remove(config, 'session', cookie(request, sessionCookie));
    await remove(config, 'transaction', cookie(request, transactionCookie));
    const result = response({ available: true, account: null });
    for (const name of [sessionCookie, transactionCookie, errorCookie])
      setCookie(result, name, '', 0);
    return result;
  } catch {
    return response({ error: 'sign_out_failed' }, 503);
  }
}
