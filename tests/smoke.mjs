// A test-only provider fixture. The application never substitutes mock responses.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';

const children = new Set();
let providerDisconnected = false;
let providerStarted = false;
const provider = createServer(async (req, res) => {
  assert.equal(req.url, '/runs/wait');
  assert.equal(req.headers['x-api-key'], 'smoke-only-placeholder');
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString());
  assert.equal(body.on_disconnect, 'cancel');
  assert.equal(body.assistant_id, 'workflow_editor');
  assert.equal(body.thread_id, undefined);
  if (body.input.request.messages.at(-1).content === 'hold-for-cancellation') {
    providerStarted = true;
    res.once('close', () => {
      providerDisconnected = true;
    });
    return;
  }
  const first = body.input.request.workflow.nodes.find((node) => node.data.kind === 'trigger');
  const operations = first
    ? [
        { type: 'update_node', id: first.id, label: 'AI smoke-test trigger' },
        {
          type: 'add_node',
          node: {
            id: 'smoke-delay',
            type: 'workflow',
            position: { x: 400, y: 600 },
            data: { kind: 'delay', label: 'AI smoke-test delay', config: { duration: 2000 } },
          },
        },
        { type: 'add_edge', edge: { id: 'smoke-edge', source: first.id, target: 'smoke-delay' } },
      ]
    : [];
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      response: {
        message: 'Mock provider: renamed the trigger and added a connected delay.',
        operations,
      },
    }),
  );
});

async function listen(server, port = 0) {
  server.listen(port, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}

async function waitFor(check) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(50);
  }
  throw new Error('Smoke test timed out.');
}

async function startNext(remoteUrl) {
  const reservation = createServer();
  const port = await listen(reservation);
  await new Promise((resolve) => reservation.close(resolve));
  let output = '';
  const child = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)],
    {
      env: {
        ...process.env,
        OPENAI_API_KEY: '',
        LANGGRAPH_API_URL: remoteUrl,
        LANGGRAPH_ASSISTANT_ID: 'workflow_editor',
        LANGSMITH_API_KEY: 'smoke-only-placeholder',
        LANGSMITH_TRACING: 'false',
        LANGCHAIN_TRACING_V2: 'false',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  children.add(child);
  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  child.stderr.on('data', (chunk) => {
    output += chunk;
  });
  const base = `http://127.0.0.1:${port}`;
  await waitFor(async () => {
    if (child.exitCode !== null) throw new Error(`Next failed: ${output}`);
    try {
      return (await fetch(`${base}/api/ai/health`)).ok;
    } catch {
      return false;
    }
  });
  return { base, child };
}

async function stop(child) {
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await once(child, 'exit');
  }
  children.delete(child);
}

const input = {
  messages: [{ role: 'user', content: 'Rename the trigger and add a connected delay.' }],
  workflow: {
    version: 1,
    name: 'Smoke test',
    websiteUrl: '/demo-site.html',
    nodes: [
      {
        id: 'start',
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: { kind: 'trigger', label: 'Start', config: { event: 'page-load' } },
      },
    ],
    edges: [],
  },
  selectedNodeIds: ['start'],
};
const post = (base, body = JSON.stringify(input), headers = {}, extra = {}) =>
  fetch(`${base}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: base,
      ...headers,
    },
    body,
    ...extra,
  });

try {
  const providerPort = await listen(provider);
  const unconfigured = await startNext('');
  assert.deepEqual(await (await fetch(`${unconfigured.base}/api/ai/health`)).json(), {
    configured: false,
    mode: 'local',
  });
  assert.equal((await post(unconfigured.base)).status, 503);
  await stop(unconfigured.child);

  const { base } = await startNext(`http://127.0.0.1:${providerPort}`);
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Visual DXP/);
  for (const asset of ['demo-site.html', 'picker-bridge.js', 'visual-dxp-logo.png']) {
    const response = await fetch(`${base}/${asset}`);
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(`public/${asset}`));
  }
  const health = await fetch(`${base}/api/ai/health`);
  assert.equal(health.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await health.json(), { configured: true, mode: 'deployment' });
  const response = await post(base);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = await response.json();
  assert.equal(result.operations.length, 3);
  assert.equal(result.operations[0].label, 'AI smoke-test trigger');
  assert.equal((await post(base, '{broken')).status, 400);
  assert.equal((await post(base, undefined, { Origin: 'https://untrusted.example' })).status, 403);
  const unsupported = await fetch(`${base}/api/ai/chat`);
  assert.equal(unsupported.status, 405);
  assert.equal(unsupported.headers.get('cache-control'), 'no-store');
  const preflight = await fetch(`${base}/api/ai/chat`, {
    method: 'OPTIONS',
    headers: { Origin: 'https://untrusted.example' },
  });
  assert.equal(preflight.headers.get('cache-control'), 'no-store');
  assert.equal(preflight.headers.has('access-control-allow-origin'), false);
  assert.equal((await post(base, 'x'.repeat(1024 * 1024 + 1))).status, 413);
  const chunked = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(512 * 1024));
      controller.enqueue(new Uint8Array(512 * 1024 + 1));
      controller.close();
    },
  });
  assert.equal((await post(base, chunked, {}, { duplex: 'half' })).status, 413);
  const controller = new AbortController();
  const cancelled = post(
    base,
    JSON.stringify({ ...input, messages: [{ role: 'user', content: 'hold-for-cancellation' }] }),
    {},
    { signal: controller.signal },
  ).catch((error) => error);
  await waitFor(() => providerStarted);
  controller.abort();
  assert.equal((await cancelled).name, 'AbortError');
  await waitFor(() => providerDisconnected);
  console.log(
    'Production smoke passed: page, exact public assets, health, mocked chat, missing configuration, malformed input, origin, method, declared/chunked limits, and disconnect cancellation.',
  );
  if (process.argv.includes('--keep-running')) {
    console.log(`Test-only mock provider is active for browser verification: ${base}`);
    await Promise.race([once(process, 'SIGINT'), once(process, 'SIGTERM')]);
  }
} finally {
  for (const child of children) await stop(child);
  provider.closeAllConnections();
  await new Promise((resolve) => provider.close(resolve));
}
