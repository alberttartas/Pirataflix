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
        
        // Agrupar por itemId e pegar apenas o mais recente de cada
        const latestPerItem = {};
        
        Object.values(progressos).forEach(item => {
            const itemId = item.itemId;
            
            if (!latestPerItem[itemId] || item.timestamp > latestPerItem[itemId].timestamp) {
                latestPerItem[itemId] = item;
            }
        });
        
        return Object.values(latestPerItem)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 20);
    }
};

// ============================================
// FUNÇÃO PARA RENDERIZAR SEÇÃO NA PÁGINA INICIAL
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

// ============================================
// FUNÇÃO PARA RETOMAR DA SEÇÃO "CONTINUAR ASSISTINDO"
// ============================================

function resumeFromContinueWatching(itemId, category, episodeIndex) {
    if (!window.vodData) {
        console.error('❌ vodData não disponível');
        return;
    }
    
    const items = window.vodData[category];
    if (!items) return;
    
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
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
    
    if (url && window.playWithModernPlayer) {
        window.playWithModernPlayer(
            url, 
            `${item.title} - ${title}`, 
            `${category} • Episódio ${episodeIndex + 1}`,
            itemId,
            category,
            episodeIndex
        );
    }
}

// ============================================
// PLAYER SIMPLES E ROBUSTO - DEFINIDO IMEDIATAMENTE
// ============================================

// CRIAR MODAL ASSIM QUE O SCRIPT CARREGA
(function() {
    // Criar modal se não existir
    if (!document.getElementById('modernPlayerModal')) {
        const modalHTML = `
            <div id="modernPlayerModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); z-index: 9999; justify-content: center; align-items: center;">
                <div style="width: 90%; max-width: 1200px; max-height: 90vh; background: #000; border-radius: 10px; overflow: hidden; position: relative;">
                    <button id="closeModernPlayer" style="position: absolute; top: 15px; right: 15px; background: rgba(255,255,255,0.1); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 20px; cursor: pointer; z-index: 10000; display: flex; align-items: center; justify-content: center;">&times;</button>
                    <div id="modern-player-container" style="width: 100%; height: 70vh; background: #000;"></div>
                    <div style="padding: 20px; color: white;">
                        <h3 id="modern-player-title" style="margin: 0 0 10px 0;"></h3>
                        <p id="modern-player-info" style="margin: 0; opacity: 0.8;"></p>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
})();

// DEFINIR FUNÇÃO PLAYER - GARANTE QUE EXISTE DESDE O INÍCIO
window.playWithModernPlayer = function(url, title, info = '', itemId = null, category = null, episodeIndex = 0) {
    console.log('🎬 PLAYER CHAMADO:', { url, title, itemId, category, episodeIndex });
    
    // OBTER MODAL
    let modal = document.getElementById('modernPlayerModal');
    
    // SE MODAL NÃO EXISTIR, CRIAR AGORA
    if (!modal) {
        console.warn('⚠️ Modal não encontrado, criando agora...');
        const modalHTML = `
            <div id="modernPlayerModal" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); z-index: 9999; justify-content: center; align-items: center;">
                <div style="width: 90%; max-width: 1200px; max-height: 90vh; background: #000; border-radius: 10px; overflow: hidden; position: relative;">
                    <button id="closeModernPlayer" style="position: absolute; top: 15px; right: 15px; background: rgba(255,255,255,0.1); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 20px; cursor: pointer; z-index: 10000; display: flex; align-items: center; justify-content: center;">&times;</button>
                    <div id="modern-player-container" style="width: 100%; height: 70vh; background: #000;"></div>
                    <div style="padding: 20px; color: white;">
                        <h3 id="modern-player-title" style="margin: 0 0 10px 0;">${title}</h3>
                        <p id="modern-player-info" style="margin: 0; opacity: 0.8;">${info}</p>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('modernPlayerModal');
    }
    
    // MOSTRAR MODAL
    modal.style.display = 'flex';
    
    // CONFIGURAR BOTÃO FECHAR
    const closeBtn = document.getElementById('closeModernPlayer');
    if (closeBtn) {
        closeBtn.onclick = function() {
            modal.style.display = 'none';
            const video = document.getElementById('modal-video');
            if (video) video.pause();
        };
    }
    
    // CONTAINER DO VÍDEO
    const container = document.getElementById('modern-player-container');
    if (!container) {
        console.error('❌ Container não encontrado');
        window.open(url, '_blank');
        return;
    }
    
    // ID ÚNICO PARA O VÍDEO
    const videoId = `${itemId}_${episodeIndex}`;
    const savedProgress = ContinueWatching.get(videoId);
    
    // CRIAR VÍDEO
    container.innerHTML = `
        <video id="modal-video" controls autoplay playsinline style="width: 100%; height: 100%; background: #000;" src="${url}"></video>
    `;
    
    const video = document.getElementById('modal-video');
    
    // RETOMAR PROGRESSO
    if (savedProgress && savedProgress.currentTime > 5) {
        video.addEventListener('loadedmetadata', function() {
            video.currentTime = savedProgress.currentTime;
            
            // MOSTRAR MENSAGEM
            const minutes = Math.floor(savedProgress.currentTime / 60);
            const seconds = Math.floor(savedProgress.currentTime % 60).toString().padStart(2, '0');
            
            const msg = document.createElement('div');
            msg.innerHTML = `⏯️ Retomando de ${minutes}:${seconds}`;
            msg.style.cssText = `
                position: absolute;
                top: 80px;
                left: 20px;
                background: rgba(229, 9, 20, 0.9);
                color: white;
                padding: 8px 16px;
                border-radius: 4px;
                z-index: 10000;
                font-size: 14px;
                font-weight: bold;
                animation: fadeOut 3s forwards;
            `;
            container.appendChild(msg);
            setTimeout(() => msg.remove(), 3000);
        });
    }
    
    // SALVAR PROGRESSO
    let saveInterval = setInterval(() => {
        if (video.duration && video.currentTime > 10) {
            ContinueWatching.save({
                videoId: videoId,
                itemId: itemId,
                category: category,
                episodeIndex: episodeIndex,
                title: title,
                seriesTitle: title.split(' - ')[0],
                season: 1,
                episode: episodeIndex + 1,
                currentTime: video.currentTime,
                duration: video.duration,
                url: url,
                poster: ''
            });
        }
    }, 5000);
    
    // QUANDO O VÍDEO TERMINAR
    video.addEventListener('ended', function() {
        ContinueWatching.remove(videoId);
        clearInterval(saveInterval);
        
        // TENTAR PRÓXIMO EPISÓDIO
        if (itemId && category && window.vodData) {
            const items = window.vodData[category];
            const item = items?.find(i => i.id === itemId);
            
            if (item) {
                let episodeList = item.episodes || [];
                
                if (!episodeList.length && item.seasons) {
                    item.seasons.forEach(s => {
                        if (s.episodes) episodeList = episodeList.concat(s.episodes);
                    });
                }
                
                if (episodeIndex + 1 < episodeList.length) {
                    setTimeout(() => {
                        const nextEp = episodeList[episodeIndex + 1];
                        window.playWithModernPlayer(
                            nextEp.url,
                            `${item.title} - ${nextEp.title}`,
                            `${category} • Episódio ${episodeIndex + 2}`,
                            itemId,
                            category,
                            episodeIndex + 1
                        );
                    }, 2000);
                }
            }
        }
    });
    
    // LIMPAR INTERVALO AO FECHAR
    if (closeBtn) {
        const originalClick = closeBtn.onclick;
        closeBtn.onclick = function() {
            clearInterval(saveInterval);
            modal.style.display = 'none';
            video.pause();
        };
    }
    
    // ATUALIZAR TÍTULO
    document.getElementById('modern-player-title').textContent = title;
    document.getElementById('modern-player-info').textContent = info;
};

// ============================================
// INJEÇÃO DA SEÇÃO NO HTML PRINCIPAL
// ============================================

const originalDisplayContent = window.displayContent;

window.displayContent = function() {
    if (originalDisplayContent) {
        originalDisplayContent();
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
    }
};

// ============================================
// ADICIONAR CSS
// ============================================

(function() {
    if (document.querySelector('#player-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'player-styles';
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
            scroll-margin-top: 80px;
            animation: slideIn 0.5s ease;
        }
        
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .resume-message {
            pointer-events: none;
            z-index: 10000;
        }
    `;
    
    document.head.appendChild(style);
})();

// ============================================
// INICIALIZAÇÃO
// ============================================

setTimeout(() => {
    if (!window.vodData && typeof vodData !== 'undefined') {
        window.vodData = vodData;
    }
    console.log('✅ Sistema de player carregado com sucesso!');
}, 500);

console.log('🚀 Player pronto para uso!');
