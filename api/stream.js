/**
 * Pirataflix — Stream Proxy
 * /api/stream?id=X&u=USER&p=PASS&src=URL_ENCODED
 *
 * Resolve bloqueios de Mediafire e CDNs que recusam requests diretos de players.
 * Faz redirect 302 com headers de browser para a URL original,
 * ou proxy transparente quando redirect não for suficiente.
 */

const https  = require('https');
const http   = require('http');
const { URL } = require('url');

const VALID_USERNAME = process.env.XTREAM_USERNAME || 'pirataflix';
const VALID_PASSWORD = process.env.XTREAM_PASSWORD || 'pirataflix';

// Headers que simulam um browser real — necessário para Mediafire e cdn-novflix
const BROWSER_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':          'video/webm,video/mp4,video/*;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'Accept-Encoding': 'identity',
  'Connection':      'keep-alive',
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const { u, p, src } = req.query;

  // Autenticação básica
  if (u !== VALID_USERNAME || p !== VALID_PASSWORD) {
    res.status(403).end('Forbidden');
    return;
  }

  if (!src) {
    res.status(400).end('Missing src');
    return;
  }

  let originalUrl;
  try {
    originalUrl = decodeURIComponent(src);
    new URL(originalUrl); // valida
  } catch {
    res.status(400).end('Invalid src URL');
    return;
  }

  // Para Mediafire: a URL de download já é direta (download2XXX.mediafire.com)
  // mas bloqueia sem Referer correto. Adicionamos o referer do Mediafire.
  const isMediafire  = originalUrl.includes('mediafire.com');
  const isCdnNovflix = originalUrl.includes('cdn-novflix.com') || originalUrl.includes('novflix');

  const extraHeaders = {};
  if (isMediafire) {
    extraHeaders['Referer'] = 'https://www.mediafire.com/';
    extraHeaders['Origin']  = 'https://www.mediafire.com';
  }
  if (isCdnNovflix) {
    extraHeaders['Referer'] = 'https://cdn-novflix.com/';
    extraHeaders['Origin']  = 'https://cdn-novflix.com';
  }

  const reqHeaders = {
    ...BROWSER_HEADERS,
    ...extraHeaders,
  };

  // Repassa Range se o player mandou (necessário para seek)
  if (req.headers['range']) {
    reqHeaders['Range'] = req.headers['range'];
  }

  try {
    await proxyStream(originalUrl, reqHeaders, req, res, 0);
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).end('Stream proxy error: ' + err.message);
    }
  }
};

/**
 * Faz proxy transparente do stream, seguindo redirects manualmente
 * para manter controle dos headers (fetch/axios perdem Range em redirects).
 */
function proxyStream(url, headers, req, res, redirectCount) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) { reject(new Error('Too many redirects')); return; }

    let parsed;
    try { parsed = new URL(url); }
    catch (e) { reject(e); return; }

    const lib     = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'GET',
      headers,
    };

    const proxyReq = lib.request(options, proxyRes => {
      const status = proxyRes.statusCode;

      // Seguir redirects (301/302/303/307/308)
      if ([301,302,303,307,308].includes(status) && proxyRes.headers.location) {
        proxyRes.resume(); // descarta o body
        const nextUrl = proxyRes.headers.location.startsWith('http')
          ? proxyRes.headers.location
          : new URL(proxyRes.headers.location, url).href;
        resolve(proxyStream(nextUrl, headers, req, res, redirectCount + 1));
        return;
      }

      // Propaga status e headers relevantes para o player
      const passHeaders = [
        'content-type', 'content-length', 'content-range',
        'accept-ranges', 'last-modified', 'etag',
      ];
      res.status(status);
      for (const h of passHeaders) {
        if (proxyRes.headers[h]) res.setHeader(h, proxyRes.headers[h]);
      }
      res.setHeader('Cache-Control', 'no-store');

      proxyRes.pipe(res);
      proxyRes.on('end', resolve);
      proxyRes.on('error', reject);
    });

    proxyReq.on('error', reject);
    proxyReq.setTimeout(15000, () => { proxyReq.destroy(new Error('Timeout')); });
    proxyReq.end();
  });
}
