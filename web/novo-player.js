// ==========================================
// 🎬 PIRATA PLAYER PRO
// ==========================================

window.ContinueWatching = {

    STORAGE_KEY: "pirataflix_progressos",

    getAll() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {};
        } catch {
            return {};
        }
    },

    save(data) {
        if (!data.videoId || data.currentTime < 10) return;

        const all = this.getAll();

        all[data.videoId] = {
            ...data,
            timestamp: Date.now(),
            progress: data.duration
                ? Math.round((data.currentTime / data.duration) * 100)
                : 0
        };

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
    },

    get(id) {
        return this.getAll()[id] || null;
    },

    remove(id) {
        const all = this.getAll();
        delete all[id];
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
    }
};


// ==========================================
// 🎥 PLAYER
// ==========================================

window.PirataPlayer = {

    currentVideo: null,
    preloadVideo: null,
    keyboardHandler: null,

    destroy() {

        if (this.currentVideo) {
            try {
                this.currentVideo.pause();
                this.currentVideo.src = "";
                this.currentVideo.load();
                this.currentVideo.remove();
            } catch(e){}
        }

        if (this.preloadVideo) {
            try {
                this.preloadVideo.src = "";
                this.preloadVideo.load();
            } catch(e){}
        }

        if (this.keyboardHandler) {
            document.removeEventListener("keydown", this.keyboardHandler);
            this.keyboardHandler = null;
        }

        this.currentVideo = null;
        this.preloadVideo = null;

        const modal = document.getElementById("modernPlayerModal");
        if (modal) modal.style.display = "none";
    },

    play(url, title, itemId=null, category=null, episodeIndex=0) {

        this.destroy();

        const modal = document.getElementById("modernPlayerModal");
        const container = document.getElementById("modern-player-container");

        if (!modal || !container) {
            window.open(url, "_blank");
            return;
        }

        modal.style.display = "flex";

        const videoId = `${itemId}_${episodeIndex}`;
        const saved = window.ContinueWatching?.get(videoId);
        const item = window.vodData?.[category]?.find(i => i.id === itemId);

        container.innerHTML = `
        <div id="player-wrapper" style="position:relative;width:100%;height:100%;background:#000;overflow:hidden;">

            <video id="current-video"
                style="width:100%;height:100%;"
                playsinline>
                <source src="${url}" type="video/mp4">
            </video>

            <div id="loading-spinner"
                style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                color:white;font-size:40px;display:none;">
                ⏳
            </div>

            <div id="controls"
                style="position:absolute;bottom:0;left:0;right:0;
                padding:20px;
                background:linear-gradient(to top, rgba(0,0,0,0.9), transparent);
                display:flex;flex-direction:column;gap:10px;
                opacity:1;
                transition:opacity 0.4s ease;">
                
                <div style="position:relative;width:100%;">
                    <div id="buffer-bar"
                        style="position:absolute;height:4px;background:#666;width:0%;top:50%;transform:translateY(-50%);">
                    </div>
                    <input type="range" id="progress-bar"
                        min="0" max="100" value="0"
                        style="width:100%;">
                </div>

                <div style="display:flex;align-items:center;gap:15px;">
                    <button id="play-btn">▶️</button>
                    <button id="back-btn">⏪</button>
                    <button id="forward-btn">⏩</button>
                    <button id="next-btn">⏭</button>
                    <button id="volume-btn">🔊</button>
                    <button id="fullscreen-btn">⛶</button>
                </div>
            </div>
        </div>
        `;

        const video = document.getElementById("current-video");
        const progress = document.getElementById("progress-bar");
        const bufferBar = document.getElementById("buffer-bar");
        const controls = document.getElementById("controls");
        const spinner = document.getElementById("loading-spinner");

        const playBtn = document.getElementById("play-btn");
        const backBtn = document.getElementById("back-btn");
        const forwardBtn = document.getElementById("forward-btn");
        const nextBtn = document.getElementById("next-btn");
        const volumeBtn = document.getElementById("volume-btn");
        const fullscreenBtn = document.getElementById("fullscreen-btn");

        this.currentVideo = video;

        if (saved?.currentTime) video.currentTime = saved.currentTime;

        video.play().catch(()=>{});

        // ======================
        // FADE AUTO-HIDE
        // ======================
        let hideTimeout;

        const showControls = () => {
            controls.style.opacity = "1";
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => {
                if (!video.paused) controls.style.opacity = "0";
            }, 3000);
        };

        container.onmousemove = showControls;
        showControls();

        // ======================
        // LOADING SPINNER
        // ======================
        video.addEventListener("waiting", ()=> spinner.style.display="block");
        video.addEventListener("playing", ()=> spinner.style.display="none");

        // ======================
        // PLAY
        // ======================
        playBtn.onclick = ()=> video.paused ? video.play() : video.pause();
        video.addEventListener("play", ()=> playBtn.textContent="⏸");
        video.addEventListener("pause", ()=> playBtn.textContent="▶️");

        backBtn.onclick = ()=> video.currentTime -= 10;
        forwardBtn.onclick = ()=> video.currentTime += 10;

        // ======================
        // PROGRESS + BUFFER
        // ======================
        video.addEventListener("timeupdate", ()=>{

            if (!video.duration) return;

            progress.value = (video.currentTime / video.duration) * 100;

            window.ContinueWatching.save({
                videoId,
                itemId,
                category,
                episodeIndex,
                title,
                currentTime: video.currentTime,
                duration: video.duration,
                url
            });

            // Pré-carregamento inteligente
            if (video.duration - video.currentTime < 40) {
                this.preloadNext(item, episodeIndex);
            }
        });

        video.addEventListener("progress", ()=>{
            if (video.buffered.length) {
                const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                const percent = (bufferedEnd / video.duration) * 100;
                bufferBar.style.width = percent + "%";
            }
        });

        progress.oninput = ()=>{
            video.currentTime = (progress.value / 100) * video.duration;
        };

        // ======================
        // VOLUME
        // ======================
        volumeBtn.onclick = ()=>{
            video.muted = !video.muted;
            volumeBtn.textContent = video.muted ? "🔇" : "🔊";
        };

        // ======================
        // FULLSCREEN
        // ======================
        fullscreenBtn.onclick = ()=>{
            const wrapper = document.getElementById("player-wrapper");
            if (!document.fullscreenElement) {
                wrapper.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        };

        // ======================
        // NEXT
        // ======================
        nextBtn.onclick = ()=>{
            if (!item) return;

            let episodes = item.episodes || [];
            if (!episodes.length && item.seasons) {
                item.seasons.forEach(s=>{
                    if (s.episodes) episodes = episodes.concat(s.episodes);
                });
            }

            if (episodeIndex + 1 < episodes.length) {
                const next = episodes[episodeIndex + 1];

                this.play(
                    next.url,
                    `${item.title} - ${next.title}`,
                    itemId,
                    category,
                    episodeIndex + 1
                );
            } else {
                this.destroy();
            }
        };

        video.addEventListener("ended", ()=> nextBtn.click());

        // ======================
        // TECLADO
        // ======================
        this.keyboardHandler = (e)=>{
            if (e.key===" ") { e.preventDefault(); playBtn.click(); }
            if (e.key==="ArrowRight") video.currentTime+=10;
            if (e.key==="ArrowLeft") video.currentTime-=10;
            if (e.key==="Escape") this.destroy();
        };

        document.addEventListener("keydown", this.keyboardHandler);
    },

    // ======================
    // PRÉ-CARREGAMENTO
    // ======================
    preloadNext(item, episodeIndex){

        if (!item || this.preloadVideo) return;

        let episodes = item.episodes || [];
        if (!episodes.length && item.seasons) {
            item.seasons.forEach(s=>{
                if (s.episodes) episodes = episodes.concat(s.episodes);
            });
        }

        if (episodeIndex + 1 >= episodes.length) return;

        const next = episodes[episodeIndex + 1];

        this.preloadVideo = document.createElement("video");
        this.preloadVideo.src = next.url;
        this.preloadVideo.preload = "auto";
    }
};
