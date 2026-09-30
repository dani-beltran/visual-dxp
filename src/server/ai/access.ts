import { isIP } from 'node:net';

/** Trust only a single-IP header overwritten by the deployment's reverse proxy. */
export function aiRateLimitKey(request: Request): string {
  const header = (process.env.AI_RATE_LIMIT_IP_HEADER ?? 'cf-connecting-ip').trim().toLowerCase();
  if (!header || !/^[a-z0-9-]+$/.test(header)) return 'ip:unknown';
  const value = request.headers.get(header)?.trim();
  if (!value || value.includes('%') || !isIP(value)) return 'ip:unknown';
  if (isIP(value) === 4) return `ip:${value}`;
  // Canonicalize IPv6 so alternate spellings cannot create extra quotas.
  const canonical = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  // IPv4-mapped IPv6 and its IPv4 spelling identify the same client.
  const mapped = /^::ffff:([\da-f]+):([\da-f]+)$/.exec(canonical);
  if (mapped) {
    const high = Number.parseInt(mapped[1], 16);
    const low = Number.parseInt(mapped[2], 16);
    return `ip:${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }
  return `ip:${canonical}`;
}

// No request bodies or provider keys are retained here.
const buckets = new Map<string, { count: number; reset: number }>();
export function allowAIRequest(bucketKey: string): boolean {
  const now = Date.now();
  for (const [id, bucket] of buckets) if (bucket.reset <= now) buckets.delete(id);
  const bucket = buckets.get(bucketKey) ?? { count: 0, reset: now + 60_000 };
  if (buckets.size >= 10_000 && !buckets.has(bucketKey)) return false;
  buckets.set(bucketKey, bucket);
  return ++bucket.count <= 20;
}
