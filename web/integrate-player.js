// ============================================
// PLAYER COMPLETO - TODAS AS FUNÇÕES
// ============================================

// GARANTIR QUE A FUNÇÃO DE GARANTIA NÃO BLOQUEIA
window.playWithModernPlayer = null;

// ============================================
// SISTEMA DE CONTINUAR ASSISTINDO
// ============================================

const ContinueWatching = {
    STORAGE_KEY: 'pirataflix_progressos',
    
    getAll() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    },
    
    save(videoData) {
        if (!videoData.videoId || !videoData.itemId || videoData.currentTime < 10) return;
        
        const progressos = this.getAll();
        progressos[videoData.videoId] = {
            ...videoData,
            timestamp: Date.now(),
            progress: videoData.duration > 0 ? Math.round((videoData.currentTime / videoData.duration) * 100) : 0
        };
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(progressos));
    },
    
    get(videoId) {
        return this.getAll()[videoId] || null;
    },
    
    remove(videoId) {
        const progressos = this.getAll();
        delete progressos[videoId];
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(progressos));
    },
    
    getWatchingList() {
        const progressos = this.getAll();
        const latestPerItem = {};
        
        Object.values(progressos).forEach(item => {
            if (!latestPerItem[item.itemId] || item.timestamp > latestPerItem[item.itemId].timestamp) {
                latestPerItem[item.itemId] = item;
            }
        });
        
        return Object.values(latestPerItem).sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
    }
};

// ============================================
// FUNÇÃO DE RENDERIZAÇÃO
// ============================================

function renderContinueWatching() {
    const watchingList = ContinueWatching.getWatchingList();
    if (watchingList.length === 0) return '';
    
    let html = `
    <section class="category-section" id="continue-watching">
        <h2 class="category-title" style="display: flex; align-items: center; gap: 10px;">
            <span style="color: #e50914; font-size: 1.8rem;">▶️</span> Continuar Assistindo
        </h2>
        <div class="items-grid">`;
    
    watchingList.forEach(item => {
        const remaining = item.duration - item.currentTime;
        const remainingFormatted = remaining > 3600 
            ? `${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}min`
            : `${Math.floor(remaining / 60)}min`;
        
        html += `
        <div class="item-card continue-card" onclick="resumeFromContinueWatching('${item.itemId}', '${item.category}', ${item.episodeIndex})">
            <img src="${item.poster || 'assets/capas/default.jpg'}" class="item-poster" onerror="this.src='assets/capas/default.jpg';">
            <div class="item-info">
                <div class="item-title">${item.seriesTitle || item.title}</div>
                <div class="item-meta">
                    <span>E${item.episode} • ${remainingFormatted} restantes</span>
                    <div class="progress-bar" style="width:100%;height:4px;background:#333;border-radius:2px;margin-top:5px;">
                        <div style="width:${item.progress || 0}%;height:100%;background:#e50914;border-radius:2px;"></div>
                    </div>
                </div>
            </div>
        </div>`;
    });
    
    html += `</div></section>`;
    return html;
}

function resumeFromContinueWatching(itemId, category, episodeIndex) {
    if (!window.vodData) return;
    
    const item = window.vodData[category]?.find(i => i.id === itemId);
    if (!item) return;
    
    let url = '';
    let title = '';
    
    if (item.episodes?.[episodeIndex]) {
        url = item.episodes[episodeIndex].url;
        title = item.episodes[episodeIndex].title;
    } else if (item.seasons) {
        let counter = 0;
        for (const season of item.seasons) {
            for (const ep of season.episodes) {
                if (counter === episodeIndex) {
                    url = ep.url;
                    title = ep.title;
                    break;
                }
                counter++;
            }
        }
    }
    
    if (url) window.playWithModernPlayer(url, `${item.title} - ${title}`, `${category} • Episódio ${episodeIndex + 1}`, itemId, category, episodeIndex);
}

// ============================================
// CRIAR MODAL
// ============================================

(function() {
    if (!document.getElementById('modernPlayerModal')) {
        const modal = document.createElement('div');
        modal.id = 'modernPlayerModal';
        modal.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:9999;justify-content:center;align-items:center;';
        modal.innerHTML = `
            <div style="width:90%;max-width:1200px;background:#000;border-radius:10px;overflow:hidden;position:relative;">
                <button id="closeModernPlayer" style="position:absolute;top:15px;right:15px;background:rgba(255,255,255,0.1);border:none;color:white;width:40px;height:40px;border-radius:50%;font-size:20px;cursor:pointer;z-index:10000;">&times;</button>
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

// ============================================
// FUNÇÃO PRINCIPAL DO PLAYER (VERSÃO COMPLETA)
// ============================================

window.playWithModernPlayer = function(url, title, info = '', itemId = null, category = null, episodeIndex = 0) {
    console.log('🎬 PLAYER COMPLETO:', title);
    
    const modal = document.getElementById('modernPlayerModal');
    if (!modal) {
        window.open(url, '_blank');
        return;
    }
    
    modal.style.display = 'flex';
    
    const container = document.getElementById('modern-player-container');
    const videoId = `${itemId}_${episodeIndex}`;
    const savedProgress = ContinueWatching.get(videoId);
    
    container.innerHTML = `<video id="current-video" controls autoplay style="width:100%;height:100%;background:#000;" src="${url}"></video>`;
    
    const video = document.getElementById('current-video');
    const closeBtn = document.getElementById('closeModernPlayer');
    
    if (savedProgress?.currentTime > 5) {
        video.addEventListener('loadedmetadata', () => {
            video.currentTime = savedProgress.currentTime;
        });
    }
    
    // Salvar progresso
    let saveInterval = setInterval(() => {
        if (video.duration && video.currentTime > 10) {
            ContinueWatching.save({
                videoId, itemId, category, episodeIndex,
                title, seriesTitle: title.split(' - ')[0],
                episode: episodeIndex + 1,
                currentTime: video.currentTime,
                duration: video.duration,
                url, poster: ''
            });
        }
    }, 5000);
    
    video.addEventListener('ended', () => {
        ContinueWatching.remove(videoId);
        clearInterval(saveInterval);
    });
    
    // Fechar
    closeBtn.onclick = function() {
        clearInterval(saveInterval);
        modal.style.display = 'none';
        video.pause();
    };
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            clearInterval(saveInterval);
            modal.style.display = 'none';
            video.pause();
        }
    });
    
    document.getElementById('modern-player-title').textContent = title;
    document.getElementById('modern-player-info').textContent = info;
};

// ============================================
// INJEÇÃO NO DISPLAY CONTENT
// ============================================

const originalDisplay = window.displayContent;
window.displayContent = function() {
    if (originalDisplay) originalDisplay();
    setTimeout(() => {
        const contentDiv = document.getElementById('content');
        if (!contentDiv) return;
        
        const continueHtml = renderContinueWatching();
        if (continueHtml) {
            const existing = document.getElementById('continue-watching');
            if (existing) existing.remove();
            
            const firstSection = contentDiv.querySelector('.category-section');
            if (firstSection) {
                firstSection.insertAdjacentHTML('beforebegin', continueHtml);
            } else {
                contentDiv.insertAdjacentHTML('afterbegin', continueHtml);
            }
        }
    }, 200);
};

// ============================================
// CSS
// ============================================

(function() {
    if (!document.querySelector('#player-styles')) {
        const style = document.createElement('style');
        style.id = 'player-styles';
        style.textContent = `
            .continue-card { cursor: pointer; transition: all 0.3s; }
            .continue-card:hover { transform: scale(1.05); border: 2px solid #e50914; }
            #continue-watching { animation: slideIn 0.5s ease; }
            @keyframes slideIn {
                from { opacity: 0; transform: translateY(-20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }
})();

console.log('✅ PLAYER COMPLETO CARREGADO!');
