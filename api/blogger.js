/**
 * Pirataflix — Blogger resolver
 * /api/blogger?src=<URL blogger.com/video.g codificada>
 * Lê a página do Blogger NO SERVIDOR (sem CORS) e devolve { url } com o mp4 direto.
 * Só aceita blogger.com/video.g (não é proxy aberto).
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function extract(html) {
  const txt = html.replace(/\\u0026/g, '&').replace(/\\u003d/g, '=').replace(/&amp;/g, '&').replace(/\\\//g, '/');
  let best = null, bestScore = -1, fmt = null;
  const re = /"play_url":"([^"]+)"[^}]*?"format_id":(\d+)/g;
  let m;
  while ((m = re.exec(txt))) {
    const f = parseInt(m[2], 10);
    const score = f === 22 ? 100 : (f === 18 ? 50 : f);
    if (score > bestScore) { bestScore = score; best = m[1]; fmt = f; }
  }
  if (!best) {
    const m2 = /https?:\/\/[^"'\\\s<>]+googlevideo\.com\/videoplayback[^"'\\\s<>]*/.exec(txt);
    if (m2) best = m2[0];
  }
  return { url: best, format: fmt };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  let target;
  try {
    target = new URL(decodeURIComponent(req.query.src || ''));
  } catch { return res.status(400).json({ error: 'src inválido' }); }

  const okHost = target.protocol === 'https:' && /^(www\.)?blogger\.com$/.test(target.hostname);
  if (!okHost || target.pathname !== '/video.g') {
    return res.status(400).json({ error: 'somente blogger.com/video.g' });
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    const r = await fetch(target.href, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' }, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return res.status(502).json({ error: 'blogger HTTP ' + r.status });
    const out = extract(await r.text());
    res.setHeader('Cache-Control', 'no-store');
    if (!out.url) return res.status(404).json({ error: 'sem link na página' });
    return res.status(200).json(out);
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
};
