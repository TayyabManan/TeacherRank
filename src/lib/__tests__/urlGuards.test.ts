import { describe, it, expect } from 'vitest';
import {
  ALLOWED_CONTENT_TYPES,
  Denied,
  assertSafeTarget,
  hostAllowed,
  isPrivateAddress,
} from '../urlGuards';

/**
 * These cases are the actual bypasses that worked against the previous
 * `api/image-proxy.ts`, which gated on `url.includes(domain)` over the unparsed
 * string with no scheme check. Each one must stay refused.
 *
 * Only deny-paths are asserted through assertSafeTarget: every check that can
 * reject does so before the DNS lookup, so these run without network access.
 */

const denyReason = async (url: string): Promise<string> => {
  try {
    await assertSafeTarget(url);
  } catch (error) {
    if (error instanceof Denied) return error.message;
    throw error;
  }
  throw new Error(`expected ${url} to be denied, but it was allowed`);
};

describe('hostAllowed', () => {
  it('accepts an exact host and a subdomain', () => {
    expect(hostAllowed('comsats.edu.pk')).toBe(true);
    expect(hostAllowed('ww2.comsats.edu.pk')).toBe(true);
    expect(hostAllowed('COMSATS.EDU.PK')).toBe(true);
    expect(hostAllowed('comsats.edu.pk.')).toBe(true); // trailing root dot
  });

  it('rejects suffix confusion — the classic allowlist bypass', () => {
    expect(hostAllowed('comsats.edu.pk.attacker.tld')).toBe(false);
    expect(hostAllowed('notcomsats.edu.pk')).toBe(false);
    expect(hostAllowed('attacker.tld')).toBe(false);
  });
});

describe('isPrivateAddress', () => {
  it('rejects cloud metadata and loopback', () => {
    expect(isPrivateAddress('169.254.169.254')).toBe(true); // the one that matters
    expect(isPrivateAddress('127.0.0.1')).toBe(true);
    expect(isPrivateAddress('0.0.0.0')).toBe(true);
    expect(isPrivateAddress('::1')).toBe(true);
    expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true); // IPv4-mapped
  });

  it('rejects private and reserved ranges', () => {
    expect(isPrivateAddress('10.0.0.5')).toBe(true);
    expect(isPrivateAddress('172.16.0.1')).toBe(true);
    expect(isPrivateAddress('172.31.255.255')).toBe(true);
    expect(isPrivateAddress('192.168.1.1')).toBe(true);
    expect(isPrivateAddress('100.64.0.1')).toBe(true); // CGNAT
    expect(isPrivateAddress('239.0.0.1')).toBe(true); // multicast
    expect(isPrivateAddress('fe80::1')).toBe(true);
    expect(isPrivateAddress('fd00::1')).toBe(true);
  });

  it('allows public addresses, including ones adjacent to private ranges', () => {
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    expect(isPrivateAddress('172.15.0.1')).toBe(false); // just below RFC1918
    expect(isPrivateAddress('172.32.0.1')).toBe(false); // just above
    expect(isPrivateAddress('192.167.1.1')).toBe(false);
    expect(isPrivateAddress('2606:4700::1111')).toBe(false);
  });

  it('refuses anything unparseable rather than guessing', () => {
    expect(isPrivateAddress('not-an-ip')).toBe(true);
    expect(isPrivateAddress('999.1.1.1')).toBe(true);
  });
});

describe('assertSafeTarget', () => {
  it('rejects non-https schemes', async () => {
    // data: was the same-origin XSS vector — it returned attacker HTML that the
    // old proxy echoed back with the upstream Content-Type.
    await expect(
      denyReason('data:text/html,<script>1</script><!--comsats.edu.pk-->'),
    ).resolves.toContain('scheme');
    await expect(denyReason('http://comsats.edu.pk/x.jpg')).resolves.toContain('scheme');
    await expect(denyReason('file:///etc/passwd?comsats.edu.pk')).resolves.toContain('scheme');
  });

  it('rejects an allowlisted string that is not the host', async () => {
    // Every one of these passed the old `url.includes(domain)` check.
    await expect(
      denyReason('https://169.254.169.254/latest/meta-data/?x=comsats.edu.pk'),
    ).resolves.toContain('host');
    await expect(denyReason('https://attacker.tld/nu.edu.pk')).resolves.toContain('host');
    await expect(denyReason('https://attacker.tld/#lums.edu.pk')).resolves.toContain('host');
    await expect(denyReason('https://comsats.edu.pk.attacker.tld/x')).resolves.toContain('host');
  });

  it('rejects credentials used to disguise the real host', async () => {
    await expect(
      denyReason('https://comsats.edu.pk@169.254.169.254/latest/meta-data/'),
    ).resolves.toContain('credentials');
  });

  it('rejects a literal private address even when well-formed', async () => {
    await expect(denyReason('https://127.0.0.1/x.jpg')).resolves.toContain('host');
  });

  it('rejects malformed input', async () => {
    await expect(denyReason('not a url')).resolves.toContain('malformed');
    await expect(denyReason('')).resolves.toContain('malformed');
  });
});

describe('ALLOWED_CONTENT_TYPES', () => {
  it('excludes SVG, which can execute script', () => {
    expect(ALLOWED_CONTENT_TYPES.has('image/svg+xml')).toBe(false);
    expect(ALLOWED_CONTENT_TYPES.has('text/html')).toBe(false);
    expect(ALLOWED_CONTENT_TYPES.has('image/png')).toBe(true);
    expect(ALLOWED_CONTENT_TYPES.has('image/jpeg')).toBe(true);
  });
});
