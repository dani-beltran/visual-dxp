import { randomUUID } from 'node:crypto';

export const MAX_LOG_BODY_BYTES = 64 * 1024;
const secretKey =
  /authorization|cookie|api.?key|password|passwd|secret|credential|access.?token|refresh.?token|private.?key|^headers$/i;

export function captureLimit(): number {
  const value = Number(process.env.LLM_CONTENT_MAX_BYTES ?? 262144);
  return Number.isFinite(value) ? Math.max(256, Math.min(1048576, value)) : 262144;
}

/** Redact before slicing/chunking so secrets split over tokens/chunks cannot escape. */
export function redact(value: unknown, extraSecrets: string[] = []): unknown {
  const secrets = [
    ...extraSecrets,
    ...Object.entries(process.env)
      .filter(([key]) => secretKey.test(key) || key.includes('OTLP_HEADERS'))
      .map(([, value]) => value ?? ''),
  ].filter(Boolean);
  function clean(input: unknown, depth = 0): unknown {
    if (depth > 40) return '[DEPTH LIMIT]';
    if (typeof input === 'string') {
      // Tools often return JSON encoded inside strings (including workflow headers).
      try {
        const parsed: unknown = JSON.parse(input);
        if (parsed && typeof parsed === 'object') return JSON.stringify(clean(parsed, depth + 1));
      } catch {
        /* Plain text. */
      }
      let output = input;
      for (const secret of secrets) output = output.split(secret).join('[REDACTED]');
      return output
        .replace(
          /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,
          '[REDACTED]',
        )
        .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9+/=_\-.]+/gi, '[REDACTED]')
        .replace(
          /\b(?:sk-[\w-]{8,}|glc_[\w+/=-]+|gh[pousr]_[\w]+|AKIA[A-Z0-9]{16})\b/g,
          '[REDACTED]',
        )
        .replace(
          /(["']?(?:authorization|x-api-key|api[_-]?key|password|secret|access[_-]?token)["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;}]+)/gi,
          '$1[REDACTED]',
        );
    }
    if (Array.isArray(input)) return input.map((item) => clean(item, depth + 1));
    if (input && typeof input === 'object')
      return Object.fromEntries(
        Object.entries(input).map(([key, item]) => [
          key,
          secretKey.test(key) ? '[REDACTED]' : clean(item, depth + 1),
        ]),
      );
    return input;
  }
  return clean(value);
}

export function utf8Prefix(value: string, maxBytes: number): string {
  const bytes = Buffer.from(value);
  if (bytes.length <= maxBytes) return value;
  let end = Math.floor(maxBytes);
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) end--;
  return bytes.subarray(0, end).toString('utf8');
}

export type ContentMetadata = Record<string, string | number | boolean>;

/** content_json fragments concatenate into the redacted JSON, unless truncated=true. */
export function contentRecords(
  value: unknown,
  metadata: ContentMetadata,
  secrets: string[] = [],
  limit = captureLimit(),
) {
  const serialized = JSON.stringify(redact(value, secrets)) ?? 'null';
  const captured = utf8Prefix(serialized, limit);
  const base = {
    ...Object.fromEntries(
      Object.entries(metadata).map(([key, item]) => [
        key,
        typeof item === 'string' ? utf8Prefix(String(redact(item, secrets)), 512) : item,
      ]),
    ),
    record_id: randomUUID(),
    original_bytes: Buffer.byteLength(serialized),
    captured_bytes: Buffer.byteLength(captured),
    truncated: Buffer.byteLength(serialized) > limit || metadata.truncated === true,
  };
  const chunks: string[] = [];
  let part = '';
  let bytes = 0;
  // Count the escaped JSON body bytes, not JS UTF-16 characters. Reserve 16 KiB
  // for the envelope, with another 192 KiB below Cloud Loki's 256 KiB line limit.
  for (const char of captured) {
    const size = Buffer.byteLength(JSON.stringify(char)) - 2;
    if (bytes + size > 48 * 1024) {
      chunks.push(part);
      part = '';
      bytes = 0;
    }
    part += char;
    bytes += size;
  }
  chunks.push(part);
  return chunks.map((content_json, chunk_index) => ({
    ...base,
    chunk_index,
    chunk_count: chunks.length,
    content_json,
  }));
}

/** Only retain bounded content when opted in. The provider already bounds bodies to 2 MiB. */
export class StreamCapture {
  private parts: { type: string; text: string }[] = [];
  private bytes = 0;
  truncated = false;
  constructor(
    private enabled: boolean,
    private limit = captureLimit(),
  ) {}
  append(key: string, text: string) {
    if (!this.enabled) return;
    // Keep extra suffix for redaction across the eventual truncation boundary.
    const prefix = utf8Prefix(text, Math.max(0, this.limit + 4096 - this.bytes));
    this.bytes += Buffer.byteLength(prefix);
    this.truncated ||= prefix !== text;
    if (prefix) {
      const last = this.parts.at(-1);
      if (last?.type === key) last.text += prefix;
      else this.parts.push({ type: key, text: prefix });
    }
  }
  value() {
    return this.parts;
  }
}
