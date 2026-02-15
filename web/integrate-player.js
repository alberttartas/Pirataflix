// ============================================
// PLAYER COMPLETO - VERSÃO FINAL
// ============================================

// Garantir que não há função anterior
window.playWithModernPlayer = null;

// ============================================
// SISTEMA DE CONTINUAR ASSISTINDO
// ============================================

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
        all[videoData.videoId] = {
            ...videoData,
            timestamp: Date.now(),
            progress: videoData.duration ? Math.round((videoData.currentTime / videoData.duration) * 100) : 0
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
        console.log('💾 Progresso salvo:', videoData.videoId);
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

window.resumeFromContinueWatching = function(itemId, category, episodeIndex) {
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
};

// ============================================
// CRIAR MODAL IMEDIATAMENTE
// ============================================

(function() {
    if (!document.getElementById('modernPlayerModal')) {
        console.log('🎨 Criando modal...');
        
        const modal = document.createElement('div');
        modal.id = 'modernPlayerModal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.95);
            z-index: 9999;
            justify-content: center;
            align-items: center;
        `;
        
        modal.innerHTML = `
            <div style="width: 90%; max-width: 1200px; background: #000; border-radius: 10px; overflow: hidden; position: relative;">
                <button id="closeModernPlayer" style="position: absolute; top: 15px; right: 15px; background: rgba(255,255,255,0.1); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 20px; cursor: pointer; z-index: 10000;">&times;</button>
                <div id="modern-player-container" style="width: 100%; height: 70vh; background: #000;"></div>
                <div style="padding: 20px; color: white;">
                    <h3 id="modern-player-title"></h3>
                    <p id="modern-player-info"></p>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
})();

// ============================================
// FUNÇÃO PRINCIPAL DO PLAYER
// ============================================

window.playWithModernPlayer = function(url, title, info = '', itemId = null, category = null, episodeIndex = 0) {
    console.log('🎬 PLAYER PRINCIPAL ATIVADO');
    
    const modal = document.getElementById('modernPlayerModal');
    if (!modal) {
        window.open(url, '_blank');
        return;
    }
    
    // Mostrar modal
    modal.style.display = 'flex';
    
    const container = document.getElementById('modern-player-container');
    const videoId = `${itemId}_${episodeIndex}`;
    const saved = ContinueWatching.get(videoId);
    
    // Criar vídeo
    container.innerHTML = `<video id="current-video" controls autoplay style="width:100%;height:100%;background:#000;" src="${url}"></video>`;
    
    const video = document.getElementById('current-video');
    const closeBtn = document.getElementById('closeModernPlayer');
    
    // Buscar item para poster (se disponível)
    let currentItem = null;
    if (itemId && category && window.vodData?.[category]) {
        currentItem = window.vodData[category].find(i => i.id === itemId);
    }
    
    // Retomar progresso
    if (saved?.currentTime > 5) {
        video.addEventListener('loadedmetadata', () => {
            video.currentTime = saved.currentTime;
            
            // Mostrar mensagem
            const minutes = Math.floor(saved.currentTime / 60);
            const seconds = Math.floor(saved.currentTime % 60).toString().padStart(2, '0');
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
            ContinueWatching.save({
                videoId, itemId, category, episodeIndex,
                title, seriesTitle: title.split(' - ')[0],
                season: 1,
                episode: episodeIndex + 1,
                currentTime: video.currentTime,
                duration: video.duration,
                url, poster: currentItem?.poster || ''
            });
        }
    }, 5000);
    
    // Fechar
    const close = () => {
        clearInterval(interval);
        modal.style.display = 'none';
        video.pause();
    };
    
    closeBtn.onclick = close;
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') close();
    }, { once: true });
    
    video.addEventListener('ended', () => {
        ContinueWatching.remove(videoId);
        clearInterval(interval);
    });
    
    // Títulos
    document.getElementById('modern-player-title').textContent = title;
    document.getElementById('modern-player-info').textContent = info;
};

// ============================================
// INJEÇÃO DA SEÇÃO NO HTML PRINCIPAL
// ============================================

// Guardar referência à função displayContent original
const originalDisplayContent = window.displayContent;

// Substituir displayContent para incluir "Continuar Assistindo"
window.displayContent = function() {
    if (originalDisplayContent) {
        originalDisplayContent();
        setTimeout(() => {
            const contentDiv = document.getElementById('content');
            if (!contentDiv) return;
            
            const continueHtml = renderContinueWatching();
            if (continueHtml) {
                // Remover seção antiga se existir
                const existing = document.getElementById('continue-watching');
                if (existing) existing.remove();
                
                // Inserir após o header ou no início
                const firstSection = contentDiv.querySelector('.category-section');
                if (firstSection) {
                    firstSection.insertAdjacentHTML('beforebegin', continueHtml);
                } else {
                    contentDiv.insertAdjacentHTML('afterbegin', continueHtml);
                }
                console.log('✅ Seção Continuar Assistindo adicionada');
            }
        }, 200);
    }
};

// ============================================
// CSS ADICIONAL
// ============================================

(function() {
    if (!document.querySelector('#player-styles')) {
        const style = document.createElement('style');
        style.id = 'player-styles';
        style.textContent = `
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
    }
})();

console.log('✅ PLAYER COMPLETO CARREGADO COM SUCESSO!');
