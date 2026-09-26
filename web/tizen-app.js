/*
 * PIRATAFLIX — tizen-app.js  (v2 — navegação espacial)
 */

(function () {
  'use strict';

  // ─── CONFIG ──────────────────────────────────────────────────────────────

  var RAW_BASE       = 'https://raw.githubusercontent.com/alberttartas/Pirataflix/main';
  var DEFAULT_POSTER = RAW_BASE + '/assets/Capas/default.jpg';
  var TV_POSTER      = RAW_BASE + '/assets/Capas/tv_default.jpg';

  var CATS = ['filmes', 'series', 'novelas', 'animes', 'infantil'];
  var CAT_LABELS = {
    filmes:   '🎬 Filmes',
    series:   '📺 Séries',
    novelas:  '💖 Novelas',
    animes:   '👻 Animes',
    infantil: '🧸 Infantil',
    tv:       '📡 TV Ao Vivo'
  };

  var KEY = {
    ENTER: 13, ESC: 27, SPACE: 32, PGUP: 33, PGDN: 34,
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40,
    BACK: 10009,
    MEDIA_PAUSE: 19, MEDIA_REWIND: 412, MEDIA_STOP: 413,
    MEDIA_PLAY: 415, MEDIA_FF: 417, MEDIA_PLAYPAUSE: 10252,
    CH_UP: 427, CH_DOWN: 428
  };

  var TIZEN_KEY_NAMES = [
    'MediaPlay', 'MediaPause', 'MediaPlayPause', 'MediaStop',
    'MediaRewind', 'MediaFastForward', 'ChannelUp', 'ChannelDown'
  ];

  var BATCH        = 40;    // cards renderizados por lote
  var CW_KEY       = 'pirataflix_progressos';
  var EXIT_WINDOW  = 2500;  // ms para confirmar saída com Voltar

  // ─── ESTADO ──────────────────────────────────────────────────────────────

  var vodData      = {};
  var channels     = [];
  var currentCat   = 'filmes';
  var searchActive = false;
  var searchTimer  = null;

  // Player
  var playerUrl      = '';
  var playerTitle    = '';
  var playerItemId   = null;
  var playerCat      = null;
  var playerEpIdx    = 0;
  var playerEnded    = false;
  var hlsInstance    = null;
  var controlsTimer  = null;
  var progressInterval = null;
  var seekStreak     = 0;
  var lastSeekAt     = 0;

  // Player Blogger (iframe) — vídeos hospedados em blogger.com/video.g
  // não podem ser tocados via <video src="">, precisam de iframe (embed)
  var bloggerIframe = null;
  var isBloggerMode = false;

  // Foco / saída
  var focusReturn = null;   // { el, key } — de onde o modal/player foi aberto
  var lastBackAt  = 0;
  var toastTimer  = null;
  var scrollTimer = null;
  var fsRequested = false;
  var layerPushed = false;  // há uma entrada no histórico para modal/player (Voltar do navegador)
  var ignorePop   = 0;      // popstate causado por nós mesmos

  // ─── UTILITÁRIOS ─────────────────────────────────────────────────────────

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toArray(list) {
    var arr = [];
    for (var i = 0; i < list.length; i++) arr.push(list[i]);
    return arr;
  }

  function isShown(el) { return !!el && el.style.display !== 'none'; }

  function isVisible(el) { return el.offsetWidth > 0 && el.offsetHeight > 0; }

  function fmt(s) {
    if (!s || isNaN(s) || !isFinite(s)) return '0:00';
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' + sec : sec);
  }

  function normalizeStr(s) {
    return s.toLowerCase()
      .replace(/[àáâãä]/g, 'a').replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u').replace(/ç/g, 'c').replace(/ñ/g, 'n');
  }

  function ajax(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) {
        try {
          callback(null, JSON.parse(xhr.responseText));
        } catch (e) {
          callback(e, null);
        }
      } else {
        callback(new Error('HTTP ' + xhr.status), null);
      }
    };
    xhr.send();
  }

  function makeImg(src, fallback) {
    var img = document.createElement('img');
    img.alt = '';
    img.onerror = function () { this.onerror = null; this.src = fallback; };
    img.src = src;
    return img;
  }

  function showToast(msg) {
    var t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'show';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ''; }, EXIT_WINDOW);
  }

  // ─── DADOS ───────────────────────────────────────────────────────────────

  function getPoster(item, cat) {
    if (cat === 'tv') {
      if (item.tvg_logo && item.tvg_logo.indexOf('http') === 0) return item.tvg_logo;
      return TV_POSTER;
    }
    if (item.poster && item.poster.indexOf('http') === 0) return item.poster;
    var file = item.poster ? item.poster.split('/').pop() : 'default.jpg';
    return RAW_BASE + '/assets/Capas/' + file;
  }

  function getEpList(item) {
    if (item.episodes && item.episodes.length) return item.episodes;
    if (item.seasons && item.seasons.length) {
      var seasons = item.seasons.slice().sort(function (a, b) { return a.season - b.season; });
      var list = [];
      for (var i = 0; i < seasons.length; i++) {
        var eps = seasons[i].episodes || [];
        for (var j = 0; j < eps.length; j++) list.push(eps[j]);
      }
      return list;
    }
    return [];
  }

  function findItem(cat, itemId) {
    var items = vodData[cat] || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === itemId || items[i].title === itemId) return items[i];
    }
    return null;
  }

  function isPlayable(ep) { return !!ep && !!ep.url && !ep.locked; }

  // ─── CONTINUE WATCHING (formato compatível com o site) ───────────────────

  function cwAll() {
    try {
      var data = JSON.parse(localStorage.getItem(CW_KEY)) || {};
      if (Object.prototype.toString.call(data) === '[object Array]') {
        var conv = {};
        for (var i = 0; i < data.length; i++) {
          var it = data[i];
          conv[it.videoId || (it.itemId + '_' + (it.episodeIndex || 0))] = it;
        }
        return conv;
      }
      return data;
    } catch (e) { return {}; }
  }

  function cwGet(videoId) { return cwAll()[videoId] || null; }

  function cwSave(obj) {
    if (!obj.videoId || !obj.itemId) return;
    try {
      var data = cwAll();
      obj.timestamp = Date.now();
      obj.progress  = obj.duration ? Math.round((obj.currentTime / obj.duration) * 100) : 0;
      data[obj.videoId] = obj;
      localStorage.setItem(CW_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function cwRemove(videoId) {
    try {
      var data = cwAll();
      delete data[videoId];
      localStorage.setItem(CW_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function cwLatestFor(itemId, cat) {
    var all = cwAll();
    var best = null;
    for (var k in all) {
      if (!all.hasOwnProperty(k)) continue;
      var e = all[k];
      if (e && e.itemId === itemId && e.category === cat &&
          (!best || (e.timestamp || 0) > (best.timestamp || 0))) {
        best = e;
      }
    }
    return best;
  }

  function cwGetList() {
    var raw  = cwAll();
    var seen = {};
    var keys = Object.keys(raw);
    for (var i = 0; i < keys.length; i++) {
      var entry = raw[keys[i]];
      if (!entry || !entry.itemId || !entry.category || entry.category === 'tv') continue;
      var pct = entry.duration ? (entry.currentTime / entry.duration) * 100 : 0;
      if (pct < 2 || pct > 95) continue;
      var dk = entry.itemId + '_' + entry.category;
      if (!seen[dk] || (entry.timestamp || 0) > (seen[dk].timestamp || 0)) seen[dk] = entry;
    }
    var list = [];
    var dks  = Object.keys(seen);
    for (var di = 0; di < dks.length; di++) list.push(seen[dks[di]]);
    list.sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    return list.slice(0, 10);
  }

  // ─── INIT ────────────────────────────────────────────────────────────────

  function init() {
    registerTizenKeys();
    bindKeys();
    bindFullscreenTriggers();
    bindFocusTracking();
    bindScrollLoader();
    window.addEventListener('popstate', onPopState);

    ajax('data.json', function (err, data) {
      if (err || !data) {
        $('loading').textContent = 'Erro ao carregar catálogo.';
        return;
      }
      vodData = data;

      ajax('channels.json', function (err2, chs) {
        channels = (err2 || !chs) ? [] : chs;
        for (var i = 0; i < channels.length; i++) channels[i]._idx = i;
        vodData['tv'] = channels;

        $('loading').style.display = 'none';
        $('catalog').style.display = 'block';

        renderCatalog(currentCat);
        bindNav();
        bindSearch();
        bindModal();
        bindPlayer();

        focusEl(activeNavLink());
      });
    });
  }

  // Só existe quando empacotado como app Tizen (no navegador da TV é ignorado)
  function registerTizenKeys() {
    try {
      if (window.tizen && window.tizen.tvinputdevice) {
        for (var i = 0; i < TIZEN_KEY_NAMES.length; i++) {
          try { window.tizen.tvinputdevice.registerKey(TIZEN_KEY_NAMES[i]); } catch (e) {}
        }
      }
    } catch (e2) {}
  }

  // ─── RENDER: CATÁLOGO ────────────────────────────────────────────────────

  function setNavActive(cat) {
    var links = document.querySelectorAll('.nav-link');
    for (var i = 0; i < links.length; i++) {
      links[i].className = (links[i].getAttribute('data-cat') === cat) ? 'nav-link active' : 'nav-link';
    }
  }

  function activeNavLink() {
    return document.querySelector('.nav-link.active') || document.querySelector('.nav-link');
  }

  function addSectionTitle(parent, text) {
    var title = document.createElement('div');
    title.className = 'section-title';
    title.textContent = text;
    parent.appendChild(title);
  }

  // Linha de cards renderizada em lotes (BATCH por vez)
  function makeRow(items, fn) {
    var row = document.createElement('div');
    row.className = 'cards-row';
    row._items = items;
    row._fn    = fn;
    row._pos   = 0;
    appendBatch(row);
    return row;
  }

  function appendBatch(row) {
    if (!row._items || row._pos >= row._items.length) return;
    var end  = Math.min(row._pos + BATCH, row._items.length);
    var frag = document.createDocumentFragment();
    while (row._pos < end) {
      frag.appendChild(row._fn(row._items[row._pos]));
      row._pos++;
    }
    row.appendChild(frag);
  }

  function renderCatalog(cat) {
    currentCat   = cat;
    searchActive = false;
    setNavActive(cat);

    var catalog = $('catalog');
    catalog.innerHTML = '';

    var cwBox  = document.createElement('div');
    cwBox.id = 'cw-section';
    var catBox = document.createElement('div');
    catBox.id = 'cat-section';
    catalog.appendChild(cwBox);
    catalog.appendChild(catBox);

    renderContinueWatching(cwBox);

    var noRes = $('no-results');
    noRes.style.display = 'none';

    if (cat === 'tv') {
      renderTvGrid(catBox, channels);
      return;
    }

    var items = vodData[cat] || [];
    if (!items.length) {
      noRes.style.display = 'block';
      return;
    }

    addSectionTitle(catBox, CAT_LABELS[cat] || cat);
    catBox.appendChild(makeRow(items, function (it) { return makeCard(it, cat); }));
  }

  function renderTvGrid(container, chs) {
    var noRes = $('no-results');
    if (!chs.length) {
      noRes.style.display = 'block';
      return;
    }
    noRes.style.display = 'none';

    var groups = {};
    var groupOrder = [];
    for (var i = 0; i < chs.length; i++) {
      var g = chs[i].group || 'TV';
      if (!groups[g]) { groups[g] = []; groupOrder.push(g); }
      groups[g].push(chs[i]);
    }

    for (var gi = 0; gi < groupOrder.length; gi++) {
      addSectionTitle(container, groupOrder[gi]);
      container.appendChild(makeRow(groups[groupOrder[gi]], makeTvCard));
    }
  }

  // ─── CONTINUAR ASSISTINDO ────────────────────────────────────────────────

  function renderContinueWatching(container) {
    container.innerHTML = '';
    var list = cwGetList();
    if (!list.length) return;

    addSectionTitle(container, '▶ Continuar Assistindo');

    var row = document.createElement('div');
    row.className = 'cards-row';
    for (var i = 0; i < list.length; i++) row.appendChild(makeCwCard(list[i]));
    container.appendChild(row);
  }

  // Atualiza só a fileira (sem mexer no resto do catálogo)
  function refreshContinueWatching() {
    var box = $('cw-section');
    if (box && !searchActive) renderContinueWatching(box);
  }

  function makeCwCard(entry) {
    var card = document.createElement('div');
    card.className = 'card card-cw';
    card.setAttribute('tabindex', '0');
    card.setAttribute('data-key', 'w:' + entry.category + ':' + entry.itemId);

    var item    = findItem(entry.category, entry.itemId);
    var poster  = item ? getPoster(item, entry.category) : DEFAULT_POSTER;
    var pct     = entry.duration ? Math.round((entry.currentTime / entry.duration) * 100) : 0;
    var label   = entry.seriesTitle || entry.title || (item ? item.title : 'Sem título');
    var seriesTitle = String(label).split(' - ')[0];

    var wrap = document.createElement('div');
    wrap.className = 'cw-thumb-wrap';
    wrap.appendChild(makeImg(poster, DEFAULT_POSTER));
    wrap.insertAdjacentHTML('beforeend',
      '<div class="cw-progress-bar"><div class="cw-progress-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="cw-time-badge">' + fmt(entry.currentTime || 0) + '</div>' +
      '<div class="cw-play-icon">▶</div>');
    card.appendChild(wrap);

    var info = document.createElement('div');
    info.className = 'card-info';
    info.innerHTML =
      '<div class="card-title">' + esc(seriesTitle) + '</div>' +
      '<div class="card-meta">' + pct + '% assistido</div>';
    card.appendChild(info);

    card.onclick = function () { resumeCw(entry); };
    return card;
  }

  function resumeCw(entry) {
    rememberFocus();

    var item = findItem(entry.category, entry.itemId);
    if (!item) { playVideo(entry.url, entry.title, entry.itemId, entry.category, 0); return; }

    var epList = getEpList(item);
    var idx    = entry.episodeIndex || 0;
    var ep     = epList[idx];
    var url    = ep ? ep.url : (item.url || entry.url);
    var title  = ep ? (item.title + ' - ' + (ep.title || 'Ep ' + (idx + 1))) : item.title;

    playVideo(url, title, entry.itemId, entry.category, idx);
  }

  // ─── CARDS ───────────────────────────────────────────────────────────────

  function makeCard(item, cat) {
    var card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('tabindex', '0');
    card.setAttribute('data-key', 'c:' + cat + ':' + (item.id || item.title));

    card.appendChild(makeImg(getPoster(item, cat), DEFAULT_POSTER));

    var info = document.createElement('div');
    info.className = 'card-info';
    info.innerHTML =
      '<div class="card-title">' + esc(item.title) + '</div>' +
      '<div class="card-meta">' +
        (item.year ? '<span>' + esc(item.year) + '</span> ' : '') +
        (item.rating ? '<span class="card-rating">⭐ ' + esc(item.rating) + '</span>' : '') +
      '</div>';
    card.appendChild(info);

    card.onclick = function () { openModal(cat, item.id || item.title); };
    return card;
  }

  function makeTvCard(canal) {
    var card = document.createElement('div');
    card.className = 'card card-tv';
    card.setAttribute('tabindex', '0');
    card.setAttribute('data-key', 't:' + canal._idx);

    card.appendChild(makeImg(getPoster(canal, 'tv'), TV_POSTER));

    var info = document.createElement('div');
    info.className = 'card-info';
    info.innerHTML =
      '<div class="card-title">' + esc(canal.title || canal.name || 'Canal') + '</div>' +
      '<div class="card-meta"><span class="live-dot">●</span> AO VIVO</div>';
    card.appendChild(info);

    card.onclick = function () { openTvModal(canal._idx); };
    return card;
  }

  // ─── MODAL ───────────────────────────────────────────────────────────────

  function setBackdrop(url) {
    $('modal-backdrop').style.backgroundImage = 'url("' + String(url).replace(/"/g, '%22') + '")';
  }

  function openModal(cat, itemId) {
    var item = findItem(cat, itemId);
    if (!item) return;

    if (!isShown($('modal'))) rememberFocus();

    var modal = $('modal');
    var body  = $('modal-body');

    setBackdrop(item.backdrop || getPoster(item, cat));

    var epList    = getEpList(item);
    var last      = cwLatestFor(itemId, cat);
    var resumeIdx = last ? (last.episodeIndex || 0) : -1;
    if (resumeIdx >= epList.length) resumeIdx = -1;

    var html = '';
    html += '<div class="modal-title">' + esc(item.title) + '</div>';
    html += '<div class="modal-badges">';
    html += '<span class="badge badge-type">' + (CAT_LABELS[cat] || cat) + '</span>';
    if (item.year)   html += '<span class="badge">📅 ' + esc(item.year) + '</span>';
    if (item.rating) html += '<span class="badge badge-rating">⭐ ' + esc(item.rating) + '</span>';
    html += '</div>';

    if (item.overview) html += '<p class="modal-overview">' + esc(item.overview) + '</p>';

    html += '<button class="modal-play-btn" id="modal-play-btn">' +
              (resumeIdx >= 0 ? '▶ Continuar (Ep ' + (resumeIdx + 1) + ')' : '▶ Assistir') +
            '</button>';

    if (item.seasons && item.seasons.length) {
      html += renderSeasons(item, cat, resumeIdx);
    } else if (item.episodes && item.episodes.length) {
      html += '<div class="modal-section-title">Episódios</div>';
      html += '<div class="ep-list" id="ep-list-main">';
      for (var ei = 0; ei < item.episodes.length; ei++) {
        html += renderEpItem(item.episodes[ei], item.episodes[ei].episode || (ei + 1), ei, itemId, cat, resumeIdx);
      }
      html += '</div>';
    }

    body.innerHTML = html;
    modal.style.display = 'block';
    modal.scrollTop = 0;
    syncHistory();

    $('modal-play-btn').onclick = function () {
      closeModal(false);
      playFirstEpisode(cat, itemId);
      syncHistory();
    };

    bindEpClicks(body, itemId, cat, item.title);

    setTimeout(function () {
      // Deixa o episódio "atual" visível no carrossel
      var cur = body.querySelector('.ep-resume');
      if (cur && isVisible(cur)) {
        var list = cur.parentNode;
        list.scrollLeft += cur.getBoundingClientRect().left - list.getBoundingClientRect().left - 24;
      }
      focusEl($('modal-play-btn'));
    }, 60);
  }

  function openTvModal(idx) {
    var canal = channels[idx];
    if (!canal) return;

    if (!isShown($('modal'))) rememberFocus();

    var modal = $('modal');
    var body  = $('modal-body');

    setBackdrop(getPoster(canal, 'tv'));

    var html = '';
    html += '<div class="modal-title">' + esc(canal.title || canal.name) + '</div>';
    html += '<div class="modal-badges"><span class="badge badge-type">📡 TV Ao Vivo</span>';
    if (canal.group) html += '<span class="badge">' + esc(canal.group) + '</span>';
    html += '</div>';
    html += '<button class="modal-play-btn" id="modal-play-btn">▶ Assistir ao Vivo</button>';

    var grupo = canal.group || 'TV';
    var same  = [];
    for (var i = 0; i < channels.length; i++) {
      if ((channels[i].group || 'TV') === grupo) same.push(channels[i]);
    }

    if (same.length > 1) {
      html += '<div class="modal-section-title">Canais — ' + esc(grupo) + '</div>';
      html += '<div class="ep-list canal-list">';
      for (var si = 0; si < same.length; si++) {
        var ch = same[si];
        html +=
          '<div class="canal-item" tabindex="0" data-tv-idx="' + ch._idx + '">' +
            '<img src="' + esc(getPoster(ch, 'tv')) + '" class="canal-logo" onerror="this.onerror=null;this.src=\'' + TV_POSTER + '\'">' +
            '<span class="canal-name">' + esc(ch.title || ch.name || 'Canal') + '</span>' +
            (ch._idx === idx ? '<span class="live-dot">● AO VIVO</span>' : '') +
          '</div>';
      }
      html += '</div>';
    }

    body.innerHTML = html;
    modal.style.display = 'block';
    modal.scrollTop = 0;
    syncHistory();

    $('modal-play-btn').onclick = function () {
      closeModal(false);
      playTvChannel(idx);
      syncHistory();
    };

    var canalItems = body.querySelectorAll('.canal-item');
    for (var ci = 0; ci < canalItems.length; ci++) {
      (function (el) {
        var tvIdx = parseInt(el.getAttribute('data-tv-idx'), 10);
        el.onclick = function () { closeModal(false); playTvChannel(tvIdx); syncHistory(); };
      })(canalItems[ci]);
    }

    setTimeout(function () {
      var atual = body.querySelector('.canal-item[data-tv-idx="' + idx + '"]');
      if (atual && isVisible(atual)) {
        var list = atual.parentNode;
        list.scrollTop += atual.getBoundingClientRect().top - list.getBoundingClientRect().top - 40;
      }
      focusEl($('modal-play-btn'));
    }, 60);
  }

  // restore=false: o modal fecha porque um vídeo vai abrir (o foco de retorno
  // continua guardado para quando o player fechar)
  function closeModal(restore) {
    $('modal').style.display = 'none';
    if (restore !== false) { syncHistory(); restoreFocusReturn(); }
  }

  // ─── EPISÓDIOS HTML ──────────────────────────────────────────────────────

  function renderSeasons(item, cat, resumeIdx) {
    var seasons = item.seasons.slice().sort(function (a, b) { return a.season - b.season; });
    var itemId  = item.id || item.title;

    // Abre a temporada do episódio "atual"; senão, a última
    var openIdx = seasons.length - 1;
    if (resumeIdx >= 0) {
      var acc = 0;
      for (var k = 0; k < seasons.length; k++) {
        var n = (seasons[k].episodes || []).length;
        if (resumeIdx < acc + n) { openIdx = k; break; }
        acc += n;
      }
    }

    var html   = '<div>';
    var offset = 0;

    for (var si = 0; si < seasons.length; si++) {
      var s      = seasons[si];
      var sNum   = s.season || (si + 1);
      var isOpen = si === openIdx;
      var colId  = 'season-' + sNum;
      var eps    = s.episodes || [];

      html +=
        '<div class="modal-section-title season-header" tabindex="0" data-toggle="' + colId + '">' +
          '<span class="season-label">🎬 Temporada ' + sNum + '</span>' +
          '<span class="season-count">' + eps.length + ' ep.</span>' +
          '<span class="season-chevron">' + (isOpen ? '▲' : '▼') + '</span>' +
        '</div>';

      html += '<div class="ep-list" id="' + colId + '" style="display:' + (isOpen ? 'flex' : 'none') + '">';
      for (var ei = 0; ei < eps.length; ei++) {
        html += renderEpItem(eps[ei], eps[ei].episode || (ei + 1), offset + ei, itemId, cat, resumeIdx);
      }
      html += '</div>';
      offset += eps.length;
    }

    html += '</div>';
    return html;
  }

  function renderEpItem(ep, num, globalIdx, itemId, cat, resumeIdx) {
    var locked  = ep.locked || !ep.url;
    var title   = ep.title || ('Episódio ' + num);
    var airdate = ep.air_date || ep.release_iso || '';

    if (locked) {
      return '<div class="ep-item locked">' +
        '<div class="ep-num">' + num + '</div>' +
        '<div class="ep-info">' +
          '<div class="ep-title">' + esc(title) + '</div>' +
          (airdate ? '<div class="ep-date">📅 ' + esc(airdate) + '</div>' : '<div class="ep-date">Em breve</div>') +
        '</div>' +
        '<span>🔒</span>' +
      '</div>';
    }

    var isResume = globalIdx === resumeIdx;

    return '<div class="ep-item' + (isResume ? ' ep-resume' : '') + '" tabindex="0" data-ep-url="' + esc(ep.url) +
      '" data-ep-title="' + esc(title) + '" data-ep-idx="' + globalIdx +
      '" data-item-id="' + esc(itemId) + '" data-cat="' + cat + '">' +
      '<div class="ep-num">' + num + '</div>' +
      '<div class="ep-info">' +
        '<div class="ep-title">' + esc(title) + '</div>' +
        (isResume ? '<div class="ep-date ep-resume-tag">▶ Continuar daqui</div>'
                  : (airdate ? '<div class="ep-date">' + esc(airdate) + '</div>' : '')) +
      '</div>' +
      '<span class="ep-play">▶</span>' +
    '</div>';
  }

  function bindEpClicks(container, itemId, cat, itemTitle) {
    var items = container.querySelectorAll('.ep-item:not(.locked)');
    for (var i = 0; i < items.length; i++) {
      (function (el) {
        el.onclick = function () {
          var url   = el.getAttribute('data-ep-url');
          var title = itemTitle + ' - ' + el.getAttribute('data-ep-title');
          var idx   = parseInt(el.getAttribute('data-ep-idx'), 10) || 0;
          closeModal(false);
          playVideo(url, title, el.getAttribute('data-item-id'), el.getAttribute('data-cat'), idx);
          syncHistory();
        };
      })(items[i]);
    }

    var headers = container.querySelectorAll('.season-header');
    for (var si = 0; si < headers.length; si++) {
      (function (h) {
        h.onclick = function () {
          var panel   = $(h.getAttribute('data-toggle'));
          var chevron = h.querySelector('.season-chevron');
          if (!panel) return;
          var open = panel.style.display !== 'none';
          panel.style.display = open ? 'none' : 'flex';
          if (chevron) chevron.textContent = open ? '▼' : '▲';
          ensureVisible(h);
        };
      })(headers[si]);
    }
  }

  // ─── PLAY ────────────────────────────────────────────────────────────────

  function firstPlayableIndex(epList, from) {
    for (var i = from; i < epList.length; i++) if (isPlayable(epList[i])) return i;
    for (var j = 0; j < from && j < epList.length; j++) if (isPlayable(epList[j])) return j;
    return -1;
  }

  // "Assistir": retoma do progresso salvo (igual à versão web)
  function playFirstEpisode(cat, itemId) {
    var item = findItem(cat, itemId);
    if (!item) return;

    var epList = getEpList(item);
    if (epList.length) {
      var idx  = 0;
      var last = cwLatestFor(itemId, cat);
      if (last) {
        idx = last.episodeIndex || 0;
        var pct = last.duration ? last.currentTime / last.duration : 0;
        if (pct > 0.95 && idx + 1 < epList.length) idx++;
      }
      if (idx >= epList.length) idx = 0;
      idx = firstPlayableIndex(epList, idx);
      if (idx < 0) { showToast('Nenhum episódio disponível ainda'); return; }

      var ep = epList[idx];
      playVideo(ep.url, item.title + ' - ' + (ep.title || 'Ep ' + (idx + 1)), itemId, cat, idx);
    } else if (item.url) {
      playVideo(item.url, item.title, itemId, cat, 0);
    }
  }

  function playTvChannel(idx) {
    var canal = channels[idx];
    if (!canal) return;
    var url = (canal.episodes && canal.episodes[0]) ? canal.episodes[0].url : canal.url;
    if (!url) return;
    playVideo(url, canal.title || 'Canal ' + (idx + 1), 'tv_' + idx, 'tv', 0);
  }

  function channelStep(delta) {
    if (!channels.length) return;
    var cur = parseInt(String(playerItemId).replace('tv_', ''), 10);
    if (isNaN(cur)) cur = 0;
    playTvChannel((cur + delta + channels.length) % channels.length);
  }

  function safePlay(video) {
    try {
      var p = video.play();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (e) {}
  }

  // Próximo episódio reproduzível (ou null)
  function nextEpisode() {
    if (playerCat === 'tv') return null;
    var item = findItem(playerCat, playerItemId);
    if (!item) return null;
    var epList = getEpList(item);
    var next   = epList[playerEpIdx + 1];
    if (!isPlayable(next)) return null;
    return {
      url:   next.url,
      title: item.title + ' - ' + (next.title || 'Ep ' + (playerEpIdx + 2))
    };
  }

  function saveProgress() {
    var video = $('player');
    if (!playerUrl || playerEnded || playerCat === 'tv' || !video) return;
    if (isBloggerMode) return; // Blogger não expõe duration/currentTime via JS
    if (!video.duration || !isFinite(video.duration) || video.currentTime < 10) return;

    var item = findItem(playerCat, playerItemId);
    cwSave({
      videoId:      playerItemId + '_' + playerEpIdx,
      itemId:       playerItemId,
      category:     playerCat,
      episodeIndex: playerEpIdx,
      title:        playerTitle,
      seriesTitle:  String(playerTitle).split(' - ')[0],
      episode:      playerEpIdx + 1,
      currentTime:  video.currentTime,
      duration:     video.duration,
      url:          playerUrl,
      poster:       item ? getPoster(item, playerCat) : ''
    });
  }

  // Detecta URLs do Blogger (blogger.com/video.g, googlevideo.com), que
  // não podem ser tocadas via <video src="">, pois exigem carregamento
  // como página (iframe/embed), não como recurso de mídia direto — ao
  // tentar direto, o Blogger responde 403.
  function isBloggerUrl(url) {
    return !!url && (url.indexOf('blogger.com/video.g') !== -1 || url.indexOf('googlevideo.com') !== -1);
  }

  // Toca um vídeo do Blogger dentro de um iframe (evita o 403 causado por
  // tentar carregar o video.g diretamente como recurso de mídia).
  function playBloggerVideo(url) {
    var container = $('player-video-container');
    var video     = $('player');
    if (video) video.style.display = 'none';

    var iframe = document.createElement('iframe');
    iframe.id = 'tizen-blogger-iframe';
    iframe.src = url;
    iframe.style.cssText = 'width:100%;height:100%;border:none;background:#000;display:block;';
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');
    container.appendChild(iframe);

    bloggerIframe = iframe;
    isBloggerMode = true;

    // Sem timeupdate/duration disponíveis — esconder o que depende disso
    var progWrap  = $('progress-wrap');
    var timeLabel = $('time-label');
    var btnPlay   = $('btn-play');
    if (progWrap)  progWrap.style.display  = 'none';
    if (timeLabel) timeLabel.style.display = 'none';
    if (btnPlay)   btnPlay.style.display   = 'none';
  }

  // Destrói o iframe do Blogger (se existir) e restaura os controles normais
  function destroyBloggerIframe() {
    if (bloggerIframe) {
      bloggerIframe.src = 'about:blank';
      if (bloggerIframe.parentNode) bloggerIframe.parentNode.removeChild(bloggerIframe);
      bloggerIframe = null;
    }
    isBloggerMode = false;

    var video     = $('player');
    var progWrap  = $('progress-wrap');
    var timeLabel = $('time-label');
    var btnPlay   = $('btn-play');
    if (video)     video.style.display     = '';
    if (progWrap)  progWrap.style.display  = '';
    if (timeLabel) timeLabel.style.display = '';
    if (btnPlay)   btnPlay.style.display   = '';
  }

  function playVideo(url, title, itemId, cat, epIdx) {
    if (!url) { showToast('Vídeo indisponível'); return; }

    // Guarda o progresso do vídeo anterior (troca de episódio/canal)
    saveProgress();

    playerUrl    = url;
    playerTitle  = title;
    playerItemId = itemId;
    playerCat    = cat;
    playerEpIdx  = epIdx || 0;
    playerEnded  = false;

    var wrap  = $('player-wrap');
    var video = $('player');
    $('player-title').textContent = title || '';

    destroyHls();
    destroyBloggerIframe();
    wrap.style.display = 'block';

    if (isBloggerUrl(url)) {
      // Blogger (video.g) exige iframe — <video src=""> retorna 403
      playBloggerVideo(url);
    } else {
      var isHls = url.indexOf('m3u8') !== -1;

      if (isHls && typeof Hls !== 'undefined' && Hls.isSupported()) {
        hlsInstance = new Hls({ enableWorker: false });
        hlsInstance.loadSource(url);
        hlsInstance.attachMedia(video);
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, function () { safePlay(video); });
        hlsInstance.on(Hls.Events.ERROR, function (ev, data) {
          if (!data || !data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hlsInstance.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hlsInstance.recoverMediaError();
          } else {
            showOsd('⚠ Erro ao reproduzir');
          }
        });
      } else {
        video.src = url;
        safePlay(video);
      }

      // Restaurar progresso (só VOD, e só quando não é Blogger)
      if (cat !== 'tv') {
        var saved = cwGet(itemId + '_' + epIdx);
        if (saved && saved.currentTime > 5) {
          var restorer = function () {
            video.removeEventListener('loadedmetadata', restorer);
            if (video.duration && saved.currentTime < video.duration - 2) {
              video.currentTime = saved.currentTime;
              var m = Math.floor(saved.currentTime / 60);
              var s = Math.floor(saved.currentTime % 60);
              showOsd('⏯ Retomando ' + m + ':' + (s < 10 ? '0' + s : s));
            }
          };
          video.addEventListener('loadedmetadata', restorer);
        }
      }

      video.focus();
    }

    // Botão "Próximo" (funciona tanto para vídeo normal quanto Blogger)
    var nextBtn = $('btn-next-ep');
    var nxt     = nextEpisode();
    if (nxt) {
      nextBtn.style.display = 'inline-block';
      nextBtn.onclick = function () {
        playVideo(nxt.url, nxt.title, playerItemId, playerCat, playerEpIdx + 1);
      };
    } else {
      nextBtn.style.display = 'none';
      nextBtn.onclick = null;
    }

    // Progresso periódico (sem efeito no modo Blogger — ver saveProgress)
    progressInterval = setInterval(saveProgress, 5000);

    seekStreak = 0;
    showControls();
    syncHistory();
  }

  function destroyHls() {
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
    var video = $('player');
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
  }

  function closePlayer(restore) {
    saveProgress();
    destroyHls();
    destroyBloggerIframe();
    playerUrl = '';
    if (controlsTimer) { clearTimeout(controlsTimer); controlsTimer = null; }
    $('player-controls').className = '';
    $('player-wrap').style.display = 'none';

    refreshContinueWatching();
    if (restore !== false) { syncHistory(); restoreFocusReturn(); }
  }

  // ─── CONTROLES DO PLAYER ─────────────────────────────────────────────────

  function playerBarHas(el) {
    var bar = $('player-bar');
    return !!el && !!bar && bar.contains(el);
  }

  function showControls() {
    var ctrl = $('player-controls');
    ctrl.className = 'visible';
    if (controlsTimer) clearTimeout(controlsTimer);
    controlsTimer = setTimeout(function () {
      var v = $('player');
      if (v && !v.paused && !playerBarHas(document.activeElement)) ctrl.className = '';
    }, 3500);
  }

  function showOsd(text) {
    var wrap = $('player-wrap');
    if (!wrap) return;
    var old = wrap.querySelector('.osd-msg');
    if (old) old.parentNode.removeChild(old);
    var msg = document.createElement('div');
    msg.className = 'osd-msg';
    msg.textContent = text;
    wrap.appendChild(msg);
    setTimeout(function () {
      if (msg.parentNode) msg.parentNode.removeChild(msg);
    }, 1200);
  }

  function togglePlay() {
    if (isBloggerMode) return; // sem controle de play/pause via JS no embed
    var video = $('player');
    if (video.paused) safePlay(video); else video.pause();
  }

  function seekBy(sec) {
    if (isBloggerMode) {
      if (bloggerIframe && bloggerIframe.contentWindow) {
        bloggerIframe.contentWindow.postMessage({ event: 'command', func: 'seek', args: sec }, '*');
      }
      showOsd((sec > 0 ? '⏩ +' : '⏪ -') + Math.abs(sec) + 's');
      return;
    }
    var video = $('player');
    if (!video.duration || !isFinite(video.duration)) { showOsd('📡 Ao vivo'); return; }
    video.currentTime = Math.max(0, Math.min(video.duration - 1, video.currentTime + sec));
    showOsd((sec > 0 ? '⏩ +' : '⏪ -') + Math.abs(sec) + 's');
  }

  // Seek progressivo: 10s → 30s → 60s se o botão for repetido rápido
  function seekAccel(sign) {
    var now = Date.now();
    seekStreak = (now - lastSeekAt < 700) ? seekStreak + 1 : 0;
    lastSeekAt = now;
    var step = seekStreak < 3 ? 10 : (seekStreak < 8 ? 30 : 60);
    seekBy(sign * step);
  }

  function bindPlayer() {
    var video     = $('player');
    var wrap      = $('player-wrap');
    var progWrap  = $('progress-wrap');
    var progFill  = $('progress-fill');
    var timeLabel = $('time-label');
    var btnPlay   = $('btn-play');

    video.addEventListener('timeupdate', function () {
      if (!video.duration || !isFinite(video.duration)) {
        timeLabel.textContent = (playerCat === 'tv') ? '🔴 AO VIVO' : '0:00 / 0:00';
        progFill.style.width = (playerCat === 'tv') ? '100%' : '0%';
        return;
      }
      progFill.style.width = ((video.currentTime / video.duration) * 100) + '%';
      timeLabel.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration);
    });

    video.addEventListener('play',  function () { btnPlay.innerHTML = '⏸'; });
    video.addEventListener('pause', function () { btnPlay.innerHTML = '▶'; showControls(); });

    video.addEventListener('error', function () {
      if (isShown(wrap) && playerUrl && !isBloggerMode) showOsd('⚠ Erro ao reproduzir');
    });

    video.addEventListener('ended', function () {
      if (playerCat === 'tv') { closePlayer(true); return; }
      cwRemove(playerItemId + '_' + playerEpIdx);
      playerEnded = true;
      var nxt = nextEpisode();
      if (nxt) {
        playVideo(nxt.url, nxt.title, playerItemId, playerCat, playerEpIdx + 1);
        return;
      }
      closePlayer(true);
    });

    // Botões (mouse / ponteiro do controle)
    btnPlay.onclick = togglePlay;
    $('btn-back').onclick = function () { seekBy(-10); };
    $('btn-fwd').onclick  = function () { seekBy(10); };
    $('btn-close-player').onclick = function () { closePlayer(true); };

    $('btn-fs').onclick = function () {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        (wrap.requestFullscreen || wrap.webkitRequestFullscreen).call(wrap);
      }
    };

    progWrap.onclick = function (e) {
      if (isBloggerMode) return;
      var rect = progWrap.getBoundingClientRect();
      var pct  = (e.clientX - rect.left) / rect.width;
      if (video.duration && isFinite(video.duration)) video.currentTime = pct * video.duration;
    };

    wrap.addEventListener('mousemove', showControls);
    wrap.addEventListener('touchstart', showControls, true);
    video.onclick = function () { showControls(); togglePlay(); };

    var touchX = 0;
    wrap.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, true);
    wrap.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 60) seekBy(dx > 0 ? -10 : 10);
    }, true);
  }

  // ─── BUSCA ───────────────────────────────────────────────────────────────

  function bindSearch() {
    var input = $('search-input');
    if (!input) return;
    // 'input' (e não 'keyup'): as setas usadas para sair do campo não
    // disparam nova busca nem recriam os cards.
    input.addEventListener('input', function () {
      if (searchTimer) clearTimeout(searchTimer);
      var q = input.value;
      searchTimer = setTimeout(function () { doSearch(q); }, 300);
    });
  }

  function doSearch(query) {
    query = (query || '').replace(/^\s+|\s+$/g, '');
    if (query.length < 2) {
      if (searchActive) renderCatalog(currentCat);
      return;
    }

    var q       = normalizeStr(query);
    var allCats = CATS.concat(['tv']);
    var results = [];

    for (var ci = 0; ci < allCats.length; ci++) {
      var cat   = allCats[ci];
      var items = vodData[cat] || [];
      for (var i = 0; i < items.length; i++) {
        if (normalizeStr(items[i].title || '').indexOf(q) !== -1) {
          results.push({ item: items[i], cat: cat });
        }
      }
    }

    searchActive = true;
    var catalog = $('catalog');
    var noRes   = $('no-results');
    catalog.innerHTML = '';
    noRes.style.display = 'none';

    if (!results.length) {
      noRes.style.display = 'block';
      return;
    }

    addSectionTitle(catalog, results.length + ' resultado(s) para "' + query + '"');
    catalog.appendChild(makeRow(results, function (r) {
      return r.cat === 'tv' ? makeTvCard(r.item) : makeCard(r.item, r.cat);
    }));
  }

  // ─── NAV / MODAL BIND ────────────────────────────────────────────────────

  function bindNav() {
    var links = document.querySelectorAll('.nav-link');
    for (var i = 0; i < links.length; i++) {
      (function (link) {
        link.onclick = function () {
          $('search-input').value = '';
          renderCatalog(link.getAttribute('data-cat'));
          window.scrollTo(0, 0);
          link.focus(); // o foco fica no link; ↓ leva ao primeiro card
        };
      })(links[i]);
    }
  }

  function bindModal() {
    var modal = $('modal');
    $('modal-close').onclick = function () { closeModal(true); };
    modal.onclick = function (e) { if (e.target === modal) closeModal(true); };
  }

  // ─── FOCO: RETORNO ───────────────────────────────────────────────────────

  function rememberFocus() {
    var a = document.activeElement;
    if (a && a !== document.body && a !== document.documentElement) {
      focusReturn = { el: a, key: a.getAttribute('data-key') };
    }
  }

  function restoreFocusReturn() {
    var fr = focusReturn;
    focusReturn = null;
    setTimeout(function () {
      var target = null;
      if (fr) {
        if (fr.el && document.body.contains(fr.el) && isVisible(fr.el)) {
          target = fr.el;
        } else if (fr.key) {
          target = document.querySelector('[data-key="' + fr.key + '"]');
          // card de "Continuar" que sumiu → cai no card do catálogo
          if (!target && fr.key.indexOf('w:') === 0) {
            target = document.querySelector('[data-key="c:' + fr.key.slice(2) + '"]');
          }
        }
      }
      if (!target) {
        var list = getFocusables('main');
        target = activeNavLink() || list[0];
      }
      focusEl(target);
    }, 50);
  }

  // ─── FOCO: NAVEGAÇÃO ESPACIAL ────────────────────────────────────────────

  var SELECTORS = {
    main:   '.nav-link, #search-input, .card',
    modal:  '.modal-close-btn, .modal-play-btn, .season-header, .ep-item:not(.locked), .canal-item',
    player: '#btn-play, #btn-back, #btn-fwd, #btn-fs, #btn-next-ep, #btn-close-player'
  };

  function getScope() {
    if (isShown($('player-wrap'))) return 'player';
    if (isShown($('modal')))       return 'modal';
    return 'main';
  }

  // Só entra na navegação o que está realmente visível (temporadas
  // recolhidas e botões ocultos ficam de fora)
  function getFocusables(scope) {
    var root = scope === 'player' ? $('player-wrap') : (scope === 'modal' ? $('modal') : document);
    var all  = root.querySelectorAll(SELECTORS[scope]);
    var out  = [];
    for (var i = 0; i < all.length; i++) if (isVisible(all[i])) out.push(all[i]);
    return out;
  }

  function initialFocus(scope, list) {
    if (scope === 'main') return activeNavLink() || list[0];
    if (scope === 'modal') return $('modal-play-btn') || list[0];
    return $('btn-play') || list[0];
  }

  function gap(a1, a2, b1, b2) {
    if (a2 < b1) return b1 - a2;
    if (b2 < a1) return a1 - b2;
    return 0;
  }

  function findNext(cur, dir, list) {
    var r  = cur.getBoundingClientRect();
    var cx = (r.left + r.right) / 2;
    var cy = (r.top + r.bottom) / 2;
    var best = null;
    var bestScore = Infinity;

    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el === cur) continue;
      var b  = el.getBoundingClientRect();
      var bx = (b.left + b.right) / 2;
      var by = (b.top + b.bottom) / 2;
      var primary, perpGap, perpCenter;

      if (dir === 'right') {
        if (bx <= cx + 1) continue;
        primary = Math.max(0, b.left - r.right);
        perpGap = gap(r.top, r.bottom, b.top, b.bottom);
        perpCenter = Math.abs(by - cy);
      } else if (dir === 'left') {
        if (bx >= cx - 1) continue;
        primary = Math.max(0, r.left - b.right);
        perpGap = gap(r.top, r.bottom, b.top, b.bottom);
        perpCenter = Math.abs(by - cy);
      } else if (dir === 'down') {
        if (by <= cy + 1) continue;
        primary = Math.max(0, b.top - r.bottom);
        perpGap = gap(r.left, r.right, b.left, b.right);
        perpCenter = Math.abs(bx - cx);
      } else {
        if (by >= cy - 1) continue;
        primary = Math.max(0, r.top - b.bottom);
        perpGap = gap(r.left, r.right, b.left, b.right);
        perpCenter = Math.abs(bx - cx);
      }

      var score = primary + perpGap * 4 + perpCenter * 0.6;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    return best;
  }

  function moveFocus(dir) {
    var scope = getScope();
    var list  = getFocusables(scope);
    if (!list.length) return;

    var cur = document.activeElement;
    if (list.indexOf(cur) < 0) { focusEl(initialFocus(scope, list)); return; }

    var next = findNext(cur, dir, list);
    if (next) focusEl(next);
  }

  function focusEl(el) {
    if (!el) return;
    try { el.focus(); } catch (e) {}
    ensureVisible(el);
  }

  // Rola os contêineres (carrossel de episódios, lista de canais, modal e
  // janela) para o elemento focado ficar visível e fora do header fixo.
  function ensureVisible(el) {
    var PAD = 24;
    var parent = el.parentNode;

    while (parent && parent !== document.body && parent !== document.documentElement) {
      if (parent.nodeType === 1) {
        var cs   = window.getComputedStyle(parent);
        var canX = (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && parent.scrollWidth > parent.clientWidth;
        var canY = (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight;
        if (canX || canY) {
          var pr = parent.getBoundingClientRect();
          var er = el.getBoundingClientRect();
          if (canX) {
            if (er.left < pr.left + PAD)        parent.scrollLeft -= (pr.left + PAD - er.left);
            else if (er.right > pr.right - PAD) parent.scrollLeft += (er.right - (pr.right - PAD));
          }
          if (canY) {
            if (er.top < pr.top + PAD)            parent.scrollTop -= (pr.top + PAD - er.top);
            else if (er.bottom > pr.bottom - PAD) parent.scrollTop += (er.bottom - (pr.bottom - PAD));
          }
        }
      }
      parent = parent.parentNode;
    }

    // Janela principal (só na tela inicial; modal e player têm rolagem própria)
    if (getScope() !== 'main') return;

    if (el.classList.contains('nav-link') || el.id === 'search-input') {
      window.scrollTo(0, 0);
      return;
    }

    var header = $('header');
    var top    = (header ? header.offsetHeight : 0) + PAD;
    var bottom = window.innerHeight - PAD;
    var rect   = el.getBoundingClientRect();
    if (rect.top < top)            window.scrollBy(0, rect.top - top);
    else if (rect.bottom > bottom) window.scrollBy(0, rect.bottom - bottom);
  }

  // Pula N itens na mesma lista de episódios/canais (CH+ / CH−)
  function jumpInList(active, delta) {
    if (!active || !active.parentNode) return false;
    var list = active.parentNode;
    if ((' ' + list.className + ' ').indexOf(' ep-list ') < 0) return false;
    var items = [];
    var kids  = list.children;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if ((k.classList.contains('ep-item') && !k.classList.contains('locked')) || k.classList.contains('canal-item')) {
        items.push(k);
      }
    }
    var idx = items.indexOf(active);
    if (idx < 0) return false;
    focusEl(items[Math.max(0, Math.min(items.length - 1, idx + delta))]);
    return true;
  }

  // Lote seguinte quando o foco chega perto do fim da fileira
  function bindFocusTracking() {
    document.addEventListener('focus', function (e) {
      var t = e.target;
      if (!t || t.nodeType !== 1) return;
      var row = t.parentNode;
      if (!row || !row._items || row._pos >= row._items.length) return;
      var idx = 0;
      var kids = row.children;
      for (var i = 0; i < kids.length; i++) if (kids[i] === t) { idx = i; break; }
      if (kids.length - idx <= 24) appendBatch(row);
    }, true);
  }

  // Também carrega mais quando a rolagem (mouse/ponteiro) chega perto do fim
  function bindScrollLoader() {
    window.addEventListener('scroll', function () {
      if (scrollTimer) return;
      scrollTimer = setTimeout(function () {
        scrollTimer = null;
        var rows = document.querySelectorAll('.cards-row');
        for (var i = 0; i < rows.length; i++) {
          var row = rows[i];
          if (row._items && row._pos < row._items.length &&
              row.getBoundingClientRect().bottom < window.innerHeight + 600) {
            appendBatch(row);
          }
        }
      }, 150);
    });
  }

  // ─── HISTÓRICO (Voltar do navegador) ─────────────────────────────────────
  // No navegador da TV o Voltar faz history.back() e sairia do site.
  // Enquanto houver modal ou player aberto, mantemos UMA entrada extra no
  // histórico; o Voltar consome essa entrada e fecha a camada de cima.

  function syncHistory() {
    var need = isShown($('modal')) || isShown($('player-wrap'));
    if (need && !layerPushed) {
      try { history.pushState({ pf: 1 }, ''); layerPushed = true; } catch (e) {}
    } else if (!need && layerPushed) {
      layerPushed = false;
      ignorePop++;
      try { history.back(); } catch (e2) { ignorePop--; }
    }
  }

  function onPopState() {
    if (ignorePop > 0) { ignorePop--; return; }
    layerPushed = false;                      // a entrada já foi consumida
    if (isShown($('player-wrap')))      closePlayer(true);
    else if (isShown($('modal')))       closeModal(true);
  }

  function isTizenApp() {
    try {
      return !!(window.tizen && window.tizen.application && window.tizen.application.getCurrentApplication());
    } catch (e) { return false; }
  }

  // ─── TECLADO (handler único) ─────────────────────────────────────────────

  function activate(el) {
    if (el && el !== document.body && el !== document.documentElement && typeof el.click === 'function') {
      el.click();
    }
  }

  function isSearchInput(el) { return !!el && el.id === 'search-input'; }

  // Retorna true se o Voltar foi tratado aqui; false = deixa o navegador agir
  function onBack(scope) {
    if (scope === 'modal') { closeModal(true); return true; }

    var input = $('search-input');
    if (searchActive || (input && input.value)) {
      input.value = '';
      renderCatalog(currentCat);
      focusEl(activeNavLink());
      return true;
    }
    if (isTizenApp()) { confirmExit(); return true; }
    return false;
  }

  function confirmExit() {
    var now = Date.now();
    if (now - lastBackAt < EXIT_WINDOW) { exitApp(); return; }
    lastBackAt = now;
    showToast('Pressione VOLTAR novamente para sair');
  }

  function exitApp() {
    try {
      if (window.tizen && window.tizen.application) {
        window.tizen.application.getCurrentApplication().exit();
        return;
      }
    } catch (e) {}
    try { window.close(); } catch (e2) {}
  }

  function onSearchKey(e, key, input) {
    switch (key) {
      case KEY.BACK:
      case KEY.ESC:
        e.preventDefault();
        input.blur();
        focusEl(activeNavLink());
        break;
      case KEY.DOWN:
        e.preventDefault();
        moveFocus('down');
        break;
      case KEY.UP:
        e.preventDefault();
        break;
      case KEY.LEFT:
        if (input.selectionStart === 0 && input.selectionEnd === 0) {
          e.preventDefault();
          moveFocus('left');
        }
        break;
      case KEY.RIGHT:
        if (input.selectionStart === input.value.length) {
          e.preventDefault();
          moveFocus('right');
        }
        break;
      // Enter: deixa o comportamento padrão (abre o teclado na TV)
    }
  }

  // No player: setas não movem foco — fazem seek / troca de canal.
  // ↓ abre a barra de controles; ↑ volta para o vídeo.
  function onPlayerKey(e, key, active) {
    var video = $('player');
    var inBar = playerBarHas(active);
    var isTv  = playerCat === 'tv';

    showControls();

    switch (key) {
      case KEY.BACK:
      case KEY.ESC:
      case KEY.MEDIA_STOP:
        e.preventDefault(); closePlayer(true); return;

      case KEY.MEDIA_PLAY:
        e.preventDefault(); if (!isBloggerMode) safePlay(video); return;
      case KEY.MEDIA_PAUSE:
        e.preventDefault(); if (!isBloggerMode) video.pause(); return;
      case KEY.MEDIA_PLAYPAUSE:
      case KEY.SPACE:
        e.preventDefault(); togglePlay(); return;

      case KEY.MEDIA_REWIND:
        e.preventDefault(); seekAccel(-1); return;
      case KEY.MEDIA_FF:
        e.preventDefault(); seekAccel(1); return;

      case KEY.CH_UP:
        e.preventDefault(); if (isTv) channelStep(1); else seekBy(60); return;
      case KEY.CH_DOWN:
        e.preventDefault(); if (isTv) channelStep(-1); else seekBy(-60); return;

      case KEY.ENTER:
        e.preventDefault();
        if (inBar) activate(active); else togglePlay();
        return;

      case KEY.LEFT:
        e.preventDefault();
        if (inBar) moveFocus('left'); else if (isTv) channelStep(-1); else seekAccel(-1);
        return;
      case KEY.RIGHT:
        e.preventDefault();
        if (inBar) moveFocus('right'); else if (isTv) channelStep(1); else seekAccel(1);
        return;

      case KEY.DOWN:
        e.preventDefault();
        if (!inBar) focusEl(isBloggerMode ? $('btn-back') : $('btn-play'));
        return;
      case KEY.UP:
        e.preventDefault();
        if (inBar) video.focus();
        return;
    }
  }

  function onKeyDown(e) {
    var key    = e.keyCode || e.which;
    var scope  = getScope();
    var active = document.activeElement;

    // No navegador, o Voltar da TV vira history.back() → tratado em onPopState
    if (key === KEY.BACK && !isTizenApp()) return;

    if (scope === 'player') { onPlayerKey(e, key, active); return; }
    if (isSearchInput(active)) { onSearchKey(e, key, active); return; }

    switch (key) {
      case KEY.BACK:
      case KEY.ESC:
        if (onBack(scope)) e.preventDefault();
        break;

      case KEY.ENTER:
        if (active && active !== document.body && active !== document.documentElement) {
          e.preventDefault(); // evita o clique nativo → Enter dispara uma vez só
          activate(active);
        }
        break;

      case KEY.LEFT:  e.preventDefault(); moveFocus('left');  break;
      case KEY.RIGHT: e.preventDefault(); moveFocus('right'); break;
      case KEY.UP:    e.preventDefault(); moveFocus('up');    break;
      case KEY.DOWN:  e.preventDefault(); moveFocus('down');  break;

      case KEY.CH_UP:
      case KEY.PGDN:
        if (scope === 'modal' && jumpInList(active, 10)) e.preventDefault();
        break;
      case KEY.CH_DOWN:
      case KEY.PGUP:
        if (scope === 'modal' && jumpInList(active, -10)) e.preventDefault();
        break;
    }
  }

  function bindKeys() {
    document.addEventListener('keydown', onKeyDown);
  }

  // ─── FULLSCREEN AUTOMÁTICO ───────────────────────────────────────────────
  // Tizen exige gesto do usuário; tenta na primeira interação.

  function requestAppFullscreen() {
    if (fsRequested) return;
    fsRequested = true;
    var el = document.documentElement;
    var fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
    if (fn) { try { fn.call(el); } catch (e) {} }
  }

  function bindFullscreenTriggers() {
    document.addEventListener('click',      requestAppFullscreen, true);
    document.addEventListener('keydown',    requestAppFullscreen, true);
    document.addEventListener('touchstart', requestAppFullscreen, true);
  }

  // ─── START ───────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
