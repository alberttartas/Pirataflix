// ============================================
// PLAYER AVANÇADO DE TV - VERSÃO INDEPENDENTE
// ============================================

(function() {
    // Aguardar DOM carregar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTVPlayer);
    } else {
        initTVPlayer();
    }
    
    function initTVPlayer() {
        // Elementos do player
        const container = document.getElementById('tvPlayerContainer');
        const video = document.getElementById('tvPlayer');
        
        // Se não existir, criar
        if (!container) {
            createTVPlayerElements();
        }
    }
    
    function createTVPlayerElements() {
        // Criar container
        const container = document.createElement('div');
        container.className = 'tv-player-container';
        container.id = 'tvPlayerContainer';
        
        // Criar HTML do player
        container.innerHTML = `
            <video id="tvPlayer" autoplay playsinline></video>
            
            <div class="tv-controls">
                <div class="tv-controls-top">
                    <div class="tv-channel-info" id="tvChannelInfo">
                        <img id="tvCurrentLogo" class="tv-channel-logo" src="" alt="">
                        <span id="tvCurrentName" class="tv-channel-name">Carregando...</span>
                    </div>
                    
                    <div class="tv-channel-next" id="tvNextChannel">
                        <img id="tvNextLogo" class="tv-next-thumb" src="" alt="">
                        <div class="tv-next-info">
                            <span class="tv-next-label">PRÓXIMO</span>
                            <span id="tvNextName" class="tv-next-title"></span>
                        </div>
                        <i class="fas fa-step-forward"></i>
                    </div>
                </div>
                
                <div class="tv-controls-bottom">
                    <button class="tv-control-btn" id="tvPlayPause"><i class="fas fa-pause"></i></button>
                    
                    <div class="tv-progress-bar" id="tvProgressBar">
                        <div class="tv-progress-fill" id="tvProgressFill"></div>
                    </div>
                    
                    <span class="tv-time" id="tvTime">00:00 / 00:00</span>
                    
                    <div class="tv-volume-control">
                        <button class="tv-control-btn" id="tvMute"><i class="fas fa-volume-up"></i></button>
                        <div class="tv-volume-slider" id="tvVolumeSlider">
                            <div class="tv-volume-fill" id="tvVolumeFill" style="width: 100%;"></div>
                        </div>
                        <span class="tv-time" id="tvVolumePercent">100%</span>
                    </div>
                    
                    <div class="tv-controls-small">
                        <button class="tv-control-btn" id="tvPrevChannel"><i class="fas fa-backward"></i></button>
                        <button class="tv-control-btn" id="tvNextChannelBtn"><i class="fas fa-forward"></i></button>
                        <button class="tv-control-btn" id="tvFullscreen"><i class="fas fa-expand"></i></button>
                        <button class="tv-control-btn" id="tvClosePlayer"><i class="fas fa-times"></i></button>
                    </div>
                </div>
            </div>
            
            <div class="tv-channel-list" id="tvChannelList"></div>
        `;
        
        document.body.appendChild(container);
        
        // Inicializar lógica do player
        initTVLogic();
    }
    
    function initTVLogic() {
        const container = document.getElementById('tvPlayerContainer');
        const video = document.getElementById('tvPlayer');
        let currentChannelIndex = 0;
        let channels = [];
        let isPlaying = true;
        let isMuted = false;
        let volume = 1;
        let listVisible = false;
        
        // Elementos
        const currentLogo = document.getElementById('tvCurrentLogo');
        const currentName = document.getElementById('tvCurrentName');
        const nextLogo = document.getElementById('tvNextLogo');
        const nextName = document.getElementById('tvNextName');
        const playPauseBtn = document.getElementById('tvPlayPause');
        const progressBar = document.getElementById('tvProgressBar');
        const progressFill = document.getElementById('tvProgressFill');
        const timeDisplay = document.getElementById('tvTime');
        const muteBtn = document.getElementById('tvMute');
        const volumeSlider = document.getElementById('tvVolumeSlider');
        const volumeFill = document.getElementById('tvVolumeFill');
        const volumePercent = document.getElementById('tvVolumePercent');
        const prevBtn = document.getElementById('tvPrevChannel');
        const nextBtn = document.getElementById('tvNextChannelBtn');
        const nextChannelDiv = document.getElementById('tvNextChannel');
        const fullscreenBtn = document.getElementById('tvFullscreen');
        const closeBtn = document.getElementById('tvClosePlayer');
        const channelList = document.getElementById('tvChannelList');
        const channelInfo = document.getElementById('tvChannelInfo');
        
        // Função para pegar poster (usa a mesma do app principal)
        function getPoster(item, category) {
            if (category === 'tv') {
                if (item.tvg_logo && item.tvg_logo.startsWith('http')) return item.tvg_logo;
                var key = (item.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                if (window.channelsDict && window.channelsDict[key]) return window.channelsDict[key];
                return window._DEFAULT_POSTER || 'https://raw.githubusercontent.com/alberttartas/Pirataflix/main/assets/Capas/tv_default.jpg';
            }
            return window._DEFAULT_POSTER;
        }
        
        // Abrir player
        window.openTVPlayer = function(index) {
            channels = window.vodData?.tv || [];
            if (!channels.length) {
                alert('Nenhum canal disponível');
                return;
            }
            
            currentChannelIndex = index || 0;
            loadChannel(currentChannelIndex);
            container.classList.add('active');
            updateChannelList();
            
            // Focar no player para capturar teclas
            video.focus();
        };
        
        // Carregar canal
        function loadChannel(index) {
            if (!channels[index]) return;
            
            const canal = channels[index];
            const url = canal.episodes?.[0]?.url || canal.url;
            
            if (!url) return;
            
            video.src = url;
            video.play().catch(e => console.log('Autoplay bloqueado:', e));
            isPlaying = true;
            updatePlayPauseIcon();
            
            // Atualizar informações
            currentLogo.src = getPoster(canal, 'tv') || window._DEFAULT_POSTER;
            currentName.textContent = canal.title;
            
            // Próximo canal
            const nextIndex = (index + 1) % channels.length;
            const nextCanal = channels[nextIndex];
            nextLogo.src = getPoster(nextCanal, 'tv') || window._DEFAULT_POSTER;
            nextName.textContent = nextCanal.title;
            
            // Destacar na lista
            updateChannelList();
        }
        
        // Play/Pause
        function togglePlay() {
            if (video.paused) {
                video.play();
                isPlaying = true;
            } else {
                video.pause();
                isPlaying = false;
            }
            updatePlayPauseIcon();
        }
        
        function updatePlayPauseIcon() {
            const icon = playPauseBtn.querySelector('i');
            icon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
        }
        
        // Volume
        function setVolume(value) {
            volume = Math.max(0, Math.min(1, value));
            video.volume = volume;
            volumeFill.style.width = (volume * 100) + '%';
            volumePercent.textContent = Math.round(volume * 100) + '%';
            
            const icon = muteBtn.querySelector('i');
            if (volume === 0) {
                icon.className = 'fas fa-volume-mute';
            } else if (volume < 0.5) {
                icon.className = 'fas fa-volume-down';
            } else {
                icon.className = 'fas fa-volume-up';
            }
        }
        
        function toggleMute() {
            isMuted = !isMuted;
            video.muted = isMuted;
            setVolume(isMuted ? 0 : volume);
        }
        
        // Tempo
        function updateTime() {
            if (!video.duration) return;
            
            const current = video.currentTime;
            const duration = video.duration;
            const percent = (current / duration) * 100;
            
            progressFill.style.width = percent + '%';
            
            const format = (s) => {
                if (!s || isNaN(s)) return '00:00';
                const mins = Math.floor(s / 60);
                const secs = Math.floor(s % 60);
                return (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
            };
            
            timeDisplay.textContent = format(current) + ' / ' + format(duration);
        }
        
        function seek(e) {
            const rect = progressBar.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            video.currentTime = pos * video.duration;
        }
        
        // Navegação
        function nextChannel() {
            currentChannelIndex = (currentChannelIndex + 1) % channels.length;
            loadChannel(currentChannelIndex);
        }
        
        function prevChannel() {
            currentChannelIndex = (currentChannelIndex - 1 + channels.length) % channels.length;
            loadChannel(currentChannelIndex);
        }
        
        // Fullscreen
        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                container.requestFullscreen();
                fullscreenBtn.querySelector('i').className = 'fas fa-compress';
            } else {
                document.exitFullscreen();
                fullscreenBtn.querySelector('i').className = 'fas fa-expand';
            }
        }
        
        // Lista de canais
        function updateChannelList() {
            if (!channels.length) return;
            
            let html = '';
            channels.forEach((canal, idx) => {
                const isActive = idx === currentChannelIndex;
                const logo = getPoster(canal, 'tv') || window._DEFAULT_POSTER;
                
                html += `
                    <div class="tv-channel-list-item ${isActive ? 'active' : ''}" data-index="${idx}">
                        <img src="${logo}" class="tv-channel-list-logo" onerror="this.src=window._DEFAULT_POSTER">
                        <div class="tv-channel-list-title">${canal.title}</div>
                        ${isActive ? '<span class="tv-channel-list-now">🔴 AO VIVO</span>' : ''}
                    </div>
                `;
            });
            
            channelList.innerHTML = html;
        }
        
        // Event Listeners
        video.addEventListener('timeupdate', updateTime);
        video.addEventListener('ended', nextChannel);
        
        playPauseBtn.addEventListener('click', togglePlay);
        video.addEventListener('click', togglePlay);
        
        progressBar.addEventListener('click', seek);
        
        muteBtn.addEventListener('click', toggleMute);
        
        volumeSlider.addEventListener('click', function(e) {
            const rect = volumeSlider.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            setVolume(pos);
            if (isMuted) {
                isMuted = false;
                video.muted = false;
            }
        });
        
        prevBtn.addEventListener('click', prevChannel);
        nextBtn.addEventListener('click', nextChannel);
        nextChannelDiv.addEventListener('click', nextChannel);
        
        fullscreenBtn.addEventListener('click', toggleFullscreen);
        
        closeBtn.addEventListener('click', function() {
            container.classList.remove('active');
            video.pause();
            video.src = '';
        });
        
        // Lista de canais
        channelInfo.addEventListener('click', function() {
            listVisible = !listVisible;
            channelList.classList.toggle('active', listVisible);
            updateChannelList();
        });
        
        channelList.addEventListener('click', function(e) {
            const item = e.target.closest('.tv-channel-list-item');
            if (!item) return;
            
            const index = parseInt(item.dataset.index);
            if (!isNaN(index)) {
                currentChannelIndex = index;
                loadChannel(index);
                channelList.classList.remove('active');
                listVisible = false;
            }
        });
        
        // Teclas de atalho
        document.addEventListener('keydown', function(e) {
            if (!container.classList.contains('active')) return;
            
            switch(e.key) {
                case ' ':
                case 'Space':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    prevChannel();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    nextChannel();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setVolume(Math.min(1, volume + 0.1));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setVolume(Math.max(0, volume - 0.1));
                    break;
                case 'f':
                case 'F':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case 'Escape':
                    if (listVisible) {
                        channelList.classList.remove('active');
                        listVisible = false;
                    } else {
                        container.classList.remove('active');
                        video.pause();
                        video.src = '';
                    }
                    break;
            }
        });
    }
})();
