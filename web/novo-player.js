// ============================================
// NOVO PLAYER - VERSÃO FINAL CORRIGIDA
// ============================================

// ===== CONTROLE GLOBAL DE LISTENER =====
let onTimeUpdateHandler = null;

// ===== ANIMAÇÕES DO PLAYER (CRIADAS UMA VEZ) =====
if (!document.getElementById('player-animations')) {
    const style = document.createElement('style');
    style.id = 'player-animations';
    style.textContent = `
        @keyframes fadeOut {
            0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);
}

// CRIAR MODAL IMEDIATAMENTE
(function() {
    if (!document.getElementById('modernPlayerModal')) {
        const modal = document.createElement('div');
        modal.id = 'modernPlayerModal';
        modal.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:9999;justify-content:center;align-items:center;';
        modal.innerHTML = `
            <div style="width:90%;max-width:1200px;background:#000;border-radius:10px;overflow:hidden;position:relative;">
                <button id="closeModernPlayerFix" style="position:absolute;top:15px;right:15px;background:#e50914;border:none;color:white;width:40px;height:40px;border-radius:50%;font-size:20px;cursor:pointer;z-index:10001;display:flex;align-items:center;justify-content:center;">&times;</button>
                <div id="modern-player-container" style="width:100%;height:70vh;background:#000;position:relative;"></div>
                <div style="padding:20px;color:white;">
                    <h3 id="modern-player-title"></h3>
                    <p id="modern-player-info"></p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
})();

// CORRIGIR FAVICON
(function() {
    const links = document.querySelectorAll('link[rel*="icon"]');
    if (links.length === 0) {
        const link = document.createElement('link');
        link.rel = 'icon';
        link.href = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎬</text></svg>';
        document.head.appendChild(link);
    }
})();

// SISTEMA DE CONTINUAR ASSISTINDO
window.ContinueWatching = {
    STORAGE_KEY: 'pirataflix_progressos',
    
    getAll() {
        try { 
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {}; 
        } catch { 
            return {}; 
        }
    },
    
    save(videoData) {
        if (!videoData.videoId || !videoData.itemId || videoData.currentTime < 10) return;
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
        return Object.values(unique).sort((a,b) => b.timestamp - a.timestamp).slice(0,20);
    }
};

// ==========================================
// 🔥 FUNÇÃO GLOBAL PARA DESTRUIR O PLAYER
// ==========================================
window.destroyModernPlayer = function() {
    console.log("🧹 Destruindo player...");

    const video = document.getElementById("current-video");

    if (video) {
        try {
            if (onTimeUpdateHandler) {
                video.removeEventListener('timeupdate', onTimeUpdateHandler);
                onTimeUpdateHandler = null;
            }

            video.pause();
            video.removeAttribute("src");
            video.load();
        } catch(e) {
            console.log("Erro ao destruir vídeo:", e);
        }
    }

    if (window.__playerInterval) {
        clearInterval(window.__playerInterval);
        window.__playerInterval = null;
    }

    if (window.__keyboardHandler) {
        document.removeEventListener('keydown', window.__keyboardHandler);
        window.__keyboardHandler = null;
    }

    if (window.controlsTimeout) {
        clearTimeout(window.controlsTimeout);
        window.controlsTimeout = null;
    }

    const controls = document.getElementById('custom-controls');
    if (controls) controls.remove();
};

// ==========================================
// 🎬 FUNÇÃO PRINCIPAL DO PLAYER
// ==========================================
window.playWithModernPlayer = function(
    url,
    title,
    info = '',
    itemId = null,
    category = null,
    episodeIndex = 0
) {
    console.log('🎬 Player chamado');

    // 🔥 SEMPRE limpar antes de criar novo player
    window.destroyModernPlayer();

    const modal = document.getElementById('modernPlayerModal');
    const closeBtn = document.getElementById('closeModernPlayerFix');
    const titleEl = document.getElementById('modern-player-title');
    const infoEl = document.getElementById('modern-player-info');

    if (!modal) {
        window.open(url, '_blank');
        return;
    }

    // Atualizar título e info
    if (titleEl) titleEl.textContent = title;
    if (infoEl) infoEl.textContent = info;

    modal.style.display = 'flex';

    const container = document.getElementById('modern-player-container');
    if (!container) return;

    const videoId = `${itemId}_${episodeIndex}`;
    const saved = window.ContinueWatching?.get(videoId);

    // Criar vídeo SEM autoplay direto
    container.innerHTML = `
        <video 
            id="current-video"
            style="width:100%;height:100%;background:#000;"
            playsinline
        >
            <source src="${url}" type="video/mp4">
        </video>
    `;

    const video = document.getElementById('current-video');
    if (!video) return;

    // Restaurar progresso salvo
    if (saved && saved.currentTime) {
        video.currentTime = saved.currentTime;
    }

    // Tocar manualmente (evita bug de autoplay)
    video.play().catch(() => {
        console.log("⚠️ Autoplay bloqueado pelo navegador");
    });
    
    // Criar barra + botão próximo
    setTimeout(() => {
        addNextButton(container, video, itemId, category, episodeIndex, title, info);
    }, 200);

    // ======================================
    // 💾 SALVAR PROGRESSO
    // ======================================
    window.__playerInterval = setInterval(() => {
        if (!video || !video.duration) return;
        if (video.currentTime < 10) return;

        let posterUrl = '';

        if (itemId && category && window.vodData) {
            try {
                const item = window.vodData[category]?.find(i => i.id === itemId);
                if (item?.poster) {
                    posterUrl = item.poster;
                }
            } catch(e) {}
        }

        window.ContinueWatching?.save({
            videoId,
            itemId,
            category,
            episodeIndex,
            title,
            seriesTitle: title?.split(' - ')[0] || title,
            episode: episodeIndex + 1,
            currentTime: video.currentTime,
            duration: video.duration,
            url,
            poster: posterUrl
        });

    }, 5000);

    // ======================================
    // ⌨️ CONTROLES DE TECLADO (SEM DUPLICAR)
    // ======================================
    window.__keyboardHandler = function(e) {
        if (!video) return;

        switch (e.key) {
            case " ":
                e.preventDefault();
                video.paused ? video.play() : video.pause();
                break;

            case "ArrowRight":
                video.currentTime += 10;
                showMessage(container, '⏩ +10 segundos');
                break;

            case "ArrowLeft":
                video.currentTime -= 10;
                showMessage(container, '⏪ -10 segundos');
                break;

            case "Escape":
                window.destroyModernPlayer();
                modal.style.display = 'none';
                break;
        }
    };

    document.addEventListener('keydown', window.__keyboardHandler);

    // ======================================
    // 🛑 QUANDO TERMINAR
    // ======================================
    video.addEventListener("ended", () => {
        console.log("🎉 Vídeo finalizado");

        window.ContinueWatching?.remove(videoId);

        if (itemId && category && window.vodData) {
            const item = window.vodData[category]?.find(i => i.id === itemId);

            if (item) {
                let episodeList = item.episodes || [];

                // Se usar seasons
                if (!episodeList.length && item.seasons) {
                    item.seasons.forEach(s => {
                        if (s.episodes) episodeList = episodeList.concat(s.episodes);
                    });
                }

                // Se existir próximo episódio
                if (episodeIndex + 1 < episodeList.length) {
                    const next = episodeList[episodeIndex + 1];

                    setTimeout(() => {
                        window.playWithModernPlayer(
                            next.url,
                            `${item.title} - ${next.title}`,
                            `${category} • Ep ${episodeIndex + 2}`,
                            itemId,
                            category,
                            episodeIndex + 1
                        );
                    }, 2000);

                    return; // 🔥 IMPORTANTE: não destruir ainda
                }
            }
        }

        // Se não houver próximo episódio
        window.destroyModernPlayer();
        modal.style.display = 'none';
    });

    // ===== BOTÃO FECHAR CORRIGIDO =====
    closeBtn.onclick = function() {
        window.destroyModernPlayer();
        modal.style.display = 'none';
    };

    // Retomar progresso
    if (saved?.currentTime > 5) {
        video.addEventListener('loadedmetadata', () => {
            video.currentTime = saved.currentTime;
            const minutes = Math.floor(saved.currentTime / 60);
            const seconds = Math.floor(saved.currentTime % 60).toString().padStart(2,'0');
            const msg = document.createElement('div');
            msg.textContent = `⏯️ Retomando de ${minutes}:${seconds}`;
            msg.style.cssText = 'position:absolute;top:80px;left:20px;background:#e50914;color:white;padding:8px 16px;border-radius:4px;z-index:10000;';
            container.appendChild(msg);
            setTimeout(() => msg.remove(), 3000);
        });
    }
};

// ===== FUNÇÃO PARA MOSTRAR MENSAGENS =====
function showMessage(container, text) {
    const msg = document.createElement('div');
    msg.textContent = text;
    msg.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 20px 30px;
        border-radius: 50px;
        font-size: 24px;
        font-weight: bold;
        z-index: 10002;
        animation: fadeOut 1s forwards;
    `;
    
    container.appendChild(msg);
    setTimeout(() => msg.remove(), 1000);
}

// ===== BARRA DE CONTROLES COMPLETA + BOTÃO PRÓXIMO =====
function addNextButton(container, video, itemId, category, episodeIndex, title, info) {
    const oldControls = document.getElementById('custom-controls');
    if (oldControls) oldControls.remove();

    console.log('🔵 addNextButton iniciada');
    
    if (!itemId || !category) {
        console.log('🔴 Saindo: sem itemId ou category');
        return;
    }
    
    // Verificar se vodData existe
    if (!window.vodData) {
        console.log('⏳ Aguardando vodData carregar...');
        setTimeout(() => addNextButton(container, video, itemId, category, episodeIndex, title, info), 1000);
        return;
    }
    
    const item = window.vodData[category]?.find(i => i.id === itemId);
    if (!item) {
        console.log('🔴 Saindo: item não encontrado');
        return;
    }
    
    let episodeList = item.episodes || [];
    if (!episodeList.length && item.seasons) {
        item.seasons.forEach(s => {
            if (s.episodes) episodeList = episodeList.concat(s.episodes);
        });
    }
    
    // Esconder controles nativos
    video.controls = false;
    
    // ===== CRIAR BARRA DE CONTROLES COMPLETA =====
    let controlsContainer = document.getElementById('custom-controls');
    if (!controlsContainer) {
        console.log('🟢 Criando barra de controles completa');
        
        // Container principal da barra
        controlsContainer = document.createElement('div');
        controlsContainer.id = 'custom-controls';
        controlsContainer.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(transparent, rgba(0,0,0,0.9));
            padding: 15px 20px;
            display: flex;
            align-items: center;
            gap: 15px;
            z-index: 10001;
            opacity: 0;
            transition: opacity 0.3s;
        `;
        
        // Mostrar barra ao mover o mouse
        container.addEventListener('mousemove', () => {
            controlsContainer.style.opacity = '1';
            clearTimeout(window.controlsTimeout);
            window.controlsTimeout = setTimeout(() => {
                if (!video.paused) {
                    controlsContainer.style.opacity = '0';
                }
            }, 3000);
        });
        
        // ===== BOTÃO FULLSCREEN =====
        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.innerHTML = '⛶';
        fullscreenBtn.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 22px;
            cursor: pointer;
            padding: 5px;
        `;
        
        fullscreenBtn.onclick = () => {
            if (!document.fullscreenElement) {
                container.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen();
            }
        };

        // ===== BOTÃO PLAY/PAUSE =====
        const playPauseBtn = document.createElement('button');
        playPauseBtn.id = 'playPauseBtn';
        playPauseBtn.innerHTML = '⏸️';
        playPauseBtn.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 28px;
            cursor: pointer;
            padding: 5px;
            width: 40px;
        `;
        
        playPauseBtn.onclick = () => {
            if (video.paused) {
                video.play();
                playPauseBtn.innerHTML = '⏸️';
            } else {
                video.pause();
                playPauseBtn.innerHTML = '▶️';
            }
        };
        
        video.addEventListener('play', () => playPauseBtn.innerHTML = '⏸️');
        video.addEventListener('pause', () => playPauseBtn.innerHTML = '▶️');
        
        // ===== BOTÃO RETROCEDER 10s =====
        const backwardBtn = document.createElement('button');
        backwardBtn.id = 'backwardBtn';
        backwardBtn.innerHTML = '⏪ 10s';
        backwardBtn.style.cssText = `
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            font-size: 14px;
            cursor: pointer;
            padding: 8px 12px;
            border-radius: 4px;
            transition: 0.2s;
        `;
        
        backwardBtn.onmouseover = () => {
            backwardBtn.style.background = 'rgba(255,255,255,0.3)';
        };
        backwardBtn.onmouseout = () => {
            backwardBtn.style.background = 'rgba(255,255,255,0.2)';
        };
        
        backwardBtn.onclick = () => {
            video.currentTime = Math.max(0, video.currentTime - 10);
            showMessage(container, '⏪ -10 segundos');
        };
        
        // ===== BOTÃO AVANÇAR 10s =====
        const forwardBtn = document.createElement('button');
        forwardBtn.id = 'forwardBtn';
        forwardBtn.innerHTML = '10s ⏩';
        forwardBtn.style.cssText = `
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            font-size: 14px;
            cursor: pointer;
            padding: 8px 12px;
            border-radius: 4px;
            transition: 0.2s;
        `;
        
        forwardBtn.onmouseover = () => {
            forwardBtn.style.background = 'rgba(255,255,255,0.3)';
        };
        forwardBtn.onmouseout = () => {
            forwardBtn.style.background = 'rgba(255,255,255,0.2)';
        };
        
        forwardBtn.onclick = () => {
            video.currentTime = Math.min(video.duration, video.currentTime + 10);
            showMessage(container, '⏩ +10 segundos');
        };
        
        // ===== BARRA DE PROGRESSO =====
        const progressContainer = document.createElement('div');
        progressContainer.style.cssText = `
            flex: 1;
            height: 5px;
            background: rgba(255,255,255,0.3);
            border-radius: 5px;
            cursor: pointer;
            position: relative;
        `;
        
        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
            width: 0%;
            height: 100%;
            background: #e50914;
            border-radius: 5px;
            transition: width 0.1s;
        `;
        
        progressContainer.appendChild(progressBar);
        
        progressContainer.addEventListener('click', (e) => {
            const rect = progressContainer.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            video.currentTime = pos * video.duration;
        });
        
        // ===== TEMPO =====
        const timeDisplay = document.createElement('span');
        timeDisplay.style.cssText = 'color: white; font-size: 14px; min-width: 100px;';

        function formatTime(seconds) {
            if (!seconds || isNaN(seconds)) return '0:00';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
            return `${mins}:${secs}`;
        }

        // ===== TIMEUPDATE UNIFICADO =====
        if (onTimeUpdateHandler) {
            video.removeEventListener('timeupdate', onTimeUpdateHandler);
        }

        onTimeUpdateHandler = () => {
            if (!video || !video.duration) return;

            const progress = (video.currentTime / video.duration) * 100 || 0;
            progressBar.style.width = progress + '%';

            timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;

            const nextBtn = document.getElementById('nextEpisodeBtn');
            if (nextBtn) {
                if (video.duration - video.currentTime <= 10) {
                    nextBtn.style.opacity = '1';
                    nextBtn.style.transform = 'scale(1.1)';
                } else {
                    nextBtn.style.opacity = '0.7';
                    nextBtn.style.transform = 'scale(1)';
                }
            }
        };

        video.addEventListener('timeupdate', onTimeUpdateHandler);
                           
        // Adicionar elementos à barra
        controlsContainer.appendChild(playPauseBtn);
        controlsContainer.appendChild(backwardBtn);
        controlsContainer.appendChild(forwardBtn);
        controlsContainer.appendChild(progressContainer);
        controlsContainer.appendChild(timeDisplay);
        controlsContainer.appendChild(fullscreenBtn);
        
        container.appendChild(controlsContainer);
        console.log('✅ Barra de controles criada');
    }
    
    // ===== ADICIONAR TOQUES NAS LATERAIS =====
    function setupTouchControls() {
        let touchStartX = 0;
        let touchStartY = 0;
        
        container.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        
        container.addEventListener('touchend', (e) => {
            if (!touchStartX) return;
            
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            
            // Se foi mais horizontal que vertical (ignorar scroll)
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
                if (deltaX > 0) {
                    // Deslizou para direita → retroceder
                    video.currentTime = Math.max(0, video.currentTime - 10);
                    showMessage(container, '⏪ -10 segundos');
                } else {
                    // Deslizou para esquerda → avançar
                    video.currentTime = Math.min(video.duration, video.currentTime + 10);
                    showMessage(container, '⏩ +10 segundos');
                }
            }
            
            touchStartX = 0;
        }, { passive: true });
        
        // Toque simples no lado esquerdo/direito da tela
        container.addEventListener('click', (e) => {
            const rect = container.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const thirdWidth = rect.width / 3;
            
            // Ignorar se clicou na barra de controles
            if (controlsContainer && controlsContainer.contains(e.target)) return;
            
            if (clickX < thirdWidth) {
                // Lado esquerdo - retroceder
                video.currentTime = Math.max(0, video.currentTime - 10);
                showMessage(container, '⏪ -10 segundos');
            } else if (clickX > thirdWidth * 2) {
                // Lado direito - avançar
                video.currentTime = Math.min(video.duration, video.currentTime + 10);
                showMessage(container, '⏩ +10 segundos');
            }
        });
    }
    
    setupTouchControls();
    
    // ===== BOTÃO PRÓXIMO EPISÓDIO (se houver) =====
    if (episodeIndex + 1 < episodeList.length) {
        // Remover botão antigo se existir
        const oldBtn = document.getElementById('nextEpisodeBtn');
        if (oldBtn) oldBtn.remove();
        
        const nextBtn = document.createElement('button');
        nextBtn.id = 'nextEpisodeBtn';
        nextBtn.innerHTML = 'PRÓXIMO ▶';
        nextBtn.style.cssText = `
            background: #e50914;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            margin-left: 10px;
            transition: 0.2s;
            white-space: nowrap;
        `;
        
        nextBtn.onmouseover = () => {
            nextBtn.style.background = '#f40612';
            nextBtn.style.transform = 'scale(1.05)';
        };
        nextBtn.onmouseout = () => {
            nextBtn.style.background = '#e50914';
            nextBtn.style.transform = 'scale(1)';
        };
        
        nextBtn.onclick = () => {
            const next = episodeList[episodeIndex + 1];
            window.playWithModernPlayer(
                next.url,
                `${item.title} - ${next.title}`,
                `${category} • Ep ${episodeIndex + 2}`,
                itemId,
                category,
                episodeIndex + 1
            );
        };
        
        controlsContainer.appendChild(nextBtn);
        console.log('✅ Botão PRÓXIMO adicionado à barra');
    }
}

// RENDERIZAR CONTINUAR ASSISTINDO
window.renderContinueWatching = function() {
    const list = window.ContinueWatching.getWatchingList();
    if (list.length === 0) return '';
    
    // CORREÇÃO: Usar GitHub RAW para todas as imagens
    const GITHUB_RAW = 'https://raw.githubusercontent.com/alberttartas/Pirataflix/main/assets/Capas/';
    
    let html = '<section class="category-section" id="continue-watching"><h2 class="category-title">▶️ Continuar Assistindo</h2><div class="items-grid">';
    
    list.forEach(item => {
        const remaining = item.duration - item.currentTime;
        const time = remaining > 3600 ? 
            `${Math.floor(remaining/3600)}h ${Math.floor((remaining%3600)/60)}min` : 
            `${Math.floor(remaining/60)}min`;
        
        // CORREÇÃO: Extrair nome do arquivo da capa
        let nomeArquivo = 'default.jpg';
        
        if (item.poster) {
            // Se já for URL completa, extrair só o nome
            if (item.poster.includes('/')) {
                nomeArquivo = item.poster.split('/').pop();
            } else {
                nomeArquivo = item.poster;
            }
        }
        
        // CORREÇÃO: Usar sempre GitHub RAW + nome do arquivo
        const posterUrl = `${GITHUB_RAW}${nomeArquivo}`;
        
        html += `<div class="item-card continue-card" onclick="resumeItem('${item.itemId}', '${item.category}', ${item.episodeIndex})">
            <img src="${posterUrl}" class="item-poster" 
                 onerror="this.onerror=null; this.src='${GITHUB_RAW}default.jpg';">
            <div class="item-info">
                <div class="item-title">${item.seriesTitle || item.title}</div>
                <div class="item-meta">E${item.episode} • ${time}</div>
                <div style="width:100%;height:3px;background:#333;margin-top:5px;">
                    <div style="width:${item.progress}%;height:100%;background:#e50914;"></div>
                </div>
            </div>
        </div>`;
    });
    
    html += '</div></section>';
    return html;
};

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
                if (count === episodeIndex) { 
                    url = e.url; 
                    title = e.title; 
                    break; 
                }
                count++;
            }
        }
    }
    if (url) window.playWithModernPlayer(url, `${item.title} - ${title}`, `${category} • Ep ${episodeIndex+1}`, itemId, category, episodeIndex);
};

// INJEÇÃO NO DISPLAY CONTENT
const originalDisplay = window.displayContent;
window.displayContent = function() {
    if (originalDisplay) originalDisplay();
    setTimeout(() => {
        const content = document.getElementById('content');
        if (!content) return;
        const html = window.renderContinueWatching();
        if (html) {
            const old = document.getElementById('continue-watching');
            if (old) old.remove();
            const first = content.querySelector('.category-section');
            if (first) first.insertAdjacentHTML('beforebegin', html);
            else content.insertAdjacentHTML('afterbegin', html);
        }
    }, 300);
};
    
// ===== CONTROLE GLOBAL DE FULLSCREEN =====
if (!window.__fullscreenListenerAdded) {
    document.addEventListener('fullscreenchange', () => {
        const modal = document.getElementById('modernPlayerModal');
        if (!modal) return;

        if (!document.fullscreenElement) {
            modal.classList.remove('fullscreen-active');
        } else {
            modal.classList.add('fullscreen-active');
        }
    });

    window.__fullscreenListenerAdded = true;
}

// CSS ESTILO NETFLIX
const netflixStyle = document.createElement('style');
netflixStyle.textContent = `
    .netflix-player {
        width: 100%;
        height: 100%;
        position: relative;
        background: #000;
        font-family: 'Helvetica Neue', Arial, sans-serif;
    }
    
    .netflix-video {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }
    
    .player-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        padding: 30px;
        background: linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%);
        opacity: 1;
        transition: opacity 0.3s;
        pointer-events: none;
    }
    
    .player-title h2 {
        color: white;
        margin: 0;
        font-size: 24px;
        font-weight: 500;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
    }
    
    .player-title p {
        color: #ccc;
        margin: 5px 0 0;
        font-size: 16px;
    }
    
    .player-controls {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 20px;
        background: linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%);
        opacity: 1;
        transition: opacity 0.3s;
    }
    
    .progress-container {
        position: relative;
        height: 5px;
        margin-bottom: 15px;
        cursor: pointer;
    }
    
    .progress-buffer {
        position: absolute;
        width: 100%;
        height: 100%;
        background: rgba(255,255,255,0.3);
        border-radius: 5px;
    }
    
    .progress-played {
        position: absolute;
        height: 100%;
        background: #e50914;
        border-radius: 5px;
        z-index: 1;
    }
    
    .progress-bar {
        position: absolute;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
        z-index: 2;
    }
    
    .controls-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .left-controls, .right-controls {
        display: flex;
        align-items: center;
        gap: 15px;
    }
    
    .control-btn {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 8px;
        border-radius: 4px;
        transition: 0.2s;
        display: flex;
        align-items: center;
        gap: 5px;
    }
    
    .control-btn:hover {
        background: rgba(255,255,255,0.1);
    }
    
    .volume-slider {
        width: 80px;
        height: 4px;
        cursor: pointer;
    }
    
    .time-display {
        color: white;
        font-size: 14px;
        margin-left: 10px;
    }
    
    #nextEpisodeBtn {
        background: rgba(229, 9, 20, 0.8);
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 14px;
        font-weight: bold;
        letter-spacing: 0.5px;
        transition: 0.2s;
    }
    
    #nextEpisodeBtn:hover {
        background: #e50914;
        transform: scale(1.05);
    }
    
    .loading-spinner {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }
    
    .spinner {
        width: 50px;
        height: 50px;
        border: 3px solid rgba(255,255,255,0.3);
        border-top-color: #e50914;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    
    .resume-message {
        position: absolute;
        top: 80px;
        left: 30px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        border-left: 4px solid #e50914;
        animation: slideIn 0.3s;
    }
    
    .next-episode-message {
        position: absolute;
        bottom: 100px;
        right: 30px;
        background: rgba(0,0,0,0.9);
        color: white;
        padding: 15px 25px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 20px;
        animation: slideIn 0.3s;
    }
    
    .next-episode-message button {
        background: #e50914;
        border: none;
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
    }
    
    .next-episode-message button:hover {
        background: #f40612;
    }
    
    /* Fullscreen styles */
    .netflix-player:fullscreen {
        width: 100vw;
        height: 100vh;
    }
    
    .netflix-player:fullscreen .netflix-video {
        object-fit: contain;
    }
`;

// Verificar se o estilo já não foi adicionado
if (!document.getElementById('netflix-style')) {
    netflixStyle.id = 'netflix-style';
    document.head.appendChild(netflixStyle);
}

console.log('✅ NOVO PLAYER AVANÇADO');
