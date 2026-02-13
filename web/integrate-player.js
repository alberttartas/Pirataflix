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
        return Object.values(progressos)
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

// Função para retomar da seção "Continuar Assistindo"
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
        // Procurar em temporadas
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
                // Verificar se já existe
                if (document.getElementById('continue-watching')) {
                    document.getElementById('continue-watching').remove();
                }
                // Inserir após o header ou no início
                const firstSection = contentDiv.querySelector('.category-section');
                if (firstSection) {
                    firstSection.insertAdjacentHTML('beforebegin', continueHtml);
                } else {
                    contentDiv.insertAdjacentHTML('afterbegin', continueHtml);
                }
                console.log('✅ Seção Continue Watching adicionada!');
            }
        }, 200);
    }
};

// ============================================
// INTEGRAÇÃO DO PLAYER COM MODERNVIDEOPLAYER
// ============================================

function integrateModernPlayer() {
    console.log('🚀 Iniciando integração do player...');
    
    // Carregar CSS primeiro
    loadCSS('player.css');
    
    // Carregar Font Awesome
    loadFontAwesome();
    
    // Verificar se ModernVideoPlayer já está disponível
    if (typeof ModernVideoPlayer !== 'undefined') {
        console.log('✅ ModernVideoPlayer já está disponível');
        setupPlayerModal();
    } else {
        // Carregar player.js
        loadScript('player.js').then(() => {
            console.log('✅ player.js carregado');
            setupPlayerModal();
        }).catch(error => {
            console.error('❌ Erro ao carregar player.js:', error);
            setupFallbackPlayer();
        });
    }
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
        document.head.appendChild(script);
    });
}

function loadCSS(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
}

function loadFontAwesome() {
    if (document.querySelector('link[href*="font-awesome"]')) return;
    
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
    document.head.appendChild(link);
}

// Variáveis globais
let modernPlayer = null;

function setupPlayerModal() {
    // Criar modal
    const modalHTML = `
        <div id="modernPlayerModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); z-index: 9999; justify-content: center; align-items: center;">
            <div style="width: 90%; max-width: 1200px; max-height: 90vh; background: #000; border-radius: 10px; overflow: hidden; position: relative;">
                <button id="closeModernPlayer" style="position: absolute; top: 15px; right: 15px; background: rgba(255,255,255,0.1); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 20px; cursor: pointer; z-index: 10000; display: flex; align-items: center; justify-content: center;">&times;</button>
                <div id="modern-player-container" style="width: 100%; height: 70vh;"></div>
                <div style="padding: 20px; color: white;">
                    <h3 id="modern-player-title" style="margin: 0 0 10px 0;"></h3>
                    <p id="modern-player-info" style="margin: 0; opacity: 0.8;"></p>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    window.playWithModernPlayer = function(url, title, info = '', itemId = null, category = null, episodeIndex = 0) {
        const modal = document.getElementById('modernPlayerModal');
        modal.style.display = 'flex';
        
        // Gerar ID único para este vídeo
        const videoId = `${itemId}_${episodeIndex}`;
        
        // VERIFICAR SE EXISTE PROGRESSO SALVO
        const savedProgress = ContinueWatching.get(videoId);
        let resumeTime = 0;
        if (savedProgress && savedProgress.currentTime > 5) {
            resumeTime = savedProgress.currentTime;
            console.log('⏯️ Progresso encontrado:', Math.floor(savedProgress.currentTime) + 's');
        }
        
        // Salvar identificação do item
        modal.dataset.itemId = itemId || '';
        modal.dataset.category = category || '';
        modal.dataset.currentEpisodeIndex = episodeIndex;
        modal.dataset.currentVideoUrl = url;
        modal.dataset.currentVideoTitle = title;
        modal.dataset.currentVideoId = videoId;
        
        console.log('🎬 Reproduzindo:', { url, title, itemId, category, episodeIndex, videoId });
        
        // Buscar lista de episódios do vodData global
        let episodeList = [];
        let currentItem = null;
        
        if (itemId && category && window.vodData && window.vodData[category]) {
            const items = window.vodData[category];
            currentItem = items.find(i => i.id === itemId);
            
            if (currentItem) {
                console.log('✅ Item encontrado:', currentItem.title);
                
                // Tentar pegar episódios da propriedade episodes
                episodeList = currentItem.episodes || [];
                
                // Se não tiver episódios diretos, verificar temporadas
                if (!episodeList.length && currentItem.seasons && currentItem.seasons.length > 0) {
                    console.log('📚 Procurando episódios nas temporadas');
                    episodeList = [];
                    currentItem.seasons.forEach(season => {
                        if (season.episodes && season.episodes.length > 0) {
                            episodeList = episodeList.concat(season.episodes);
                        }
                    });
                }
                
                console.log('🎯 Lista de episódios encontrada:', episodeList.length, 'episódios');
            }
        }
        
        modal.dataset.episodeList = JSON.stringify(episodeList);
        
        // Inicializar player se necessário
        if (!modernPlayer) {
            console.log('🎮 Criando novo ModernVideoPlayer...');
            modernPlayer = new ModernVideoPlayer({
                containerId: 'modern-player-container',
                autoPlay: true,
                skipSeconds: 10
            });
        }
        
        // Carregar vídeo
        modernPlayer.load(url, title);
        
        // Configurar retomada após o vídeo carregar
        if (resumeTime > 0) {
            const checkLoaded = setInterval(() => {
                if (modernPlayer.video && modernPlayer.video.readyState >= 1) {
                    modernPlayer.video.currentTime = resumeTime;
                    clearInterval(checkLoaded);
                    
                    // Mostrar mensagem de retomada
                    showResumeMessage(resumeTime);
                }
            }, 100);
        }
        
        // Configurar salvamento automático de progresso
        setupProgressSaving(modernPlayer, videoId, itemId, category, episodeIndex, title, currentItem);
        
        // Atualizar informações
        document.getElementById('modern-player-title').textContent = title;
        document.getElementById('modern-player-info').textContent = info || `Episódio ${episodeIndex + 1} de ${episodeList.length}`;
        
        // Adicionar botão de próximo episódio se houver lista
        if (episodeList && episodeList.length > 1 && episodeIndex < episodeList.length - 1) {
            console.log('➕ Adicionando botão de próximo episódio');
            addNextEpisodeButton(episodeList, episodeIndex);
        }
    };
    
    // Eventos de fechamento
    document.getElementById('closeModernPlayer').addEventListener('click', closePlayer);
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closePlayer();
        }
    });
    
    console.log('✅ Player integrado com sucesso!');
}

// Função para configurar salvamento de progresso
function setupProgressSaving(player, videoId, itemId, category, episodeIndex, title, item) {
    if (!player || !player.video) return;
    
    let saveInterval = setInterval(() => {
        if (player.video && player.video.duration && player.video.currentTime > 0) {
            ContinueWatching.save({
                videoId: videoId,
                itemId: itemId,
                category: category,
                episodeIndex: episodeIndex,
                title: title,
                seriesTitle: title.split(' - ')[0],
                season: 1,
                episode: episodeIndex + 1,
                currentTime: player.video.currentTime,
                duration: player.video.duration,
                url: player.video.src,
                poster: item?.poster || ''
            });
        }
    }, 5000);
    
    // Quando o vídeo terminar, remover progresso e limpar intervalo
    player.video.addEventListener('ended', function onEnded() {
        ContinueWatching.remove(videoId);
        clearInterval(saveInterval);
        player.video.removeEventListener('ended', onEnded);
        
        // Avançar para próximo episódio automaticamente
        const modal = document.getElementById('modernPlayerModal');
        const episodeList = JSON.parse(modal.dataset.episodeList || '[]');
        const currentIndex = parseInt(modal.dataset.currentEpisodeIndex || 0);
        
        if (currentIndex < episodeList.length - 1) {
            setTimeout(() => {
                playNextEpisode();
            }, 2000);
        }
    });
    
    // Limpar intervalo ao fechar
    const originalClose = closePlayer;
    window.closePlayer = function() {
        clearInterval(saveInterval);
        originalClose();
    };
}

// Função para fechar player
function closePlayer() {
    const modal = document.getElementById('modernPlayerModal');
    modal.style.display = 'none';
    
    if (modernPlayer && modernPlayer.video) {
        modernPlayer.video.pause();
    }
    
    // Remover botão de próximo episódio
    const nextBtn = document.getElementById('nextEpisodeBtn');
    if (nextBtn) nextBtn.remove();
}

// Função para mostrar mensagem de retomada
function showResumeMessage(resumeTime) {
    const minutes = Math.floor(resumeTime / 60);
    const seconds = Math.floor(resumeTime % 60).toString().padStart(2, '0');
    
    const container = document.getElementById('modern-player-container');
    const msg = document.createElement('div');
    msg.className = 'resume-message';
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
}

// Funções para controle de episódios
function addNextEpisodeButton(episodeList, currentIndex) {
    const modal = document.getElementById('modernPlayerModal');
    
    // Remover botão anterior se existir
    const existingBtn = document.getElementById('nextEpisodeBtn');
    if (existingBtn) existingBtn.remove();
    
    if (currentIndex < episodeList.length - 1) {
        const nextEpisode = episodeList[currentIndex + 1];
        
        const nextBtn = document.createElement('button');
        nextBtn.id = 'nextEpisodeBtn';
        nextBtn.innerHTML = '<i class="fas fa-forward"></i> Próximo Episódio';
        nextBtn.title = `Próximo: ${nextEpisode.title}`;
        nextBtn.style.cssText = `
            position: absolute;
            bottom: 100px;
            right: 20px;
            background: rgba(229, 9, 20, 0.9);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 10000;
            transition: all 0.3s;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        nextBtn.onmouseover = () => {
            nextBtn.style.background = 'rgba(229, 9, 20, 1)';
            nextBtn.style.transform = 'scale(1.05)';
        };
        nextBtn.onmouseout = () => {
            nextBtn.style.background = 'rgba(229, 9, 20, 0.9)';
            nextBtn.style.transform = 'scale(1)';
        };
        nextBtn.onclick = playNextEpisode;
        
        const modalContent = modal.querySelector('div > div');
        if (modalContent) {
            modalContent.appendChild(nextBtn);
        }
    }
}

function playNextEpisode() {
    console.log('⏭️ Reproduzindo próximo episódio...');
    
    const modal = document.getElementById('modernPlayerModal');
    const episodeList = JSON.parse(modal.dataset.episodeList || '[]');
    const currentIndex = parseInt(modal.dataset.currentEpisodeIndex || 0);
    
    if (currentIndex < episodeList.length - 1) {
        const nextEpisode = episodeList[currentIndex + 1];
        const itemId = modal.dataset.itemId;
        const category = modal.dataset.category;
        
        // Atualizar dados no modal
        modal.dataset.currentEpisodeIndex = currentIndex + 1;
        modal.dataset.currentVideoUrl = nextEpisode.url;
        modal.dataset.currentVideoTitle = nextEpisode.title;
        modal.dataset.currentVideoId = `${itemId}_${currentIndex + 1}`;
        
        // Carregar próximo episódio no player existente
        if (modernPlayer) {
            modernPlayer.load(nextEpisode.url, nextEpisode.title);
            
            // Reconfigurar salvamento de progresso
            const videoId = modal.dataset.currentVideoId;
            const title = nextEpisode.title;
            
            // Buscar item atual para poster
            let currentItem = null;
            if (itemId && category && window.vodData && window.vodData[category]) {
                currentItem = window.vodData[category].find(i => i.id === itemId);
            }
            
            setupProgressSaving(modernPlayer, videoId, itemId, category, currentIndex + 1, title, currentItem);
        }
        
        // Atualizar título
        document.getElementById('modern-player-title').textContent = nextEpisode.title;
        document.getElementById('modern-player-info').textContent = `Episódio ${currentIndex + 2} de ${episodeList.length}`;
        
        // Atualizar botão
        updateNextEpisodeButton();
    }
}

function updateNextEpisodeButton() {
    const modal = document.getElementById('modernPlayerModal');
    const episodeList = JSON.parse(modal.dataset.episodeList || '[]');
    const currentIndex = parseInt(modal.dataset.currentEpisodeIndex || 0);
    
    // Remover botão atual
    const nextBtn = document.getElementById('nextEpisodeBtn');
    if (nextBtn) nextBtn.remove();
    
    // Adicionar novo botão se ainda houver episódios
    if (currentIndex < episodeList.length - 1) {
        addNextEpisodeButton(episodeList, currentIndex);
    } else {
        // Mostrar mensagem de conclusão
        const modalBody = modal.querySelector('div > div > div:last-child');
        if (modalBody) {
            const completionMsg = document.createElement('div');
            completionMsg.innerHTML = '<i class="fas fa-check-circle" style="color: #4CAF50; margin-right: 10px;"></i> Todos os episódios assistidos';
            completionMsg.style.cssText = `
                color: #4CAF50;
                font-weight: bold;
                margin-top: 10px;
                display: flex;
                align-items: center;
            `;
            
            // Remover mensagem anterior se existir
            const oldMsg = modalBody.querySelector('.completion-msg');
            if (oldMsg) oldMsg.remove();
            
            completionMsg.className = 'completion-msg';
            modalBody.appendChild(completionMsg);
            
            setTimeout(() => completionMsg.remove(), 5000);
        }
    }
}

// Player fallback simples
function setupFallbackPlayer() {
    console.log('🔄 Configurando player fallback...');
    
    window.ModernVideoPlayer = class FallbackPlayer {
        constructor(options) {
            this.containerId = options.containerId;
            this.options = options;
            this.container = document.getElementById(this.containerId);
            this.video = null;
        }
        
        load(url, title = '') {
            console.log('🎬 Fallback player carregando:', title);
            
            const container = document.getElementById(this.containerId);
            if (!container) return;
            
            container.innerHTML = `
                <video controls autoplay playsinline style="width: 100%; height: 100%; background: #000;">
                    <source src="${url}" type="video/mp4">
                    Seu navegador não suporta o elemento de vídeo.
                </video>
            `;
            
            this.video = container.querySelector('video');
            
            // Adicionar título
            if (title) {
                const titleEl = document.createElement('div');
                titleEl.style.cssText = `
                    position: absolute;
                    top: 20px;
                    left: 20px;
                    color: white;
                    font-size: 16px;
                    text-shadow: 1px 1px 2px black;
                    z-index: 10;
                `;
                titleEl.textContent = title;
                container.appendChild(titleEl);
            }
        }
    };
    
    setupPlayerModal();
}

// Adicionar CSS para animações
function addGlobalStyles() {
    if (document.querySelector('#player-global-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'player-global-styles';
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
        
        .continue-card .progress-bar {
            transition: opacity 0.3s;
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
        
        #nextEpisodeBtn {
            animation: slideInRight 0.3s ease;
        }
        
        @keyframes slideInRight {
            from {
                opacity: 0;
                transform: translateX(50px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
    `;
    
    document.head.appendChild(style);
}

// Inicializar com timeout para garantir que tudo carregou
function initializePlayer() {
    // Adicionar estilos globais
    addGlobalStyles();
    
    setTimeout(() => {
        if (!window.vodData) {
            console.warn('⚠️ vodData ainda não carregado, tentando novamente...');
            if (typeof vodData !== 'undefined') {
                window.vodData = vodData;
                console.log('✅ vodData encontrado no escopo global');
            }
        }
        
        integrateModernPlayer();
    }, 1000);
}

// Inicializar quando a página carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePlayer);
} else {
    initializePlayer();
}

// Exportar funções para debug
window.debugPlayer = {
    getCurrentEpisode: function() {
        const modal = document.getElementById('modernPlayerModal');
        if (!modal) return null;
        
        return {
            itemId: modal.dataset.itemId,
            category: modal.dataset.category,
            currentIndex: parseInt(modal.dataset.currentEpisodeIndex || 0),
            episodeList: JSON.parse(modal.dataset.episodeList || '[]'),
            player: modernPlayer
        };
    },
    forceNextEpisode: playNextEpisode,
    showNextButton: addNextEpisodeButton,
    ContinueWatching: ContinueWatching,
    watchingList: ContinueWatching.getWatchingList()
};
// ============================================
// SUBSTITUIÇÃO CORRETA DA FUNÇÃO DISPLAYCONTENT
// ============================================

// Guardar referência à função original
const originalDisplayContent = window.displayContent;

// Substituir por nossa versão
window.displayContent = function() {
    console.log('🎯 NOVA DISPLAYCONTENT EXECUTANDO');
    
    // Chamar função original primeiro para mostrar as categorias
    if (originalDisplayContent) {
        originalDisplayContent();
    }
    
    // Adicionar Continue Watching após um pequeno delay
    setTimeout(() => {
        const contentDiv = document.getElementById('content');
        if (!contentDiv) {
            console.warn('❌ contentDiv não encontrado');
            return;
        }
        
        const continueHtml = renderContinueWatching();
        if (continueHtml) {
            // Remover se já existir
            const existing = document.getElementById('continue-watching');
            if (existing) {
                existing.remove();
            }
            
            // Inserir no início
            contentDiv.insertAdjacentHTML('afterbegin', continueHtml);
            console.log('✅ Seção Continue Watching adicionada!');
        } else {
            console.log('ℹ️ Nenhum vídeo em andamento');
        }
    }, 300);
};

console.log('✅ Função displayContent substituída com sucesso!');
