// ============================================
// FUNÇÕES COMPARTILHADAS - TODAS AS PÁGINAS
// ============================================

// Variáveis globais
window.RAW_BASE = 'https://raw.githubusercontent.com/alberttartas/Pirataflix/main';
window._DEFAULT_POSTER = window.RAW_BASE + '/assets/Capas/default.jpg';
window.vodData = {};
window.channelsDict = {};

// =====================
// GET POSTER
// =====================
function getPoster(item, category) {
    if (category === 'tv') {
        if (item.tvg_logo && item.tvg_logo.startsWith('http')) return item.tvg_logo;
        var key = (item.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (window.channelsDict && window.channelsDict[key]) return window.channelsDict[key];
        return window.RAW_BASE + '/assets/Capas/tv_default.jpg';
    }
    if (item.poster && item.poster.startsWith('http')) return item.poster;
    var file = item.poster ? item.poster.split('/').pop() : 'default.jpg';
    return window.RAW_BASE + '/assets/Capas/' + file;
}

// =====================
// SAFE IMG
// =====================
function safeImg(poster, altText) {
    return '<img src="' + poster + '" alt="' + altText.replace(/"/g, '') +
           '" class="item-poster" onerror="this.onerror=null;this.src=window._DEFAULT_POSTER">';
}

// =====================
// ITEM TITLE FROM
// =====================
function item_title_from(category, itemId) {
    var items = window.vodData[category];
    if (!items) return '';
    var item = (category === 'tv') ? items[parseInt(itemId)] : items.find(i => i.id === itemId);
    return item ? item.title : '';
}

// =====================
// PLAY EPISODE
// =====================
function playEpisode(url, title, itemId, category, episodeIndex) {
    if (category === 'tv') {
        if (typeof window.openTVPlayer === 'function') {
            window.openTVPlayer(parseInt(itemId));
        } else {
            window.open(url, '_blank');
        }
        document.getElementById('modal').style.display = 'none';
        return;
    }
    
    if (typeof window.playWithModernPlayer === 'function') {
        window.playWithModernPlayer(url, title, '', itemId, category, episodeIndex);
        document.getElementById('modal').style.display = 'none';
    } else {
        window.open(url, '_blank');
    }
}

// =====================
// PLAY FIRST EPISODE
// =====================
function playFirstEpisode(category, itemId) {
    var items = window.vodData[category];
    if (!items) return;
    var item = (category === 'tv') ? items[parseInt(itemId)] : items.find(i => i.id === itemId);
    if (!item) return;
    
    if (item.episodes && item.episodes.length > 0) {
        playEpisode(item.episodes[0].url, item.title + ' - ' + (item.episodes[0].title || 'AO VIVO'), itemId, category, 0);
    } else if (item.url) {
        playEpisode(item.url, item.title, itemId, category, 0);
    } else if (item.seasons && item.seasons.length > 0 && item.seasons[0].episodes.length > 0) {
        var ep = item.seasons[0].episodes[0];
        playEpisode(ep.url, item.title + ' - Temp 1 - ' + ep.title, itemId, category, 0);
    }
}

// =====================
// OPEN MODAL
// =====================
function openModal(category, itemId) {
    var items = window.vodData[category];
    if (!items) return;
    var item = (category === 'tv') ? items[parseInt(itemId)] : items.find(i => i.id === itemId);
    if (!item) return;

    var posterUrl = getPoster(item, category);
    var headerHtml = '<div class="modal-backdrop" style="background-image:url(&quot;' + posterUrl + '&quot;)"></div>';
    if (category === 'tv') {
        headerHtml += '<div style="position:absolute;top:30px;left:30px;background:#e50914;color:white;padding:8px 16px;border-radius:4px;font-weight:bold;">🔴 AO VIVO</div>';
    }
    var playLabel = category === 'tv' ? '▶ Assistir ao Vivo' : '▶ Assistir';
    headerHtml += '<button class="play-button" data-action="play-first" data-category="' + category + '" data-id="' + itemId + '" style="position:absolute;bottom:30px;left:30px;">' + playLabel + '</button>';

    var typeLabel = category === 'filmes' ? 'Filme' : (category === 'tv' ? 'Canal de TV' : 'Série');
    var bodyHtml = '<h2 class="modal-title">' + item.title + '</h2>';
    bodyHtml += '<div class="modal-meta"><span>' + typeLabel + '</span>';
    if (category === 'tv') bodyHtml += '<span>🔴 Ao Vivo</span>';
    bodyHtml += '</div>';

    if (category === 'tv') {
        var todosCanais = window.vodData['tv'] || [];
        bodyHtml += '<div class="episodes-section"><h3 style="margin-bottom:15px;font-size:1.1rem;">📡 Todos os Canais</h3><div class="episode-list">';
        todosCanais.forEach(function(canal, idx) {
            var isAtual = String(idx) === String(itemId);
            var canalPoster = canal.tvg_logo || '';
            var canalUrl = (canal.episodes && canal.episodes[0]) ? canal.episodes[0].url : canal.url || '';
            bodyHtml += '<div class="episode-item' + (isAtual ? ' canal-ativo' : '') + '" data-action="play-canal" data-url="' + canalUrl + '" data-id="' + idx + '" data-title="' + canal.title.replace(/"/g, '') + '" data-category="tv">';
            if (canalPoster) {
                bodyHtml += '<img src="' + canalPoster + '" style="width:40px;height:40px;object-fit:contain;background:#222;border-radius:4px;flex-shrink:0;" onerror="this.remove();">';
            } else {
                bodyHtml += '<div class="episode-number">📺</div>';
            }
            bodyHtml += '<div class="episode-info"><div class="episode-title">' + canal.title + (isAtual ? ' <span style="color:#e50914;font-size:0.8rem;">● AO VIVO</span>' : '') + '</div></div></div>';
        });
        bodyHtml += '</div></div>';
    } else if (item.seasons && item.seasons.length > 0) {
        bodyHtml += '<div class="episodes-section">';
        item.seasons.sort(function(a, b) { return a.season - b.season; });
        item.seasons.forEach(function(season) {
            bodyHtml += '<h3 style="margin:25px 0 10px;color:#e50914;font-size:1.2rem;">🎬 Temporada ' + season.season + '</h3>';
            bodyHtml += '<div class="episode-list">';
            season.episodes.forEach(function(ep, index) {
                var episodeNum = ep.episode || (index + 1);
                var episodeTitle = ep.title || 'Episódio ' + episodeNum;
                var safeTitle = episodeTitle.replace(/"/g, '');
                bodyHtml += '<div class="episode-item" data-action="play-ep" data-url="' + ep.url + '" data-title="' + safeTitle + '" data-itemid="' + itemId + '" data-category="' + category + '" data-index="' + index + '">';
                bodyHtml += '<div class="episode-number">' + episodeNum + '</div>';
                bodyHtml += '<div class="episode-info"><div class="episode-title">' + safeTitle + '</div></div></div>';
            });
            bodyHtml += '</div>';
        });
        bodyHtml += '</div>';
    } else if (item.episodes && item.episodes.length > 0) {
        bodyHtml += '<div class="episodes-section"><h3 style="margin-bottom:15px;font-size:1.1rem;">Episódios</h3><div class="episode-list">';
        item.episodes.forEach(function(ep, index) {
            var safeTitle = (ep.title || '').replace(/"/g, '');
            bodyHtml += '<div class="episode-item" data-action="play-ep" data-url="' + ep.url + '" data-title="' + safeTitle + '" data-itemid="' + itemId + '" data-category="' + category + '" data-index="' + index + '">';
            bodyHtml += '<div class="episode-number">' + (index + 1) + '</div>';
            bodyHtml += '<div class="episode-info"><div class="episode-title">' + (ep.title || item.title) + '</div></div></div>';
        });
        bodyHtml += '</div></div>';
    }

    document.getElementById('modalHeader').innerHTML = headerHtml;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modal').style.display = 'block';
    document.getElementById('modal').scrollTop = 0;
}

// =====================
// CARREGAR CHANNELS
// =====================
function loadChannels() {
    fetch('channels.json')
        .then(r => r.json())
        .then(data => {
            window.channelsDict = {};
            data.forEach(canal => {
                if (canal.tvg_logo) {
                    var chave = (canal.title || canal.name || canal.tvg_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (chave) window.channelsDict[chave] = canal.tvg_logo;
                }
            });
        })
        .catch(() => console.log('channels.json não encontrado'));
}

// =====================
// EVENT LISTENERS DO MODAL
// =====================
function setupModalListeners() {
    var modal = document.getElementById('modal');
    var closeBtn = document.getElementById('closeModal');
    
    if (modal) {
        modal.addEventListener('click', function(e) {
            var el = e.target.closest('[data-action]');
            if (!el) return;
            var action = el.dataset.action;
            var cat = el.dataset.category;
            var id = el.dataset.id;
            
            if (action === 'play-first') {
                playFirstEpisode(cat, id);
            } else if (action === 'play-canal') {
                var canalUrl = el.dataset.url;
                var canalId = el.dataset.id;
                var canalTitle = el.dataset.title || '';
                modal.style.display = 'none';
                playEpisode(canalUrl, canalTitle, canalId, 'tv', 0);
            } else if (action === 'play-ep') {
                var epCat = el.dataset.category;
                var epId = el.dataset.itemid;
                var epUrl = el.dataset.url;
                var epTitle = el.dataset.title || '';
                var epIndex = parseInt(el.dataset.index) || 0;
                modal.style.display = 'none';
                playEpisode(epUrl, item_title_from(epCat, epId) + ' - ' + epTitle, epId, epCat, epIndex);
            }
        });
        
        if (closeBtn) {
            closeBtn.onclick = function() { modal.style.display = 'none'; };
        }
    }
    
    window.onclick = function(event) {
        if (event.target === modal) modal.style.display = 'none';
    };
    
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && modal) modal.style.display = 'none';
    });
}

// Expor funções globalmente
window.getPoster = getPoster;
window.safeImg = safeImg;
window.item_title_from = item_title_from;
window.playEpisode = playEpisode;
window.playFirstEpisode = playFirstEpisode;
window.openModal = openModal;
window.loadChannels = loadChannels;
window.setupModalListeners = setupModalListeners;
