// integrate-player.js - Integração completa do player com suporte a episódios
function integrateModernPlayer() {
    console.log('🚀 Iniciando integração do player...');
    
    // Carregar CSS primeiro
    loadCSS('player.css');
    
    // Carregar Font Awesome
    loadFontAwesome();
    
    // Carregar player.js
    loadScript('player.js').then(() => {
        console.log('✅ player.js carregado');
        setupPlayerModal();
    }).catch(error => {
        console.error('❌ Erro ao carregar player.js:', error);
        setupFallbackPlayer();
    });
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
                <button id="closeModernPlayer" style="position: absolute; top: 15px; right: 15px; background: rgba(255,255,255,0.1); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 20px; cursor: pointer; z-index: 10000;">&times;</button>
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
        
        // Salvar identificação do item
        modal.dataset.itemId = itemId || '';
        modal.dataset.category = category || '';
        modal.dataset.currentEpisodeIndex = episodeIndex;
        modal.dataset.currentVideoUrl = url;
        modal.dataset.currentVideoTitle = title;
        
        console.log('🎬 Reproduzindo:', { url, title, itemId, category, episodeIndex });
        
        // Buscar lista de episódios do vodData global
        let episodeList = [];
        if (itemId && category && window.vodData && window.vodData[category]) {
            const items = window.vodData[category];
            console.log('📁 Procurando item:', itemId, 'em categoria:', category);
            console.log('📁 Itens disponíveis:', items.map(i => i.id));
            
            const item = items.find(i => i.id === itemId);
            if (item) {
                console.log('✅ Item encontrado:', item.title);
                console.log('📺 Episódios do item:', item.episodes);
                console.log('📺 Temporadas do item:', item.seasons);
                
                // Tentar pegar episódios da propriedade episodes
                episodeList = item.episodes || [];
                
                // Se não tiver episódios diretos, verificar temporadas
                if (!episodeList.length && item.seasons && item.seasons.length > 0) {
                    console.log('📚 Procurando episódios nas temporadas');
                    // Para séries com temporadas, usar episódios da primeira temporada
                    // ou juntar todos os episódios de todas as temporadas
                    episodeList = [];
                    item.seasons.forEach(season => {
                        if (season.episodes && season.episodes.length > 0) {
                            episodeList = episodeList.concat(season.episodes);
                        }
                    });
                }
                
                console.log('🎯 Lista de episódios encontrada:', episodeList.length, 'episódios');
            } else {
                console.warn('⚠️ Item não encontrado:', itemId);
            }
        } else {
            console.warn('⚠️ Dados insuficientes para buscar episódios');
        }
        
        modal.dataset.episodeList = JSON.stringify(episodeList);
        
        // Inicializar player
        if (!modernPlayer) {
            console.log('🎮 Criando novo player...');
            modernPlayer = new ModernVideoPlayer({
                containerId: 'modern-player-container',
                autoPlay: true,
                skipSeconds: 10,
                showNextEpisode: true
            });
        } else {
            console.log('🎮 Usando player existente');
        }
        
        // Carregar vídeo
        modernPlayer.load(url, title, episodeList, episodeIndex);
        
        // Atualizar informações
        document.getElementById('modern-player-title').textContent = title;
        document.getElementById('modern-player-info').textContent = info || `Episódio ${episodeIndex + 1} de ${episodeList.length}`;
        
        // Adicionar botão de próximo episódio se houver lista
        if (episodeList && episodeList.length > 1 && episodeIndex < episodeList.length - 1) {
            console.log('➕ Adicionando botão de próximo episódio');
            addNextEpisodeButton();
        } else {
            console.log('➖ Sem botão de próximo (último episódio ou sem lista)');
        }
    };
    
    // Eventos de fechamento
    document.getElementById('closeModernPlayer').addEventListener('click', () => {
        console.log('❌ Fechando player');
        document.getElementById('modernPlayerModal').style.display = 'none';
        if (modernPlayer && modernPlayer.video) {
            modernPlayer.video.pause();
        }
        // Remover botão de próximo episódio
        const nextBtn = document.getElementById('nextEpisodeBtn');
        if (nextBtn) {
            console.log('🗑️ Removendo botão de próximo episódio');
            nextBtn.remove();
        }
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            console.log('⎋ Fechando player com ESC');
            document.getElementById('modernPlayerModal').style.display = 'none';
            if (modernPlayer && modernPlayer.video) {
                modernPlayer.video.pause();
            }
            // Remover botão de próximo episódio
            const nextBtn = document.getElementById('nextEpisodeBtn');
            if (nextBtn) nextBtn.remove();
        }
    });
    
    console.log('✅ Player integrado com sucesso!');
}

// Funções para controle de episódios
function addNextEpisodeButton() {
    const modal = document.getElementById('modernPlayerModal');
    const episodeList = JSON.parse(modal.dataset.episodeList || '[]');
    const currentIndex = parseInt(modal.dataset.currentEpisodeIndex || 0);
    
    console.log('🔘 Verificando botão próximo:', { 
        episodios: episodeList.length, 
        atual: currentIndex,
        podeProximo: currentIndex < episodeList.length - 1 
    });
    
    // Remover botão anterior se existir
    const existingBtn = document.getElementById('nextEpisodeBtn');
    if (existingBtn) {
        console.log('🗑️ Removendo botão anterior');
        existingBtn.remove();
    }
    
    if (currentIndex < episodeList.length - 1) {
        const nextEpisode = episodeList[currentIndex + 1];
        console.log('▶️ Próximo episódio:', nextEpisode.title);
        
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
            nextBtn.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
        };
        nextBtn.onmouseout = () => {
            nextBtn.style.background = 'rgba(229, 9, 20, 0.9)';
            nextBtn.style.transform = 'scale(1)';
            nextBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        };
        nextBtn.onclick = playNextEpisode;
        
        const modalContent = modal.querySelector('div > div');
        if (modalContent) {
            modalContent.appendChild(nextBtn);
            console.log('✅ Botão de próximo episódio adicionado');
        }
    } else {
        console.log('❌ Não há próximo episódio');
    }
}

function playNextEpisode() {
    console.log('⏭️ Reproduzindo próximo episódio...');
    
    const modal = document.getElementById('modernPlayerModal');
    const episodeList = JSON.parse(modal.dataset.episodeList || '[]');
    const currentIndex = parseInt(modal.dataset.currentEpisodeIndex || 0);
    
    console.log('📊 Estado atual:', { 
        total: episodeList.length, 
        atual: currentIndex,
        proximoDisponivel: currentIndex < episodeList.length - 1 
    });
    
    if (currentIndex < episodeList.length - 1) {
        const nextEpisode = episodeList[currentIndex + 1];
        console.log('🎬 Carregando próximo episódio:', nextEpisode.title);
        
        // Atualizar dados no modal
        modal.dataset.currentEpisodeIndex = currentIndex + 1;
        modal.dataset.currentVideoUrl = nextEpisode.url;
        modal.dataset.currentVideoTitle = nextEpisode.title;
        
        // Carregar próximo episódio
        if (modernPlayer) {
            modernPlayer.load(nextEpisode.url, nextEpisode.title, episodeList, currentIndex + 1);
        } else {
            console.error('❌ Player não inicializado');
            // Recriar player se necessário
            modernPlayer = new ModernVideoPlayer({
                containerId: 'modern-player-container',
                autoPlay: true,
                skipSeconds: 10,
                showNextEpisode: true
            });
            modernPlayer.load(nextEpisode.url, nextEpisode.title, episodeList, currentIndex + 1);
        }
        
        // Atualizar título
        document.getElementById('modern-player-title').textContent = nextEpisode.title;
        document.getElementById('modern-player-info').textContent = `Episódio ${currentIndex + 2} de ${episodeList.length}`;
        
        // Atualizar botão
        updateNextEpisodeButton();
        
        console.log('✅ Próximo episódio carregado');
    } else {
        console.warn('⚠️ Não há próximo episódio disponível');
        // Remover botão se for o último
        const nextBtn = document.getElementById('nextEpisodeBtn');
        if (nextBtn) {
            nextBtn.style.display = 'none';
            console.log('🗑️ Botão removido (último episódio)');
        }
    }
}

function updateNextEpisodeButton() {
    const modal = document.getElementById('modernPlayerModal');
    const episodeList = JSON.parse(modal.dataset.episodeList || '[]');
    const currentIndex = parseInt(modal.dataset.currentEpisodeIndex || 0);
    
    console.log('🔄 Atualizando botão próximo:', { 
        total: episodeList.length, 
        atual: currentIndex 
    });
    
    // Remover botão atual
    const nextBtn = document.getElementById('nextEpisodeBtn');
    if (nextBtn) {
        nextBtn.remove();
        console.log('🗑️ Botão anterior removido');
    }
    
    // Adicionar novo botão se ainda houver episódios
    if (currentIndex < episodeList.length - 1) {
        console.log('➕ Adicionando novo botão');
        addNextEpisodeButton();
    } else {
        console.log('🎉 Último episódio da lista');
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
            modalBody.appendChild(completionMsg);
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
        }
        
        load(url, title, episodeList = null, episodeIndex = 0) {
            console.log('🎬 Fallback player carregando:', title);
            
            const container = document.getElementById(this.containerId);
            if (!container) return;
            
            container.innerHTML = `
                <video controls autoplay playsinline style="width: 100%; height: 100%; background: #000;">
                    <source src="${url}" type="video/mp4">
                    Seu navegador não suporta o elemento de vídeo.
                </video>
            `;
            
            // Adicionar título
            const video = container.querySelector('video');
            video.title = title;
            
            // Adicionar evento de término
            video.addEventListener('ended', () => {
                console.log('⏹️ Vídeo finalizado (fallback)');
                if (episodeList && episodeIndex < episodeList.length - 1) {
                    setTimeout(() => {
                        if (confirm('Deseja reproduzir o próximo episódio?')) {
                            const nextEpisode = episodeList[episodeIndex + 1];
                            this.load(nextEpisode.url, nextEpisode.title, episodeList, episodeIndex + 1);
                            // Atualizar título na interface
                            document.getElementById('modern-player-title').textContent = nextEpisode.title;
                        }
                    }, 1000);
                }
            });
        }
    };
    
    setupPlayerModal();
}

// Inicializar com timeout para garantir que tudo carregou
function initializePlayer() {
    // Esperar um pouco mais para garantir que a página carregou completamente
    setTimeout(() => {
        if (!window.vodData) {
            console.warn('⚠️ vodData ainda não carregado, tentando novamente...');
            // Tentar pegar vodData do escopo global
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
    showNextButton: addNextEpisodeButton
};