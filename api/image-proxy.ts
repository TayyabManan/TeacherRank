import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  ALLOWED_CONTENT_TYPES,
  Denied,
  assertSafeTarget,
} from '../src/lib/urlGuards';

/**
 * Avatar proxy for institute-hosted faculty photos.
 *
 * This endpoint is unauthenticated and internet-reachable, so its input is
 * treated as hostile. All of the decision logic lives in src/lib/urlGuards.ts
 * (type-checked, linted and unit-tested — this directory is none of those); the
 * handler below is deliberately thin I/O around it.
 *
 * What the guards are there to stop, all of which the previous version allowed:
 * SSRF to internal hosts and cloud metadata, `data:`/`http:` schemes, redirect
 * laundering through an allowlisted host, echoing an attacker-controlled
 * Content-Type back on this origin, and unbounded response buffering.
 */

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let target = await assertSafeTarget(url);
    let response: Response;

    // Redirects are followed by hand so every hop is re-validated.
    for (let hop = 0; ; hop++) {
      response = await fetch(target, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/*;q=0.8',
        },
        // Don't leak our origin to the upstream institute server.
        referrer: '',
        referrerPolicy: 'no-referrer',
      });

      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      if (hop >= MAX_REDIRECTS) throw new Denied('too many redirects');

      const location = response.headers.get('location');
      if (!location) throw new Denied('redirect without Location');
      target = await assertSafeTarget(new URL(location, target).toString());
    }

    if (!response.ok) throw new Denied(`upstream ${response.status}`);

    // Pin the type to one we recognise. Never echo the upstream header — that
    // is what allowed text/html to be served from this origin.
    const upstreamType = (response.headers.get('content-type') || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.has(upstreamType)) {
      throw new Denied(`content-type ${upstreamType || 'missing'}`);
    }

    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > MAX_BYTES) throw new Denied(`declared length ${declared}`);

    // Stream, so an absent or lying Content-Length can't blow the memory cap.
    const reader = response.body?.getReader();
    if (!reader) throw new Denied('empty body');
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new Denied(`body exceeded ${MAX_BYTES} bytes`);
      }
      chunks.push(value);
    }

    res.setHeader('Content-Type', upstreamType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    // Only validated 2xx image responses are cacheable. (No Access-Control-
    // Allow-Origin: nothing reads these cross-origin — they are <img> sources,
    // and the wildcard made the endpoint usable as a general CORS proxy.)
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.status(200).send(Buffer.concat(chunks));
  } catch (error) {
    if (error instanceof Denied) {
      console.warn('Image proxy refused:', error.message);
      return res.status(403).json({ error: 'Image source not allowed' });
    }
    console.error('Image proxy error:', error);
    res.status(404).json({ error: 'Failed to load image' });
  } finally {
    clearTimeout(timer);
  }
}
