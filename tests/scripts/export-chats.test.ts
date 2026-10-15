import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import {
  configuration,
  createLokiClient,
  discoverRuns,
  exportChats,
  parseArgs,
  reconstruct,
  renderConversation,
  saveConversation,
} from '../../scripts/export-chats.mjs';

const id = '12345678-1234-1234-1234-123456789abc';
const id2 = '12345678-1234-1234-1234-123456789abd';
const ns = (iso: string) => String(BigInt(Date.parse(iso)) * 1_000_000n);
const time = ns('2026-10-15T22:30:00Z'); // Already October 16 in Madrid.
const config = configuration({
  LOKI_URL: 'https://logs.example.test',
  LOKI_USERNAME: 'tenant',
  LOKI_READ_TOKEN: 'token',
});
type LogBody = Record<string, string | number | boolean>;
const entry = (body: LogBody, when = time, service = 'visual-dxp') => ({
  time: when,
  service,
  body,
});
const completion = (status = 'success', extra: LogBody = {}) =>
  entry({
    event_type: 'workflow.completed',
    workflow_run_id: id,
    status,
    duration_seconds: 5,
    ...extra,
  });
function chunks(value: unknown, sequence = 0, recordId = 'record', extra: LogBody = {}) {
  const text = JSON.stringify(value);
  const split = Math.floor(text.length / 2);
  return [text.slice(0, split), text.slice(split)].map((content_json, chunk_index) =>
    entry({
      event_type: 'llm.input',
      workflow_run_id: id,
      record_id: recordId,
      sequence,
      role: 'user',
      llm_call_id: 'call',
      chunk_index,
      chunk_count: 2,
      content_json,
      ...extra,
    }),
  );
}
const run = (status = 'success') => discoverRuns([completion(status)])[0];
const skipDelay = async <T = void>(_milliseconds?: number, value?: T): Promise<T> => value as T;

test('CLI defaults, overrides, validation, and literal service escaping', () => {
  assert.equal(parseArgs([]).days, 7);
  assert.deepEqual(parseArgs(['--days', '14', '--watch', '--interval', '90']), {
    days: 14,
    watch: true,
    interval: 90,
    help: false,
  });
  for (const args of [
    ['--days'],
    ['--days', '-1'],
    ['--days', '1.5'],
    ['--interval', '0'],
    ['--unknown'],
  ]) {
    assert.throws(() => parseArgs(args));
  }
  assert.throws(() => configuration({}), /Missing LOKI_URL/);
  const env = {
    LOKI_URL: 'https://test',
    LOKI_USERNAME: '1',
    LOKI_READ_TOKEN: 'secret',
    LOKI_SERVICE_NAME: 'a.b',
  };
  assert.equal(configuration(env).selector, '{service_name=~"a\\\\.b(-agent)?"}');
  assert.throws(() => configuration({ ...env, LOKI_URL: 'https://user:pass@test' }));
});

test('reassembles decoded Unicode/escaped content, deduplicates, and orders sequences numerically', () => {
  const first = chunks({ role: 'user', content: 'Hola 👋\n"quoted" \\text' }, 2, 'a');
  const last = chunks({ role: 'assistant', content: [{ type: 'text', text: 'Done' }] }, 10, 'b');
  const records = reconstruct([...last, first[1], first[0], first[0]]);
  assert.deepEqual(
    records.map((record) => record.body.sequence),
    [2, 10],
  );
  assert.equal(records[0].value.content, 'Hola 👋\n"quoted" \\text');
  assert.deepEqual(records[0].warnings, []);
  assert.match(renderConversation(run(), [], records), /Reviewed: \n/);
  assert.match(renderConversation(run(), [], records), /ASSISTANT\nDone/);
});

test('flags missing, conflicting, truncated, interrupted, and invalid content', () => {
  const original = chunks({ content: 'hello' });
  assert.match(reconstruct([original[1]])[0].warnings.join(), /missing chunks: 0/);
  assert.equal(reconstruct([original[1]])[0].value, undefined);
  const conflict = { ...original[0], body: { ...original[0].body, content_json: 'different' } };
  assert.match(reconstruct([...original, conflict])[0].warnings.join(), /conflicting chunk 0/);
  const metadata = { ...original[1], body: { ...original[1].body, sequence: 9 } };
  assert.match(
    reconstruct([original[0], metadata])[0].warnings.join(),
    /conflicting chunk metadata/,
  );
  const truncated = reconstruct(chunks('hello', 0, 'a', { truncated: true }))[0];
  assert.match(truncated.warnings.join(), /truncated content/);
  const interrupted = reconstruct(
    chunks([{ type: 'text', text: 'prefix' }], 0, 'a', { partial: true, interrupted: true }),
  )[0];
  assert.deepEqual(interrupted.value, [{ type: 'text', text: 'prefix' }]);
  assert.match(interrupted.warnings.join(), /interrupted output/);
  assert.match(renderConversation(run(), [], []), /No conversation content available/);
});

test('deduplicates completions and prefers root status to remote status', () => {
  const remote = completion('error', { event_type: 'workflow.remote.completed' });
  const root = completion('success');
  const results = discoverRuns([remote, root, root]);
  assert.equal(results.length, 1);
  assert.equal(results[0].body.status, 'success');
  assert.throws(() => discoverRuns([completion('error', { workflow_run_id: '../escape' })]));
});

test('writes Madrid completion folders for both statuses, preserves review, and is idempotent', async () => {
  const output = await mkdtemp(join(tmpdir(), 'dxp-chat-'));
  try {
    const records = reconstruct(chunks({ role: 'user', content: 'Hello' }));
    for (const status of ['success', 'error']) {
      const destination = join(
        output,
        '2026-10-16',
        status === 'error' ? 'failed' : 'successful',
        `${id}.txt`,
      );
      assert.equal(await saveConversation(output, run(status), [], records), 'written');
      const text = await readFile(destination, 'utf8');
      assert.match(text, /Completed: .*\nReviewed: \n/);
      await writeFile(destination, text.replace('Reviewed: ', 'Reviewed: 2026-10-17'));
      assert.equal(await saveConversation(output, run(status), [], records), 'unchanged');
      const updated = reconstruct(chunks({ role: 'user', content: 'Updated' }));
      await saveConversation(output, run(status), [], updated);
      assert.match(await readFile(destination, 'utf8'), /Reviewed: 2026-10-17\n/);
    }
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test('splits capped responses without skipping records sharing a timestamp', async () => {
  const source = [1n, 2n, 2n, 3n, 8n].map((when, index) => ({
    when,
    line: JSON.stringify({ event_type: 'fixture', index }),
  }));
  let requests = 0;
  const query = createLokiClient(config, {
    limit: 3,
    fetcher: async (url, init) => {
      requests++;
      assert.match(new Headers(init?.headers).get('Authorization') ?? '', /^Basic /);
      const requestUrl = new URL(String(url));
      const start = BigInt(requestUrl.searchParams.get('start') ?? '');
      const end = BigInt(requestUrl.searchParams.get('end') ?? '');
      return Response.json({
        status: 'success',
        data: {
          resultType: 'streams',
          result: [
            {
              stream: { service_name: 'visual-dxp' },
              values: source
                .filter((row) => row.when >= start && row.when < end)
                .slice(0, 3)
                .map((row) => [String(row.when), row.line]),
            },
          ],
        },
      });
    },
  });
  const rows = await query('query', 0n, 10n);
  assert.equal(rows.length, 5);
  assert.ok(requests > 1);
});

test('fails visibly when a single nanosecond saturates Loki limit', async () => {
  const query = createLokiClient(config, {
    limit: 1,
    fetcher: async () =>
      Response.json({
        status: 'success',
        data: { resultType: 'streams', result: [{ stream: {}, values: [['0', '{}']] }] },
      }),
  });
  await assert.rejects(query('query', 0n, 1n), /cannot guarantee a complete export/);
});

test('retries transient failures; auth failures do not expose response bodies', async () => {
  let attempts = 0;
  const query = createLokiClient(config, {
    sleep: skipDelay,
    fetcher: async () => {
      attempts++;
      if (attempts === 1) return new Response('private server detail', { status: 429 });
      if (attempts === 2) throw new Error('private network detail');
      return Response.json({ status: 'success', data: { resultType: 'streams', result: [] } });
    },
  });
  assert.deepEqual(await query('query', 0n, 1n), []);
  assert.equal(attempts, 3);
  const denied = createLokiClient(config, {
    fetcher: async () => new Response('secret', { status: 403 }),
  });
  await assert.rejects(denied('query', 0n, 1n), { message: 'Loki query failed (HTTP 403)' });
});

test('cancellation aborts polling without retrying a cancelled request', async () => {
  const controller = new AbortController();
  let requests = 0;
  const query = createLokiClient(config, {
    signal: controller.signal,
    fetcher: async () => {
      requests++;
      controller.abort();
      throw new Error('Cancelled');
    },
    sleep: async () => assert.fail('A cancelled query must not retry'),
  });
  await assert.rejects(query('query', 0n, 1n), { name: 'AbortError' });
  assert.equal(requests, 1);
});

test('exports failed and successful runs, reaches before lookback for long runs, retries missing chunks, and continues after failure', async () => {
  const output = await mkdtemp(join(tmpdir(), 'dxp-chat-poll-'));
  const now = Date.parse('2026-10-15T23:00:00Z');
  const longRun = completion('error', { duration_seconds: 9 * 86_400 });
  const goodRun = completion('success', { workflow_run_id: id2 });
  const calls: { text: string; start: bigint; end: bigint }[] = [];
  let contentAttempts = 0;
  const query = async (text: string, start: bigint, end: bigint) => {
    calls.push({ text, start, end });
    if (text.includes('event_type=~')) return [longRun, goodRun];
    if (text.includes(id2)) return [];
    contentAttempts++;
    const result = chunks({ role: 'user', content: 'Hello' });
    return contentAttempts === 1 ? [result[0]] : result;
  };
  try {
    const counts = await exportChats({
      config,
      output,
      now,
      days: 7,
      query,
      sleep: skipDelay,
      report: () => {},
    });
    assert.equal(calls[0].start, BigInt(now - 7 * 86_400_000) * 1_000_000n);
    const runQuery = calls.find((call) => call.text.includes(id));
    assert.ok(runQuery);
    assert.ok(runQuery.start < calls[0].start);
    assert.deepEqual(counts, { discovered: 2, written: 2, unchanged: 0, incomplete: 1, failed: 0 });
    assert.match(
      await readFile(join(output, '2026-10-16', 'failed', `${id}.txt`), 'utf8'),
      /Status: error/,
    );
    const failing = await exportChats({
      config,
      output,
      now,
      query: async (text: string) => {
        if (text.includes('event_type=~')) return [longRun, goodRun];
        if (text.includes(id)) throw new Error('private detail');
        return chunks('ok').map((item) => ({
          ...item,
          body: { ...item.body, workflow_run_id: id2 },
        }));
      },
      report: () => {},
    });
    assert.equal(failing.failed, 1);
    assert.equal(failing.written, 1);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
