// ============================================
// PIRATAFLIX - SISTEMA COMPLETO
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
            console.error('Erro ao carregar progressos:', e);
            return {};
        }
    },
    
    save(videoData) {
        if (!videoData.videoId || !videoData.itemId || videoData.currentTime < 10) return;
        
        const progressos = this.getAll();
        const now = Date.now();
        
        progressos[videoData.videoId] = {
            ...videoData,
            timestamp: now,
            progress: videoData.duration > 0 
                ? Math.round((videoData.currentTime / videoData.duration) * 100) 
                : 0
        };
        
        // Limpar antigos (30 dias)
        const trintaDias = 30 * 24 * 60 * 60 * 1000;
        Object.keys(progressos).forEach(key => {
            if (now - progressos[key].timestamp > trintaDias) {
                delete progressos[key];
            }
        });
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(progressos));
        console.log('💾 Progresso salvo:', videoData.videoId, Math.floor(videoData.currentTime) + 's');
    },
    
    get(videoId) {
        const progressos = this.getAll();
        return progressos[videoId] || null;
    },
    
    remove(videoId) {
        const progressos = this.getAll();
        if (progressos[videoId]) {
            delete progressos[videoId];
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(progressos));
            console.log('🗑️ Progresso removido:', videoId);
        }
    },
    
    getWatchingList() {
        const progressos = this.getAll();
        
        // Agrupar por série (apenas o mais recente de cada)
        const latestPerSeries = {};
        Object.values(progressos).forEach(item => {
            if (!latestPerSeries[item.itemId] || item.timestamp > latestPerSeries[item.itemId].timestamp) {
                latestPerSeries[item.itemId] = item;
            }
        });
        
        return Object.values(latestPerSeries)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 20);
    }
};

// ============================================
// FUNÇÕES DE RENDERIZAÇÃO
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
        
        const progressPercent = item.progress || 0;
        
        html += `
        <div class="item-card continue-card" onclick="resumeFromContinueWatching('${item.itemId}', '${item.category}', ${item.episodeIndex})">
            <img src="${item.poster || 'assets/capas/default.jpg'}" 
                 alt="${item.seriesTitle || item.title}" 
                 class="item-poster"
                 onerror="this.onerror=null; this.src='assets/capas/default.jpg';">
            <div class="item-info">
                <div class="item-title">${item.seriesTitle || item.title}</div>
                <div class="item-meta" style="display: flex; flex-direction: column; gap: 5px;">
                    <span>${item.season ? `T${item.season} ` : ''}E${item.episode} • ${remainingFormatted} restantes</span>
                    <div class="progress-bar" style="width: 100%; height: 4px; background: #333; border-radius: 2px; margin-top: 5px;">
                        <div style="width: ${progressPercent}%; height: 100%; background: #e50914; border-radius: 2px;"></div>
                    </div>
                </div>
            </div>
        </div>`;
    });
    
    html += `</div></section>`;
    return html;
}

function resumeFromContinueWatching(itemId, category, episodeIndex) {
    if (!window.vodData) {
        console.error('❌ vodData não disponível');
        return;
    }
    
    const items = window.vodData[category];
    if (!items) return;
    
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    // Encontrar URL do episódio
    let url = '';
    let title = '';
    
    if (item.episodes && item.episodes[episodeIndex]) {
        url = item.episodes[episodeIndex].url;
        title = item.episodes[episodeIndex].title;
    } else if (item.seasons) {
        let episodeCounter = 0;
        for (const season of item.seasons) {
            for (const ep of season.episodes) {
                if (episodeCounter === episodeIndex) {
                    url = ep.url;
                    title = ep.title;
                    break;
                }
                episodeCounter++;
            }
            if (url) break;
        }
    }
    
    if (url) {
        playVideo(itemId, category, episodeIndex);
    }
}

// ============================================
// CRIAÇÃO DO MODAL
// ============================================

(function criarModal() {
    if (document.getElementById('modernPlayerModal')) return;
    
    const modal = document.createElement('div');
    modal.id = 'modernPlayerModal';
    modal.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:9999;justify-content:center;align-items:center;';
    modal.innerHTML = `
        <div style="width:90%;max-width:1200px;max-height:90vh;background:#000;border-radius:10px;overflow:hidden;position:relative;">
            <button id="closeModernPlayer" style="position:absolute;top:15px;right:15px;background:rgba(255,255,255,0.1);border:none;color:white;width:40px;height:40px;border-radius:50%;font-size:20px;cursor:pointer;z-index:10000;">&times;</button>
            <div id="modern-player-container" style="width:100%;height:70vh;background:#000;"></div>
            <div style="padding:20px;color:white;">
                <h3 id="modern-player-title"></h3>
                <p id="modern-player-info"></p>
                <div id="next-episode-container"></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('closeModernPlayer').onclick = () => {
        modal.style.display = 'none';
        const video = document.querySelector('#modern-player-container video');
        if (video) video.pause();
    };
    
    console.log('✅ Modal criado');
})();

// ============================================
// FUNÇÃO PRINCIPAL DE REPRODUÇÃO
// ============================================

let currentPlayer = null;
let currentSaveInterval = null;

function playVideo(itemId, category, episodeIndex = 0) {
    console.log('🎬 playVideo', { itemId, category, episodeIndex });
    
    if (!window.vodData || !window.vodData[category]) {
        alert('Dados não carregados');
        return;
    }
    
    const item = window.vodData[category].find(i => i.id === itemId);
    if (!item) {
        alert('Item não encontrado');
        return;
    }
    
    // Encontrar URL e título
    let url = '';
    let title = '';
    let episodeList = [];
    
    if (item.episodes && item.episodes.length > 0) {
        episodeList = item.episodes;
        if (episodeList[episodeIndex]) {
            url = episodeList[episodeIndex].url;
            title = episodeList[episodeIndex].title;
        }
    } else if (item.seasons) {
        episodeList = [];
        item.seasons.forEach(season => {
            if (season.episodes) {
                episodeList = episodeList.concat(season.episodes);
            }
        });
        if (episodeList[episodeIndex]) {
            url = episodeList[episodeIndex].url;
            title = episodeList[episodeIndex].title;
        }
    }
    
    if (!url) {
        alert('URL não encontrada');
        return;
    }
    
    // Reproduzir
    playWithModernPlayer(url, `${item.title} - ${title}`, '', itemId, category, episodeIndex, episodeList);
}

window.playVideo = playVideo;

// ============================================
// PLAYER PRINCIPAL
// ============================================

window.playWithModernPlayer = function(url, title, info = '', itemId = null, category = null, episodeIndex = 0, episodeList = []) {
    console.log('🎬 Reproduzindo:', title);
    
    const modal = document.getElementById('modernPlayerModal');
    if (!modal) {
        window.open(url, '_blank');
        return;
    }
    
    modal.style.display = 'flex';
    
    const container = document.getElementById('modern-player-container');
    container.innerHTML = `
        <video controls autoplay style="width:100%;height:100%;background:#000;" id="mainVideo">
            <source src="${url}" type="video/mp4">
            <source src="${url}" type="application/x-mpegURL">
        </video>
    `;
    
    const video = document.getElementById('mainVideo');
    document.getElementById('modern-player-title').textContent = title;
    document.getElementById('modern-player-info').textContent = info || `Episódio ${episodeIndex + 1} de ${episodeList.length}`;
    
    // Botão próximo episódio
    const nextContainer = document.getElementById('next-episode-container');
    nextContainer.innerHTML = '';
    
    if (episodeList.length > 0 && episodeIndex < episodeList.length - 1) {
        const nextBtn = document.createElement('button');
        nextBtn.textContent = '⏭️ Próximo Episódio';
        nextBtn.style.cssText = 'background:#e50914;color:white;border:none;padding:10px 20px;border-radius:4px;cursor:pointer;margin-top:10px;';
        nextBtn.onclick = () => {
            playVideo(itemId, category, episodeIndex + 1);
        };
        nextContainer.appendChild(nextBtn);
    }
    
    // Progresso
    const videoId = `${itemId}_${episodeIndex}`;
    const savedProgress = ContinueWatching.get(videoId);
    
    if (savedProgress && savedProgress.currentTime > 5) {
        video.addEventListener('loadedmetadata', () => {
            video.currentTime = savedProgress.currentTime;
            showResumeMessage(savedProgress.currentTime);
        });
    }
    
    // Limpar intervalo anterior
    if (currentSaveInterval) clearInterval(currentSaveInterval);
    
    // Salvar progresso
    currentSaveInterval = setInterval(() => {
        if (video.duration && video.currentTime > 10) {
            ContinueWatching.save({
                videoId, itemId, category, episodeIndex,
                title, seriesTitle: title.split(' - ')[0],
                episode: episodeIndex + 1,
                currentTime: video.currentTime,
                duration: video.duration,
                url, poster: item?.poster || ''
            });
        }
    }, 5000);
    
    video.addEventListener('ended', () => {
        ContinueWatching.remove(videoId);
        clearInterval(currentSaveInterval);
        
        // Avançar para próximo automaticamente
        if (episodeList.length > 0 && episodeIndex < episodeList.length - 1) {
            setTimeout(() => {
                playVideo(itemId, category, episodeIndex + 1);
            }, 2000);
        }
    });
};

function showResumeMessage(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    
    const msg = document.createElement('div');
    msg.textContent = `⏯️ Retomando de ${minutes}:${secs}`;
    msg.style.cssText = `
        position:absolute;top:80px;left:20px;background:rgba(229,9,20,0.9);
        color:white;padding:8px 16px;border-radius:4px;z-index:10000;
        animation:fadeOut 3s forwards;
    `;
    
    const container = document.getElementById('modern-player-container');
    container.appendChild(msg);
    setTimeout(() => msg.remove(), 3000);
}

// ============================================
// INJEÇÃO NO DISPLAY CONTENT
// ============================================

// Guardar função original
const originalDisplayContent = window.displayContent;

// Substituir
window.displayContent = function() {
    if (originalDisplayContent) {
        originalDisplayContent();
    }
    
    setTimeout(() => {
        const contentDiv = document.getElementById('content');
        if (!contentDiv) return;
        
        const continueHtml = renderContinueWatching();
        if (continueHtml) {
            const existing = document.getElementById('continue-watching');
            if (existing) existing.remove();
            contentDiv.insertAdjacentHTML('afterbegin', continueHtml);
            console.log('✅ Seção Continue Watching adicionada');
        }
    }, 500);
};

// ============================================
// CORREÇÃO DOS CARDS EXISTENTES
// ============================================

function fixCardClicks() {
    document.querySelectorAll('.episode-item, .item-card').forEach(el => {
        const onclick = el.getAttribute('onclick');
        if (onclick && onclick.includes('playEpisode')) {
            const match = onclick.match(/playEpisode\('([^']+)', '([^']+)', '([^']+)', '([^']+)', (\d+)\)/);
            if (match) {
                const [_, url, title, itemId, category, index] = match;
                el.setAttribute('onclick', `playVideo('${itemId}', '${category}', ${index})`);
            }
        }
    });
}

// ============================================
// INICIALIZAÇÃO
// ============================================

// Capturar vodData
if (!window.vodData) {
    const checkData = setInterval(() => {
        if (window.vodData || typeof vodData !== 'undefined') {
            window.vodData = window.vodData || vodData;
            console.log('✅ vodData capturado');
            clearInterval(checkData);
            fixCardClicks();
        }
    }, 100);
}

// Adicionar CSS para animações
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        0% { opacity: 1; }
        70% { opacity: 1; }
        100% { opacity: 0; }
    }
    .continue-card {
        position: relative;
        border: 2px solid transparent;
        transition: all 0.3s;
        cursor: pointer;
    }
    .continue-card:hover {
        border-color: #e50914;
        transform: scale(1.1) translateY(-10px);
        z-index: 20;
    }
    #continue-watching {
        animation: slideIn 0.5s ease;
    }
    @keyframes slideIn {
        from { opacity: 0; transform: translateY(-20px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(style);

console.log('✅ Sistema PIRATAFLIX completo instalado!');
