/**
 * Pirataflix — XMLTV / EPG endpoint
 * /xmltv.php?username=X&password=Y
 *
 * Lê os channels.json e devolve um XMLTV básico
 * (suficiente para players como TiviMate, GSE, PirataPlay).
 */

const fs   = require('fs');
const path = require('path');

const VALID_USERNAME = process.env.XTREAM_USERNAME || 'pirataflix';
const VALID_PASSWORD = process.env.XTREAM_PASSWORD || 'pirataflix';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const q = req.query;
  if (q.username !== VALID_USERNAME || q.password !== VALID_PASSWORD) {
    res.status(403).end('Forbidden');
    return;
  }

  let channels = [];
  try {
    const p = path.join(process.cwd(), 'web', 'channels.json');
    channels = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { /* sem canais */ }

  const now    = new Date();
  const pad    = n => String(n).padStart(2, '0');
  const fmtDt  = d => `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}` +
                       `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())} +0000`;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<tv generator-info-name="Pirataflix">\n`;

  for (const canal of channels) {
    const id   = canal.tvg_id || canal.title || '';
    const name = canal.title  || canal.name  || id;
    const logo = canal.tvg_logo || '';
    xml += `  <channel id="${esc(id)}">\n`;
    xml += `    <display-name>${esc(name)}</display-name>\n`;
    if (logo) xml += `    <icon src="${esc(logo)}"/>\n`;
    xml += `  </channel>\n`;
  }

  for (const canal of channels) {
    const id = canal.tvg_id || canal.title || '';
    const name = canal.title || '';
    for (let h = 0; h < 24; h++) {
      const start = new Date(now);
      start.setUTCHours(h, 0, 0, 0);
      const stop  = new Date(start);
      stop.setUTCHours(h + 1);
      xml += `  <programme channel="${esc(id)}" start="${fmtDt(start)}" stop="${fmtDt(stop)}">\n`;
      xml += `    <title>${esc(name)}</title>\n`;
      xml += `  </programme>\n`;
    }
  }

  xml += `</tv>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.status(200).end(xml);
};

function esc(s) {
  return String(s)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}
