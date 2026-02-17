// ============================================
// NOVO PLAYER - VERSÃO CORRIGIDA
// ============================================

// CRIAR MODAL IMEDIATAMENTE
(function() {
    if (!document.getElementById('modernPlayerModal')) {
        const modal = document.createElement('div');
        modal.id = 'modernPlayerModal';
        modal.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:9999;justify-content:center;align-items:center;';
        modal.innerHTML = `
            <div style="width:90%;max-width:1200px;background:#000;border-radius:10px;overflow:hidden;position:relative;">
                <button id="closeModernPlayer" style="position:absolute;top:15px;right:15px;background:#e50914;border:none;color:white;width:40px;height:40px;border-radius:50%;font-size:20px;cursor:pointer;">&times;</button>
                <div id="modern-player-container" style="width:100%;height:70vh;background:#000;"></div>
                <div style="padding:20px;color:white;">
                    <h3 id="modern-player-title"></h3>
                    <p id="modern-player-info"></p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
})();

// SISTEMA DE CONTINUAR ASSISTINDO
window.ContinueWatching = {
    STORAGE_KEY: 'pirataflix_progressos',
    
    getAll() {
        try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {}; } catch { return {}; }
    },
    
    save(videoData) {
        if (!videoData.videoId || !videoData.itemId || videoData.currentTime < 10) return;
        const all = this.getAll();
        all[videoData.videoId] = {...videoData, timestamp: Date.now(), progress: videoData.duration ? Math.round((videoData.currentTime / videoData.duration) * 100) : 0};
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
        console.log('💾 Progresso salvo');
    },
    
    get(videoId) { return this.getAll()[videoId] || null; },
    
    remove(videoId) {
        const all = this.getAll();
        delete all[videoId];
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
    },
    
    getWatchingList() {
        const all = this.getAll();
        const unique = {};
        Object.values(all).forEach(item => {
            if (!unique[item.itemId] || item.timestamp > unique[item.itemId].timestamp) {
                unique[item.itemId] = item;
            }
        });
        return Object.values(unique).sort((a,b) => b.timestamp - a.timestamp).slice(0,20);
    }
};

// FUNÇÃO PRINCIPAL DO PLAYER
window.playWithModernPlayer = function(url, title, info = '', itemId = null, category = null, episodeIndex = 0) {
    console.log('🎬 Player chamado');
    
    const modal = document.getElementById('modernPlayerModal');
    if (!modal) { window.open(url, '_blank'); return; }
    
    modal.style.display = 'flex';
    
    const container = document.getElementById('modern-player-container');
    const videoId = `${itemId}_${episodeIndex}`;
    const saved = window.ContinueWatching.get(videoId);
    
    container.innerHTML = `<video id="current-video" controls autoplay style="width:100%;height:100%;background:#000;" src="${url}"></video>`;
    const video = document.getElementById('current-video');
    const closeBtn = document.getElementById('closeModernPlayer');
    
    // Retomar progresso
    if (saved?.currentTime > 5) {
        video.addEventListener('loadedmetadata', () => {
            video.currentTime = saved.currentTime;
            const minutes = Math.floor(saved.currentTime / 60);
            const seconds = Math.floor(saved.currentTime % 60).toString().padStart(2,'0');
            const msg = document.createElement('div');
            msg.textContent = `⏯️ Retomando de ${minutes}:${seconds}`;
            msg.style.cssText = 'position:absolute;top:80px;left:20px;background:#e50914;color:white;padding:8px 16px;border-radius:4px;z-index:10000;';
            container.appendChild(msg);
            setTimeout(() => msg.remove(), 3000);
        });
    }
    
    // Salvar progresso
    let interval = setInterval(() => {
        if (video.duration && video.currentTime > 10) {
            window.ContinueWatching.save({
                videoId, itemId, category, episodeIndex,
                title, seriesTitle: title.split(' - ')[0],
                episode: episodeIndex + 1,
                currentTime: video.currentTime,
                duration: video.duration,
                url, poster: ''
            });
        }
    }, 5000);
    
    // Botão fechar
    closeBtn.onclick = () => {
        clearInterval(interval);
        modal.style.display = 'none';
        video.pause();
        container.innerHTML = '';
    };
    
    // Fechar com ESC
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            clearInterval(interval);
            modal.style.display = 'none';
            video.pause();
            container.innerHTML = '';
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    
    // Próximo episódio automático
    video.addEventListener('ended', () => {
        window.ContinueWatching.remove(videoId);
        clearInterval(interval);
        
        if (itemId && category && window.vodData) {
            const item = window.vodData[category]?.find(i => i.id === itemId);
            if (item) {
                let episodeList = item.episodes || [];
                if (!episodeList.length && item.seasons) {
                    item.seasons.forEach(s => {
                        if (s.episodes) episodeList = episodeList.concat(s.episodes);
                    });
                }
                
                if (episodeIndex + 1 < episodeList.length) {
                    setTimeout(() => {
                        const next = episodeList[episodeIndex + 1];
                        window.playWithModernPlayer(
                            next.url,
                            `${item.title} - ${next.title}`,
                            `${category} • Ep ${episodeIndex + 2}`,
                            itemId,
                            category,
                            episodeIndex + 1
                        );
                    }, 2000);
                }
            }
        }
    });
    
    document.getElementById('modern-player-title').textContent = title;
    document.getElementById('modern-player-info').textContent = info;
};

// RENDERIZAR CONTINUAR ASSISTINDO
window.renderContinueWatching = function() {
    const list = window.ContinueWatching.getWatchingList();
    if (list.length === 0) return '';
    
    const GITHUB_RAW = 'https://raw.githubusercontent.com/alberttartas/Pirataflix/main/assets/Capas/';
    let html = '<section class="category-section" id="continue-watching"><h2 class="category-title">▶️ Continuar Assistindo</h2><div class="items-grid">';
    
    list.forEach(item => {
        const remaining = item.duration - item.currentTime;
        const time = remaining > 3600 ? `${Math.floor(remaining/3600)}h ${Math.floor((remaining%3600)/60)}min` : `${Math.floor(remaining/60)}min`;
        
        let nome = 'default.jpg';
        if (item.poster) nome = item.poster.split('/').pop();
        
        html += `<div class="item-card continue-card" onclick="resumeItem('${item.itemId}', '${item.category}', ${item.episodeIndex})">
            <img src="${GITHUB_RAW}${nome}" class="item-poster" onerror="this.src='${GITHUB_RAW}default.jpg';">
            <div class="item-info">
                <div class="item-title">${item.seriesTitle || item.title}</div>
                <div class="item-meta">E${item.episode} • ${time}</div>
                <div style="width:100%;height:3px;background:#333;margin-top:5px;">
                    <div style="width:${item.progress}%;height:100%;background:#e50914;"></div>
                </div>
            </div>
        </div>`;
    });
    
    html += '</div></section>';
    return html;
};

// RETOMAR ITEM
window.resumeItem = function(itemId, category, episodeIndex) {
    if (!window.vodData?.[category]) return;
    const item = window.vodData[category].find(i => i.id === itemId);
    if (!item) return;
    
    let url = '', title = '';
    if (item.episodes?.[episodeIndex]) {
        url = item.episodes[episodeIndex].url;
        title = item.episodes[episodeIndex].title;
    } else if (item.seasons) {
        let count = 0;
        for (const s of item.seasons) {
            for (const e of s.episodes) {
                if (count === episodeIndex) { url = e.url; title = e.title; break; }
                count++;
            }
        }
    }
    if (url) window.playWithModernPlayer(url, `${item.title} - ${title}`, `${category} • Ep ${episodeIndex+1}`, itemId, category, episodeIndex);
};

// INJEÇÃO NO DISPLAY CONTENT
const originalDisplay = window.displayContent;
window.displayContent = function() {
    if (originalDisplay) originalDisplay();
    setTimeout(() => {
        const content = document.getElementById('content');
        if (!content) return;
        const html = window.renderContinueWatching();
        if (html) {
            const old = document.getElementById('continue-watching');
            if (old) old.remove();
            const first = content.querySelector('.category-section');
            if (first) first.insertAdjacentHTML('beforebegin', html);
            else content.insertAdjacentHTML('afterbegin', html);
        }
    }, 300);
};

console.log('✅ NOVO PLAYER CARREGADO COM SUCESSO!');
