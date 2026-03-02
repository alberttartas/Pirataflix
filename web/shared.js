// ============================================
// FUNÇÕES COMPARTILHADAS - PIRATAFLIX v2
// ============================================

window.RAW_BASE       = 'https://raw.githubusercontent.com/alberttartas/Pirataflix/main';
window._DEFAULT_POSTER = window.RAW_BASE + '/assets/Capas/default.jpg';
window.vodData         = {};
window.channelsDict    = {};

function getPoster(item, category) {
    if (category === 'tv') {
        if (item.tvg_logo && item.tvg_logo.startsWith('http')) return item.tvg_logo;
        const key = (item.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (window.channelsDict && window.channelsDict[key]) return window.channelsDict[key];
        return window.RAW_BASE + '/assets/Capas/tv_default.jpg';
    }
    if (item.poster && item.poster.startsWith('http')) return item.poster;
    const file = item.poster ? item.poster.split('/').pop() : 'default.jpg';
    return window.RAW_BASE + '/assets/Capas/' + file;
}

function safeImg(poster, altText, extraClass) {
    const cls = 'item-poster' + (extraClass ? ' ' + extraClass : '');
    return '<img src="' + poster + '" alt="' + (altText||'').replace(/"/g,'') + '" class="' + cls + '" loading="lazy" onerror="this.onerror=null;this.src=window._DEFAULT_POSTER">';
}

function item_title_from(category, itemId) {
    const items = window.vodData[category];
    if (!items) return '';
    const item = category === 'tv' ? items[parseInt(itemId)] : items.find(i => i.id === itemId);
    return item ? item.title : '';
}

function closeAllModals() {
    const m = document.getElementById('modal');
    const s = document.getElementById('search-modal');
    if (m) m.style.display = 'none';
    if (s) s.style.display = 'none';
}

function playEpisode(url, title, itemId, category, episodeIndex) {
    if (category === 'tv') {
        if (typeof window.openTVPlayer === 'function') {
            const go = () => window.openTVPlayer(parseInt(itemId));
            if (!window.vodData || !window.vodData.tv) {
                fetch('data.json').then(r => r.json()).then(d => { window.vodData = d; go(); });
            } else { go(); }
        } else { window.open(url, '_blank'); }
        closeAllModals(); return;
    }
    if (typeof window.playWithModernPlayer === 'function') {
        window.playWithModernPlayer(url, title, '', itemId, category, episodeIndex || 0);
        closeAllModals();
    } else { window.open(url, '_blank'); }
}

function playFirstEpisode(category, itemId) {
    const items = window.vodData[category];
    if (!items) return;
    const item = category === 'tv' ? items[parseInt(itemId)] : items.find(i => i.id === itemId);
    if (!item) return;
    let episodeIndex = 0;
    try {
        if (window.ContinueWatching) {
            const list = window.ContinueWatching.getAll();
            const entries = Object.values(list).filter(e => e.itemId === itemId && e.category === category);
            if (entries.length) {
                const latest = entries.sort((a,b)=>(b.timestamp||0)-(a.timestamp||0))[0];
                if (typeof latest.episodeIndex === 'number') episodeIndex = latest.episodeIndex;
            }
        }
    } catch(e) {}
    if (item.episodes && item.episodes.length) {
        const i = Math.min(episodeIndex, item.episodes.length - 1);
        playEpisode(item.episodes[i].url, item.title + ' - ' + (item.episodes[i].title || 'Ep '+(i+1)), itemId, category, i);
    } else if (item.url) {
        playEpisode(item.url, item.title, itemId, category, 0);
    } else if (item.seasons && item.seasons.length) {
        let rem = episodeIndex;
        for (const s of item.seasons) {
            const eps = s.episodes || [];
            if (rem < eps.length) { playEpisode(eps[rem].url, item.title+' - Temp '+s.season, itemId, category, episodeIndex); return; }
            rem -= eps.length;
        }
        const ep = item.seasons[0].episodes[0];
        playEpisode(ep.url, item.title+' - Temp 1 - Ep 1', itemId, category, 0);
    }
}

// =====================
// MODAL ENRIQUECIDO
// =====================
function openModal(category, itemId) {
    const items = window.vodData[category];
    if (!items) return;
    const item = category === 'tv' ? items[parseInt(itemId)] : items.find(i => i.id === itemId);
    if (!item) return;
    const posterUrl = getPoster(item, category);
    const typeLabel = {filmes:'Filme',series:'Série',novelas:'Novela',animes:'Anime',infantil:'Infantil',tv:'Canal de TV'}[category] || category;

    let headerHtml = '<div class="modal-backdrop" style="background-image:url(\'' + posterUrl.replace(/'/g,"%27") + '\')"></div>';
    if (category === 'tv') headerHtml += '<div class="live-tag">🔴 AO VIVO</div>';
    headerHtml += '<button class="play-button" data-action="play-first" data-category="' + category + '" data-id="' + itemId + '">' + (category === 'tv' ? '▶ Assistir ao Vivo' : '▶ Assistir') + '</button>';

    let bodyHtml = '<h2 class="modal-title">' + item.title + '</h2>';
    bodyHtml += '<div class="modal-meta">';
    bodyHtml += '<span class="meta-badge">' + typeLabel + '</span>';
    if (item.year)   bodyHtml += '<span class="meta-badge">📅 ' + item.year + '</span>';
    if (item.rating) bodyHtml += '<span class="meta-badge">⭐ ' + item.rating + '</span>';
    if (category === 'tv') bodyHtml += '<span class="meta-badge live-badge-sm">🔴 Ao Vivo</span>';
    bodyHtml += '</div>';
    if (item.genres && item.genres.length) {
        bodyHtml += '<div class="modal-genres">' + item.genres.map(g => '<span class="genre-tag">' + g + '</span>').join('') + '</div>';
    }
    if (item.overview) {
        bodyHtml += '<p class="modal-overview">' + item.overview + '</p>';
    }

    if (category === 'tv') {
        const canais = window.vodData['tv'] || [];
        bodyHtml += '<div class="episodes-section"><h3 class="eps-title">📡 Todos os Canais</h3><div class="episode-list">';
        canais.forEach((canal, idx) => {
            const isAtual  = String(idx) === String(itemId);
            const canalUrl = (canal.episodes && canal.episodes[0]) ? canal.episodes[0].url : canal.url || '';
            bodyHtml += '<div class="episode-item' + (isAtual ? ' canal-ativo' : '') + '" data-action="play-canal" data-url="' + canalUrl + '" data-id="' + idx + '" data-title="' + canal.title.replace(/"/g,'') + '" data-category="tv">';
            if (canal.tvg_logo) bodyHtml += '<img src="' + canal.tvg_logo + '" style="width:40px;height:40px;object-fit:contain;background:#222;border-radius:4px;flex-shrink:0" onerror="this.remove()">';
            else bodyHtml += '<div class="episode-number">📺</div>';
            bodyHtml += '<div class="episode-info"><div class="episode-title">' + canal.title + (isAtual ? ' <span style="color:#e50914;font-size:.8rem">● AO VIVO</span>' : '') + '</div></div></div>';
        });
        bodyHtml += '</div></div>';
    } else if (item.seasons && item.seasons.length) {
        bodyHtml += '<div class="episodes-section">';
        item.seasons.slice().sort((a,b) => a.season - b.season).forEach(season => {
            bodyHtml += '<h3 class="eps-title">🎬 Temporada ' + season.season + '</h3><div class="episode-list">';
            season.episodes.forEach((ep, index) => {
                const num = ep.episode || (index+1);
                const t   = (ep.title || 'Episódio '+num).replace(/"/g,'');
                bodyHtml += '<div class="episode-item" data-action="play-ep" data-url="' + ep.url + '" data-title="' + t + '" data-itemid="' + itemId + '" data-category="' + category + '" data-index="' + index + '">';
                bodyHtml += '<div class="episode-number">' + num + '</div>';
                bodyHtml += '<div class="episode-info"><div class="episode-title">' + t + '</div></div></div>';
            });
            bodyHtml += '</div>';
        });
        bodyHtml += '</div>';
    } else if (item.episodes && item.episodes.length) {
        bodyHtml += '<div class="episodes-section"><h3 class="eps-title">Episódios</h3><div class="episode-list">';
        item.episodes.forEach((ep, index) => {
            const t = (ep.title || item.title).replace(/"/g,'');
            bodyHtml += '<div class="episode-item" data-action="play-ep" data-url="' + ep.url + '" data-title="' + t + '" data-itemid="' + itemId + '" data-category="' + category + '" data-index="' + index + '">';
            bodyHtml += '<div class="episode-number">' + (index+1) + '</div>';
            bodyHtml += '<div class="episode-info"><div class="episode-title">' + t + '</div></div></div>';
        });
        bodyHtml += '</div></div>';
    }

    document.getElementById('modalHeader').innerHTML = headerHtml;
    document.getElementById('modalBody').innerHTML   = bodyHtml;
    document.getElementById('modal').style.display  = 'block';
    document.getElementById('modal').scrollTop      = 0;
}

// =====================
// BUSCA GLOBAL
// =====================
function initSearch() {
    if (!document.getElementById('search-modal')) {
        const el = document.createElement('div');
        el.id = 'search-modal';
        el.innerHTML = `
            <div class="search-overlay" id="searchOverlay">
                <div class="search-box">
                    <div class="search-input-wrap">
                        <i class="fas fa-search search-icon-inp"></i>
                        <input type="text" id="searchInput" placeholder="Buscar filmes, séries, canais..." autocomplete="off">
                        <button id="searchClose"><i class="fas fa-times"></i></button>
                    </div>
                    <div id="searchResults"></div>
                </div>
            </div>`;
        document.body.appendChild(el);
        document.getElementById('searchClose').onclick = () => { el.style.display = 'none'; };
        document.getElementById('searchOverlay').onclick = (e) => { if (e.target.id === 'searchOverlay') el.style.display = 'none'; };
        const input = document.getElementById('searchInput');
        let t;
        input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => doSearch(input.value.trim()), 200); });
        input.addEventListener('keydown', (e) => { if (e.key === 'Escape') el.style.display = 'none'; });
    }

    const header = document.querySelector('.header, header');
    if (header && !document.getElementById('search-trigger')) {
        const btn = document.createElement('button');
        btn.id = 'search-trigger';
        btn.innerHTML = '<i class="fas fa-search"></i>';
        btn.title = 'Buscar (/)';
        btn.onclick = openSearch;
        header.appendChild(btn);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); openSearch(); }
    });
}

function openSearch() {
    const modal = document.getElementById('search-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    const input = document.getElementById('searchInput');
    if (input) { input.value = ''; input.focus(); }
    document.getElementById('searchResults').innerHTML = '';
}

function doSearch(query) {
    const container = document.getElementById('searchResults');
    if (!query || query.length < 2) { container.innerHTML = ''; return; }
    const normalize = s => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const q = normalize(query);
    const cats = {filmes:'🎬',series:'📺',novelas:'💖',animes:'👻',infantil:'🧸',tv:'📡'};
    const results = [];
    for (const [cat, icon] of Object.entries(cats)) {
        (window.vodData[cat]||[]).forEach((item, idx) => {
            if (normalize(item.title).includes(q)) results.push({item, cat, icon, idx});
        });
    }
    if (!results.length) {
        container.innerHTML = '<div class="search-empty">Nenhum resultado para "<strong>' + query + '</strong>"</div>';
        return;
    }
    let html = '<div class="search-count">' + results.length + ' resultado' + (results.length>1?'s':'') + '</div><div class="search-list">';
    results.slice(0,40).forEach(({item, cat, icon, idx}) => {
        const poster = getPoster(item, cat);
        const id     = cat === 'tv' ? idx : item.id;
        const year   = item.year   ? ' · ' + item.year   : '';
        const rating = item.rating ? ' · ⭐' + item.rating : '';
        html += '<div class="search-item" data-category="' + cat + '" data-id="' + id + '">'
            + '<img src="' + poster + '" alt="" onerror="this.onerror=null;this.src=window._DEFAULT_POSTER">'
            + '<div class="search-item-info">'
            + '<div class="search-item-title">' + item.title + '</div>'
            + '<div class="search-item-meta">' + icon + ' ' + cat + year + rating + '</div>'
            + '</div></div>';
    });
    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll('.search-item').forEach(el => {
        el.onclick = () => {
            document.getElementById('search-modal').style.display = 'none';
            openModal(el.dataset.category, el.dataset.id);
        };
    });
}

// =====================
// HAMBURGER MOBILE
// =====================
function initHamburger() {
    const header   = document.querySelector('.header, header');
    const navLinks = document.querySelector('.nav-links');
    if (!header || !navLinks || document.getElementById('hamburger-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'hamburger-btn';
    btn.className = 'hamburger';
    btn.setAttribute('aria-label', 'Menu');
    btn.innerHTML = '<span></span><span></span><span></span>';
    btn.onclick = () => navLinks.classList.toggle('open');
    header.insertBefore(btn, navLinks);
    // fechar menu ao clicar em link
    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('open')));
}

// =====================
// CARREGAR CHANNELS
// =====================
function loadChannels() {
    return fetch('channels.json')
        .then(r => r.json())
        .then(data => {
            window.channelsDict = {};
            data.forEach(c => {
                if (c.tvg_logo) {
                    const k = (c.title||c.name||c.tvg_name||'').toLowerCase().replace(/[^a-z0-9]/g,'');
                    if (k) window.channelsDict[k] = c.tvg_logo;
                }
            });
            return window.channelsDict;
        }).catch(() => ({}));
}

// =====================
// SETUP MODAL LISTENERS
// =====================
function setupModalListeners() {
    const modal = document.getElementById('modal');
    const closeBtn = document.getElementById('closeModal');
    if (modal) {
        modal.addEventListener('click', e => {
            const el = e.target.closest('[data-action]');
            if (!el) return;
            if (el.dataset.action === 'play-first') {
                playFirstEpisode(el.dataset.category, el.dataset.id);
            } else if (el.dataset.action === 'play-canal') {
                modal.style.display = 'none';
                playEpisode(el.dataset.url, el.dataset.title||'', el.dataset.id, 'tv', 0);
            } else if (el.dataset.action === 'play-ep') {
                modal.style.display = 'none';
                playEpisode(el.dataset.url, item_title_from(el.dataset.category, el.dataset.itemid)+' - '+(el.dataset.title||''), el.dataset.itemid, el.dataset.category, parseInt(el.dataset.index)||0);
            }
        });
        if (closeBtn) closeBtn.onclick = () => (modal.style.display = 'none');
    }
    window.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllModals(); });
}

// =====================
// INJECT CSS
// =====================
(function() {
    if (document.getElementById('pirataflix-shared-css')) return;
    const s = document.createElement('style');
    s.id = 'pirataflix-shared-css';
    s.textContent = `
    #search-trigger {
        background:none;border:none;color:#e5e5e5;font-size:1.1rem;
        cursor:pointer;padding:6px 10px;transition:color .2s;margin-left:8px;
    }
    #search-trigger:hover{color:#e50914;}
    #search-modal{
        display:none;position:fixed;inset:0;z-index:99999;
        align-items:flex-start;justify-content:center;
    }
    .search-overlay{
        position:absolute;inset:0;background:rgba(0,0,0,.88);
        display:flex;justify-content:center;align-items:flex-start;padding-top:70px;
    }
    .search-box{
        background:#1a1a1a;border-radius:12px;width:90%;max-width:680px;
        max-height:80vh;display:flex;flex-direction:column;overflow:hidden;
        box-shadow:0 20px 60px rgba(0,0,0,.9);border:1px solid rgba(255,255,255,.08);
    }
    .search-input-wrap{
        display:flex;align-items:center;gap:12px;padding:16px 20px;
        border-bottom:1px solid rgba(255,255,255,.08);
    }
    .search-icon-inp{color:#555;font-size:.95rem;}
    #searchInput{
        flex:1;background:none;border:none;outline:none;
        color:white;font-size:1.05rem;font-family:Arial,sans-serif;
    }
    #searchInput::placeholder{color:#444;}
    #searchClose{background:none;border:none;color:#555;font-size:.9rem;cursor:pointer;padding:4px;transition:color .2s;}
    #searchClose:hover{color:white;}
    #searchResults{overflow-y:auto;padding:8px 0;}
    .search-count{color:#666;font-size:.82rem;padding:8px 20px;}
    .search-list{display:flex;flex-direction:column;}
    .search-item{
        display:flex;align-items:center;gap:14px;padding:10px 20px;
        cursor:pointer;transition:background .15s;
    }
    .search-item:hover{background:rgba(255,255,255,.06);}
    .search-item img{width:46px;height:64px;object-fit:cover;border-radius:4px;flex-shrink:0;background:#111;}
    .search-item-title{font-weight:bold;font-size:.92rem;margin-bottom:3px;}
    .search-item-meta{font-size:.78rem;color:#666;}
    .search-empty{color:#555;text-align:center;padding:28px 20px;font-size:.9rem;}
    .meta-badge{
        background:rgba(255,255,255,.1);border-radius:4px;
        padding:3px 9px;font-size:.78rem;color:#ccc;
    }
    .live-badge-sm{background:rgba(229,9,20,.18);color:#e50914;}
    .live-tag{
        position:absolute;top:20px;left:20px;background:#e50914;color:white;
        padding:5px 12px;border-radius:4px;font-weight:bold;font-size:.82rem;
    }
    .modal-genres{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0;}
    .genre-tag{
        background:rgba(229,9,20,.12);border:1px solid rgba(229,9,20,.25);
        color:#e50914;border-radius:20px;padding:2px 9px;font-size:.73rem;
    }
    .modal-overview{
        color:#aaa;font-size:.88rem;line-height:1.6;
        margin:12px 0 0;max-height:130px;overflow-y:auto;
    }
    .eps-title{margin:18px 0 8px;color:#e50914;font-size:1rem;}
    .hamburger{
        display:none;flex-direction:column;gap:5px;
        cursor:pointer;background:none;border:none;padding:5px;
    }
    .hamburger span{display:block;width:23px;height:2px;background:white;border-radius:2px;transition:.3s;}
    @media(max-width:768px){
        .hamburger{display:flex;}
        .nav-links{
            display:none;position:fixed;top:60px;left:0;right:0;
            background:rgba(15,15,15,.98);flex-direction:column;
            padding:16px 20px;gap:12px;z-index:200;
            border-bottom:1px solid rgba(255,255,255,.08);
        }
        .nav-links.open{display:flex;}
        .nav-link{font-size:.95rem;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);}
    }
    `;
    document.head.appendChild(s);
})();

document.addEventListener('DOMContentLoaded', () => {
    initSearch();
    initHamburger();
    setupModalListeners();
});

window.getPoster           = getPoster;
window.safeImg             = safeImg;
window.item_title_from     = item_title_from;
window.playEpisode         = playEpisode;
window.playFirstEpisode    = playFirstEpisode;
window.openModal           = openModal;
window.openSearch          = openSearch;
window.loadChannels        = loadChannels;
window.setupModalListeners = setupModalListeners;
window.closeAllModals      = closeAllModals;
console.log('✅ Pirataflix shared.js v2 carregado');
