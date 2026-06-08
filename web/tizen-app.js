/*
 * PIRATAFLIX — tizen-app.js
 * Compatível com Samsung Tizen (Chromium 38–56)
 */

(function () {

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

  // ─── ESTADO ──────────────────────────────────────────────────────────────

  var vodData      = {};   // { filmes:[], series:[], ... }
  var channels     = [];   // array de canais de TV
  var currentCat   = 'filmes';
  var searchTimer  = null;

  // Player
  var playerUrl    = '';
  var playerTitle  = '';
  var playerItemId = null;
  var playerCat    = null;
  var playerEpIdx  = 0;
  var hlsInstance  = null;
  var controlsTimer = null;
  var progressInterval = null;

  // Continue watching (localStorage)
  var CW_KEY = 'pirataflix_progressos';

  // ─── AJAX HELPER ─────────────────────────────────────────────────────────

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

  // ─── INIT ────────────────────────────────────────────────────────────────

  function init() {
    ajax('data.json', function (err, data) {
      if (err || !data) {
        document.getElementById('loading').textContent = 'Erro ao carregar catálogo.';
        return;
      }
      vodData = data;

      ajax('channels.json', function (err2, chs) {
        channels = (err2 || !chs) ? [] : chs;
        // injeta canais no vodData para compatibilidade
        vodData['tv'] = channels;

        document.getElementById('loading').style.display = 'none';
        document.getElementById('catalog').style.display = 'block';

        renderCatalog(currentCat);
        bindNav();
        bindSearch();
        bindModal();
        bindPlayer();
      });
    });
  }

  // ─── RENDER CATÁLOGO ─────────────────────────────────────────────────────

  function renderCatalog(cat) {
    currentCat = cat;
    var catalog = document.getElementById('catalog');
    catalog.innerHTML = '';

    // Atualizar nav
    var links = document.querySelectorAll('.nav-link');
    for (var i = 0; i < links.length; i++) {
      if (links[i].getAttribute('data-cat') === cat) {
        links[i].className = 'nav-link active';
      } else {
        links[i].className = 'nav-link';
      }
    }

    // Seção "Continuar Assistindo" sempre no topo
    renderContinueWatching(catalog);

    if (cat === 'tv') {
      renderTvGrid(catalog, channels);
    } else {
      var items = vodData[cat] || [];
      if (!items.length) {
        document.getElementById('no-results').style.display = 'block';
        return;
      }
      document.getElementById('no-results').style.display = 'none';

      var title = document.createElement('div');
      title.className = 'section-title';
      title.textContent = CAT_LABELS[cat] || cat;
      catalog.appendChild(title);

      var row = document.createElement('div');
      row.className = 'cards-row';
      for (var j = 0; j < items.length; j++) {
        row.appendChild(makeCard(items[j], cat));
      }
      catalog.appendChild(row);
    }
  }

  // ─── CONTINUAR ASSISTINDO ─────────────────────────────────────────────────

  function cwGetList() {
    try {
      var raw  = JSON.parse(localStorage.getItem(CW_KEY)) || {};
      var seen = {};
      var keys = Object.keys(raw);
      for (var i = 0; i < keys.length; i++) {
        var entry = raw[keys[i]];
        if (!entry || !entry.itemId || !entry.category) continue;
        var pct = entry.duration ? (entry.currentTime / entry.duration) * 100 : 0;
        if (pct < 2 || pct > 95) continue;
        var dk = entry.itemId + '_' + entry.category;
        if (!seen[dk] || entry.timestamp > seen[dk].timestamp) seen[dk] = entry;
      }
      var list = [];
      var dks  = Object.keys(seen);
      for (var di = 0; di < dks.length; di++) list.push(seen[dks[di]]);
      list.sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
      return list.slice(0, 10);
    } catch (e) { return []; }
  }

  function renderContinueWatching(catalog) {
    var list = cwGetList();
    if (!list.length) return;

    var title = document.createElement('div');
    title.className = 'section-title';
    title.textContent = '▶ Continuar Assistindo';
    catalog.appendChild(title);

    var row = document.createElement('div');
    row.className = 'cards-row';
    for (var i = 0; i < list.length; i++) {
      row.appendChild(makeCwCard(list[i]));
    }
    catalog.appendChild(row);
  }

  function makeCwCard(entry) {
    var card = document.createElement('div');
    card.className = 'card card-cw';
    card.setAttribute('tabindex', '0');

    var items = vodData[entry.category] || [];
    var item  = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === entry.itemId || items[i].title === entry.itemId) { item = items[i]; break; }
    }

    var poster  = item ? getPoster(item, entry.category) : DEFAULT_POSTER;
    var pct     = entry.duration ? Math.round((entry.currentTime / entry.duration) * 100) : 0;
    var timeStr = fmtTime(entry.currentTime || 0);
    var label   = entry.title || (item ? item.title : 'Sem título');
    // Pegar só o nome da série (antes do " - ")
    var seriesTitle = label.split(' - ')[0];

    card.innerHTML =
      '<div class="cw-thumb-wrap">' +
        '<img src="' + poster + '" alt="" loading="lazy" onerror="this.src=\'' + DEFAULT_POSTER + '\'">' +
        '<div class="cw-progress-bar"><div class="cw-progress-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="cw-time-badge">' + timeStr + '</div>' +
        '<div class="cw-play-icon">▶</div>' +
      '</div>' +
      '<div class="card-info">' +
        '<div class="card-title">' + esc(seriesTitle) + '</div>' +
        '<div class="card-meta">' + pct + '% assistido</div>' +
      '</div>';

    card.onclick    = function () { resumeCw(entry); };
    card.onkeydown  = function (e) { if (e.keyCode === 13 || e.keyCode === 32) resumeCw(entry); };
    return card;
  }

  function resumeCw(entry) {
    var items = vodData[entry.category] || [];
    var item  = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === entry.itemId || items[i].title === entry.itemId) { item = items[i]; break; }
    }

    if (!item) { playVideo(entry.url, entry.title, entry.itemId, entry.category, 0); return; }

    var epList = getEpList(item);
    var idx    = entry.episodeIndex || 0;
    var ep     = epList[idx];
    var url    = ep ? ep.url : item.url;
    var title  = ep ? (item.title + ' - ' + (ep.title || 'Ep ' + (idx + 1))) : item.title;

    playVideo(url, title, entry.itemId, entry.category, idx);
  }

  function fmtTime(s) {
    if (!s || isNaN(s)) return '0:00';
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' + sec : sec);
  }

  function renderTvGrid(catalog, chs) {
    if (!chs.length) {
      document.getElementById('no-results').style.display = 'block';
      return;
    }
    document.getElementById('no-results').style.display = 'none';

    // Agrupar por grupo
    var groups = {};
    var groupOrder = [];
    for (var i = 0; i < chs.length; i++) {
      var g = chs[i].group || 'TV';
      if (!groups[g]) { groups[g] = []; groupOrder.push(g); }
      groups[g].push(chs[i]);
    }

    for (var gi = 0; gi < groupOrder.length; gi++) {
      var gName = groupOrder[gi];
      var gItems = groups[gName];

      var title = document.createElement('div');
      title.className = 'section-title';
      title.textContent = gName;
      catalog.appendChild(title);

      var row = document.createElement('div');
      row.className = 'cards-row';
      for (var ci = 0; ci < gItems.length; ci++) {
        row.appendChild(makeTvCard(gItems[ci], ci));
      }
      catalog.appendChild(row);
    }
  }

  // ─── MAKE CARD ───────────────────────────────────────────────────────────

  function makeCard(item, cat) {
    var card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('tabindex', '0');

    var poster = getPoster(item, cat);
    var year   = item.year   ? item.year   : '';
    var rating = item.rating ? ('⭐ ' + item.rating) : '';

    card.innerHTML =
      '<img src="' + poster + '" alt="" loading="lazy" onerror="this.src=\'' + DEFAULT_POSTER + '\'">' +
      '<div class="card-info">' +
        '<div class="card-title">' + esc(item.title) + '</div>' +
        '<div class="card-meta">' +
          (year ? '<span>' + year + '</span> ' : '') +
          (rating ? '<span class="card-rating">' + rating + '</span>' : '') +
        '</div>' +
      '</div>';

    card.onclick = function () { openModal(cat, item.id || item.title); };
    card.onkeydown = function (e) {
      if (e.keyCode === 13 || e.keyCode === 32) openModal(cat, item.id || item.title);
    };
    return card;
  }

  function makeTvCard(canal, idx) {
    var card = document.createElement('div');
    card.className = 'card card-tv';
    card.setAttribute('tabindex', '0');

    var logo = (canal.tvg_logo && canal.tvg_logo.indexOf('http') === 0) ? canal.tvg_logo : TV_POSTER;

    card.innerHTML =
      '<img src="' + logo + '" alt="" loading="lazy" onerror="this.src=\'' + TV_POSTER + '\'">' +
      '<div class="card-info">' +
        '<div class="card-title">' + esc(canal.title || canal.name || 'Canal') + '</div>' +
        '<div class="card-meta"><span class="live-dot">●</span> AO VIVO</div>' +
      '</div>';

    card.onclick = function () { openTvModal(idx); };
    card.onkeydown = function (e) {
      if (e.keyCode === 13 || e.keyCode === 32) openTvModal(idx);
    };
    return card;
  }

  // ─── MODAL ───────────────────────────────────────────────────────────────

  function openModal(cat, itemId) {
    var items = vodData[cat] || [];
    var item = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === itemId || items[i].title === itemId) { item = items[i]; break; }
    }
    if (!item) return;

    var modal    = document.getElementById('modal');
    var backdrop = document.getElementById('modal-backdrop');
    var body     = document.getElementById('modal-body');

    var bgUrl = item.backdrop || getPoster(item, cat);
    backdrop.style.backgroundImage = 'url(' + bgUrl + ')';

    var typeLabel = CAT_LABELS[cat] || cat;
    var html = '';

    html += '<div class="modal-title">' + esc(item.title) + '</div>';
    html += '<div class="modal-badges">';
    html += '<span class="badge badge-type">' + typeLabel + '</span>';
    if (item.year)   html += '<span class="badge">📅 ' + item.year + '</span>';
    if (item.rating) html += '<span class="badge badge-rating">⭐ ' + item.rating + '</span>';
    html += '</div>';

    if (item.overview) {
      html += '<p class="modal-overview">' + esc(item.overview) + '</p>';
    }

    html += '<button class="modal-play-btn" id="modal-play-btn">▶ Assistir</button>';

    // Episódios
    if (item.seasons && item.seasons.length) {
      html += renderSeasons(item, cat);
    } else if (item.episodes && item.episodes.length) {
      html += '<div class="modal-section-title">Episódios</div>';
      html += '<div class="ep-list" id="ep-list-main">';
      for (var ei = 0; ei < item.episodes.length; ei++) {
        html += renderEpItem(item.episodes[ei], ei, ei, itemId, cat);
      }
      html += '</div>';
    }

    body.innerHTML = html;
    modal.style.display = 'block';

    // Botão assistir principal
    var playBtn = document.getElementById('modal-play-btn');
    if (playBtn) {
      playBtn.onclick = function () {
        closeModal();
        playFirstEpisode(cat, itemId);
      };
    }

    // Bind episódios
    bindEpClicks(body, itemId, cat);

    // Foco no botão de play do modal
    setTimeout(function () {
      var playBtn = document.getElementById('modal-play-btn');
      if (playBtn) {
        currentFocusIndex = 1;
        playBtn.focus();
      }
    }, 100);
  }

  function openTvModal(idx) {
    var canal = channels[idx];
    if (!canal) return;

    var modal    = document.getElementById('modal');
    var backdrop = document.getElementById('modal-backdrop');
    var body     = document.getElementById('modal-body');

    var logo = (canal.tvg_logo && canal.tvg_logo.indexOf('http') === 0) ? canal.tvg_logo : TV_POSTER;
    backdrop.style.backgroundImage = 'url(' + logo + ')';

    var html = '';
    html += '<div class="modal-title">' + esc(canal.title || canal.name) + '</div>';
    html += '<div class="modal-badges"><span class="badge badge-type">📡 TV Ao Vivo</span>';
    if (canal.group) html += '<span class="badge">' + esc(canal.group) + '</span>';
    html += '</div>';

    html += '<button class="modal-play-btn" id="modal-play-btn">▶ Assistir ao Vivo</button>';

    // Lista de canais do mesmo grupo
    var grupo = canal.group || 'TV';
    var same  = [];
    for (var i = 0; i < channels.length; i++) {
      if ((channels[i].group || 'TV') === grupo) same.push({ ch: channels[i], idx: i });
    }

    if (same.length > 1) {
      html += '<div class="modal-section-title">Canais — ' + esc(grupo) + '</div>';
      html += '<div class="ep-list">';
      for (var si = 0; si < same.length; si++) {
        var ch = same[si].ch;
        var ci = same[si].idx;
        var chLogo = (ch.tvg_logo && ch.tvg_logo.indexOf('http') === 0) ? ch.tvg_logo : TV_POSTER;
        var isAtivo = ci === idx;
        html +=
          '<div class="canal-item" tabindex="0" data-tv-idx="' + ci + '">' +
            '<img src="' + chLogo + '" class="canal-logo" onerror="this.src=\'' + TV_POSTER + '\'">' +
            '<span class="canal-name">' + esc(ch.title || ch.name || 'Canal') + '</span>' +
            (isAtivo ? '<span class="live-dot">● AO VIVO</span>' : '') +
          '</div>';
      }
      html += '</div>';
    }

    body.innerHTML = html;
    modal.style.display = 'block';

    var playBtn = document.getElementById('modal-play-btn');
    if (playBtn) {
      playBtn.onclick = function () {
        closeModal();
        playTvChannel(idx);
      };
    }

    // Bind canais
    var canalItems = body.querySelectorAll('.canal-item');
    for (var ci2 = 0; ci2 < canalItems.length; ci2++) {
      (function (el) {
        var tvIdx = parseInt(el.getAttribute('data-tv-idx'), 10);
        function doPlay() { closeModal(); playTvChannel(tvIdx); }
        el.onclick = doPlay;
        el.onkeydown = function (e) { if (e.keyCode === 13) doPlay(); };
      })(canalItems[ci2]);
    }

    // Foco no botão de play do modal
    setTimeout(function () {
      var playBtn = document.getElementById('modal-play-btn');
      if (playBtn) {
        currentFocusIndex = 1;
        playBtn.focus();
      }
    }, 100);
  }

  function closeModal() {
    document.getElementById('modal').style.display = 'none';

    setTimeout(function () {
      focusIndex(currentFocusIndex);
    }, 100);
  }

  // ─── EPISÓDIOS HTML ───────────────────────────────────────────────────────

  function renderSeasons(item, cat) {
    var html = '<div>';
    var seasons = item.seasons.slice().sort(function (a, b) { return a.season - b.season; });
    var offset  = 0;

    for (var si = 0; si < seasons.length; si++) {
      var s      = seasons[si];
      var sNum   = s.season || (si + 1);
      var isLast = si === seasons.length - 1;
      var colId  = 'season-' + sNum;
      var eps    = s.episodes || [];

      html +=
        '<div class="modal-section-title season-header" tabindex="0" data-toggle="' + colId + '">' +
          '<span class="season-label">🎬 Temporada ' + sNum + '</span>' +
          '<span class="season-count">' + eps.length + ' ep.</span>' +
          '<span class="season-chevron">' + (isLast ? '▲' : '▼') + '</span>' +
        '</div>';

      html += '<div class="ep-list" id="' + colId + '" style="display:' + (isLast ? 'block' : 'none') + '">';
      for (var ei = 0; ei < eps.length; ei++) {
        html += renderEpItem(eps[ei], eps[ei].episode || (ei + 1), offset + ei, item.id || item.title, cat);
      }
      html += '</div>';
      offset += eps.length;
    }

    html += '</div>';
    return html;
  }

  function renderEpItem(ep, num, globalIdx, itemId, cat) {
    var locked  = ep.locked || !ep.url;
    var title   = ep.title || ('Episódio ' + num);
    var airdate = ep.air_date || ep.release_iso || '';

    if (locked) {
      return '<div class="ep-item locked">' +
        '<div class="ep-num">' + num + '</div>' +
        '<div class="ep-info">' +
          '<div class="ep-title">' + esc(title) + '</div>' +
          (airdate ? '<div class="ep-date">📅 ' + airdate + '</div>' : '<div class="ep-date">Em breve</div>') +
        '</div>' +
        '<span>🔒</span>' +
      '</div>';
    }

    return '<div class="ep-item" tabindex="0" data-ep-url="' + esc(ep.url) + '" data-ep-title="' + esc(title) + '" data-ep-idx="' + globalIdx + '" data-item-id="' + esc(itemId) + '" data-cat="' + cat + '">' +
      '<div class="ep-num">' + num + '</div>' +
      '<div class="ep-info">' +
        '<div class="ep-title">' + esc(title) + '</div>' +
        (airdate ? '<div class="ep-date">' + airdate + '</div>' : '') +
      '</div>' +
      '<span class="ep-play">▶</span>' +
    '</div>';
  }

  function bindEpClicks(container, itemId, cat) {
    var items = container.querySelectorAll('.ep-item:not(.locked)');
    for (var i = 0; i < items.length; i++) {
      (function (el) {
        function doPlay() {
          var url   = el.getAttribute('data-ep-url');
          var title = el.getAttribute('data-ep-title');
          var idx   = parseInt(el.getAttribute('data-ep-idx'), 10) || 0;
          var iid   = el.getAttribute('data-item-id');
          var c     = el.getAttribute('data-cat');
          closeModal();
          playVideo(url, title, iid, c, idx);
        }
        el.onclick = doPlay;
        el.onkeydown = function (e) { if (e.keyCode === 13) doPlay(); };
      })(items[i]);
    }

    // Season toggles
    var headers = container.querySelectorAll('.season-header');
    for (var si = 0; si < headers.length; si++) {
      (function (h) {
        h.onclick = function () {
          var id      = h.getAttribute('data-toggle');
          var panel   = document.getElementById(id);
          var chevron = h.querySelector('.season-chevron');
          if (!panel) return;
          var open = panel.style.display !== 'none';
          panel.style.display = open ? 'none' : 'block';
          if (chevron) chevron.textContent = open ? '▼' : '▲';
        };
        h.onkeydown = function (e) { if (e.keyCode === 13) h.onclick(); };
      })(headers[si]);
    }
  }

  // ─── PLAY ─────────────────────────────────────────────────────────────────

  function playFirstEpisode(cat, itemId) {
    var items = vodData[cat] || [];
    var item  = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === itemId || items[i].title === itemId) { item = items[i]; break; }
    }
    if (!item) return;

    var epList = getEpList(item);
    if (epList.length) {
      playVideo(epList[0].url, item.title + ' - ' + (epList[0].title || 'Ep 1'), itemId, cat, 0);
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

  function playVideo(url, title, itemId, cat, epIdx) {
    playerUrl    = url;
    playerTitle  = title;
    playerItemId = itemId;
    playerCat    = cat;
    playerEpIdx  = epIdx || 0;

    var wrap  = document.getElementById('player-wrap');
    var video = document.getElementById('player');
    var titleEl = document.getElementById('player-title');

    titleEl.textContent = title || '';

    // Destruir HLS anterior
    destroyHls();

    wrap.style.display = 'block';

    // Verificar se é HLS
    var isHls = url.indexOf('.m3u8') !== -1 || url.indexOf('m3u8') !== -1;

    if (isHls && typeof Hls !== 'undefined' && Hls.isSupported()) {
      hlsInstance = new Hls({ enableWorker: false });
      hlsInstance.loadSource(url);
      hlsInstance.attachMedia(video);
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, function () {
        video.play();
      });
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari / Tizen com suporte nativo
      video.src = url;
      video.play();
    } else {
      video.src = url;
      video.play();
    }

    video.focus();
    showControls();

    // Restaurar progresso
    var videoId = itemId + '_' + epIdx;
    var saved   = cwGet(videoId);
    if (saved && saved.currentTime > 5) {
      video.addEventListener('loadedmetadata', function restorer() {
        if (saved.currentTime < video.duration - 2) {
          video.currentTime = saved.currentTime;
          var m = Math.floor(saved.currentTime / 60);
          var s = Math.floor(saved.currentTime % 60);
          showOsd('⏯ Retomando ' + m + ':' + (s < 10 ? '0' + s : s));
        }
        video.removeEventListener('loadedmetadata', restorer);
      });
    }

    // Progresso periódico
    if (progressInterval) clearInterval(progressInterval);
    progressInterval = setInterval(function () {
      if (!video.duration || video.currentTime < 10) return;
      cwSave({
        videoId:      videoId,
        itemId:       itemId,
        category:     cat,
        episodeIndex: epIdx,
        title:        title,
        currentTime:  video.currentTime,
        duration:     video.duration,
        url:          url
      });
    }, 5000);

    // Próximo episódio
    var item    = null;
    var items   = vodData[cat] || [];
    for (var ii = 0; ii < items.length; ii++) {
      if (items[ii].id === itemId || items[ii].title === itemId) { item = items[ii]; break; }
    }
    var epList  = item ? getEpList(item) : [];
    var nextBtn = document.getElementById('btn-next-ep');
    if (nextBtn) {
      if (item && epIdx + 1 < epList.length) {
        nextBtn.style.display = 'inline-block';
        nextBtn.onclick = function () {
          var next = epList[epIdx + 1];
          closePlayer();
          playVideo(next.url, item.title + ' - ' + (next.title || 'Ep ' + (epIdx + 2)), itemId, cat, epIdx + 1);
        };
      } else {
        nextBtn.style.display = 'none';
      }
    }
  }

  function destroyHls() {
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
    var video = document.getElementById('player');
    if (video) {
      video.pause();
      video.src = '';
      video.load();
    }
    if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
  }

  function closePlayer() {
    destroyHls();
    document.getElementById('player-wrap').style.display = 'none';
    // Recarrega a seção "Continuar Assistindo" com progresso atualizado
    var catalog = document.getElementById('catalog');
    var cwTitle = catalog ? catalog.querySelector('.section-title') : null;
    if (cwTitle && cwTitle.textContent.indexOf('Continuar') !== -1) {
      // Remove seção antiga e reinserere atualizada
      var next = cwTitle.nextSibling;
      if (next && next.className === 'cards-row') catalog.removeChild(next);
      catalog.removeChild(cwTitle);
    }
    if (catalog) {
      var frag = document.createDocumentFragment();
      renderContinueWatching(frag);
      catalog.insertBefore(frag, catalog.firstChild);
    }

    setTimeout(function () {
      focusIndex(currentFocusIndex);
    }, 100);
  }

  // ─── CONTROLES DO PLAYER ─────────────────────────────────────────────────

  function showControls() {
    var ctrl = document.getElementById('player-controls');
    ctrl.className = 'visible';
    if (controlsTimer) clearTimeout(controlsTimer);
    controlsTimer = setTimeout(function () {
      var video = document.getElementById('player');
      if (video && !video.paused) ctrl.className = '';
    }, 3000);
  }

  function showOsd(text) {
    var wrap = document.getElementById('player-wrap');
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

  function fmt(s) {
    if (!s || isNaN(s)) return '0:00';
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' + sec : sec);
  }

  // ─── BIND PLAYER ─────────────────────────────────────────────────────────

  function bindPlayer() {
    var video     = document.getElementById('player');
    var wrap      = document.getElementById('player-wrap');
    var progWrap  = document.getElementById('progress-wrap');
    var progFill  = document.getElementById('progress-fill');
    var timeLabel = document.getElementById('time-label');
    var btnPlay   = document.getElementById('btn-play');
    var btnBack   = document.getElementById('btn-back');
    var btnFwd    = document.getElementById('btn-fwd');
    var btnFs     = document.getElementById('btn-fs');
    var btnClose  = document.getElementById('btn-close-player');

    // Progresso
    video.addEventListener('timeupdate', function () {
      if (!video.duration) return;
      var pct = (video.currentTime / video.duration) * 100;
      progFill.style.width = pct + '%';
      timeLabel.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration);
    });

    // Play/pause icon
    video.addEventListener('play',  function () { btnPlay.innerHTML = '⏸'; });
    video.addEventListener('pause', function () { btnPlay.innerHTML = '▶'; });

    // Auto-next
    video.addEventListener('ended', function () {
      var item  = null;
      var items = vodData[playerCat] || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === playerItemId || items[i].title === playerItemId) { item = items[i]; break; }
      }
      if (item) {
        var epList = getEpList(item);
        if (playerEpIdx + 1 < epList.length) {
          var next = epList[playerEpIdx + 1];
          playVideo(next.url, item.title + ' - ' + (next.title || 'Ep ' + (playerEpIdx + 2)), playerItemId, playerCat, playerEpIdx + 1);
          return;
        }
      }
      closePlayer();
    });

    // Cliques nos controles
    btnPlay.onclick = function () { video.paused ? video.play() : video.pause(); };
    btnBack.onclick = function () { video.currentTime = Math.max(0, video.currentTime - 10); showOsd('⏪ -10s'); };
    btnFwd.onclick  = function () { video.currentTime = Math.min(video.duration || 0, video.currentTime + 10); showOsd('⏩ +10s'); };
    btnClose.onclick = closePlayer;

    btnFs.onclick = function () {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        var el = wrap;
        (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      }
    };

    // Clique na barra de progresso
    progWrap.onclick = function (e) {
      var rect = progWrap.getBoundingClientRect();
      var pct  = (e.clientX - rect.left) / rect.width;
      if (video.duration) video.currentTime = pct * video.duration;
    };

    // Mostrar controles ao mover mouse / toque
    wrap.addEventListener('mousemove', showControls);
    wrap.addEventListener('touchstart', showControls, { passive: true });
    video.onclick = function () { showControls(); video.paused ? video.play() : video.pause(); };

    // Touch swipe para seek
    var touchX = 0;
    wrap.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    wrap.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 60) {
        if (dx > 0) { video.currentTime = Math.max(0, video.currentTime - 10); showOsd('⏪ -10s'); }
        else        { video.currentTime = Math.min(video.duration || 0, video.currentTime + 10); showOsd('⏩ +10s'); }
      }
    }, { passive: true });

    // Teclado (D-pad Tizen + PC)
    document.addEventListener('keydown', function (e) {
      if (wrap.style.display === 'none') return;
      var key = e.keyCode || e.which;

      switch (key) {
        case 32:  // Space
        case 415: // Tizen Play
          e.preventDefault();
          video.paused ? video.play() : video.pause();
          showControls();
          break;
        case 19:  // Tizen Pause
          e.preventDefault();
          video.pause();
          showControls();
          break;
        case 37:  // Left
        case 412: // Tizen Rewind
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          showOsd('⏪ -10s');
          showControls();
          break;
        case 39:  // Right
        case 417: // Tizen FastForward
          e.preventDefault();
          video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
          showOsd('⏩ +10s');
          showControls();
          break;
        case 38:  // Up — aumentar volume
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          showOsd('🔊 ' + Math.round(video.volume * 100) + '%');
          showControls();
          break;
        case 40:  // Down — diminuir volume
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          showOsd('🔉 ' + Math.round(video.volume * 100) + '%');
          showControls();
          break;
        case 27:  // Escape / Back
        case 10009: // Tizen Back
          e.preventDefault();
          closePlayer();
          break;
      }
    });
  }

  // ─── BUSCA ───────────────────────────────────────────────────────────────

  function bindSearch() {
    var input = document.getElementById('search-input');
    if (!input) return;
    input.addEventListener('keyup', function () {
      if (searchTimer) clearTimeout(searchTimer);
      var q = input.value;
      searchTimer = setTimeout(function () { doSearch(q); }, 250);
    });
  }

  function doSearch(query) {
    var catalog   = document.getElementById('catalog');
    var noResults = document.getElementById('no-results');

    query = (query || '').trim();
    if (query.length < 2) {
      // Limpa busca, volta catálogo
      renderCatalog(currentCat);
      return;
    }

    query = normalizeStr(query);
    var allCats = CATS.concat(['tv']);
    var results = [];

    for (var ci = 0; ci < allCats.length; ci++) {
      var cat   = allCats[ci];
      var items = vodData[cat] || [];
      for (var i = 0; i < items.length; i++) {
        if (normalizeStr(items[i].title || '').indexOf(query) !== -1) {
          results.push({ item: items[i], cat: cat });
        }
      }
    }

    catalog.innerHTML = '';
    noResults.style.display = 'none';

    if (!results.length) {
      noResults.style.display = 'block';
      return;
    }

    var title = document.createElement('div');
    title.className = 'section-title';
    title.textContent = results.length + ' resultado(s) para "' + query + '"';
    catalog.appendChild(title);

    var row = document.createElement('div');
    row.className = 'cards-row';
    for (var ri = 0; ri < results.length; ri++) {
      var r = results[ri];
      if (r.cat === 'tv') {
        row.appendChild(makeTvCard(r.item, results[ri].idx || ri));
      } else {
        row.appendChild(makeCard(r.item, r.cat));
      }
    }
    catalog.appendChild(row);
  }

  function normalizeStr(s) {
    return s.toLowerCase()
      .replace(/[àáâãä]/g, 'a').replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u').replace(/ç/g, 'c').replace(/ñ/g, 'n');
  }

  // ─── NAV ─────────────────────────────────────────────────────────────────

  function bindNav() {
    var links = document.querySelectorAll('.nav-link');
    for (var i = 0; i < links.length; i++) {
      (function (link) {
        link.onclick = function () {
          var cat = link.getAttribute('data-cat');
          document.getElementById('search-input').value = '';
          renderCatalog(cat);
          
          setTimeout(function () {
            currentFocusIndex = 0;
            focusIndex(0);
          }, 100);
        };
        link.onkeydown = function (e) {
          if (e.keyCode === 13) link.onclick();
        };
      })(links[i]);
    }
  }

  // ─── MODAL BIND ──────────────────────────────────────────────────────────

  function bindModal() {
    var closeBtn = document.getElementById('modal-close');
    var modal    = document.getElementById('modal');

    closeBtn.onclick = closeModal;
    closeBtn.onkeydown = function (e) { if (e.keyCode === 13) closeModal(); };
    modal.onclick = function (e) { if (e.target === modal) closeModal(); };

    document.addEventListener('keydown', function (e) {
      var key = e.keyCode || e.which;
      if ((key === 27 || key === 10009) && modal.style.display !== 'none') {
        closeModal();
      }
    });
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────

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
      var list = [];
      for (var i = 0; i < item.seasons.length; i++) {
        var eps = item.seasons[i].episodes || [];
        for (var j = 0; j < eps.length; j++) list.push(eps[j]);
      }
      return list;
    }
    return [];
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ─── CONTINUE WATCHING ───────────────────────────────────────────────────

  function cwGet(videoId) {
    try {
      var data = JSON.parse(localStorage.getItem(CW_KEY)) || {};
      return data[videoId] || null;
    } catch (e) { return null; }
  }

  function cwSave(obj) {
    try {
      var data = JSON.parse(localStorage.getItem(CW_KEY)) || {};
      data[obj.videoId] = obj;
      localStorage.setItem(CW_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  // ─── FULLSCREEN AUTOMÁTICO ───────────────────────────────────────────────
  // Tizen exige gesto do usuário para entrar em fullscreen.
  // Tentamos na primeira interação (clique, tecla, toque).

  var _fsRequested = false;

  function requestAppFullscreen() {
    if (_fsRequested) return;
    _fsRequested = true;
    var el = document.documentElement;
    var fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
    if (fn) fn.call(el);
  }

  function bindFullscreenTriggers() {
    // Tenta assim que o usuário fizer qualquer interação
    document.addEventListener('click',     requestAppFullscreen, { once: true });
    document.addEventListener('keydown',   requestAppFullscreen, { once: true });
    document.addEventListener('touchstart', requestAppFullscreen, { once: true, passive: true });
  }

  // ────────────────────────────────────────────────────────
  // D-PAD TIZEN (VERSÃO ROBUSTA)
  // Navegação por índice e colunas
  // ────────────────────────────────────────────────────────

  var currentFocusIndex = 0;

  function getFocusables() {

    var modal  = document.getElementById('modal');
    var player = document.getElementById('player-wrap');

    if (modal && modal.style.display !== 'none') {
        return toArray(
            modal.querySelectorAll(
                '.modal-close-btn,' +
                '.modal-play-btn,' +
                '.season-header,' +
                '.ep-item:not(.locked),' +
                '.canal-item'
            )
        );
    }

    if (player && player.style.display !== 'none') {
        return toArray(
            player.querySelectorAll(
                '#btn-play,' +
                '#btn-back,' +
                '#btn-fwd,' +
                '#btn-fs,' +
                '#btn-next-ep,' +
                '#btn-close-player'
            )
        );
    }

    return toArray(
        document.querySelectorAll(
            '.nav-link,' +
            '#search-input,' +
            '.card'
        )
    );
  }

  function toArray(nodeList) {
    var arr = [];
    for (var i = 0; i < nodeList.length; i++) {
        arr.push(nodeList[i]);
    }
    return arr;
  }

  function focusIndex(idx) {

    var els = getFocusables();

    if (!els.length) return;

    if (idx < 0) idx = 0;
    if (idx >= els.length) idx = els.length - 1;

    currentFocusIndex = idx;

    var el = els[idx];

    if (!el) return;

    el.focus();

    try {
        el.scrollIntoView(false);
    } catch (e) {}
  }

  function getColumns() {

    var width = window.innerWidth;

    if (width >= 1900) return 10;
    if (width >= 1600) return 8;
    if (width >= 1300) return 7;
    if (width >= 1000) return 6;

    return 5;
  }

  function moveFocus(direction) {

    var els = getFocusables();

    if (!els.length) return;

    var idx = currentFocusIndex;
    var focused = els[idx];

    // Navegação especial para itens de menu (nav-links)
    if (
        focused &&
        focused.classList &&
        focused.classList.contains('nav-link')
    ) {
        if (direction === 'left') idx--;
        if (direction === 'right') idx++;
    } else {
        var columns = getColumns();
        if (direction === 'left') idx--;
        if (direction === 'right') idx++;
        if (direction === 'up') idx -= columns;
        if (direction === 'down') idx += columns;
    }

    if (idx < 0) idx = 0;
    if (idx >= els.length) idx = els.length - 1;

    focusIndex(idx);
  }

  function bindDpad() {

    document.addEventListener('keydown', function(e) {

        var key = e.keyCode || e.which;

        var focused = document.activeElement;

        var modal  = document.getElementById('modal');
        var player = document.getElementById('player-wrap');

        // BACK TIZEN
        if (key === 10009 || key === 27) {

            if (player && player.style.display !== 'none') {
                e.preventDefault();
                closePlayer();
                return;
            }

            if (modal && modal.style.display !== 'none') {
                e.preventDefault();
                closeModal();
                return;
            }

            return;
        }

        // ENTER
        if (key === 13) {

            if (
                focused &&
                focused !== document.body &&
                focused !== document.documentElement
            ) {
                e.preventDefault();

                if (typeof focused.click === 'function') {
                    focused.click();
                }
            }

            return;
        }

        // Search Input - permite navegação normal dentro do campo
        if (
            focused &&
            focused.id === 'search-input'
        ) {
            return;
        }

        switch (key) {

            case 37:
                e.preventDefault();
                moveFocus('left');
                break;

            case 38:
                e.preventDefault();
                moveFocus('up');
                break;

            case 39:
                e.preventDefault();
                moveFocus('right');
                break;

            case 40:
                e.preventDefault();
                moveFocus('down');
                break;
        }
    });

    setTimeout(function() {

        var els = getFocusables();

        if (els.length) {
            currentFocusIndex = 0;
            focusIndex(0);
        }

    }, 1000);
  }
  
  // ─── START ───────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
      bindFullscreenTriggers();
      bindDpad();
    });
  } else {
    init();
    bindFullscreenTriggers();
    bindDpad();
  }

})();
