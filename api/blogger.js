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


// A página do video.g é um app JS: o link NÃO vem no HTML, vem de uma chamada
// batchexecute (rpc "WcwnYd") feita pelo próprio player. Repetimos essa chamada.
function unescapeDeep(t) {
  // \+ = qualquer nível de escape (JSON dentro de JSON)
  return t.replace(/\\+u0026/gi, '&').replace(/\\+u003d/gi, '=').replace(/\\+\//g, '/').replace(/\\+"/g, '"');
}

function pickGoogleVideo(txt) {
  const urls = txt.match(/https?:\/\/[^"'\\\s<>\]]+googlevideo\.com\/videoplayback[^"'\\\s<>\]]*/g) || [];
  if (!urls.length) return null;
  const itag = u => { const m = /[?&]itag=(\d+)/.exec(u); return m ? parseInt(m[1], 10) : 0; };
  urls.sort((a, b) => (itag(b) === 22 ? 100 : itag(b) === 18 ? 50 : 0) - (itag(a) === 22 ? 100 : itag(a) === 18 ? 50 : 0));
  return { url: urls[0], format: itag(urls[0]) || null };
}

async function rpcResolve(token, html, setCookies, wantRaw) {
  const bl  = (/"cfb2h":"([^"]+)"/.exec(html) || [])[1] || '';
  const sid = (/"FdrFJe":"([^"]+)"/.exec(html) || [])[1] || '';
  const cookie = (setCookies || []).map(c => c.split(';')[0]).join('; ');
  const q = new URLSearchParams({ rpcids: 'WcwnYd', 'source-path': '/video.g', hl: 'pt-BR', rt: 'c' });
  if (bl)  q.set('bl', bl);
  if (sid) q.set('f.sid', sid);
  const body = 'f.req=' + encodeURIComponent(JSON.stringify([[['WcwnYd', JSON.stringify([token, '', 0]), null, 'generic']]])) + '&';

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  const r = await fetch('https://www.blogger.com/_/BloggerVideoPlayerUi/data/batchexecute?' + q.toString(), {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'Origin': 'https://www.blogger.com',
      'Referer': 'https://www.blogger.com/video.g?token=' + token,
      ...(cookie ? { Cookie: cookie } : {})
    },
    body,
    signal: ctrl.signal
  });
  clearTimeout(t);
  const raw = await r.text();
  if (wantRaw) return { status: r.status, bl, sid, rawHead: raw.slice(0, 1800) };
  const txt = unescapeDeep(raw);
  return pickGoogleVideo(txt) || extract(txt);
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
    const html = await r.text();

    // ?debug=1 → mostra o que o servidor realmente recebeu (para ajustar a extração)
    if (req.query.debug) {
      const keys = ['videoplayback', 'googlevideo', 'play_url', 'streams', 'format_id', 'VIDEO_CONFIG',
                    'video-play', 'contentId', '.mp4', 'consent', 'captcha', 'unavailable', 'indispon', 'error'];
      const hits = {};
      for (const k of keys) {
        const i = html.indexOf(k);
        if (i !== -1) hits[k] = html.slice(Math.max(0, i - 150), i + 350);
      }
      const title = (/<title[^>]*>([^<]*)/i.exec(html) || [])[1] || '';
      const text = html.replace(/<script[\s\S]*?<\/script>/gi, '[script]').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 500);
      return res.status(200).json({ status: r.status, finalUrl: r.url, contentType: r.headers.get('content-type'), len: html.length, title, textHead: text, hits });
    }

    let out = extract(html);
    const token = target.searchParams.get('token') || '';
    const cookies = (r.headers.getSetCookie ? r.headers.getSetCookie() : []);

    // ?debug=2 → resposta crua da chamada batchexecute
    if (req.query.debug === '2') {
      try { return res.status(200).json(await rpcResolve(token, html, cookies, true)); }
      catch (e) { return res.status(200).json({ rpcError: String(e.message || e) }); }
    }

    if (!out.url && token) {
      try { out = (await rpcResolve(token, html, cookies, false)) || out; } catch (e) {}
    }
    res.setHeader('Cache-Control', 'no-store');
    if (!out.url) {
      // 422 (e não 404) para distinguir de "endpoint não publicado"
      return res.status(422).json({ error: 'página sem link (formato novo?) len=' + html.length + ' play_url=' + (html.indexOf('play_url') !== -1) });
    }
    return res.status(200).json(out);
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
};
