// ============================================
// PIRATAFLIX — index-app.js (LOADER)
// ============================================

(function() {
    'use strict';

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
                console.error('❌ Erro ao carregar data.json:', err);
                return;
            }

            window.vodData = data;

            ajax('channels.json', function(err2, chs) {
                var channels = (err2 || !chs) ? [] : chs;

                // Mantém compatibilidade com qualquer código que use
                // a categoria genérica "tv" (lista plana de canais)
                window.vodData['tv'] = channels;

                // shared.js já sabe montar o channelsDict a partir de
                // channels.json — reaproveita em vez de duplicar
                if (typeof window.loadChannels === 'function') {
                    window.loadChannels().then(finishInit);
                } else {
                    finishInit();
                }
            });
        });
    }

    function finishInit() {
        // Ativa a rotação de capas dos cards estáticos, se existir
        if (typeof window.initPosterRotation === 'function') {
            window.initPosterRotation();
        }
        console.log('✅ PIRATAFLIX: vodData/channelsDict carregados', {
            categorias: Object.keys(window.vodData || {}),
            canais: (window.vodData && window.vodData.tv) ? window.vodData.tv.length : 0
        });
    }

    // ─── START ───────────────────────────────────────────────────────────────

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
