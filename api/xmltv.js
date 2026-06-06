/**
 * Pirataflix — XMLTV / EPG endpoint (corrigido)
 * /xmltv.php?username=X&password=Y
 *
 * Lê channels.json e devolve XMLTV básico
 * compatível com TiviMate, GSE, PirataPlay.
 */

const fs   = require('fs');
const path = require('path');

const VALID_USERNAME = process.env.XTREAM_USERNAME || 'pirataflix';
const VALID_PASSWORD = process.env.XTREAM_PASSWORD || 'pirataflix';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const q = req.query;
  if (q.username !== VALID_USERNAME || q.password !== VALID_PASSWORD) {
    return res.status(403).end('Forbidden');
  }

  let channels = [];
  try {
    const p = path.join(process.cwd(), 'web', 'channels.json');
    channels = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { /* sem canais, retorna XML vazio */ }

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fmtDt = d =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())} +0000`;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<tv generator-info-name="Pirataflix">\n`;

  // Canais
  for (const canal of channels) {
    const id   = canal.tvg_id || canal.title || '';
    const name = canal.title  || canal.name  || id;
    const logo = canal.tvg_logo || '';
    xml += `  <channel id="${esc(id)}">\n`;
    xml += `    <display-name>${esc(name)}</display-name>\n`;
    if (logo) xml += `    <icon src="${esc(logo)}"/>\n`;
    xml += `  </channel>\n`;
  }

  // Programação — blocos de 1h para as próximas 24h
  for (const canal of channels) {
    const id   = canal.tvg_id || canal.title || '';
    const name = canal.title  || canal.name  || '';
    for (let h = 0; h < 24; h++) {
      const start = new Date(now);
      start.setUTCHours(h, 0, 0, 0);
      const stop = new Date(start);
      stop.setUTCHours(h + 1);
      xml += `  <programme channel="${esc(id)}" start="${fmtDt(start)}" stop="${fmtDt(stop)}">\n`;
      xml += `    <title>${esc(name)}</title>\n`;
      xml += `  </programme>\n`;
    }
  }

  xml += `</tv>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).end(xml);
};

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
