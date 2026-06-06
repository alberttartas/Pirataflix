/**
 * Pirataflix — Xtream Codes API
 * Vercel Serverless Function
 *
 * Endpoints:
 *   (sem action)             → user_info + server_info
 *   get_live_categories      → grupos de TV
 *   get_live_streams         → canais TV
 *   get_vod_categories       → categorias VOD (filmes)
 *   get_vod_streams          → filmes
 *   get_vod_info             → info + URL de um filme
 *   get_series_categories    → categorias séries/novelas/animes/infantil
 *   get_series               → lista de séries/novelas/animes/infantil
 *   get_series_info          → temporadas + episódios de uma série
 *
 * Auth: XTREAM_USERNAME / XTREAM_PASSWORD (env vars) ou fallback "pirataflix"/"pirataflix"
 */

const fs   = require('fs');
const path = require('path');

const VALID_USERNAME = process.env.XTREAM_USERNAME || 'pirataflix';
const VALID_PASSWORD = process.env.XTREAM_PASSWORD || 'pirataflix';
const SERVER_URL     = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : (process.env.SERVER_URL || 'http://localhost:3000');

// ─── Cache de dados ───────────────────────────────────────────────────────────

let _dataCache = null;
let _chCache   = null;

function loadData() {
  if (_dataCache) return _dataCache;
  try {
    _dataCache = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'web', 'data.json'), 'utf8'));
  } catch {
    _dataCache = { filmes: [], series: [], novelas: [], animes: [], infantil: [], tv: [] };
  }
  return _dataCache;
}

function loadChannels() {
  if (_chCache) return _chCache;
  try {
    _chCache = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'web', 'channels.json'), 'utf8'));
  } catch { _chCache = []; }
  return _chCache;
}

// ─── Categorias ───────────────────────────────────────────────────────────────

// VOD = só filmes (protocolo Xtream separa vod de series)
const VOD_CATEGORIES = [
  { category_id: '1', category_name: '🎬 Filmes', parent_id: 0 },
];

// Series = séries + novelas + animes + infantil
const SERIES_CATEGORIES = [
  { category_id: '2', category_name: '📺 Séries',   parent_id: 0 },
  { category_id: '3', category_name: '📖 Novelas',  parent_id: 0 },
  { category_id: '4', category_name: '👻 Animes',   parent_id: 0 },
  { category_id: '5', category_name: '🧸 Infantil', parent_id: 0 },
];

// Mapeamento categoria_id → chave no data.json
const SERIES_CAT_MAP = { '2': 'series', '3': 'novelas', '4': 'animes', '5': 'infantil' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stableId(str) {
  let h = 5381;
  for (let i = 0; i < (str || '').length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h) % 900000 + 100000;
}

function tvGroupId(groupName) {
  let h = 100;
  for (let i = 0; i < groupName.length; i++) h = ((h << 5) - h + groupName.charCodeAt(i)) | 0;
  return Math.abs(h) % 9000 + 1000;
}

function extFromUrl(url) {
  const m = (url || '').match(/\.(mp4|mkv|avi|ts|m3u8|mov|webm)(\?|$)/i);
  return m ? m[1].toLowerCase() : 'mp4';
}

// ─── Formatadores ─────────────────────────────────────────────────────────────

function fmtVodStream(item, num) {
  const ep = (item.episodes || [])[0] || {};
  return {
    num,
    name:                item.title,
    stream_type:         'movie',
    stream_id:           stableId(item.id || item.title),
    stream_icon:         item.poster || '',
    rating:              String(item.rating || ''),
    rating_5based:       item.rating ? (item.rating / 2).toFixed(1) : '0',
    added:               '',
    category_id:         '1',
    container_extension: extFromUrl(ep.url || ''),
    custom_sid:          '',
    direct_source:       ep.url || '',
  };
}

function fmtSeries(item, catId) {
  return {
    num:             stableId(item.id || item.title),
    name:            item.title,
    series_id:       stableId(item.id || item.title),
    cover:           item.poster || '',
    plot:            item.overview || '',
    cast:            (item.cast || []).map(c => c.name).join(', '),
    director:        '',
    genre:           (item.genres || []).join(', '),
    releaseDate:     item.year || '',
    last_modified:   '',
    rating:          String(item.rating || ''),
    rating_5based:   item.rating ? (item.rating / 2).toFixed(1) : '0',
    backdrop_path:   item.backdrop ? [item.backdrop] : [],
    youtube_trailer: '',
    episode_run_time:'',
    category_id:     catId,
  };
}

function fmtLiveStream(canal, num) {
  return {
    num,
    name:            canal.title || canal.name || 'Canal',
    stream_type:     'live',
    stream_id:       stableId(canal.tvg_id || canal.title || String(num)),
    stream_icon:     canal.tvg_logo || '',
    epg_channel_id:  canal.tvg_id || '',
    added:           '',
    category_id:     String(tvGroupId(canal.group || 'TV')),
    custom_sid:      '',
    direct_source:   canal.url || '',
    tv_archive:      0,
    tv_archive_duration: 0,
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const q = { ...req.query, ...(req.body || {}) };
  const { username, password, action } = q;

  // Auth
  if (username !== VALID_USERNAME || password !== VALID_PASSWORD) {
    return res.status(200).json({
      user_info:   { username, password, message: 'Wrong username or password', auth: 0, status: 'Disabled', exp_date: null, is_trial: '0', active_cons: '0', created_at: '', max_connections: '0', allowed_output_formats: ['m3u8', 'ts', 'rtmp'] },
      server_info: serverInfo(),
    });
  }

  const data     = loadData();
  const channels = loadChannels();

  // Sem action = login
  if (!action) {
    return res.status(200).json({ user_info: userInfo(username, password), server_info: serverInfo() });
  }

  switch (action) {

    // ── TV ao vivo ────────────────────────────────────────────────────────────

    case 'get_live_categories': {
      const groups = [...new Set(channels.map(c => c.group || 'TV'))];
      return ok(res, groups.map(g => ({ category_id: String(tvGroupId(g)), category_name: g, parent_id: 0 })));
    }

    case 'get_live_streams': {
      let list = channels;
      if (q.category_id) list = list.filter(c => String(tvGroupId(c.group || 'TV')) === String(q.category_id));
      return ok(res, list.map((c, i) => fmtLiveStream(c, i + 1)));
    }

    // ── VOD (filmes) ──────────────────────────────────────────────────────────

    case 'get_vod_categories': {
      return ok(res, VOD_CATEGORIES);
    }

    case 'get_vod_streams': {
      // Só filmes nesse endpoint — séries ficam em get_series
      if (q.category_id && q.category_id !== '1') return ok(res, []);
      return ok(res, (data.filmes || []).map((f, i) => fmtVodStream(f, i + 1)));
    }

    case 'get_vod_info': {
      const vid   = Number(q.vod_id);
      const filme = (data.filmes || []).find(f => stableId(f.id || f.title) === vid);
      if (!filme) return ok(res, {});
      const ep = (filme.episodes || [])[0] || {};
      return ok(res, {
        info: {
          tmdb_id:       filme.tmdb_id || '',
          name:          filme.title,
          o_name:        filme.title,
          cover_big:     filme.poster || '',
          movie_image:   filme.poster || '',
          releasedate:   filme.year   || '',
          actors:        (filme.cast || []).map(c => c.name).join(', '),
          cast:          (filme.cast || []).map(c => c.name).join(', '),
          description:   filme.overview || '',
          plot:          filme.overview || '',
          genre:         (filme.genres || []).join(', '),
          backdrop_path: filme.backdrop ? [filme.backdrop] : [],
          rating:        String(filme.rating || ''),
          status:        'Ended',
        },
        movie_data: {
          stream_id:           stableId(filme.id || filme.title),
          name:                filme.title,
          added:               '',
          category_id:         '1',
          container_extension: extFromUrl(ep.url || ''),
          custom_sid:          '',
          direct_source:       ep.url || '',
        },
      });
    }

    // ── Séries / Novelas / Animes / Infantil ──────────────────────────────────

    case 'get_series_categories': {
      return ok(res, SERIES_CATEGORIES);
    }

    case 'get_series': {
      const catFilter = q.category_id;
      let items = [];

      if (!catFilter) {
        // Sem filtro: devolve tudo com o category_id correto
        for (const [catId, key] of Object.entries(SERIES_CAT_MAP)) {
          for (const it of (data[key] || [])) items.push(fmtSeries(it, catId));
        }
      } else {
        const key = SERIES_CAT_MAP[catFilter];
        if (key) {
          for (const it of (data[key] || [])) items.push(fmtSeries(it, catFilter));
        }
      }

      return ok(res, items);
    }

    case 'get_series_info': {
      const sid = Number(q.series_id);
      let found = null;
      let foundCat = '2';

      for (const [catId, key] of Object.entries(SERIES_CAT_MAP)) {
        found = (data[key] || []).find(s => stableId(s.id || s.title) === sid);
        if (found) { foundCat = catId; break; }
      }
      if (!found) return ok(res, {});

      const rawSeasons = found.seasons
        || (found.episodes ? [{ season: 1, episodes: found.episodes }] : []);

      const seasons  = {};
      const episodes = {};

      for (const season of rawSeasons) {
        const sNum = season.season || 1;
        seasons[sNum] = {
          name:          `Temporada ${sNum}`,
          episode_count: (season.episodes || []).length,
          overview:      '',
          cover:         found.poster   || '',
          cover_big:     found.backdrop || found.poster || '',
          air_date:      '',
          season_number: sNum,
        };
        episodes[sNum] = (season.episodes || []).map((ep, i) => {
          const epNum = ep.episode || i + 1;
          return {
            id:                  String(stableId((found.id || found.title) + sNum + epNum)),
            episode_num:         epNum,
            title:               ep.title || `Episódio ${epNum}`,
            container_extension: extFromUrl(ep.url || ''),
            info: {
              releasedate:  ep.air_date  || '',
              plot:         ep.overview  || '',
              movie_image:  ep.still     || '',
              duration_secs: 0,
              duration:     '',
              rating:       '',
            },
            subtitles:     [],
            custom_sid:    '',
            added:         '',
            season:        sNum,
            direct_source: ep.url    || '',
            locked:        ep.locked || false,
          };
        });
      }

      return ok(res, {
        info: {
          name:            found.title,
          cover:           found.poster   || '',
          plot:            found.overview || '',
          cast:            (found.cast || []).map(c => c.name).join(', '),
          genre:           (found.genres || []).join(', '),
          releaseDate:     found.year     || '',
          rating:          String(found.rating || ''),
          rating_5based:   found.rating ? (found.rating / 2).toFixed(1) : '0',
          backdrop_path:   found.backdrop ? [found.backdrop] : [],
          backdrop:        found.backdrop || '',
          category_id:     foundCat,
        },
        seasons,
        episodes,
      });
    }

    default:
      return ok(res, { error: `Unknown action: ${action}` });
  }
};

// ─── Aux ──────────────────────────────────────────────────────────────────────

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
    message:         'Welcome back!',
    auth:            1,
    status:          'Active',
    exp_date:        null,
    is_trial:        '0',
    active_cons:     '0',
    created_at:      String(Math.floor(Date.now() / 1000)),
    max_connections: '1',
    allowed_output_formats: ['m3u8', 'ts', 'rtmp'],
  };
}
