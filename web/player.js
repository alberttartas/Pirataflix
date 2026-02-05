// player.js - Modern Video Player
class ModernVideoPlayer {
    constructor(options = {}) {
        this.options = {
            containerId: 'modern-player-container',
            autoPlay: true,
            skipSeconds: 10,
            ...options
        };
        
        this.player = null;
        this.video = null;
        this.isPlaying = false;
        this.isFullscreen = false;
        this.isMuted = false;
        this.volume = 1.0;
        this.controlsVisible = true;
        this.controlsTimeout = null;
        
        this.init();
    }
    
    init() {
        this.createPlayer();
        this.setupControls();
        this.setupEvents();
        this.hideControlsAfterDelay();
    }
    
    createPlayer() {
        const container = document.getElementById(this.options.containerId);
        if (!container) {
            console.error(`Container #${this.options.containerId} não encontrado`);
            return;
        }
        
        container.innerHTML = `
            <div class="video-player">
                <video class="video-element" ${this.options.autoPlay ? 'autoplay' : ''} playsinline>
                    Seu navegador não suporta o elemento de vídeo.
                </video>
                
                <div class="player-controls">
                    <!-- Top controls -->
                    <div class="top-controls">
                        <button class="control-btn back-btn" title="Voltar">
                            <i class="fas fa-arrow-left"></i>
                        </button>
                        <div class="video-title"></div>
                        <button class="control-btn settings-btn" title="Configurações">
                            <i class="fas fa-cog"></i>
                        </button>
                    </div>
                    
                    <!-- Center controls -->
                    <div class="center-controls">
                        <button class="control-btn big-btn rewind-btn" title="Retroceder ${this.options.skipSeconds}s">
                            <i class="fas fa-backward"></i>
                        </button>
                        <button class="control-btn big-btn play-pause-btn" title="Play/Pause">
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="control-btn big-btn forward-btn" title="Avançar ${this.options.skipSeconds}s">
                            <i class="fas fa-forward"></i>
                        </button>
                    </div>
                    
                    <!-- Bottom controls -->
                    <div class="bottom-controls">
                        <div class="time-display">
                            <span class="current-time">00:00</span> / 
                            <span class="duration">00:00</span>
                        </div>
                        
                        <div class="progress-container">
                            <div class="progress-bar">
                                <div class="progress-fill"></div>
                                <div class="progress-thumb"></div>
                            </div>
                        </div>
                        
                        <button class="control-btn volume-btn" title="Volume">
                            <i class="fas fa-volume-up"></i>
                        </button>
                        
                        <button class="control-btn fullscreen-btn" title="Tela Cheia">
                            <i class="fas fa-expand"></i>
                        </button>
                    </div>
                </div>
                
                <!-- Loading spinner -->
                <div class="loading-spinner">
                    <div class="spinner"></div>
                </div>
                
                <!-- Error message -->
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erro ao carregar o vídeo</p>
                    <button class="retry-btn">Tentar Novamente</button>
                </div>
            </div>
        `;
        
        this.video = container.querySelector('.video-element');
        this.player = container.querySelector('.video-player');
    }
    
    setupControls() {
        // Elementos DOM
        this.playPauseBtn = this.player.querySelector('.play-pause-btn');
        this.rewindBtn = this.player.querySelector('.rewind-btn');
        this.forwardBtn = this.player.querySelector('.forward-btn');
        this.volumeBtn = this.player.querySelector('.volume-btn');
        this.fullscreenBtn = this.player.querySelector('.fullscreen-btn');
        this.backBtn = this.player.querySelector('.back-btn');
        this.settingsBtn = this.player.querySelector('.settings-btn');
        this.retryBtn = this.player.querySelector('.retry-btn');
        
        this.progressBar = this.player.querySelector('.progress-bar');
        this.progressFill = this.player.querySelector('.progress-fill');
        this.progressThumb = this.player.querySelector('.progress-thumb');
        
        this.currentTimeEl = this.player.querySelector('.current-time');
        this.durationEl = this.player.querySelector('.duration');
        this.videoTitleEl = this.player.querySelector('.video-title');
        
        this.loadingSpinner = this.player.querySelector('.loading-spinner');
        this.errorMessage = this.player.querySelector('.error-message');
    }
    
    setupEvents() {
        // Eventos do vídeo
        this.video.addEventListener('loadedmetadata', () => this.onVideoLoaded());
        this.video.addEventListener('timeupdate', () => this.updateProgress());
        this.video.addEventListener('play', () => this.onPlay());
        this.video.addEventListener('pause', () => this.onPause());
        this.video.addEventListener('waiting', () => this.showLoading());
        this.video.addEventListener('playing', () => this.hideLoading());
        this.video.addEventListener('error', () => this.showError());
        this.video.addEventListener('volumechange', () => this.updateVolume());
        
        // Eventos dos controles
        this.playPauseBtn.addEventListener('click', () => this.togglePlay());
        this.rewindBtn.addEventListener('click', () => this.rewind());
        this.forwardBtn.addEventListener('click', () => this.forward());
        this.volumeBtn.addEventListener('click', () => this.toggleMute());
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        this.backBtn.addEventListener('click', () => this.goBack());
        this.settingsBtn.addEventListener('click', () => this.showSettings());
        this.retryBtn.addEventListener('click', () => this.retry());
        
        // Eventos da barra de progresso
        this.progressBar.addEventListener('click', (e) => this.seek(e));
        this.progressThumb.addEventListener('mousedown', () => this.startDragging());
        
        // Eventos de mouse e teclado
        this.player.addEventListener('mousemove', () => this.showControls());
        this.player.addEventListener('mouseleave', () => this.hideControlsAfterDelay());
        
        // Eventos de teclado
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // Eventos de fullscreen
        document.addEventListener('fullscreenchange', () => this.onFullscreenChange());
        document.addEventListener('webkitfullscreenchange', () => this.onFullscreenChange());
        document.addEventListener('mozfullscreenchange', () => this.onFullscreenChange());
        document.addEventListener('MSFullscreenChange', () => this.onFullscreenChange());
    }
    
    // Métodos principais
    load(url, title = '') {
        this.video.src = url;
        if (title) {
            this.videoTitleEl.textContent = title;
        }
        
        this.hideError();
        this.showLoading();
        
        // Tentar carregar
        this.video.load();
    }
    
    togglePlay() {
        if (this.video.paused) {
            this.video.play();
        } else {
            this.video.pause();
        }
    }
    
    rewind() {
        this.video.currentTime = Math.max(0, this.video.currentTime - this.options.skipSeconds);
    }
    
    forward() {
        this.video.currentTime = Math.min(this.video.duration, this.video.currentTime + this.options.skipSeconds);
    }
    
    toggleMute() {
        this.video.muted = !this.video.muted;
        this.isMuted = this.video.muted;
        this.updateVolumeIcon();
    }
    
    toggleFullscreen() {
        if (!this.isFullscreen) {
            if (this.player.requestFullscreen) {
                this.player.requestFullscreen();
            } else if (this.player.webkitRequestFullscreen) {
                this.player.webkitRequestFullscreen();
            } else if (this.player.mozRequestFullScreen) {
                this.player.mozRequestFullScreen();
            } else if (this.player.msRequestFullscreen) {
                this.player.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }
    
    // Métodos auxiliares
    onVideoLoaded() {
        this.durationEl.textContent = this.formatTime(this.video.duration);
        this.hideLoading();
    }
    
    updateProgress() {
        if (!this.video.duration) return;
        
        const progress = (this.video.currentTime / this.video.duration) * 100;
        this.progressFill.style.width = `${progress}%`;
        this.progressThumb.style.left = `${progress}%`;
        this.currentTimeEl.textContent = this.formatTime(this.video.currentTime);
    }
    
    seek(e) {
        const rect = this.progressBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        this.video.currentTime = pos * this.video.duration;
    }
    
    startDragging() {
        const onMouseMove = (e) => {
            const rect = this.progressBar.getBoundingClientRect();
            const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            this.video.currentTime = pos * this.video.duration;
        };
        
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }
    
    onPlay() {
        this.isPlaying = true;
        this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    }
    
    onPause() {
        this.isPlaying = false;
        this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    }
    
    updateVolume() {
        this.volume = this.video.volume;
        this.updateVolumeIcon();
    }
    
    updateVolumeIcon() {
        if (this.video.muted || this.volume === 0) {
            this.volumeBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        } else if (this.volume < 0.5) {
            this.volumeBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
        } else {
            this.volumeBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
        }
    }
    
    onFullscreenChange() {
        this.isFullscreen = !!(document.fullscreenElement || 
                              document.webkitFullscreenElement || 
                              document.mozFullScreenElement || 
                              document.msFullscreenElement);
        
        this.fullscreenBtn.innerHTML = this.isFullscreen ? 
            '<i class="fas fa-compress"></i>' : 
            '<i class="fas fa-expand"></i>';
    }
    
    goBack() {
        // Fechar modal ou voltar à lista
        const modal = document.getElementById('modernPlayerModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.video.pause();
    }
    
    showSettings() {
        // Implementar menu de configurações
        console.log('Abrir configurações');
    }
    
    retry() {
        this.video.load();
        this.hideError();
        this.showLoading();
    }
    
    showLoading() {
        this.loadingSpinner.style.display = 'flex';
    }
    
    hideLoading() {
        this.loadingSpinner.style.display = 'none';
    }
    
    showError() {
        this.errorMessage.style.display = 'flex';
    }
    
    hideError() {
        this.errorMessage.style.display = 'none';
    }
    
    showControls() {
        this.player.querySelector('.player-controls').style.opacity = '1';
        this.controlsVisible = true;
        this.hideControlsAfterDelay();
    }
    
    hideControlsAfterDelay() {
        if (this.controlsTimeout) {
            clearTimeout(this.controlsTimeout);
        }
        
        this.controlsTimeout = setTimeout(() => {
            if (this.isPlaying) {
                this.player.querySelector('.player-controls').style.opacity = '0';
                this.controlsVisible = false;
            }
        }, 3000);
    }
    
    handleKeyPress(e) {
        switch(e.key.toLowerCase()) {
            case ' ':
            case 'k':
                e.preventDefault();
                this.togglePlay();
                break;
            case 'f':
                this.toggleFullscreen();
                break;
            case 'm':
                this.toggleMute();
                break;
            case 'arrowleft':
            case 'j':
                e.preventDefault();
                this.rewind();
                break;
            case 'arrowright':
            case 'l':
                e.preventDefault();
                this.forward();
                break;
            case 'arrowup':
                e.preventDefault();
                this.video.volume = Math.min(1, this.video.volume + 0.1);
                break;
            case 'arrowdown':
                e.preventDefault();
                this.video.volume = Math.max(0, this.video.volume - 0.1);
                break;
            case 'escape':
                if (this.isFullscreen) {
                    this.toggleFullscreen();
                } else {
                    this.goBack();
                }
                break;
        }
    }
    
    formatTime(seconds) {
        if (isNaN(seconds)) return '00:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    // Destructor
    destroy() {
        if (this.video) {
            this.video.pause();
            this.video.src = '';
            this.video.load();
        }
        
        if (this.controlsTimeout) {
            clearTimeout(this.controlsTimeout);
        }
        
        // Remover event listeners
        document.removeEventListener('keydown', this.handleKeyPress);
    }
}

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModernVideoPlayer;
} else {
    window.ModernVideoPlayer = ModernVideoPlayer;
}