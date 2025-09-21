import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url } = req.query;
  
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  // Whitelist of allowed domains
  const allowedDomains = [
    'comsats.edu.pk',
    'ww2.comsats.edu.pk',
    'lums.edu.pk',
    'nu.edu.pk',
    'ui-avatars.com',
    'pu.edu.pk'
  ];

  // Check if URL is from allowed domain
  const isAllowed = allowedDomains.some(domain => url.includes(domain));
  if (!isAllowed) {
    return res.status(403).json({ error: 'Domain not allowed' });
  }

  try {
    // Fetch the image without sending referrer
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      // Don't send referrer
      referrer: '',
      referrerPolicy: 'no-referrer'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    const buffer = await response.arrayBuffer();

    // Set cache headers for 7 days
    res.setHeader('Content-Type', contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Send the image
    res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    console.error('Image proxy error:', error);
    res.status(404).json({ error: 'Failed to load image' });
  }
}