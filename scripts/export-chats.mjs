import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DAY_NS = 86_400_000_000_000n;
const SECOND_NS = 1_000_000_000n;
const UUID = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const CONTENT_EVENTS = new Set(['llm.input', 'llm.output', 'tool.input', 'tool.result']);
const TERMINAL_EVENTS = new Set(['workflow.completed', 'workflow.remote.completed']);
const isTrue = (value) => value === true || value === 'true';
const timestamp = (ns) => new Date(Number(BigInt(ns) / 1_000_000n)).toISOString();

export function parseArgs(args) {
  const options = { days: 7, watch: false, interval: 60, help: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--watch') options.watch = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--days' || arg === '--interval') {
      const value = Number(args[++i]);
      if (!Number.isSafeInteger(value) || value < 1) {
        throw new Error(`${arg} requires a positive integer`);
      }
      options[arg.slice(2)] = value;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

export function configuration(env) {
  for (const key of ['LOKI_URL', 'LOKI_USERNAME', 'LOKI_READ_TOKEN']) {
    if (!env[key]) throw new Error(`Missing ${key}; see docs/observability.md`);
  }
  const url = new URL(env.LOKI_URL);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('LOKI_URL must be an HTTP(S) URL without embedded credentials');
  }
  if (url.search || url.hash) throw new Error('LOKI_URL must not contain a query or fragment');
  const service = env.LOKI_SERVICE_NAME || env.OTEL_SERVICE_NAME || 'visual-dxp';
  // Escape the service as a literal RE2 value; include its remote agent service too.
  const pattern = `${service.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(-agent)?`;
  return {
    url: `${url.toString().replace(/\/$/, '')}/loki/api/v1/query_range`,
    authorization: `Basic ${Buffer.from(`${env.LOKI_USERNAME}:${env.LOKI_READ_TOKEN}`).toString('base64')}`,
    selector: `{service_name=~${JSON.stringify(pattern)}}`,
  };
}

export function createLokiClient(
  config,
  {
    fetcher = fetch,
    sleep = delay,
    limit = 1000,
    signal = /** @type {AbortSignal | undefined} */ (undefined),
  } = {},
) {
  async function page(query, start, end) {
    const url = new URL(config.url);
    for (const [key, value] of Object.entries({ query, start, end, limit, direction: 'forward' })) {
      url.searchParams.set(key, String(value));
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      signal?.throwIfAborted();
      let response;
      try {
        response = await fetcher(url, {
          headers: { Authorization: config.authorization },
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
            : AbortSignal.timeout(30_000),
          redirect: 'error',
        });
      } catch {
        signal?.throwIfAborted();
        if (attempt === 2) throw new Error('Loki network request failed after 3 attempts');
        await sleep(1000 * 2 ** attempt, undefined, { signal });
        continue;
      }
      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && attempt < 2) {
          await response.body?.cancel();
          await sleep(1000 * 2 ** attempt, undefined, { signal });
          continue;
        }
        throw new Error(`Loki query failed (HTTP ${response.status})`);
      }
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('Loki returned invalid JSON');
      }
      if (data.status !== 'success' || data.data?.resultType !== 'streams') {
        throw new Error('Loki returned an unsuccessful or unexpected query response');
      }
      return data.data.result.flatMap((stream) =>
        stream.values.map(([time, line]) => ({
          time,
          line,
          service: stream.stream.service_name || '',
        })),
      );
    }
  }

  return async function queryRange(query, start, end) {
    const unique = new Map();
    async function collect(left, right) {
      const entries = await page(query, left, right);
      if (entries.length >= limit) {
        if (right - left <= 1n) {
          throw new Error(
            'Loki result limit reached within 1ns; cannot guarantee a complete export',
          );
        }
        const middle = (left + right) / 2n;
        // Keep the shared boundary timestamp; never advance the cursor by 1ns.
        await collect(left, middle);
        await collect(middle, right);
        return;
      }
      for (const entry of entries) {
        unique.set(JSON.stringify([entry.service, entry.time, entry.line]), entry);
      }
    }
    // Keep individual requests within one day even for a long lookback.
    for (let left = start; left < end; left += DAY_NS) {
      await collect(left, left + DAY_NS < end ? left + DAY_NS : end);
    }
    return [...unique.values()].map((entry) => {
      let body;
      try {
        body = JSON.parse(entry.line);
      } catch {
        throw new Error('A matching Loki log body is not valid JSON');
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new Error('A matching Loki log body is not a JSON object');
      }
      return { ...entry, body };
    });
  };
}

export function discoverRuns(entries) {
  const runs = new Map();
  for (const entry of entries) {
    const body = entry.body;
    if (!TERMINAL_EVENTS.has(body.event_type) || !['success', 'error'].includes(body.status))
      continue;
    if (!UUID.test(body.workflow_run_id))
      throw new Error('Invalid workflow_run_id in completion log');
    const previous = runs.get(body.workflow_run_id);
    const completions = [...(previous?.completions || []), entry];
    const root = completions.filter((item) => item.body.event_type === 'workflow.completed');
    const selected = (root.length ? root : completions).reduce((a, b) =>
      BigInt(a.time) >= BigInt(b.time) ? a : b,
    );
    runs.set(body.workflow_run_id, { ...selected, completions });
  }
  return [...runs.values()].sort((a, b) =>
    BigInt(a.time) > BigInt(b.time)
      ? -1
      : BigInt(a.time) < BigInt(b.time)
        ? 1
        : a.body.workflow_run_id.localeCompare(b.body.workflow_run_id),
  );
}

export function reconstruct(entries) {
  const groups = new Map();
  for (const entry of entries) {
    if (!CONTENT_EVENTS.has(entry.body.event_type)) continue;
    const id = entry.body.record_id;
    if (typeof id !== 'string' || !id) throw new Error('Content record has no record_id');
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(entry);
  }
  return [...groups.values()]
    .map((chunks) => {
      const first = chunks[0];
      const metadata = first.body;
      const warnings = new Set();
      const count = Number(metadata.chunk_count);
      const parts = new Map();
      if (!Number.isSafeInteger(count) || count < 1 || count > 100_000)
        warnings.add('invalid chunk count');
      const { content_json: _content, chunk_index: _index, ...base } = metadata;
      const canonical = (value) =>
        JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
      for (const chunk of chunks) {
        const { content_json, chunk_index, ...other } = chunk.body;
        if (canonical(base) !== canonical(other)) warnings.add('conflicting chunk metadata');
        const index = Number(chunk_index);
        if (
          !Number.isSafeInteger(index) ||
          index < 0 ||
          index >= count ||
          typeof content_json !== 'string'
        ) {
          warnings.add('invalid chunk');
          continue;
        }
        if (parts.has(index) && parts.get(index) !== content_json)
          warnings.add(`conflicting chunk ${index}`);
        else parts.set(index, content_json);
      }
      const missing = [];
      if (Number.isSafeInteger(count) && count > 0 && count <= 100_000) {
        for (let index = 0; index < count; index++) if (!parts.has(index)) missing.push(index);
        if (missing.length) warnings.add(`missing chunks: ${missing.join(', ')}`);
      }
      if (isTrue(metadata.truncated)) warnings.add('truncated content');
      if (isTrue(metadata.partial)) warnings.add('partial output');
      if (isTrue(metadata.interrupted)) warnings.add('interrupted output');
      if (!Number.isSafeInteger(Number(metadata.sequence)) || Number(metadata.sequence) < 0)
        warnings.add('invalid sequence');
      const raw = [...parts]
        .sort(([a], [b]) => a - b)
        .map(([, value]) => value)
        .join('');
      let value;
      if (
        !warnings.size ||
        [...warnings].every((item) => ['partial output', 'interrupted output'].includes(item))
      ) {
        try {
          value = JSON.parse(raw);
        } catch {
          warnings.add('invalid assembled JSON');
        }
      }
      return { ...first, value, raw, warnings: [...warnings] };
    })
    .sort((a, b) => {
      const sequence = Number(a.body.sequence) - Number(b.body.sequence);
      if (Number.isFinite(sequence) && sequence) return sequence;
      return (
        a.service.localeCompare(b.service) ||
        (BigInt(a.time) < BigInt(b.time) ? -1 : BigInt(a.time) > BigInt(b.time) ? 1 : 0) ||
        a.body.record_id.localeCompare(b.body.record_id)
      );
    });
}

function readable(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(readable).join('\n\n');
  if (value && typeof value === 'object') {
    if ('role' in value && 'content' in value)
      return `${String(value.role).toUpperCase()}\n${readable(value.content)}`;
    if (['text', 'reasoning'].includes(value.type) && typeof value.text === 'string') {
      return value.type === 'reasoning' ? `REASONING\n${value.text}` : value.text;
    }
  }
  return JSON.stringify(value, null, 2);
}

export function renderConversation(run, entries, records, reviewed = '') {
  const starts = entries.filter((entry) =>
    ['workflow.started', 'workflow.remote.started'].includes(entry.body.event_type),
  );
  const started = starts.reduce(
    (minimum, entry) => (!minimum || BigInt(entry.time) < BigInt(minimum) ? entry.time : minimum),
    '',
  );
  const incomplete = records.length === 0 || records.some((record) => record.warnings.length);
  const lines = [
    `Run: ${run.body.workflow_run_id}`,
    `Status: ${run.body.status}`,
    `Started: ${started ? timestamp(started) : 'unavailable'}`,
    `Completed: ${timestamp(run.time)}`,
    `Reviewed: ${reviewed}`,
    `Workflow: ${run.body.workflow_id || 'unavailable'}`,
    `Trace: ${run.body.trace_id || 'unavailable'}`,
    `Content: ${incomplete ? 'incomplete' : 'complete (all retrieved records reconstructed; delivery is best effort)'}`,
    'Date folder timezone: Europe/Madrid',
    'Input history is repeated for each model call as captured.',
  ];
  if (!records.length)
    lines.push(
      '',
      '[No conversation content available: capture may have been disabled, or logs were lost/expired.]',
    );
  for (const record of records) {
    const body = record.body;
    lines.push(
      '',
      `[${String(body.sequence).padStart(4, '0')}] ${body.role?.toUpperCase() || 'UNKNOWN'} — ${body.event_type}`,
      `Time: ${timestamp(record.time)} | Service: ${record.service}`,
      `Record: ${body.record_id} | Model call: ${body.llm_call_id || 'unavailable'}`,
    );
    if (body.tool_name) lines.push(`Tool: ${body.tool_name}`);
    if (body.message_index !== undefined) lines.push(`Message index: ${body.message_index}`);
    if (record.warnings.length) lines.push(`[WARNING: ${record.warnings.join('; ')}]`);
    lines.push(
      '',
      record.value === undefined
        ? `[Available raw fragments]\n${record.raw}`
        : readable(record.value),
    );
  }
  const errors = entries.filter((entry) => entry.body.status === 'error');
  if (errors.length) {
    lines.push('', 'ERROR EVENTS');
    for (const { body } of errors) lines.push(JSON.stringify(body, null, 2));
  }
  return `${lines.join('\n')}\n`;
}

export async function saveConversation(output, run, entries, records) {
  if (!UUID.test(run.body.workflow_run_id)) throw new Error('Invalid workflow_run_id');
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp(run.time)));
  const folder = join(output, date, run.body.status === 'error' ? 'failed' : 'successful');
  const filename = join(folder, `${run.body.workflow_run_id}.txt`);
  let previous = '';
  try {
    previous = await readFile(filename, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const reviewed = previous.match(/^Reviewed:([^\r\n]*)/m)?.[1].replace(/^ /, '') || '';
  const text = renderConversation(run, entries, records, reviewed);
  if (text === previous) return 'unchanged';
  await mkdir(folder, { recursive: true });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, text, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await rename(temporary, filename);
  } finally {
    await rm(temporary, { force: true });
  }
  return 'written';
}

export async function exportChats({
  config,
  days = 7,
  output = join(ROOT, 'logs/chats'),
  now = Date.now(),
  query = createLokiClient(config),
  sleep = delay,
  report = console.log,
  signal = /** @type {AbortSignal | undefined} */ (undefined),
}) {
  const end = BigInt(now) * 1_000_000n;
  const start = end - BigInt(days) * DAY_NS;
  report(`Querying completed runs: ${timestamp(start)} through ${timestamp(end)}`);
  const terminalQuery = `${config.selector} | json | event_type=~"workflow.completed|workflow.remote.completed" | status=~"success|error"`;
  const runs = discoverRuns(await query(terminalQuery, start, end));
  const counts = { discovered: runs.length, written: 0, unchanged: 0, incomplete: 0, failed: 0 };
  for (const run of runs) {
    signal?.throwIfAborted();
    try {
      let from = BigInt(run.time);
      for (const completion of run.completions) {
        const duration = Number(completion.body.duration_seconds);
        const lookback =
          Number.isFinite(duration) && duration >= 0
            ? BigInt(Math.ceil(duration + 60)) * SECOND_NS
            : BigInt(days) * DAY_NS;
        const candidate = BigInt(completion.time) - lookback;
        if (candidate < from) from = candidate;
      }
      const runQuery = `${config.selector} | json | workflow_run_id=${JSON.stringify(run.body.workflow_run_id)}`;
      let entries = await query(runQuery, from, end);
      let records = reconstruct(entries);
      if (
        !records.length ||
        records.some((record) =>
          record.warnings.some((warning) => warning.startsWith('missing chunks')),
        )
      ) {
        await sleep(1000, undefined, { signal });
        entries = await query(
          runQuery,
          from,
          BigInt(Date.now()) * 1_000_000n > end ? BigInt(Date.now()) * 1_000_000n : end,
        );
        records = reconstruct(entries);
      }
      if (!records.length || records.some((record) => record.warnings.length)) counts.incomplete++;
      counts[await saveConversation(output, run, entries, records)]++;
      report(`${run.body.workflow_run_id}: ${run.body.status}`);
    } catch (error) {
      signal?.throwIfAborted();
      counts.failed++;
      // Never print raw server responses, URLs, credentials, or filesystem error messages.
      report(
        `${run.body.workflow_run_id}: export failed${error.message?.startsWith('Loki ') ? ` — ${error.message}` : ''}`,
      );
    }
  }
  report(
    Object.entries(counts)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', '),
  );
  return counts;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(
      'Usage: npm run logs:chats -- [--days 7] [--watch] [--interval 60]\nExports to logs/chats/YYYY-MM-DD/{successful,failed}/<workflow_run_id>.txt',
    );
    return;
  }
  for (const name of ['.env.local', '.env']) {
    try {
      process.loadEnvFile(join(ROOT, name));
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`Unable to load ${name}`);
    }
  }
  const config = configuration(process.env);
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    do {
      try {
        const counts = await exportChats({
          config,
          days: options.days,
          query: createLokiClient(config, { signal: controller.signal }),
          signal: controller.signal,
        });
        process.exitCode = counts.failed ? 1 : 0;
      } catch (error) {
        if (controller.signal.aborted) break;
        console.error(
          error.message?.startsWith('Loki ')
            ? error.message
            : 'Export failed; check configuration and log format',
        );
        process.exitCode = 1;
      }
      if (!options.watch || controller.signal.aborted) break;
      try {
        await delay(options.interval * 1000, undefined, { signal: controller.signal });
      } catch {
        break;
      }
    } while (!controller.signal.aborted);
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof TypeError ? 'Invalid configuration' : error.message);
    process.exitCode = 1;
  });
}
