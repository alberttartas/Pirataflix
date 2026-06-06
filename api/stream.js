/**
 * Pirataflix — Stream Proxy (corrigido)
 * /api/stream?id=X&u=USER&p=PASS&src=URL_ENCODED
 *
 * Resolve redirects (Mediafire, CDNs) e devolve 302 para a URL final.
 * O player busca o vídeo diretamente do CDN — sem pipe, sem timeout.
 */

const https   = require('https');
const http    = require('http');
const { URL } = require('url');

const VALID_USERNAME = process.env.XTREAM_USERNAME || 'pirataflix';
const VALID_PASSWORD = process.env.XTREAM_PASSWORD || 'pirataflix';

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
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const { u, p, src } = req.query;

  if (u !== VALID_USERNAME || p !== VALID_PASSWORD) {
    return res.status(403).end('Forbidden');
  }
  if (!src) return res.status(400).end('Missing src');

  let originalUrl;
  try {
    originalUrl = decodeURIComponent(src);
    new URL(originalUrl); // valida formato
  } catch {
    return res.status(400).end('Invalid src URL');
  }

  const isMediafire  = originalUrl.includes('mediafire.com');
  const isCdnNovflix = originalUrl.includes('cdn-novflix.com') || originalUrl.includes('novflix');
  const isGoogleDrive = originalUrl.includes('drive.google.com') || originalUrl.includes('docs.google.com');

  const extraHeaders = {};
  if (isMediafire) {
    extraHeaders['Referer'] = 'https://www.mediafire.com/';
    extraHeaders['Origin']  = 'https://www.mediafire.com';
  }
  if (isCdnNovflix) {
    extraHeaders['Referer'] = 'https://cdn-novflix.com/';
    extraHeaders['Origin']  = 'https://cdn-novflix.com';
  }

  const reqHeaders = { ...BROWSER_HEADERS, ...extraHeaders };

  try {
    // Resolve todos os redirects e obtém a URL final
    const finalUrl = await resolveRedirects(originalUrl, reqHeaders, 0);

    // Google Drive: precisa de pipe pois requer cookies que o player não tem
    if (isGoogleDrive) {
      return await proxyPipe(finalUrl, reqHeaders, req, res, 0);
    }

    // Para todos os outros: 302 direto ao CDN
    // O player conecta diretamente — sem timeout na Vercel
    res.setHeader('Location', finalUrl);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(302).end();

  } catch (err) {
    if (!res.headersSent) {
      return res.status(502).end('Proxy error: ' + err.message);
    }
  }
};

/**
 * Segue redirects usando HEAD (não baixa o body).
 * Retorna a URL final após todos os redirects.
 */
function resolveRedirects(url, headers, count) {
  return new Promise((resolve, reject) => {
    if (count > 10) return reject(new Error('Too many redirects'));

    let parsed;
    try { parsed = new URL(url); } catch (e) { return reject(e); }

    const lib = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'HEAD',
      headers,
    };

    const proxyReq = lib.request(options, proxyRes => {
      proxyRes.resume(); // descarta body

      const status = proxyRes.statusCode;

      // Segue redirect
      if ([301, 302, 303, 307, 308].includes(status) && proxyRes.headers.location) {
        const location = proxyRes.headers.location;
        const next = location.startsWith('http')
          ? location
          : new URL(location, url).href;
        return resolve(resolveRedirects(next, headers, count + 1));
      }

      // Chegou na URL final (200, 206, 403, qualquer outra coisa)
      // Devolve a URL para o caller fazer o redirect
      resolve(url);
    });

    proxyReq.on('error', reject);
    proxyReq.setTimeout(8000, () => {
      proxyReq.destroy(new Error('Timeout ao resolver redirect'));
    });
    proxyReq.end();
  });
}

/**
 * Proxy com pipe — usado apenas quando o redirect não é suficiente
 * (ex: Google Drive que exige cookies de sessão).
 * Segue redirects manualmente mantendo os headers (incluindo Range).
 */
function proxyPipe(url, headers, req, res, count) {
  return new Promise((resolve, reject) => {
    if (count > 10) return reject(new Error('Too many redirects'));

    let parsed;
    try { parsed = new URL(url); } catch (e) { return reject(e); }

    // Repassa Range para suporte a seek
    if (req.headers['range']) {
      headers = { ...headers, 'Range': req.headers['range'] };
    }

    const lib = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'GET',
      headers,
    };

    const proxyReq = lib.request(options, proxyRes => {
      const status = proxyRes.statusCode;

      // Segue redirect mantendo os headers
      if ([301, 302, 303, 307, 308].includes(status) && proxyRes.headers.location) {
        proxyRes.resume();
        const location = proxyRes.headers.location;
        const next = location.startsWith('http')
          ? location
          : new URL(location, url).href;
        return resolve(proxyPipe(next, headers, req, res, count + 1));
      }

      // Propaga status e headers relevantes
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
      proxyRes.on('end',   resolve);
      proxyRes.on('error', reject);
    });

    proxyReq.on('error', reject);
    proxyReq.setTimeout(15000, () => {
      proxyReq.destroy(new Error('Timeout no pipe'));
    });
    proxyReq.end();
  });
}
