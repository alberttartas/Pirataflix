// ============================================
// NOVO PLAYER - PIRATAFLIX
// Único responsável pelo sistema de progresso
// ============================================

let onTimeUpdateHandler = null;

if (!document.getElementById('player-animations')) {
    const style = document.createElement('style');
    style.id = 'player-animations';
    style.textContent = `
        @keyframes fadeOut {
            0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(20px); }
            to   { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);
}

(function() {
    if (!document.getElementById('modernPlayerModal')) {
        const modal = document.createElement('div');
        modal.id = 'modernPlayerModal';
        modal.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:9999;justify-content:center;align-items:center;';
        modal.innerHTML = `
            <div style="width:90%;max-width:1200px;background:#000;border-radius:10px;overflow:hidden;position:relative;">
                <button id="closeModernPlayerFix" style="position:absolute;top:15px;right:15px;background:#e50914;border:none;color:white;width:40px;height:40px;border-radius:50%;font-size:20px;cursor:pointer;z-index:10001;display:flex;align-items:center;justify-content:center;">&times;</button>
                <div id="modern-player-container" style="width:100%;height:70vh;background:#000;position:relative;"></div>
                <div style="padding:20px;color:white;">
                    <h3 id="modern-player-title"></h3>
                    <p id="modern-player-info"></p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
})();

// ==========================================
// 💾 SISTEMA DE PROGRESSO — FONTE ÚNICA
// ==========================================
window.ContinueWatching = {
    STORAGE_KEY: 'pirataflix_progressos',

    getAll() {
        try {
            const data = JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {};
            // Compatibilidade: se vier array (formato antigo), converter
            if (Array.isArray(data)) {
                const converted = {};
                data.forEach(item => {
                    const key = (item.videoId || (item.itemId + '_' + (item.episodeIndex || 0)));
                    converted[key] = item;
                });
                return converted;
            }
            return data;
        } catch { return {}; }
    },

    save(videoData) {
        if (!videoData.videoId || !videoData.itemId) return;
        if (videoData.currentTime < 10) return; // Não salvar menos de 10s
        const all = this.getAll();
        all[videoData.videoId] = {
            ...videoData,
            timestamp: Date.now(),
            progress: videoData.duration
                ? Math.round((videoData.currentTime / videoData.duration) * 100)
                : 0
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
    },

    get(videoId) {
        return this.getAll()[videoId] || null;
    },

    remove(videoId) {
        const all = this.getAll();
        delete all[videoId];
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
    },

    // Retorna lista deduplicada por itemId (o mais recente de cada série/filme)
    getWatchingList() {
        const all = this.getAll();
        const unique = {};
        Object.values(all).forEach(item => {
            const key = item.itemId + '_' + item.category;
            if (!unique[key] || item.timestamp > unique[key].timestamp) {
                unique[key] = item;
            }
        });
        return Object.values(unique)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 20);
    }
};

// ==========================================
// 🔥 DESTRUIR PLAYER
// ==========================================
window.destroyModernPlayer = function() {
    const video = document.getElementById('current-video');
    if (video) {
        if (onTimeUpdateHandler) {
            video.removeEventListener('timeupdate', onTimeUpdateHandler);
            onTimeUpdateHandler = null;
        }
        video.pause();
        video.removeAttribute('src');
        video.load();
    }
    if (window.__playerInterval) { clearInterval(window.__playerInterval); window.__playerInterval = null; }
    if (window.__keyboardHandler) { document.removeEventListener('keydown', window.__keyboardHandler); window.__keyboardHandler = null; }
    if (window.controlsTimeout) { clearTimeout(window.controlsTimeout); window.controlsTimeout = null; }
    const controls = document.getElementById('custom-controls');
    if (controls) controls.remove();
};

// ==========================================
// 🎬 PLAYER PRINCIPAL
// ==========================================
window.playWithModernPlayer = function(url, title, info = '', itemId = null, category = null, episodeIndex = 0) {
    window.destroyModernPlayer();

    const modal     = document.getElementById('modernPlayerModal');
    const closeBtn  = document.getElementById('closeModernPlayerFix');
    const titleEl   = document.getElementById('modern-player-title');
    const infoEl    = document.getElementById('modern-player-info');

    if (!modal) { window.open(url, '_blank'); return; }

    if (titleEl) titleEl.textContent = title;
    if (infoEl)  infoEl.textContent  = info;
    modal.style.display = 'flex';

    const container = document.getElementById('modern-player-container');
    if (!container) return;

    const videoId = `${itemId}_${episodeIndex}`;
    const saved   = window.ContinueWatching.get(videoId);

    container.innerHTML = `
        <video id="current-video"
               style="width:100%;height:100%;background:#000;"
               playsinline>
            <source src="${url}" type="video/mp4">
        </video>
    `;

    const video = document.getElementById('current-video');
    if (!video) return;

    video.play().catch(() => {});

    setTimeout(() => addControls(container, video, itemId, category, episodeIndex, title, info), 200);

    // Salvar progresso a cada 5s
    window.__playerInterval = setInterval(() => {
        if (!video || !video.duration || video.currentTime < 10) return;

        let posterUrl = '';
        try {
            const item = window.vodData?.[category]?.find(i => i.id === itemId);
            if (item?.poster) posterUrl = item.poster;
        } catch(e) {}

        window.ContinueWatching.save({
            videoId,
            itemId,
            category,
            episodeIndex,
            title,
            seriesTitle: title?.split(' - ')[0] || title,
            episode:     episodeIndex + 1,
            currentTime: video.currentTime,
            duration:    video.duration,
            url,
            poster:      posterUrl
        });
    }, 5000);

    // Teclado
    window.__keyboardHandler = function(e) {
        if (!video) return;
        switch (e.key) {
            case ' ':       e.preventDefault(); video.paused ? video.play() : video.pause(); break;
            case 'ArrowRight': video.currentTime += 10; showMessage(container, '⏩ +10s'); break;
            case 'ArrowLeft':  video.currentTime -= 10; showMessage(container, '⏪ -10s'); break;
            case 'Escape':
                window.destroyModernPlayer();
                modal.style.display = 'none';
                break;
        }
    };
    document.addEventListener('keydown', window.__keyboardHandler);

    // Ao terminar
    video.addEventListener('ended', () => {
        window.ContinueWatching.remove(videoId);

        const item = window.vodData?.[category]?.find(i => i.id === itemId);
        if (item) {
            let epList = getEpisodeList(item);
            if (episodeIndex + 1 < epList.length) {
                const next = epList[episodeIndex + 1];
                setTimeout(() => {
                    window.playWithModernPlayer(
                        next.url,
                        `${item.title} - ${next.title || 'Episódio ' + (episodeIndex + 2)}`,
                        `${category} • Ep ${episodeIndex + 2}`,
                        itemId, category, episodeIndex + 1
                    );
                }, 2000);
                return;
            }
        }
        window.destroyModernPlayer();
        modal.style.display = 'none';
    });

    closeBtn.onclick = function() {
        window.destroyModernPlayer();
        modal.style.display = 'none';
    };

    // Restaurar progresso salvo
    if (saved?.currentTime > 5) {
        let restored = false;
        function doRestore() {
            if (restored || !video.duration || isNaN(video.duration)) return;
            if (saved.currentTime >= video.duration - 2) return;
            restored = true;
            video.currentTime = saved.currentTime;
            const m = Math.floor(saved.currentTime / 60);
            const s = Math.floor(saved.currentTime % 60).toString().padStart(2, '0');
            const msg = document.createElement('div');
            msg.textContent = `⏯️ Retomando de ${m}:${s}`;
            msg.style.cssText = 'position:absolute;top:80px;left:20px;background:#e50914;color:white;padding:8px 16px;border-radius:4px;z-index:10000;font-weight:bold;';
            container.appendChild(msg);
            setTimeout(() => msg.remove(), 3000);
        }
        video.addEventListener('loadedmetadata', doRestore);
        video.addEventListener('canplay', doRestore, { once: true });
    }
};

// ==========================================
// 🛠️ HELPERS
// ==========================================
function getEpisodeList(item) {
    if (item.episodes?.length) return item.episodes;
    if (item.seasons?.length) {
        return item.seasons.reduce((acc, s) => acc.concat(s.episodes || []), []);
    }
    return [];
}

function showMessage(container, text) {
    const msg = document.createElement('div');
    msg.textContent = text;
    msg.style.cssText = `
        position:absolute;top:50%;left:50%;
        transform:translate(-50%,-50%);
        background:rgba(0,0,0,0.8);color:white;
        padding:20px 30px;border-radius:50px;
        font-size:24px;font-weight:bold;z-index:10002;
        animation:fadeOut 1s forwards;
    `;
    container.appendChild(msg);
    setTimeout(() => msg.remove(), 1000);
}

// ==========================================
// 🎮 CONTROLES
// ==========================================
function addControls(container, video, itemId, category, episodeIndex, title, info) {
    const oldControls = document.getElementById('custom-controls');
    if (oldControls) oldControls.remove();

    if (!window.vodData) {
        setTimeout(() => addControls(container, video, itemId, category, episodeIndex, title, info), 1000);
        return;
    }

    const item = window.vodData[category]?.find(i => i.id === itemId);
    const epList = item ? getEpisodeList(item) : [];

    video.controls = false;

    const bar = document.createElement('div');
    bar.id = 'custom-controls';
    bar.style.cssText = `
        position:absolute;bottom:0;left:0;right:0;
        background:linear-gradient(transparent,rgba(0,0,0,0.9));
        padding:15px 20px;display:flex;align-items:center;gap:15px;
        z-index:10001;opacity:0;transition:opacity 0.3s;
    `;

    // Mostrar barra ao mover mouse
    container.addEventListener('mousemove', () => {
        bar.style.opacity = '1';
        clearTimeout(window.controlsTimeout);
        window.controlsTimeout = setTimeout(() => {
            if (!video.paused) bar.style.opacity = '0';
        }, 3000);
    });

    // Play/Pause
    const playBtn = document.createElement('button');
    playBtn.innerHTML = '⏸️';
    playBtn.style.cssText = 'background:none;border:none;color:white;font-size:28px;cursor:pointer;padding:5px;width:40px;';
    playBtn.onclick = () => { video.paused ? video.play() : video.pause(); };
    video.addEventListener('play',  () => playBtn.innerHTML = '⏸️');
    video.addEventListener('pause', () => playBtn.innerHTML = '▶️');

    // -10s
    const backBtn = makeCtrlBtn('⏪ 10s');
    backBtn.onclick = () => { video.currentTime = Math.max(0, video.currentTime - 10); showMessage(container, '⏪ -10s'); };

    // +10s
    const fwdBtn = makeCtrlBtn('10s ⏩');
    fwdBtn.onclick = () => { video.currentTime = Math.min(video.duration, video.currentTime + 10); showMessage(container, '⏩ +10s'); };

    // Barra de progresso
    const progressWrap = document.createElement('div');
    progressWrap.style.cssText = 'flex:1;height:5px;background:rgba(255,255,255,0.3);border-radius:5px;cursor:pointer;position:relative;';
    const progressFill = document.createElement('div');
    progressFill.style.cssText = 'width:0%;height:100%;background:#e50914;border-radius:5px;transition:width 0.1s;';
    progressWrap.appendChild(progressFill);
    progressWrap.addEventListener('click', e => {
        const rect = progressWrap.getBoundingClientRect();
        video.currentTime = ((e.clientX - rect.left) / rect.width) * video.duration;
    });

    // Tempo
    const timeLabel = document.createElement('span');
    timeLabel.style.cssText = 'color:white;font-size:14px;min-width:100px;';
    function fmt(s) {
        if (!s || isNaN(s)) return '0:00';
        return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
    }

    // Fullscreen
    const fsBtn = makeCtrlBtn('⛶', '22px');
    fsBtn.onclick = () => {
        document.fullscreenElement ? document.exitFullscreen() : container.requestFullscreen().catch(() => {});
    };

    // timeupdate unificado
    if (onTimeUpdateHandler) video.removeEventListener('timeupdate', onTimeUpdateHandler);
    onTimeUpdateHandler = () => {
        if (!video.duration) return;
        progressFill.style.width = ((video.currentTime / video.duration) * 100) + '%';
        timeLabel.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration)}`;
        const nb = document.getElementById('nextEpisodeBtn');
        if (nb) nb.style.opacity = (video.duration - video.currentTime <= 10) ? '1' : '0.7';
    };
    video.addEventListener('timeupdate', onTimeUpdateHandler);

    // Montar barra
    bar.append(playBtn, backBtn, fwdBtn, progressWrap, timeLabel, fsBtn);

    // Próximo episódio
    if (item && episodeIndex + 1 < epList.length) {
        const nextBtn = document.createElement('button');
        nextBtn.id = 'nextEpisodeBtn';
        nextBtn.innerHTML = 'PRÓXIMO ▶';
        nextBtn.style.cssText = 'background:#e50914;color:white;border:none;padding:8px 16px;border-radius:4px;font-size:14px;font-weight:bold;cursor:pointer;white-space:nowrap;opacity:0.7;transition:0.2s;';
        nextBtn.onmouseover = () => nextBtn.style.background = '#f40612';
        nextBtn.onmouseout  = () => nextBtn.style.background = '#e50914';
        nextBtn.onclick = () => {
            const next = epList[episodeIndex + 1];
            window.playWithModernPlayer(
                next.url,
                `${item.title} - ${next.title || 'Episódio ' + (episodeIndex + 2)}`,
                `${category} • Ep ${episodeIndex + 2}`,
                itemId, category, episodeIndex + 1
            );
        };
        bar.appendChild(nextBtn);
    }

    container.appendChild(bar);
    setupTouchControls(container, video);
}

function makeCtrlBtn(label, size = '14px') {
    const btn = document.createElement('button');
    btn.innerHTML = label;
    btn.style.cssText = `background:rgba(255,255,255,0.2);border:none;color:white;font-size:${size};cursor:pointer;padding:8px 12px;border-radius:4px;transition:0.2s;`;
    btn.onmouseover = () => btn.style.background = 'rgba(255,255,255,0.3)';
    btn.onmouseout  = () => btn.style.background = 'rgba(255,255,255,0.2)';
    return btn;
}

function setupTouchControls(container, video) {
    let tx = 0;
    container.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
    container.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - tx;
        if (Math.abs(dx) > 50) {
            if (dx > 0) { video.currentTime = Math.max(0, video.currentTime - 10); showMessage(container, '⏪ -10s'); }
            else        { video.currentTime = Math.min(video.duration, video.currentTime + 10); showMessage(container, '⏩ +10s'); }
        }
        tx = 0;
    }, { passive: true });
}

// ==========================================
// ▶️ RETOMAR DA LISTA "CONTINUAR ASSISTINDO"
// ==========================================
window.resumeFromStorage = function(itemId, category, episodeIndex) {
    const items = window.vodData?.[category];
    if (!items) return;

    const item = (category === 'tv')
        ? items[parseInt(itemId)]
        : items.find(i => i.id === itemId);

    if (!item) { window.openModal?.(category, itemId); return; }

    const safeIdx = (typeof episodeIndex === 'number' && !isNaN(episodeIndex)) ? episodeIndex : 0;
    const epList  = getEpisodeList(item);

    let url = '', title = '';
    if (epList[safeIdx]) {
        url   = epList[safeIdx].url;
        title = `${item.title} - ${epList[safeIdx].title || 'Ep ' + (safeIdx + 1)}`;
    } else if (item.url) {
        url   = item.url;
        title = item.title;
    }

    if (!url) { window.openModal?.(category, itemId); return; }
    window.playWithModernPlayer(url, title, '', itemId, category, safeIdx);
};

// Alias para compatibilidade
window.resumeItem = window.resumeFromStorage;

if (!window.__fullscreenListenerAdded) {
    document.addEventListener('fullscreenchange', () => {
        document.getElementById('modernPlayerModal')
            ?.classList.toggle('fullscreen-active', !!document.fullscreenElement);
    });
    window.__fullscreenListenerAdded = true;
}

console.log('✅ PIRATAFLIX PLAYER CARREGADO');
