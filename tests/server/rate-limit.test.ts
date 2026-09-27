// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aiRateLimitKey, allowAIRequest } from '../../src/server/ai/access';

function request(ip?: string, extra: Record<string, string> = {}) {
  return new Request('https://builder.test/api/ai/chat', {
    headers: { ...(ip === undefined ? {} : { 'CF-Connecting-IP': ip }), ...extra },
  });
}
let now = Date.now();
beforeEach(() => {
  now += 60_001;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  vi.stubEnv('AI_RATE_LIMIT_IP_HEADER', 'cf-connecting-ip');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('IP rate limiting', () => {
  it('defaults to the Cloudflare visitor header', () => {
    vi.stubEnv('AI_RATE_LIMIT_IP_HEADER', undefined);
    expect(aiRateLimitKey(request('192.0.2.1'))).toBe('ip:192.0.2.1');
  });
  it('uses only the configured trusted header', () => {
    const req = request('192.0.2.1', { 'X-Real-IP': '192.0.2.2', 'X-Forwarded-For': '192.0.2.3' });
    expect(aiRateLimitKey(req)).toBe('ip:192.0.2.1');
    vi.stubEnv('AI_RATE_LIMIT_IP_HEADER', ' X-Real-IP ');
    expect(aiRateLimitKey(req)).toBe('ip:192.0.2.2');
    vi.stubEnv('AI_RATE_LIMIT_IP_HEADER', '');
    expect(aiRateLimitKey(req)).toBe('ip:unknown');
  });
  it.each([
    undefined,
    '',
    'not-an-ip',
    '192.0.2.1, 192.0.2.2',
    '192.0.2.1:443',
    '[::1]',
    'fe80::1%eth0',
  ])('shares a fallback quota for missing or invalid IPs: %s', (ip) => {
    expect(aiRateLimitKey(request(ip, { 'X-Forwarded-For': '192.0.2.99' }))).toBe('ip:unknown');
  });
  it.each([
    ['2001:0DB8:0000:0000:0000:0000:0000:0001', '2001:db8::1'],
    ['::ffff:192.0.2.1', '192.0.2.1'],
    ['::ffff:c000:201', '192.0.2.1'],
  ])('normalizes %s to %s', (ip, canonical) => {
    expect(aiRateLimitKey(request(ip))).toBe(`ip:${canonical}`);
  });
  it('resets an IP quota after 60 seconds without resetting another IP early', () => {
    const first = aiRateLimitKey(request('192.0.2.1'));
    const second = aiRateLimitKey(request('2001:db8::2'));
    for (let n = 0; n < 20; n++) expect(allowAIRequest(first)).toBe(true);
    expect(allowAIRequest(first)).toBe(false);
    now += 30_000;
    for (let n = 0; n < 20; n++) expect(allowAIRequest(second)).toBe(true);
    now += 30_000;
    expect(allowAIRequest(first)).toBe(true);
    expect(allowAIRequest(second)).toBe(false);
  });
});
