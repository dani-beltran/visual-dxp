import { timingSafeEqual } from 'node:crypto';

/** Host adapters must verify the app session and authorize access to this workflow. */
export interface AIAccessPolicy {
  authorize(request: Request, workflow: unknown): Promise<string | null>;
}
export const applicationAccess: AIAccessPolicy = {
  async authorize(request) {
    const expected = process.env.AI_APPLICATION_TOKEN?.trim();
    if (!expected) return null;
    const received = request.headers.get('authorization') ?? '';
    const wanted = `Bearer ${expected}`;
    const a = Buffer.from(received);
    const b = Buffer.from(wanted);
    return a.length === b.length && timingSafeEqual(a, b) ? 'configured-application' : null;
  },
};
// No request bodies, provider keys or application tokens are retained here.
const buckets = new Map<string, { count: number; reset: number }>();
export function allowAIRequest(principal: string): boolean {
  const now = Date.now();
  for (const [id, bucket] of buckets) if (bucket.reset <= now) buckets.delete(id);
  const bucket = buckets.get(principal) ?? { count: 0, reset: now + 60_000 };
  if (buckets.size >= 10_000 && !buckets.has(principal)) return false;
  buckets.set(principal, bucket);
  return ++bucket.count <= 20;
}
