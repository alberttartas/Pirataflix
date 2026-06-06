/**
 * Pirataflix — Xtream Codes API
 * Vercel Serverless Function
 *
 * Endpoints cobertos:
 *   player_api.php (sem action)  → user_info + server_info
 *   action=get_live_categories   → categorias de TV
 *   action=get_live_streams      → canais TV
 *   action=get_vod_categories    → categorias VOD
 *   action=get_vod_streams       → filmes
 *   action=get_vod_info          → info + episodes de um filme
 *   action=get_series_categories → categorias de séries
 *   action=get_series            → lista de séries
 *   action=get_series_info       → info + temporadas/episódios de uma série
 *
 * Autenticação: fake/fixa via env vars ou fallback hardcoded.
 *   XTREAM_USERNAME (default: "pirataflix")
 *   XTREAM_PASSWORD (default: "pirataflix")
 *
 * Data source: /web/data.json e /web/channels.json do repositório.
 * Em produção no Vercel esses arquivos ficam em process.cwd()/web/.
 */

const fs   = require('fs');
const path = require('path');

// ─── Configuração ────────────────────────────────────────────────────────────

const VALID_USERNAME = process.env.XTREAM_USERNAME || 'pirataflix';
const VALID_PASSWORD = process.env.XTREAM_PASSWORD || 'pirataflix';

const SERVER_URL  = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : (process.env.SERVER_URL || 'http://localhost:3000');

// ─── Helpers de dados ────────────────────────────────────────────────────────

let _dataCache    = null;
let _channelCache = null;

function loadData() {
  if (_dataCache) return _dataCache;
  try {
    const p = path.join(process.cwd(), 'web', 'data.json');
    _dataCache = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    _dataCache = { filmes: [], series: [], novelas: [], animes: [], infantil: [], tv: [] };
  }
  return _dataCache;
}

function loadChannels() {
  if (_channelCache) return _channelCache;
  try {
    const p = path.join(process.cwd(), 'web', 'channels.json');
    _channelCache = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    _channelCache = [];
  }
  return _channelCache;
}

// ─── Mapeamento de categorias ─────────────────────────────────────────────────

const VOD_CATEGORIES = [
  { category_id: '1', category_name: '🎬 Filmes',   parent_id: 0 },
  { category_id: '2', category_name: '📺 Séries',   parent_id: 0 },
  { category_id: '3', category_name: '📖 Novelas',  parent_id: 0 },
  { category_id: '4', category_name: '👻 Animes',   parent_id: 0 },
  { category_id: '5', category_name: '🧸 Infantil', parent_id: 0 },
];

const SERIES_CATEGORY_IDS = { series: '2', novelas: '3', animes: '4', infantil: '5' };

// Gera um category_id numérico estável a partir de uma string de grupo TV
function tvGroupId(groupName) {
  let h = 100;
  for (let i = 0; i < groupName.length; i++) h = ((h << 5) - h + groupName.charCodeAt(i)) | 0;
  return Math.abs(h) % 9000 + 1000;
}

// ─── Formatadores ─────────────────────────────────────────────────────────────

/**
 * Formata um item de série (series/novelas/animes/infantil) para o formato
 * get_series da Xtream Codes.
 */
function formatSeries(item, catId) {
  return {
    num:              item.id || '',
    name:             item.title,
    series_id:        stableId(item.id || item.title),
    cover:            item.poster || '',
    plot:             item.overview || '',
    cast:             (item.cast || []).map(c => c.name).join(', '),
    director:         '',
    genre:            (item.genres || []).join(', '),
    releaseDate:      item.year || '',
    last_modified:    '',
    rating:           String(item.rating || ''),
    rating_5based:    item.rating ? (item.rating / 2).toFixed(1) : '0',
    backdrop_path:    item.backdrop ? [item.backdrop] : [],
    youtube_trailer:  '',
    episode_run_time: '',
    category_id:      catId,
  };
}

/**
 * Formata um item de filme para get_vod_streams.
 */
function formatVodStream(item, num) {
  const ep = (item.episodes || [])[0] || {};
  return {
    num,
    name:              item.title,
    stream_type:       'movie',
    stream_id:         stableId(item.id || item.title),
    stream_icon:       item.poster || '',
    rating:            String(item.rating || ''),
    rating_5based:     item.rating ? (item.rating / 2).toFixed(1) : '0',
    added:             '',
    category_id:       '1',
    container_extension: extensionFromUrl(ep.url || ''),
    custom_sid:        '',
    direct_source:     ep.url || '',
  };
}

/**
 * Formata um canal de TV para get_live_streams.
 */
function formatLiveStream(canal, num) {
  return {
    num,
    name:              canal.title || canal.name || 'Canal',
    stream_type:       'live',
    stream_id:         stableId(canal.tvg_id || canal.title || String(num)),
    stream_icon:       canal.tvg_logo || '',
    epg_channel_id:   canal.tvg_id || '',
    added:             '',
    category_id:       String(tvGroupId(canal.group || 'TV')),
    custom_sid:        '',
    direct_source:     canal.url || '',
    tv_archive:        0,
    tv_archive_duration: 0,
  };
}

// ─── Helpers numéricos ────────────────────────────────────────────────────────

/** Converte um slug/string em número inteiro estável (para stream_id / series_id). */
function stableId(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h) % 900000 + 100000;
}

/** Retorna extensão de vídeo a partir da URL. */
function extensionFromUrl(url) {
  const m = (url || '').match(/\.(mp4|mkv|avi|ts|m3u8|mov|webm)(\?|$)/i);
  return m ? m[1].toLowerCase() : 'mp4';
}

// ─── Handler principal ────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  // CORS — permite qualquer player Xtream
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const q = { ...req.query, ...(req.body || {}) };

  // ── Autenticação ──────────────────────────────────────────────────────────
  const { username, password, action } = q;

  const authenticated = username === VALID_USERNAME && password === VALID_PASSWORD;

  if (!authenticated) {
    res.status(200).json({
      user_info: {
        username,
        password,
        message: 'Wrong username or password',
        auth: 0,
        status: 'Disabled',
        exp_date: null,
        is_trial: '0',
        active_cons: '0',
        created_at: '',
        max_connections: '0',
        allowed_output_formats: ['m3u8', 'ts', 'rtmp'],
      },
      server_info: serverInfo(),
    });
    return;
  }

  const data     = loadData();
  const channels = loadChannels();

  // ── Sem action = login/info ───────────────────────────────────────────────
  if (!action) {
    res.status(200).json({
      user_info:   userInfo(username, password),
      server_info: serverInfo(),
    });
    return;
  }

  // ── Dispatcher ────────────────────────────────────────────────────────────
  switch (action) {

    // ── Live ────────────────────────────────────────────────────────────────

    case 'get_live_categories': {
      const groups = [...new Set(channels.map(c => c.group || 'TV'))];
      const cats = groups.map(g => ({
        category_id:   String(tvGroupId(g)),
        category_name: g,
        parent_id:     0,
      }));
      return json(res, cats);
    }

    case 'get_live_streams': {
      const catFilter = q.category_id;
      let list = channels;
      if (catFilter) {
        list = list.filter(c => String(tvGroupId(c.group || 'TV')) === String(catFilter));
      }
      return json(res, list.map((c, i) => formatLiveStream(c, i + 1)));
    }

    // ── VOD ─────────────────────────────────────────────────────────────────

    case 'get_vod_categories': {
      return json(res, VOD_CATEGORIES);
    }

    case 'get_vod_streams': {
      const catFilter = q.category_id;
      // Se não filtrado ou filtro = '1', devolve filmes
      if (!catFilter || catFilter === '1') {
        return json(res, (data.filmes || []).map((f, i) => formatVodStream(f, i + 1)));
      }
      return json(res, []);
    }

    case 'get_vod_info': {
      const { vod_id } = q;
      if (!vod_id) return json(res, {});
      const vid = Number(vod_id);
      const filme = (data.filmes || []).find(f => stableId(f.id || f.title) === vid);
      if (!filme) return json(res, {});

      const ep = (filme.episodes || [])[0] || {};
      return json(res, {
        info: {
          kinopoisk_url:     '',
          tmdb_id:           filme.tmdb_id || '',
          name:              filme.title,
          o_name:            filme.title,
          cover_big:         filme.poster || '',
          movie_image:       filme.poster || '',
          releasedate:       filme.year || '',
          episode_run_time:  '',
          youtube_trailer:   '',
          director:          '',
          actors:            (filme.cast || []).map(c => c.name).join(', '),
          cast:              (filme.cast || []).map(c => c.name).join(', '),
          description:       filme.overview || '',
          plot:              filme.overview || '',
          age:               '',
          mpaa_rating:       '',
          rating_count_kinopoisk: '',
          country:           '',
          genre:             (filme.genres || []).join(', '),
          backdrop_path:     filme.backdrop ? [filme.backdrop] : [],
          duration_secs:     0,
          duration:          '',
          bitrate:           0,
          rating:            String(filme.rating || ''),
          status:            'Ended',
        },
        movie_data: {
          stream_id:           stableId(filme.id || filme.title),
          name:                filme.title,
          added:               '',
          category_id:         '1',
          container_extension: extensionFromUrl(ep.url || ''),
          info:                {},
          custom_sid:          '',
          direct_source:       ep.url || '',
        },
      });
    }

    // ── Séries ───────────────────────────────────────────────────────────────

    case 'get_series_categories': {
      const cats = [
        { category_id: '2', category_name: '📺 Séries',   parent_id: 0 },
        { category_id: '3', category_name: '📖 Novelas',  parent_id: 0 },
        { category_id: '4', category_name: '👻 Animes',   parent_id: 0 },
        { category_id: '5', category_name: '🧸 Infantil', parent_id: 0 },
      ];
      return json(res, cats);
    }

    case 'get_series': {
      const catFilter = q.category_id;
      let items = [];

      const push = (arr, catId) => {
        for (const it of (arr || [])) items.push(formatSeries(it, catId));
      };

      if (!catFilter) {
        push(data.series,   '2');
        push(data.novelas,  '3');
        push(data.animes,   '4');
        push(data.infantil, '5');
      } else {
        const catMap = { '2': 'series', '3': 'novelas', '4': 'animes', '5': 'infantil' };
        const key = catMap[catFilter];
        if (key) push(data[key], catFilter);
      }

      return json(res, items);
    }

    case 'get_series_info': {
      const { series_id } = q;
      if (!series_id) return json(res, {});
      const sid = Number(series_id);

      // Procura em todas as categorias de séries
      let found = null;
      for (const key of ['series', 'novelas', 'animes', 'infantil']) {
        found = (data[key] || []).find(s => stableId(s.id || s.title) === sid);
        if (found) break;
      }
      if (!found) return json(res, {});

      // Monta seasons + episodes no formato Xtream
      const seasons = {};
      const episodes = {};

      const rawSeasons = found.seasons || (found.episodes ? [{ season: 1, episodes: found.episodes }] : []);
      for (const season of rawSeasons) {
        const sNum = season.season || 1;
        seasons[sNum] = {
          name:         `Temporada ${sNum}`,
          episode_count: season.episodes ? season.episodes.length : 0,
          overview:     '',
          cover:        found.poster || '',
          cover_big:    found.backdrop || found.poster || '',
          air_date:     '',
          season_number: sNum,
        };

        episodes[sNum] = (season.episodes || []).map((ep, i) => {
          const epNum = ep.episode || i + 1;
          return {
            id:                String(stableId((found.id || found.title) + sNum + epNum)),
            episode_num:       epNum,
            title:             ep.title || `Episódio ${epNum}`,
            container_extension: extensionFromUrl(ep.url || ''),
            info: {
              tmdb_id:      '',
              releasedate:  ep.air_date || '',
              plot:         ep.overview || '',
              duration_secs: 0,
              duration:     '',
              movie_image:  ep.still || '',
              bitrate:      0,
              rating:       '',
            },
            subtitles:    [],
            custom_sid:   '',
            added:        '',
            season:       sNum,
            direct_source: ep.url || '',
            locked:       ep.locked || false,
          };
        });
      }

      return json(res, {
        info: {
          name:            found.title,
          cover:           found.poster || '',
          plot:            found.overview || '',
          cast:            (found.cast || []).map(c => c.name).join(', '),
          director:        '',
          genre:           (found.genres || []).join(', '),
          releaseDate:     found.year || '',
          last_modified:   '',
          rating:          String(found.rating || ''),
          rating_5based:   found.rating ? (found.rating / 2).toFixed(1) : '0',
          backdrop_path:   found.backdrop ? [found.backdrop] : [],
          youtube_trailer: '',
          episode_run_time: '',
          category_id:     '2',
          backdrop:        found.backdrop || '',
        },
        seasons,
        episodes,
      });
    }

    // ── M3U output ─────────────────────────────────────────────────────────

    case 'get_simple_data_table': {
      // Alguns players pedem isso — devolve lista flat de todos os streams
      const all = [
        ...(data.filmes  || []).map((f, i) => formatVodStream(f, i + 1)),
        ...(data.series  || []).map((s, i) => formatSeries(s, '2')),
        ...(channels       || []).map((c, i) => formatLiveStream(c, i + 1)),
      ];
      return json(res, all);
    }

    default:
      return json(res, { error: `Unknown action: ${action}` });
  }
};

// ─── Respostas auxiliares ─────────────────────────────────────────────────────

function json(res, data) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).json(data);
}

function serverInfo() {
  return {
    url:            SERVER_URL,
    port:           '80',
    https_port:     '443',
    server_protocol:'http',
    rtmp_port:      '1935',
    timezone:       'America/Fortaleza',
    timestamp_now:  Math.floor(Date.now() / 1000),
    time_now:       new Date().toISOString().replace('T', ' ').slice(0, 19),
    process:        'streamdev',
  };
}

function userInfo(username, password) {
  return {
    username,
    password,
    message:        'Welcome back!',
    auth:           1,
    status:         'Active',
    exp_date:       null,
    is_trial:       '0',
    active_cons:    '0',
    created_at:     String(Math.floor(Date.now() / 1000)),
    max_connections:'1',
    allowed_output_formats: ['m3u8', 'ts', 'rtmp'],
  };
}
