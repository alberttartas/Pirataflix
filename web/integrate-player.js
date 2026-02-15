// ============================================
// PLAYER COMPLETO - VERSÃO FINAL CORRIGIDA
// ============================================

// CRIAR MODAL PRIMEIRO
(function() {
    if (!document.getElementById('modernPlayerModal')) {
        console.log('🎨 CRIANDO MODAL IMEDIATAMENTE...');
        const modal = document.createElement('div');
        modal.id = 'modernPlayerModal';
        modal.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:9999;justify-content:center;align-items:center;';
        modal.innerHTML = `
            <div style="width:90%;max-width:1200px;background:#000;border-radius:10px;overflow:hidden;position:relative;">
                <button id="closeModernPlayer" style="position:absolute;top:15px;right:15px;background:#e50914;border:none;color:white;width:40px;height:40px;border-radius:50%;font-size:20px;cursor:pointer;z-index:10001;">&times;</button>
                <div id="modern-player-container" style="width:100%;height:70vh;background:#000;position:relative;"></div>
                <div style="padding:20px;color:white;">
                    <h3 id="modern-player-title"></h3>
                    <p id="modern-player-info"></p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        console.log('✅ MODAL CRIADO COM SUCESSO!');
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

// RENDERIZAR SEÇÃO
function renderContinueWatching() {
    const list = ContinueWatching.getWatchingList();
    console.log('📋 Lista de continuar assistindo:', list.length, 'itens');
    
    if (list.length === 0) {
        return '';
    }
    
    let html = `
    <section class="category-section" id="continue-watching">
        <h2 class="category-title" style="display: flex; align-items: center; gap: 10px;">
            <span style="color: #e50914; font-size: 1.8rem;">▶️</span> Continuar Assistindo
        </h2>
        <div class="items-grid">`;
    
    list.forEach(item => {
        const remaining = item.duration - item.currentTime;
        const time = remaining > 3600 
            ? `${Math.floor(remaining/3600)}h ${Math.floor((remaining%3600)/60)}min`
            : `${Math.floor(remaining/60)}min`;
        
        // CORREÇÃO DAS CAPAS
        let nomeArquivo = 'default.jpg';
        if (item.poster) {
            const partes = item.poster.split('/');
            nomeArquivo = partes[partes.length - 1];
        }
        
        const urlCapa = `https://pirataflix-seven.vercel.app/assets/Capas/${nomeArquivo}`;
        
        html += `
        <div class="item-card continue-card" onclick="window.resumeFromContinue('${item.itemId}', '${item.category}', ${item.episodeIndex})">
            <img src="${urlCapa}" 
                 class="item-poster" 
                 onerror="this.onerror=null; this.src='https://pirataflix-seven.vercel.app/assets/Capas/default.jpg';">
            <div class="item-info">
                <div class="item-title">${item.seriesTitle || item.title}</div>
                <div class="item-meta">E${item.episode} • ${time}</div>
                <div style="width:100%;height:3px;background:#333;margin-top:5px;">
                    <div style="width:${item.progress}%;height:100%;background:#e50914;"></div>
                </div>
            </div>
        </div>`;
    });
    
    html += `</div></section>`;
    return html;
}

// FUNÇÃO PARA RETOMAR DO CONTINUE WATCHING
window.resumeFromContinue = function(itemId, category, episodeIndex) {
    console.log('▶️ Retomando:', itemId, category, episodeIndex);
    
    if (!window.vodData?.[category]) {
        console.error('❌ vodData não disponível');
        return;
    }
    
    const item = window.vodData[category].find(i => i.id === itemId);
    if (!item) {
        console.error('❌ Item não encontrado');
        return;
    }
    
    let url = '', title = '';
    
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
            if (url) break;
        }
    }
    
    if (url && window.playWithModernPlayer) {
        window.playWithModernPlayer(url, `${item.title} - ${title}`, `${category} • Ep ${episodeIndex+1}`, itemId, category, episodeIndex);
    } else {
        console.error('❌ URL não encontrada');
    }
};

// FUNÇÃO PRINCIPAL DO PLAYER
window.playWithModernPlayer = function(url, title, info = '', itemId = null, category = null, episodeIndex = 0) {
    console.log('🎬 PLAYER CHAMADO');
    
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
    
    // Limpar container anterior
    container.innerHTML = '';
    
    // Criar vídeo
    const video = document.createElement('video');
    video.id = 'current-video';
    video.controls = true;
    video.autoplay = true;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.background = '#000';
    video.src = url;
    
    container.appendChild(video);
    
    const closeBtn = document.getElementById('closeModernPlayer');
    
    // Retomar progresso
    if (saved?.currentTime > 5) {
        video.addEventListener('loadedmetadata', function onMetadata() {
            video.currentTime = saved.currentTime;
            video.removeEventListener('loadedmetadata', onMetadata);
            
            // Mensagem de retomada
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
                episode: episodeIndex + 1,
                currentTime: video.currentTime,
                duration: video.duration,
                url, poster: ''
            });
        }
    }, 5000);
    
    // FUNÇÃO PARA FECHAR
    const closePlayer = () => {
        clearInterval(interval);
        modal.style.display = 'none';
        video.pause();
        video.src = '';
        container.innerHTML = '';
    };
    
    // Evento do botão fechar
    closeBtn.onclick = closePlayer;
    
    // Evento de tecla ESC
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closePlayer();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    
    // Quando o vídeo terminar
    video.addEventListener('ended', () => {
        ContinueWatching.remove(videoId);
        clearInterval(interval);
    });
    
    // Títulos
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
            if (first) {
                first.insertAdjacentHTML('beforebegin', html);
            } else {
                content.insertAdjacentHTML('afterbegin', html);
            }
            console.log('✅ Seção Continuar Assistindo adicionada');
        }
    }, 300);
};

// CSS
(function() {
    if (!document.querySelector('#player-styles')) {
        const style = document.createElement('style');
        style.id = 'player-styles';
        style.textContent = `
            .continue-card { cursor: pointer; transition: 0.3s; }
            .continue-card:hover { transform: scale(1.05); border: 2px solid #e50914; }
            #continue-watching { animation: slide 0.5s; }
            @keyframes slide {
                from { opacity: 0; transform: translateY(-20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }
})();

console.log('✅ PLAYER COMPLETO CARREGADO');
