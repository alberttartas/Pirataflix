// Lógica principal da página index - Pirataflix
(function() {
    var RAW_BASE = 'https://raw.githubusercontent.com/alberttartas/Pirataflix/main';
    // window.channelsDict é carregado de channels-dict.js (gerado pelo build.py)
    var DEFAULT_POSTER = RAW_BASE + '/assets/Capas/default.jpg';
    window._DEFAULT_POSTER = DEFAULT_POSTER;
    window.vodData = {};

    // =====================
    // FUNÇÕES AUXILIARES
    // =====================
    function item_title_from(category, itemId) {
        var items = window.vodData[category];
        if (!items) return '';
        var item = (category === 'tv')
            ? items[parseInt(itemId)]
            : items.find(function(i) { return i.id === itemId; });
        return item ? item.title : '';
    }

    // =====================
    // PLAY EPISODE
    // Não salva progresso — isso é responsabilidade exclusiva do novo-player.js
    // =====================
    function playEpisode(url, title, itemId, category, episodeIndex) {
        var safeIndex = (typeof episodeIndex === 'number' && !isNaN(episodeIndex)) ? episodeIndex : 0;

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
            window.playWithModernPlayer(url, title, '', itemId, category, safeIndex);
            document.getElementById('modal').style.display = 'none';
        } else {
            window.open(url, '_blank');
        }
    }

    // =====================
    // PLAY FIRST EPISODE
    // Lê o índice salvo pelo novo-player.js (fonte única de progresso)
    // =====================
    function playFirstEpisode(category, itemId) {
        var items = window.vodData[category];
        if (!items) return;

        var item = (category === 'tv')
            ? items[parseInt(itemId)]
            : items.find(function(i) { return i.id === itemId; });
        if (!item) return;

        // Buscar índice salvo via ContinueWatching (novo-player.js)
        var episodeIndex = 0;
        try {
            if (window.ContinueWatching) {
                var list = window.ContinueWatching.getAll();
                var entries = Object.values(list).filter(function(e) {
                    return e.itemId === itemId && e.category === category;
                });
                if (entries.length > 0) {
                    var latest = entries.sort(function(a, b) {
                        return (b.timestamp || 0) - (a.timestamp || 0);
                    })[0];
                    if (typeof latest.episodeIndex === 'number' && !isNaN(latest.episodeIndex)) {
                        episodeIndex = latest.episodeIndex;
                    }
                }
            }
        } catch(e) {}

        // Encontrar episódio pelo índice
        var url = '', title = '';

        if (item.episodes && item.episodes.length > 0) {
            var safeIdx = Math.min(episodeIndex, item.episodes.length - 1);
            url   = item.episodes[safeIdx].url;
            title = item.title + ' - ' + (item.episodes[safeIdx].title || 'Episódio ' + (safeIdx + 1));
        } else if (item.url) {
            url   = item.url;
            title = item.title;
        } else if (item.seasons && item.seasons.length > 0) {
            var remaining = episodeIndex;
            var found = false;
            for (var s = 0; s < item.seasons.length; s++) {
                var eps = item.seasons[s].episodes || [];
                if (remaining < eps.length) {
                    url   = eps[remaining].url;
                    title = item.title + ' - Temp ' + item.seasons[s].season + ' - ' + (eps[remaining].title || 'Episódio ' + (remaining + 1));
                    found = true;
                    break;
                }
                remaining -= eps.length;
            }
            if (!found) {
                url   = item.seasons[0].episodes[0].url;
                title = item.title + ' - Temp ' + item.seasons[0].season + ' - Episódio 1';
                episodeIndex = 0;
            }
        }

        if (url) {
            playEpisode(url, title, itemId, category, episodeIndex);
        }
    }

    // =====================
    // CARREGAR DADOS
    // =====================
    async function loadData() {
        try {
            var response = await fetch('data.json');
            window.vodData = await response.json();
            displayContent();
            setTimeout(function() {
                if (typeof $.fn.owlCarousel === 'function') {
                    initCarousels();
                } else {
                    initFallbackScroll();
                }
                // Alternância de capas (capa local <-> TMDB)
                if (typeof window.initPosterRotation === 'function') {
                    setTimeout(window.initPosterRotation, 600);
                }
            }, 500);
        } catch (error) {
            document.getElementById('content').innerHTML =
                '<div class="error">Erro ao carregar: ' + error.message + '</div>';
        }
    }

    // =====================
    // FALLBACK SCROLL
    // =====================
    function initFallbackScroll() {
        $('.owl-carousel').css({ display: 'flex', 'overflow-x': 'auto', gap: '10px' });
        $('.owl-carousel .item-card').css({ flex: '0 0 auto', width: '220px' });
    }

    // =====================
    // CARROSSÉIS
    // =====================
    function initCarousels() {
        setTimeout(function() {
            $('.owl-carousel').each(function() {
                var $c = $(this);
                var cId = $c.attr('id');
                var isCont = cId === 'carousel-continue';
                if (!$c.data('owlCarousel')) {
                    $c.owlCarousel({
                        items: isCont ? 8 : 7,
                        margin: isCont ? 8 : 10,
                        loop: false, nav: false, dots: false,
                        responsive: {
                            0:    { items: isCont ? 3 : 2 },
                            480:  { items: isCont ? 4 : 3 },
                            640:  { items: isCont ? 5 : 4 },
                            768:  { items: isCont ? 6 : 5 },
                            1024: { items: isCont ? 7 : 6 },
                            1280: { items: isCont ? 8 : 7 }
                        }
                    });
                }
                $('.next-' + cId).off('click').on('click', function(e) {
                    e.preventDefault(); $c.trigger('next.owl.carousel');
                });
                $('.prev-' + cId).off('click').on('click', function(e) {
                    e.preventDefault(); $c.trigger('prev.owl.carousel');
                });
            });
        }, 300);
    }

    // =====================
    // HELPERS
    // =====================
    function getPoster(item, category) {
        if (category === 'tv') {
            if (item.tvg_logo && item.tvg_logo.startsWith('http')) return item.tvg_logo;
            var key = (item.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (window.channelsDict && window.channelsDict[key]) return window.channelsDict[key];
            return RAW_BASE + '/assets/Capas/tv_default.jpg';
        }
        if (item.poster && item.poster.startsWith('http')) return item.poster;
        var file = item.poster ? item.poster.split('/').pop() : 'default.jpg';
        return RAW_BASE + '/assets/Capas/' + file;
    }

    function safeImg(poster, altText) {
        return '<img src="' + poster + '" alt="' + altText.replace(/"/g, '') +
               '" class="item-poster" onerror="this.onerror=null;this.src=window._DEFAULT_POSTER">';
    }

    // =====================
    // EXIBIR CONTEÚDO
    // =====================
    function displayContent() {
        var contentDiv = document.getElementById('content');
        var html = '';

        // =====================
        // CONTINUAR ASSISTINDO
        // Delega inteiramente ao ContinueWatching do novo-player.js (fonte única)
        // =====================
        var deduped = [];
        try {
            if (window.ContinueWatching) {
                deduped = window.ContinueWatching.getWatchingList();
            }
        } catch(e) { deduped = []; }

        if (deduped.length > 0) {
            html += '<section class="category-section continue-watching">';
            html += '<div class="category-header">';
            html += '<h2 class="category-title">⏯️ Continuar Assistindo</h2>';
            html += '<div class="nav_items_module">';
            html += '<a class="nav-btn prev-carousel-continue"><i class="fas fa-chevron-left"></i></a>';
            html += '<a class="nav-btn next-carousel-continue"><i class="fas fa-chevron-right"></i></a>';
            html += '</div></div>';
            html += '<div id="carousel-continue" class="owl-carousel">';
            deduped.forEach(function(item) {
                var itemId = item.itemId || item.id;
                var cat    = item.category;
                var epIdx  = (typeof item.episodeIndex === 'number') ? item.episodeIndex : 0;
                var progress = item.progress || (item.duration ? Math.round((item.currentTime / item.duration) * 100) : 0);
                var timeLeft = '';
                if (item.duration && item.currentTime) {
                    var rem = Math.max(0, item.duration - item.currentTime);
                    timeLeft = rem > 3600
                        ? Math.floor(rem / 3600) + 'h ' + Math.floor((rem % 3600) / 60) + 'min restantes'
                        : Math.floor(rem / 60) + 'min restantes';
                }
                var poster = DEFAULT_POSTER;
                if (item.poster) {
                    poster = item.poster.startsWith('http')
                        ? item.poster
                        : (RAW_BASE + '/assets/Capas/' + item.poster.split('/').pop());
                }
                var displayTitle = item.seriesTitle || item.title || '';
                var epLabel = (item.episode || epIdx > 0) ? ('Ep ' + (item.episode || (epIdx + 1))) : '';
                html += '<div class="item-card continue-card" data-category="' + cat + '" data-id="' + itemId + '" data-ep="' + epIdx + '">';
                html += safeImg(poster, displayTitle);
                html += '<div class="watch-badge">⏯️ Continuar</div>';
                html += '<div class="progress-bar-wrap"><div class="progress-fill" style="width:' + progress + '%;"></div></div>';
                html += '<div class="item-info">';
                html += '<div class="item-title">' + displayTitle + '</div>';
                html += '<div class="item-meta">' + epLabel + (epLabel && timeLeft ? ' • ' : '') + timeLeft + '</div>';
                html += '</div></div>';
            });
            html += '</div></section>';
        }

        // Categorias normais
        var categoryOrder = ['filmes', 'series', 'novelas', 'animes', 'infantil', 'tv'];
        var categoryNames = {
            filmes: '🎬 Filmes', series: '📺 Séries', novelas: '💖 Novelas',
            animes: '👻 Animes', infantil: '🧸 Infantil', tv: '📡 TV AO VIVO'
        };
        var categoryPages = {
            filmes: 'filmes.html', series: 'series.html', novelas: 'novelas.html',
            animes: 'animes.html', infantil: 'infantil.html', tv: 'tv.html'
        };

        categoryOrder.forEach(function(category) {
            var items = window.vodData[category];
            if (!items || items.length === 0) return;
            var carouselId = 'carousel-' + category;
            html += '<section class="category-section" id="' + category + '">';
            html += '<div class="category-header">';
            html += '<h2 class="category-title">' + categoryNames[category] + '</h2>';
            html += '<div style="display:flex;gap:10px;align-items:center;">';
            html += '<div class="nav_items_module">';
            html += '<a class="nav-btn prev-' + carouselId + '"><i class="fas fa-chevron-left"></i></a>';
            html += '<a class="nav-btn next-' + carouselId + '"><i class="fas fa-chevron-right"></i></a>';
            html += '</div>';
            html += '<a href="' + categoryPages[category] + '" class="see-all-link">Ver Tudo <i class="fas fa-arrow-right"></i></a>';
            html += '</div></div>';
            html += '<div id="' + carouselId + '" class="owl-carousel">';

            items.forEach(function(item, idx) {
                var poster = getPoster(item, category);
                // Montar lista completa de capas: TMDB posters + capa local
                var allPosters = [];
                if (category !== 'tv') {
                    var localRaw = item.local_poster || '';
                    var localUrl = localRaw ? (RAW_BASE + '/assets/Capas/' + localRaw.split('/').pop()) : '';
                    // Começar com posters TMDB
                    if (item.posters && item.posters.length) {
                        allPosters = item.posters.slice();
                    } else if (item.poster && item.poster.startsWith('http')) {
                        allPosters = [item.poster];
                    }
                    // Adicionar capa local se existir e não estiver na lista
                    if (localUrl && allPosters.indexOf(localUrl) === -1) {
                        allPosters.push(localUrl);
                    }
                }
                var postersJson = allPosters.length > 1 ? JSON.stringify(allPosters).replace(/"/g, '&quot;') : '';
                var postersAttr = postersJson ? ' data-posters="' + postersJson + '"' : '';
                var episodeCount = item.episodes ? item.episodes.length : 0;
                var meta = category === 'filmes' ? 'Filme'
                         : category === 'tv' ? '📡 Ao Vivo'
                         : (item.seasons && item.seasons.length > 1) ? item.seasons.length + ' temporadas'
                         : episodeCount + ' episódios';
                var itemKey = (category === 'tv') ? String(idx) : item.id;
                html += '<div class="item-card" data-category="' + category + '" data-id="' + itemKey + '"' + postersAttr + '>';
                html += safeImg(poster, item.title);
                html += '<div class="item-info">';
                html += '<div class="item-title">' + item.title + '</div>';
                html += '<div class="item-meta">' + meta + '</div>';
                html += '</div></div>';
            });

            html += '</div></section>';
        });

        contentDiv.innerHTML = html || '<div class="loading">Nenhum conteúdo encontrado</div>';

        contentDiv.addEventListener('click', function(e) {
            var card = e.target.closest('.item-card');
            if (!card) return;
            var cat = card.dataset.category;
            var id  = card.dataset.id;
            if (!cat || !id) return;
            if (card.classList.contains('continue-card')) {
                var epIdx = parseInt(card.dataset.ep) || 0;
                window.resumeFromStorage(id, cat, epIdx);
                return;
            }
            openModal(cat, id);
        });
    }

    // =====================
    // MODAL — delegado ao shared.js
    // =====================

    // =====================
    // EVENT LISTENERS
    // =====================

    // Expor funções globalmente
    // resumeFromStorage: delegado ao novo-player.js
    // (definido lá, sobrescreve qualquer versão anterior)

    window.playEpisode      = playEpisode;
    window.playFirstEpisode = playFirstEpisode;

    // Iniciar
    loadData();
})();
