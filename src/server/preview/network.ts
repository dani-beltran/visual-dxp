import 'server-only';
import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';
import { PreviewError } from './config';

const blocked = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  blocked.addSubnet(address, prefix, 'ipv4');
blocked.addAddress('168.63.129.16', 'ipv4'); // Azure platform virtual IP.
for (const [address, prefix] of [
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
] as const)
  blocked.addSubnet(address, prefix, 'ipv6');
const globalIPv6 = new BlockList();
globalIPv6.addSubnet('2000::', 3, 'ipv6');

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, 'ipv4');
  return family === 6 && globalIPv6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
}

export async function publicAddresses(url: URL, signal: AbortSignal) {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await new Promise<{ address: string; family: number }[]>((resolve, reject) => {
        const abort = () => reject(signal.reason);
        signal.throwIfAborted();
        signal.addEventListener('abort', abort, { once: true });
        void lookup(hostname, { all: true, verbatim: true })
          .then(resolve, reject)
          .finally(() => signal.removeEventListener('abort', abort));
      });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address)))
    throw new PreviewError(
      'Preview destinations must resolve exclusively to public IP addresses.',
      403,
    );
  return addresses;
}

export interface UpstreamResponse {
  status: number;
  headers: Headers;
  body: Buffer;
}

export const MAX_RESOURCE_BYTES = 8 * 1024 * 1024;

/** Resolve and pin DNS once per request. No cookies, credentials, or browser headers are forwarded. */
export async function fetchPublic(
  url: URL,
  signal: AbortSignal,
  method: 'GET' | 'HEAD' = 'GET',
): Promise<UpstreamResponse> {
  const addresses = await publicAddresses(url, signal);
  const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  };
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
      url,
      {
        method,
        lookup: pinnedLookup,
        // Never reuse a socket whose DNS validation belongs to a previous request.
        agent: false,
        signal,
        headers: { 'user-agent': 'VisualDXP-PublicPreview/1.0', 'accept-encoding': 'identity' },
      },
      (response) => {
        const headers = new Headers();
        for (const [name, value] of Object.entries(response.headers)) {
          if (value !== undefined)
            headers.set(name, Array.isArray(value) ? value.join(', ') : value);
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_RESOURCE_BYTES) {
            request.destroy(new PreviewError('Preview resource exceeds the 8 MiB limit.', 413));
            return;
          }
          chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () =>
          resolve({ status: response.statusCode ?? 502, headers, body: Buffer.concat(chunks) }),
        );
      },
    );
    request.on('error', reject);
    request.end();
  });
}
