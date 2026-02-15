// ============================================
// PLAYER COMPLETO - VERSÃO FINAL CORRIGIDA
// ============================================

// CRIAR MODAL PRIMEIRO
(function() {
    if (!document.getElementById('modernPlayerModal')) {
        console.log('🎨 CRIANDO MODAL...');
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
const ContinueWatching = {
    STORAGE_KEY: 'pirataflix_progressos',
    
    getAll() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {};
        } catch {
            return {};
        }
    },
    
    save(videoData) {
        if (!videoData.videoId || videoData.currentTime < 10) return;
        const all = this.getAll();
        all[videoData.videoId] = {...videoData, timestamp: Date.now(), progress: videoData.duration ? Math.round((videoData.currentTime / videoData.duration) * 100) : 0};
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
    
    getWatchingList() {
        const all = this.getAll();
        const unique = {};
        Object.values(all).forEach(item => {
            if (!unique[item.itemId] || item.timestamp > unique[item.itemId].timestamp) {
                unique[item.itemId] = item;
            }
        });
        return Object.values(unique).sort((a,b) => b.timestamp - a.timestamp).slice(0, 20);
    }
};

// RENDERIZAR CONTINUAR ASSISTINDO
function renderContinueWatching() {
    const list = ContinueWatching.getWatchingList();
    if (list.length === 0) return '';
    
    const GITHUB_RAW = 'https://raw.githubusercontent.com/alberttartas/Pirataflix/main/assets/Capas/';
    
    let html = `
    <section class="category-section" id="continue-watching">
        <h2 class="category-title">▶️ Continuar Assistindo</h2>
        <div class="items-grid">`;
    
    list.forEach(item => {
        const remaining = item.duration - item.currentTime;
        const time = remaining > 3600 ? `${Math.floor(remaining/3600)}h ${Math.floor((remaining%3600)/60)}min` : `${Math.floor(remaining/60)}min`;
        
        let nomeArquivo = 'default.jpg';
        if (item.poster) nomeArquivo = item.poster.split('/').pop();
        
        html += `
        <div class="item-card continue-card" onclick="resumeItem('${item.itemId}', '${item.category}', ${item.episodeIndex})">
            <img src="${GITHUB_RAW}${nomeArquivo}" class="item-poster" onerror="this.src='${GITHUB_RAW}default.jpg';">
            <div class="item-info">
                <div class="item-title">${item.seriesTitle || item.title}</div>
                <div class="item-meta">E${item.episode} • ${time}</div>
                <div style="width:100%;height:3px;background:#333;margin-top:5px;"><div style="width:${item.progress}%;height:100%;background:#e50914;"></div></div>
            </div>
        </div>`;
    });
    
    html += `</div></section>`;
    return html;
}

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

// FUNÇÃO PRINCIPAL DO PLAYER
window.playWithModernPlayer = function(url, title, info = '', itemId = null, category = null, episodeIndex = 0) {
    console.log('🎬 PLAYER');
    
    const modal = document.getElementById('modernPlayerModal');
    if (!modal) { window.open(url, '_blank'); return; }
    
    modal.style.display = 'flex';
    
    const container = document.getElementById('modern-player-container');
    const videoId = `${itemId}_${episodeIndex}`;
    const saved = ContinueWatching.get(videoId);
    
    container.innerHTML = `<video id="current-video" controls autoplay style="width:100%;height:100%;" src="${url}"></video>`;
    const video = document.getElementById('current-video');
    const closeBtn = document.getElementById('closeModernPlayer');
    
    if (saved?.currentTime > 5) {
        video.addEventListener('loadedmetadata', () => { video.currentTime = saved.currentTime; });
    }
    
    let interval = setInterval(() => {
        if (video.duration && video.currentTime > 10) {
            ContinueWatching.save({ videoId, itemId, category, episodeIndex, title, seriesTitle: title.split(' - ')[0], episode: episodeIndex + 1, currentTime: video.currentTime, duration: video.duration, url });
        }
    }, 5000);
    
    closeBtn.onclick = () => { clearInterval(interval); modal.style.display = 'none'; video.pause(); };
    video.addEventListener('ended', () => { ContinueWatching.remove(videoId); clearInterval(interval); });
    
    document.getElementById('modern-player-title').textContent = title;
    document.getElementById('modern-player-info').textContent = info;
};

// INJEÇÃO NO DISPLAY CONTENT
const originalDisplay = window.displayContent;
window.displayContent = function() {
    if (originalDisplay) originalDisplay();
    setTimeout(() => {
        const content = document.getElementById('content');
        if (!content) return;
        const html = renderContinueWatching();
        if (html) {
            const old = document.getElementById('continue-watching');
            if (old) old.remove();
            const first = content.querySelector('.category-section');
            if (first) first.insertAdjacentHTML('beforebegin', html);
            else content.insertAdjacentHTML('afterbegin', html);
        }
    }, 300);
};

console.log('✅ PLAYER CORRIGIDO');
