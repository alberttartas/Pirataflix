// ============================================
// PLAYER COMPLETO - VERSÃO FINAL E TESTADA
// ============================================

// ============================================
// CRIAR MODAL PRIMEIRO (ANTES DE TUDO)
// ============================================

(function() {
    // Verificar se já existe
    if (document.getElementById('modernPlayerModal')) {
        console.log('✅ Modal já existe');
        return;
    }
    
    console.log('🎨 CRIANDO MODAL IMEDIATAMENTE...');
    
    // Criar modal e já deixar pronto
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
    console.log('✅ MODAL CRIADO COM SUCESSO!');
})();

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
// FUNÇÃO PARA RENDERIZAR SEÇÃO
// ============================================

function renderContinueWatching() {
    const list = ContinueWatching.getWatchingList();
    if (list.length === 0) return '';
    
    let html = `
    <section class="category-section" id="continue-watching">
        <h2 class="category-title">▶️ Continuar Assistindo</h2>
        <div class="items-grid">`;
    
    list.forEach(item => {
        const remaining = item.duration - item.currentTime;
        const time = remaining > 3600 
            ? `${Math.floor(remaining/3600)}h ${Math.floor((remaining%3600)/60)}min`
            : `${Math.floor(remaining/60)}min`;
        
        html += `
        <div class="item-card continue-card" onclick="resumeItem('${item.itemId}', '${item.category}', ${item.episodeIndex})">
            <img src="${item.poster || 'assets/capas/default.jpg'}" class="item-poster" onerror="this.src='assets/capas/default.jpg';">
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

// ============================================
// FUNÇÃO PARA RETOMAR ITEM
// ============================================

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
                if (count === episodeIndex) {
                    url = e.url;
                    title = e.title;
                    break;
                }
                count++;
            }
        }
    }
    
    if (url) {
        window.playWithModernPlayer(url, `${item.title} - ${title}`, `${category} • Ep ${episodeIndex+1}`, itemId, category, episodeIndex);
    }
};

// ============================================
// FUNÇÃO PRINCIPAL DO PLAYER (LINHA 180)
// ============================================

window.playWithModernPlayer = function(url, title, info = '', itemId = null, category = null, episodeIndex = 0) {
    console.log('🎬 PLAYER CHAMADO EM:', new Date().toLocaleTimeString());
    
    // VERIFICAR MODAL - SE NÃO EXISTIR, CRIAR AGORA MESMO
    let modal = document.getElementById('modernPlayerModal');
    if (!modal) {
        console.warn('⚠️ MODAL NÃO ENCONTRADO! CRIANDO EMERGÊNCIA...');
        
        // Criar modal emergencial
        modal = document.createElement('div');
        modal.id = 'modernPlayerModal';
        modal.style.cssText = 'display:flex;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:9999;justify-content:center;align-items:center;';
        modal.innerHTML = `
            <div style="width:90%;max-width:1200px;background:#000;border-radius:10px;overflow:hidden;position:relative;">
                <button id="closeModernPlayer" style="position:absolute;top:15px;right:15px;background:rgba(255,255,255,0.1);border:none;color:white;width:40px;height:40px;border-radius:50%;font-size:20px;cursor:pointer;">&times;</button>
                <div id="modern-player-container" style="width:100%;height:70vh;background:#000;"></div>
                <div style="padding:20px;color:white;">
                    <h3 id="modern-player-title">${title}</h3>
                    <p id="modern-player-info">${info}</p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    // GARANTIR QUE O MODAL ESTÁ VISÍVEL
    modal.style.display = 'flex';
    
    // PEGAR CONTAINER
    const container = document.getElementById('modern-player-container');
    if (!container) {
        window.open(url, '_blank');
        return;
    }
    
    // ID DO VÍDEO
    const videoId = `${itemId}_${episodeIndex}`;
    const saved = ContinueWatching.get(videoId);
    
    // CRIAR VÍDEO
    container.innerHTML = `<video id="current-video" controls autoplay style="width:100%;height:100%;background:#000;" src="${url}"></video>`;
    
    const video = document.getElementById('current-video');
    const closeBtn = document.getElementById('closeModernPlayer');
    
    // RETOMAR PROGRESSO
    if (saved?.currentTime > 5) {
        video.addEventListener('loadedmetadata', function() {
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
    
    // SALVAR PROGRESSO
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
    
    // FECHAR
    closeBtn.onclick = function() {
        clearInterval(interval);
        modal.style.display = 'none';
        video.pause();
    };
    
    video.addEventListener('ended', function() {
        ContinueWatching.remove(videoId);
        clearInterval(interval);
    });
    
    // TÍTULOS
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
        }
    }, 300);
};

// ============================================
// CSS
// ============================================

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

console.log('✅ PLAYER COMPLETO CARREGADO - LINHA 290');
console.log('📍 Verifique se o modal foi criado:', document.getElementById('modernPlayerModal') ? 'SIM' : 'NÃO');
