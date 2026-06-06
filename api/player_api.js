/**
 * Pirataflix — Player API (Xtream Codes)
 * Vercel Serverless Function
 */

const fs   = require('fs');
const path = require('path');

const VALID_USERNAME = process.env.XTREAM_USERNAME || 'pirataflix';
const VALID_PASSWORD = process.env.XTREAM_PASSWORD || 'pirataflix';
const SERVER_URL     = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : (process.env.SERVER_URL || 'http://localhost:3000');

// ─── Cache ────────────────────────────────────────────────────────────────────

let _data = null;
let _ch   = null;

function loadData() {
  if (_data) return _data;
  try { _data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'web', 'data.json'), 'utf8')); }
  catch { _data = { filmes:[], series:[], novelas:[], animes:[], infantil:[], tv:[] }; }
  return _data;
}
function loadChannels() {
  if (_ch) return _ch;
  try { _ch = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'web', 'channels.json'), 'utf8')); }
  catch { _ch = []; }
  return _ch;
}

// ─── Categorias ───────────────────────────────────────────────────────────────

const VOD_CATEGORIES = [
  { category_id:'1', category_name:'🎬 Filmes', parent_id:0 },
];
const SERIES_CATEGORIES = [
  { category_id:'2', category_name:'📺 Séries',   parent_id:0 },
  { category_id:'3', category_name:'📖 Novelas',  parent_id:0 },
  { category_id:'4', category_name:'👻 Animes',   parent_id:0 },
  { category_id:'5', category_name:'🧸 Infantil', parent_id:0 },
];
const SERIES_CAT_MAP = { '2':'series', '3':'novelas', '4':'animes', '5':'infantil' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stableId(str) {
  let h = 5381;
  for (let i = 0; i < (str||'').length; i++) h = ((h<<5)+h+str.charCodeAt(i))|0;
  return Math.abs(h) % 900000 + 100000;
}
function tvGroupId(g) {
  let h = 100;
  for (let i = 0; i < g.length; i++) h = ((h<<5)-h+g.charCodeAt(i))|0;
  return Math.abs(h) % 9000 + 1000;
}

/**
 * Extrai extensão ignorando query params.
 * Corrigido: antes falhava com /video.mp4?token=xxx
 */
function ext(url) {
  if (!url) return 'mp4';
  try {
    const pathname = new URL(url).pathname;
    const m = pathname.match(/\.(mp4|mkv|avi|ts|m3u8|mov|webm)$/i);
    if (m) return m[1].toLowerCase();
  } catch { /* URL relativa, cai no fallback */ }
  const m = url.match(/\.(mp4|mkv|avi|ts|m3u8|mov|webm)(\?|#|$)/i);
  return m ? m[1].toLowerCase() : 'mp4';
}

/**
 * Monta URL de stream apontando para o proxy /api/stream.
 * O proxy resolve redirects e devolve 302 para a URL final —
 * o player conecta direto ao CDN, sem timeout na Vercel.
 */
function streamUrl(originalUrl, streamId, username, password) {
  if (!originalUrl) return '';
  const encoded = encodeURIComponent(originalUrl);
  return `${SERVER_URL}/api/stream?id=${streamId}&u=${encodeURIComponent(username)}&p=${encodeURIComponent(password)}&src=${encoded}`;
}

// ─── Formatadores ─────────────────────────────────────────────────────────────

function fmtVod(item, num, username, password) {
  const ep  = (item.episodes||[])[0] || {};
  const sid = stableId(item.id||item.title);
  return {
    num,
    name:                item.title,
    stream_type:         'movie',
    stream_id:           sid,
    stream_icon:         item.poster||'',
    rating:              String(item.rating||''),
    rating_5based:       item.rating ? (item.rating/2).toFixed(1) : '0',
    added:               '',
    category_id:         '1',
    container_extension: ext(ep.url||''),
    custom_sid:          '',
    direct_source:       streamUrl(ep.url, sid, username, password),
  };
}

function fmtSeries(item, catId) {
  return {
    num:             stableId(item.id||item.title),
    name:            item.title,
    series_id:       stableId(item.id||item.title),
    cover:           item.poster||'',
    plot:            item.overview||'',
    cast:            (item.cast||[]).map(c=>c.name).join(', '),
    director:        '',
    genre:           (item.genres||[]).join(', '),
    releaseDate:     item.year||'',
    last_modified:   '',
    rating:          String(item.rating||''),
    rating_5based:   item.rating ? (item.rating/2).toFixed(1) : '0',
    backdrop_path:   item.backdrop ? [item.backdrop] : [],
    youtube_trailer: '',
    episode_run_time:'',
    category_id:     catId,
  };
}

function fmtLive(canal, num, username, password) {
  const sid = stableId(canal.tvg_id||canal.title||String(num));
  return {
    num,
    name:                canal.title||canal.name||'Canal',
    stream_type:         'live',
    stream_id:           sid,
    stream_icon:         canal.tvg_logo||'',
    epg_channel_id:      canal.tvg_id||'',
    added:               '',
    category_id:         String(tvGroupId(canal.group||'TV')),
    custom_sid:          '',
    direct_source:       streamUrl(canal.url, sid, username, password),
    tv_archive:          0,
    tv_archive_duration: 0,
  };
}

/**
 * Monta objeto episodes no formato Xtream:
 * { "1": [ {ep}, {ep}, ... ] }  ← chave = número da temporada
 */
function buildEpisodesObj(item, username, password) {
  const rawSeasons = item.seasons
    || (item.episodes ? [{ season:1, episodes:item.episodes }] : []);

  const seasons  = {};
  const episodes = {};

  for (const season of rawSeasons) {
    const sNum = season.season || 1;

    seasons[String(sNum)] = {
      name:          `Temporada ${sNum}`,
      episode_count: (season.episodes||[]).length,
      overview:      '',
      cover:         item.poster||'',
      cover_big:     item.backdrop||item.poster||'',
      air_date:      '',
      season_number: sNum,
    };

    episodes[String(sNum)] = (season.episodes||[]).map((ep, i) => {
      const epNum = ep.episode || (i + 1);
      const epId  = stableId((item.id||item.title) + '_s' + sNum + '_e' + epNum);
      return {
        id:                  String(epId),
        episode_num:         epNum,
        title:               ep.title || `Episódio ${epNum}`,
        container_extension: ext(ep.url||''),
        info: {
          releasedate:   ep.air_date ||'',
          plot:          ep.overview ||'',
          movie_image:   ep.still    ||'',
          duration_secs: 0,
          duration:      '',
          rating:        '',
        },
        subtitles:     [],
        custom_sid:    '',
        added:         '',
        season:        sNum,
        direct_source: streamUrl(ep.url, epId, username, password),
        locked:        ep.locked || false,
      };
    });
  }

  return { seasons, episodes };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const q = { ...req.query, ...(req.body||{}) };
  const { username, password, action } = q;

  if (username !== VALID_USERNAME || password !== VALID_PASSWORD) {
    return res.status(200).json({
      user_info: {
        username, password,
        message:                'Wrong username or password',
        auth:                   0,
        status:                 'Disabled',
        exp_date:               null,
        is_trial:               '0',
        active_cons:            '0',
        created_at:             '',
        max_connections:        '0',
        allowed_output_formats: ['m3u8','ts','rtmp'],
      },
      server_info: serverInfo(),
    });
  }

  const data     = loadData();
  const channels = loadChannels();

  if (!action) {
    return res.status(200).json({
      user_info:   userInfo(username, password),
      server_info: serverInfo(),
    });
  }

  switch (action) {

    // ── Live TV ──────────────────────────────────────────────────────────────

    case 'get_live_categories': {
      const groups = [...new Set(channels.map(c => c.group||'TV'))];
      return ok(res, groups.map(g => ({
        category_id:   String(tvGroupId(g)),
        category_name: g,
        parent_id:     0,
      })));
    }

    case 'get_live_streams': {
      let list = channels;
      if (q.category_id) list = list.filter(c => String(tvGroupId(c.group||'TV')) === String(q.category_id));
      return ok(res, list.map((c, i) => fmtLive(c, i+1, username, password)));
    }

    // ── VOD (Filmes) ──────────────────────────────────────────────────────────

    case 'get_vod_categories':
      return ok(res, VOD_CATEGORIES);

    case 'get_vod_streams': {
      if (q.category_id && q.category_id !== '1') return ok(res, []);
      return ok(res, (data.filmes||[]).map((f, i) => fmtVod(f, i+1, username, password)));
    }

    case 'get_vod_info': {
      const vid   = Number(q.vod_id);
      const filme = (data.filmes||[]).find(f => stableId(f.id||f.title) === vid);
      if (!filme) return ok(res, {});
      const ep  = (filme.episodes||[])[0] || {};
      const sid = stableId(filme.id||filme.title);
      return ok(res, {
        info: {
          tmdb_id:       filme.tmdb_id||'',
          name:          filme.title,
          o_name:        filme.title,
          cover_big:     filme.poster||'',
          movie_image:   filme.poster||'',
          releasedate:   filme.year||'',
          actors:        (filme.cast||[]).map(c=>c.name).join(', '),
          cast:          (filme.cast||[]).map(c=>c.name).join(', '),
          description:   filme.overview||'',
          plot:          filme.overview||'',
          genre:         (filme.genres||[]).join(', '),
          backdrop_path: filme.backdrop ? [filme.backdrop] : [],
          rating:        String(filme.rating||''),
          status:        'Ended',
        },
        movie_data: {
          stream_id:           sid,
          name:                filme.title,
          added:               '',
          category_id:         '1',
          container_extension: ext(ep.url||''),
          custom_sid:          '',
          direct_source:       streamUrl(ep.url, sid, username, password),
        },
      });
    }

    // ── Séries ────────────────────────────────────────────────────────────────

    case 'get_series_categories':
      return ok(res, SERIES_CATEGORIES);

    case 'get_series': {
      const catFilter = q.category_id;
      let items = [];
      if (!catFilter) {
        for (const [catId, key] of Object.entries(SERIES_CAT_MAP))
          for (const it of (data[key]||[])) items.push(fmtSeries(it, catId));
      } else {
        const key = SERIES_CAT_MAP[catFilter];
        if (key) for (const it of (data[key]||[])) items.push(fmtSeries(it, catFilter));
      }
      return ok(res, items);
    }

    case 'get_series_info': {
      const sid = Number(q.series_id);
      let found = null, foundCat = '2';
      for (const [catId, key] of Object.entries(SERIES_CAT_MAP)) {
        found = (data[key]||[]).find(s => stableId(s.id||s.title) === sid);
        if (found) { foundCat = catId; break; }
      }
      if (!found) return ok(res, {});

      const { seasons, episodes } = buildEpisodesObj(found, username, password);

      return ok(res, {
        info: {
          name:          found.title,
          cover:         found.poster  ||'',
          plot:          found.overview||'',
          cast:          (found.cast||[]).map(c=>c.name).join(', '),
          genre:         (found.genres||[]).join(', '),
          releaseDate:   found.year    ||'',
          rating:        String(found.rating||''),
          rating_5based: found.rating ? (found.rating/2).toFixed(1) : '0',
          backdrop_path: found.backdrop ? [found.backdrop] : [],
          backdrop:      found.backdrop||'',
          category_id:   foundCat,
        },
        seasons,
        episodes,
      });
    }

    default:
      return ok(res, { error: `Unknown action: ${action}` });
  }
};

// ─── Utilitários ──────────────────────────────────────────────────────────────

function ok(res, data) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).json(data);
}

function serverInfo() {
  return {
    url:             SERVER_URL,
    port:            '80',
    https_port:      '443',
    server_protocol: 'http',
    rtmp_port:       '1935',
    timezone:        'America/Fortaleza',
    timestamp_now:   Math.floor(Date.now() / 1000),
    time_now:        new Date().toISOString().replace('T', ' ').slice(0, 19),
    process:         'streamdev',
  };
}

function userInfo(username, password) {
  return {
    username,
    password,
    message:                'Welcome back!',
    auth:                   1,
    status:                 'Active',
    exp_date:               null,
    is_trial:               '0',
    active_cons:            '0',
    created_at:             String(Math.floor(Date.now() / 1000)),
    max_connections:        '1',
    allowed_output_formats: ['m3u8','ts','rtmp'],
  };
}
