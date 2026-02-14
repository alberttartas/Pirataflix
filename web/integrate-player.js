// ============================================
// PIRATAFLIX - PLAYER INTEGRATION VERSÃO FINAL
// ============================================

console.log('🔥 PIRATAFLIX PLAYER INICIANDO...');

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
        const latestPerSeries = {};
        Object.values(progressos).forEach(item => {
            if (!latestPerSeries[item.itemId] || item.timestamp > latestPerSeries[item.itemId].timestamp) {
                latestPerSeries[item.itemId] = item;
            }
        });
        return Object.values(latestPerSeries).sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
    }
};

// ============================================
// FUNÇÕES DE RENDERIZAÇÃO
// ============================================

function renderContinueWatching() {
    const list = ContinueWatching.getWatchingList();
    if (!list.length) return '';
    
    let html = `<section class="category-section" id="continue-watching"><h2 class="category-title" style="display:flex;align-items:center;gap:10px"><span style="color:#e50914">▶️</span> Continuar Assistindo</h2><div class="items-grid">`;
    
    list.forEach(item => {
        const remaining = Math.floor((item.duration - item.currentTime) / 60);
        html += `
        <div class="item-card continue-card" onclick="window.playVideo('${item.itemId}', '${item.category}', ${item.episodeIndex})">
            <img src="${item.poster || 'assets/capas/default.jpg'}" class="item-poster">
            <div class="item-info">
                <div class="item-title">${item.seriesTitle || item.title}</div>
                <div class="item-meta">${remaining}min restantes</div>
                <div class="progress-bar" style="width:100%;height:4px;background:#333;margin-top:8px"><div style="width:${item.progress}%;height:100%;background:#e50914"></div></div>
            </div>
        </div>`;
    });
    
    return html + '</div></section>';
}

// ============================================
// PLAYER PRINCIPAL - VERSÃO SIMPLIFICADA
// ============================================

// Criar modal imediatamente
(function criarModalAgora() {
    if (document.getElementById('modernPlayerModal')) return;
    
    const modal = document.createElement('div');
    modal.id = 'modernPlayerModal';
    modal.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:9999;justify-content:center;align-items:center;';
    modal.innerHTML = `
        <div style="width:90%;max-width:1200px;max-height:90vh;background:#000;border-radius:10px;overflow:hidden;position:relative;">
            <button id="closeModernPlayer" style="position:absolute;top:15px;right:15px;background:rgba(255,255,255,0.1);border:none;color:white;width:40px;height:40px;border-radius:50%;font-size:20px;cursor:pointer;z-index:10000;">&times;</button>
            <div id="modern-player-container" style="width:100%;height:70vh;"></div>
            <div style="padding:20px;color:white;"><h3 id="modern-player-title"></h3><p id="modern-player-info"></p></div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('closeModernPlayer').onclick = () => {
        modal.style.display = 'none';
        const video = document.querySelector('#modern-player-container video');
        if (video) video.pause();
    };
    
    console.log('✅ Modal criado automaticamente');
})();

// ============================================
// FUNÇÃO PRINCIPAL DE REPRODUÇÃO
// ============================================

window.playVideo = function(itemId, category, episodeIndex = 0) {
    console.log('🎬 playVideo chamado', { itemId, category, episodeIndex });
    
    // Buscar dados
    if (!window.vodData || !window.vodData[category]) {
        alert('Dados não carregados');
        return;
    }
    
    const item = window.vodData[category].find(i => i.id === itemId);
    if (!item) {
        alert('Item não encontrado');
        return;
    }
    
    // Encontrar URL
    let url = '';
    let title = '';
    
    if (item.episodes && item.episodes[episodeIndex]) {
        url = item.episodes[episodeIndex].url;
        title = item.episodes[episodeIndex].title;
    } else if (item.seasons) {
        let count = 0;
        for (const s of item.seasons) {
            for (const e of s.episodes) {
                if (count === episodeIndex) {
                    url = e.url;
                    title = e.title;
                    break;
                }
                count++;
            }
        }
    }
    
    if (!url) {
        alert('URL não encontrada');
        return;
    }
    
    // Reproduzir
    window.playWithModernPlayer(url, `${item.title} - ${title}`, '', itemId, category, episodeIndex);
};

// ============================================
// FUNÇÃO PRINCIPAL DO PLAYER
// ============================================

window.playWithModernPlayer = function(url, title, info = '', itemId = null, category = null, episodeIndex = 0) {
    console.log('🎬 playWithModernPlayer', { url, title });
    
    const modal = document.getElementById('modernPlayerModal');
    if (!modal) {
        console.error('❌ Modal não encontrado!');
        window.open(url, '_blank');
        return;
    }
    
    modal.style.display = 'flex';
    
    const container = document.getElementById('modern-player-container');
    if (!container) {
        window.open(url, '_blank');
        return;
    }
    
    // Criar player de vídeo simples
    container.innerHTML = `
        <video controls autoplay style="width:100%;height:100%;background:#000;">
            <source src="${url}" type="video/mp4">
            <source src="${url}" type="application/x-mpegURL">
            Seu navegador não suporta vídeo.
        </video>
    `;
    
    const video = container.querySelector('video');
    
    // Título
    document.getElementById('modern-player-title').textContent = title;
    document.getElementById('modern-player-info').textContent = info || `Reproduzindo...`;
    
    // Salvar progresso
    const videoId = `${itemId}_${episodeIndex}`;
    
    video.addEventListener('timeupdate', () => {
        if (video.currentTime > 10) {
            ContinueWatching.save({
                videoId, itemId, category, episodeIndex,
                title, seriesTitle: title.split(' - ')[0],
                episode: episodeIndex + 1,
                currentTime: video.currentTime,
                duration: video.duration,
                url, poster: item?.poster || ''
            });
        }
    });
    
    video.addEventListener('ended', () => {
        ContinueWatching.remove(videoId);
    });
};

// ============================================
// INJEÇÃO NO DISPLAY CONTENT
// ============================================

// Guardar função original
const originalDisplay = window.displayContent;

// Substituir
window.displayContent = function() {
    if (originalDisplay) originalDisplay();
    
    setTimeout(() => {
        const content = document.getElementById('content');
        if (!content) return;
        
        const html = renderContinueWatching();
        if (html) {
            const existing = document.getElementById('continue-watching');
            if (existing) existing.remove();
            content.insertAdjacentHTML('afterbegin', html);
            console.log('✅ Seção Continue Watching adicionada');
        }
    }, 500);
};

// ============================================
// INICIALIZAÇÃO
// ============================================

// Garantir que vodData seja capturado
if (!window.vodData) {
    const checkData = setInterval(() => {
        if (window.vodData || typeof vodData !== 'undefined') {
            window.vodData = window.vodData || vodData;
            console.log('✅ vodData capturado');
            clearInterval(checkData);
        }
    }, 100);
}

console.log('✅ Sistema PIRATAFLIX pronto!');
