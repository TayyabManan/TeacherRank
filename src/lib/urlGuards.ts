/**
 * SSRF guards for the avatar proxy (`api/image-proxy.ts`).
 *
 * These live under src/ deliberately. Everything in api/ is excluded from both
 * tsconfig's `include` and eslint's config, so code there is neither
 * type-checked nor linted — which is how the original proxy shipped an
 * allowlist implemented as `url.includes(domain)` on the unparsed string, with
 * no scheme check at all. That made it a general-purpose SSRF and an open proxy
 * that could serve attacker HTML from this app's own origin. Keeping the
 * decision logic here means it is compiled, linted and unit-tested with the
 * rest of the app; `api/image-proxy.ts` is left as thin I/O around it.
 *
 * Nothing in the browser bundle imports this module, so it is tree-shaken out
 * of the client build.
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** Hosts the proxy will fetch from. Matched exactly, or as a dot-delimited suffix. */
export const ALLOWED_HOSTS = [
  'comsats.edu.pk',
  'lums.edu.pk',
  'nu.edu.pk',
  'pu.edu.pk',
  'ui-avatars.com',
] as const;

/**
 * Response types the proxy will re-serve.
 * `image/svg+xml` is excluded deliberately — SVG executes script.
 */
export const ALLOWED_CONTENT_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
]);

/** Thrown for any refused request. The message is for server logs, never the caller. */
export class Denied extends Error {}

/**
 * Exact or dot-delimited-suffix match against ALLOWED_HOSTS.
 *
 * The important property is what this REJECTS: `comsats.edu.pk.attacker.tld`
 * (suffix confusion) and `attacker.tld/comsats.edu.pk` (the old substring test
 * matched the path). Only a real hostname is ever passed in.
 */
export function hostAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, ''); // tolerate a trailing root dot
  return ALLOWED_HOSTS.some(d => host === d || host.endsWith('.' + d));
}

/**
 * True for anything that is not a public unicast address: loopback, link-local
 * (169.254.0.0/16 — the cloud metadata range), RFC1918, CGNAT, multicast and
 * reserved space, plus IPv6 equivalents and IPv4-mapped forms.
 */
export function isPrivateAddress(ip: string): boolean {
  if (ip.includes(':')) {
    const v6 = ip.toLowerCase();
    if (v6 === '::' || v6 === '::1') return true;
    if (/^fe[89ab]/.test(v6)) return true; // link-local
    if (/^f[cd]/.test(v6)) return true; // unique-local
    const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }

  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true; // unparseable — refuse rather than guess
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast + reserved
  return false;
}

/**
 * Parse, then apply every check that must hold before opening a connection.
 * Throws `Denied` with a log-only reason.
 *
 * Must be re-run for every redirect hop: an open redirect on an allowlisted
 * host would otherwise re-open the SSRF that the hostname check closes.
 *
 * Residual risk: between this lookup and fetch's own resolution there is a
 * DNS-rebinding window. Exploiting it requires authoritative DNS control over a
 * domain already in ALLOWED_HOSTS, so it is accepted rather than pinning the
 * resolved address and overriding the Host header.
 */
export async function assertSafeTarget(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Denied('malformed URL');
  }

  if (url.protocol !== 'https:') throw new Denied(`scheme ${url.protocol}`);
  if (url.username || url.password) throw new Denied('credentials in URL');
  if (!hostAllowed(url.hostname)) throw new Denied(`host ${url.hostname}`);

  const host = url.hostname.replace(/^\[|\]$/g, '');
  let addresses: string[];
  if (isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await lookup(host, { all: true })).map(r => r.address);
    } catch {
      throw new Denied(`unresolvable ${host}`);
    }
  }
  if (addresses.length === 0) throw new Denied(`no address for ${host}`);
  for (const address of addresses) {
    if (isPrivateAddress(address)) throw new Denied(`non-public address ${address}`);
  }

  return url;
}
