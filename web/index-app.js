// ============================================
// PIRATAFLIX — index-app.js
// 1) Carrega data.json + channels.json em window.vodData/channelsDict
// 2) Renderiza os cards do catálogo (filmes/series/novelas/animes/infantil)
//    em seções com id = categoria (casando com os <a href="#filmes"> do nav)
//
// NÃO abre modal, NÃO faz busca, NÃO monta menu — isso é tudo do shared.js
// (window.openModal, initSearch, initHamburger, injectFooter), e o player
// de TV é o tv-player.js (window.openTVPlayer).
// ============================================

(function() {
    'use strict';

    var CATS = ['filmes', 'series', 'novelas', 'animes', 'infantil'];
    var CAT_LABELS = {
        filmes:   '🎬 Filmes',
        series:   '📺 Séries',
        novelas:  '💖 Novelas',
        animes:   '👻 Animes',
        infantil: '🧸 Infantil'
    };

    // ─── AJAX HELPER ─────────────────────────────────────────────────────────

    function ajax(url, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.onreadystatechange = function() {
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
        ajax('data.json', function(err, data) {
            if (err || !data) {
                var loading = document.querySelector('.loading');
                if (loading) loading.textContent = 'Erro ao carregar catálogo.';
                console.error('❌ Erro ao carregar data.json:', err);
                return;
            }

            window.vodData = data;

            ajax('channels.json', function(err2, chs) {
                var channels = (err2 || !chs) ? [] : chs;

                // tv-player.js lê window.vodData.tv (lista plana de canais)
                window.vodData['tv'] = channels;

                // shared.js sabe montar o channelsDict a partir de channels.json
                if (typeof window.loadChannels === 'function') {
                    window.loadChannels().then(renderCatalog);
                } else {
                    renderCatalog();
                }
            });
        });
    }

    // ─── RENDER DO CATÁLOGO ──────────────────────────────────────────────────

    function renderCatalog() {
        var content = document.getElementById('content');
        if (!content) return;

        var loading = content.querySelector('.loading');
        if (loading) loading.remove();

        var categoriasRenderizadas = [];

        CATS.forEach(function(cat) {
            var items = window.vodData[cat] || [];
            if (!items.length) return;

            var section = document.createElement('section');
            section.id = cat;
            section.className = 'catalog-section';

            var title = document.createElement('h2');
            title.className = 'section-title';
            title.textContent = CAT_LABELS[cat] || cat;
            section.appendChild(title);

            var row = document.createElement('div');
            row.className = 'cards-row';
            items.forEach(function(item) {
                row.appendChild(makeCard(item, cat));
            });
            section.appendChild(row);

            content.appendChild(section);
            categoriasRenderizadas.push(cat + ' (' + items.length + ')');
        });

        // Ativa a troca/rotação de capas dos cards que têm mais de 1 poster
        if (typeof window.initPosterRotation === 'function') {
            window.initPosterRotation();
        }

        console.log('✅ PIRATAFLIX: catálogo renderizado —', categoriasRenderizadas.join(', '),
            '| TV:', (window.vodData.tv || []).length, 'canais');
    }

    function makeCard(item, cat) {
        var card = document.createElement('div');
        card.className = 'item-card';

        // shared.js -> initPosterRotation() lê este atributo pra alternar capas
        if (item.posters && item.posters.length > 1) {
            card.dataset.posters = JSON.stringify(item.posters);
        }

        var poster = (typeof window.getPoster === 'function')
            ? window.getPoster(item, cat)
            : (item.poster || window._DEFAULT_POSTER);

        var imgHtml = (typeof window.safeImg === 'function')
            ? window.safeImg(poster, item.title)
            : '<img src="' + poster + '" alt="" class="item-poster" loading="lazy" onerror="this.onerror=null;this.src=window._DEFAULT_POSTER">';

        var year   = item.year   ? '<span class="item-year">' + esc(item.year) + '</span>' : '';
        var rating = item.rating ? '<span class="item-rating">⭐ ' + item.rating + '</span>' : '';

        card.innerHTML =
            imgHtml +
            '<div class="item-info">' +
                '<div class="item-title">' + esc(item.title) + '</div>' +
                '<div class="item-meta">' + year + ' ' + rating + '</div>' +
            '</div>';

        var id = item.id || item.title;
        card.onclick = function() {
            if (typeof window.openModal === 'function') {
                window.openModal(cat, id);
            }
        };

        return card;
    }

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ─── START ───────────────────────────────────────────────────────────────

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
