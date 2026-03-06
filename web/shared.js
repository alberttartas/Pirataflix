// ============================================
// PIRATAFLIX shared.js v4 - COM CATEGORIAS DE TV
// ============================================

window.RAW_BASE        = 'https://raw.githubusercontent.com/alberttartas/Pirataflix/main';
window._DEFAULT_POSTER = window.RAW_BASE + '/assets/Capas/default.jpg';
window.vodData         = {};
window.channelsDict    = {};

// Lista de todas as categorias de TV
window.TV_CATEGORIES = [
    'tv_geral', 'tv_noticias', 'tv_esportes', 'tv_filmes', 'tv_series',
    'tv_novelas', 'tv_animes', 'tv_entretenimento', 'tv_religioso', 'tv_infantil',
    'tv_musica', 'tv_educacao', 'tv_documentario', 'tv_natureza', 'tv_animacao',
    'tv_comedia', 'tv_cultura', 'tv_legislativo', 'tv_ciencia', 'tv_shopping',
    'tv_culinaria', 'tv_viagem', 'tv_automovel', 'tv_lifestyle', 'tv_classicos',
    'tv_familia', 'tv_negocios', 'tv_clima'
];

// Mapeamento para nomes bonitos
window.TV_CATEGORY_NAMES = {
    'tv_geral': '📺 Geral',
    'tv_noticias': '📰 Notícias',
    'tv_esportes': '⚽ Esportes',
    'tv_filmes': '🎬 Filmes',
    'tv_series': '📺 Séries',
    'tv_novelas': '💖 Novelas',
    'tv_animes': '👻 Animes',
    'tv_entretenimento': '🎭 Entretenimento',
    'tv_religioso': '✝️ Religioso',
    'tv_infantil': '🧸 Infantil',
    'tv_musica': '🎵 Música',
    'tv_educacao': '📚 Educação',
    'tv_documentario': '🎥 Documentário',
    'tv_natureza': '🌿 Natureza',
    'tv_animacao': '🎨 Animação',
    'tv_comedia': '😂 Comédia',
    'tv_cultura': '🎨 Cultura',
    'tv_legislativo': '🏛️ Legislativo',
    'tv_ciencia': '🔬 Ciência',
    'tv_shopping': '🛍️ Shopping',
    'tv_culinaria': '🍳 Culinária',
    'tv_viagem': '✈️ Viagem',
    'tv_automovel': '🚗 Automóvel',
    'tv_lifestyle': '💅 Lifestyle',
    'tv_classicos': '🎞️ Clássicos',
    'tv_familia': '👨‍👩‍👧 Família',
    'tv_negocios': '💼 Negócios',
    'tv_clima': '🌦️ Clima'
};

// =====================
// HELPERS
// =====================
function isTvCategory(category) {
    return category === 'tv' || window.TV_CATEGORIES.includes(category);
}

function getPoster(item, category) {
    if (isTvCategory(category)) {
        if (item.tvg_logo && item.tvg_logo.startsWith('http')) return item.tvg_logo;
        const key = (item.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (window.channelsDict && window.channelsDict[key]) return window.channelsDict[key];
        return window.RAW_BASE + '/assets/Capas/tv_default.jpg';
    }
    if (item.poster && item.poster.startsWith('http')) return item.poster;
    const file = item.poster ? item.poster.split('/').pop() : 'default.jpg';
    return window.RAW_BASE + '/assets/Capas/' + file;
}

function getLocalPoster(item) {
    if (!item.poster || item.poster.startsWith('http')) return null;
    const file = item.poster.split('/').pop();
    return window.RAW_BASE + '/assets/Capas/' + file;
}

function safeImg(poster, altText, extraClass) {
    const cls = 'item-poster' + (extraClass ? ' ' + extraClass : '');
    return '<img src="' + poster + '" alt="' + (altText||'').replace(/"/g,'') + '" class="' + cls + '" loading="lazy" onerror="this.onerror=null;this.src=window._DEFAULT_POSTER">';
}

function item_title_from(category, itemId) {
    const items = window.vodData[category];
    if (!items) return '';
    
    // Para TV, pode ser índice ou objeto com id
    if (isTvCategory(category)) {
        const item = items.find(i => i.id === itemId || i.url === itemId);
        return item ? item.title : '';
    }
    
    const item = items.find(i => i.id === itemId);
    return item ? item.title : '';
}

function closeAllModals() {
    const m = document.getElementById('modal');
    const s = document.getElementById('search-modal');
    if (m) m.style.display = 'none';
    if (s) s.style.display = 'none';
}

// =====================
// PLAY
// =====================
function playEpisode(url, title, itemId, category, episodeIndex) {
    if (isTvCategory(category)) {
        if (typeof window.openTVPlayer === 'function') {
            const go = () => window.openTVPlayer(itemId);
            if (!window.vodData || !window.vodData[category]) {
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
    
    const item = isTvCategory(category) 
        ? items.find(i => i.id === itemId || i.url === itemId)
        : items.find(i => i.id === itemId);
        
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
            if (rem < eps.length) { 
                playEpisode(eps[rem].url, item.title+' - Temp '+s.season, itemId, category, episodeIndex); 
                return; 
            }
            rem -= eps.length;
        }
        const ep = item.seasons[0].episodes[0];
        playEpisode(ep.url, item.title+' - Temp 1 - Ep 1', itemId, category, 0);
    }
}

// =====================
// ALTERNÂNCIA DE CAPAS
// =====================
function initPosterRotation() {
    const INTERVAL = 2 * 60 * 1000; // 2 minutos
    const FADE     = 500;            // ms do fade

    document.querySelectorAll('.item-card').forEach(card => {
        const img        = card.querySelector('.item-poster');
        const postersRaw = card.dataset.posters;
        if (!img || !postersRaw) return;

        let posters;
        try {
            posters = JSON.parse(postersRaw);
        } catch(e) { return; }
        if (!posters || posters.length < 2) return;

        let idx = 0;

        const delay = Math.random() * (INTERVAL * 0.9);
        setTimeout(() => {
            card._posterInterval = setInterval(() => {
                idx = (idx + 1) % posters.length;
                img.style.opacity = '0';
                setTimeout(() => {
                    img.setAttribute('src', posters[idx]);
                    img.style.opacity = '1';
                }, FADE);
            }, INTERVAL);
        }, delay);
    });
}

function stopPosterRotation() {
    document.querySelectorAll('.item-card').forEach(card => {
        if (card._posterInterval) {
            clearInterval(card._posterInterval);
            card._posterInterval = null;
        }
    });
}

// =====================
// CARREGAR TODOS OS CANAIS DE TV
// =====================
function getAllTvChannels() {
    let allChannels = [];
    window.TV_CATEGORIES.forEach(cat => {
        const channels = window.vodData[cat] || [];
        allChannels = allChannels.concat(channels);
    });
    return allChannels;
}

// =====================
// MODAL ELEGANTE
// =====================
function openModal(category, itemId) {
    history.pushState({ pirataflixModal: true, category, itemId }, '');
    _renderModal(category, itemId);
}

function _renderModal(category, itemId) {
    const items = window.vodData[category];
    if (!items) return;
    
    const item = isTvCategory(category)
        ? items.find(i => i.id === itemId || i.url === itemId)
        : items.find(i => i.id === itemId);
        
    if (!item) return;

    const posterUrl   = getPoster(item, category);
    const backdropUrl = item.backdrop || posterUrl;
    const typeLabel   = isTvCategory(category) ? 'Canal de TV' : 
                       ({filmes:'Filme',series:'Série',novelas:'Novela',animes:'Anime',infantil:'Infantil'}[category] || category);

    // ---- HEADER com backdrop ----
    let headerHtml = `
        <div class="pf-modal-backdrop" style="background-image:url('${backdropUrl.replace(/'/g,"%27")}')"></div>
        <div class="pf-modal-backdrop-grad"></div>
        <button class="pf-modal-close" id="closeModal"><i class="fas fa-times"></i></button>
        <div class="pf-modal-header-info">
            <div class="pf-modal-poster-wrap">
                <img src="${posterUrl}" alt="${item.title.replace(/"/g,'')}" class="pf-modal-poster" onerror="this.onerror=null;this.src=window._DEFAULT_POSTER">
            </div>
            <div class="pf-modal-header-text">
                <h2 class="pf-modal-title">${item.title}</h2>
                <div class="pf-modal-badges">
                    <span class="pf-badge pf-badge-type">${typeLabel}</span>
                    ${item.year   ? `<span class="pf-badge">📅 ${item.year}</span>` : ''}
                    ${item.rating ? `<span class="pf-badge pf-badge-rating">⭐ ${item.rating}</span>` : ''}
                    ${isTvCategory(category) ? '<span class="pf-badge pf-badge-live">🔴 Ao Vivo</span>' : ''}
                </div>
                ${item.genres && item.genres.length ? `
                <div class="pf-modal-genres">
                    ${item.genres.map(g => `<span class="pf-genre-tag">${g}</span>`).join('')}
                </div>` : ''}
                ${item.overview ? `<p class="pf-modal-overview">${item.overview}</p>` : ''}
                <div class="pf-modal-actions">
                    <button class="pf-play-btn" data-action="play-first" data-category="${category}" data-id="${itemId}">
                        <i class="fas fa-play"></i> ${isTvCategory(category) ? 'Assistir ao Vivo' : 'Assistir'}
                    </button>
                </div>
            </div>
        </div>`;

    // ---- BODY ----
    let bodyHtml = '';

    // Elenco (só para não-TV)
    if (!isTvCategory(category) && item.cast && item.cast.length) {
        bodyHtml += `<div class="pf-cast-section">
            <h3 class="pf-section-title"><i class="fas fa-users"></i> Elenco Principal</h3>
            <div class="pf-cast-scroll">`;
        item.cast.forEach(actor => {
            bodyHtml += `<div class="pf-cast-card">
                <div class="pf-cast-photo">
                    ${actor.profile
                        ? `<img src="${actor.profile}" alt="${actor.name.replace(/"/g,'')}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                        : ''}
                    <div class="pf-cast-placeholder" style="${actor.profile ? 'display:none' : ''}"><i class="fas fa-user"></i></div>
                </div>
                <div class="pf-cast-name">${actor.name}</div>
                <div class="pf-cast-char">${actor.character || ''}</div>
            </div>`;
        });
        bodyHtml += `</div></div>`;
    }

    // Episódios / Canais
    if (isTvCategory(category)) {
        // Para TV, mostrar todos os canais da mesma categoria
        const canais = window.vodData[category] || [];
        const nomeCategoria = window.TV_CATEGORY_NAMES[category] || category;
        
        bodyHtml += `<div class="pf-eps-section">
            <h3 class="pf-section-title"><i class="fas fa-satellite-dish"></i> ${nomeCategoria}</h3>
            <div class="pf-episode-list">`;
        canais.forEach((canal, idx) => {
            const isAtual  = canal.id === itemId || canal.url === item.url;
            const canalUrl = (canal.episodes && canal.episodes[0]) ? canal.episodes[0].url : canal.url || '';
            bodyHtml += `<div class="pf-episode-item${isAtual ? ' pf-ep-active' : ''}" data-action="play-canal" data-url="${canalUrl}" data-id="${canal.id || idx}" data-title="${canal.title.replace(/"/g,'')}" data-category="${category}">
                ${canal.tvg_logo
                    ? `<img src="${canal.tvg_logo}" class="pf-ep-logo" onerror="this.remove()">`
                    : '<div class="pf-ep-num">📺</div>'}
                <div class="pf-ep-info"><div class="pf-ep-title">${canal.title}${isAtual ? ' <span class="pf-live-dot">● AO VIVO</span>' : ''}</div></div>
            </div>`;
        });
        bodyHtml += `</div></div>`;

    } else if (item.seasons && item.seasons.length) {
        const sortedSeasons = item.seasons.slice().sort((a,b) => a.season - b.season);
        const lastIdx = sortedSeasons.length - 1;
        bodyHtml += `<div class="pf-eps-section">
            <h3 class="pf-section-title"><i class="fas fa-list"></i> Episódios</h3>`;
        let epOffset = 0;
        sortedSeasons.forEach((season, sIdx) => {
            const isOpen     = sIdx === lastIdx;
            const collapseId = 'season-' + itemId + '-' + season.season;
            const totalEps   = season.episodes.length;
            const availEps   = season.episodes.filter(e => !e.locked).length;
            bodyHtml += `<div class="pf-season-block">
                <div class="pf-season-header" data-toggle="${collapseId}">
                    <span class="pf-season-label">🎬 Temporada ${season.season}</span>
                    <span class="pf-season-count">${availEps}/${totalEps} ep.</span>
                    <span class="pf-season-chevron">${isOpen ? '▲' : '▼'}</span>
                </div>
                <div class="pf-episode-list pf-season-episodes" id="${collapseId}" style="display:${isOpen ? 'flex' : 'none'}">`;
            season.episodes.forEach((ep, index) => {
                const num       = ep.episode || (index + 1);
                const t         = (ep.title || 'Capítulo ' + num).replace(/"/g,'');
                const globalIdx = epOffset + index;
                bodyHtml += _renderEpisodeItem(ep, num, t, globalIdx, itemId, category);
            });
            bodyHtml += _renderNextEpisodeBanner(season.episodes);
            bodyHtml += `</div></div>`;
            epOffset += season.episodes.length;
        });
        bodyHtml += `</div>`;

    } else if (item.episodes && item.episodes.length) {
        bodyHtml += `<div class="pf-eps-section">
            <h3 class="pf-section-title"><i class="fas fa-list"></i> Episódios</h3>
            <div class="pf-episode-list">`;
        item.episodes.forEach((ep, index) => {
            const num = ep.episode || (index + 1);
            const t   = (ep.title || item.title).replace(/"/g,'');
            bodyHtml += _renderEpisodeItem(ep, num, t, index, itemId, category);
        });
        bodyHtml += _renderNextEpisodeBanner(item.episodes);
        bodyHtml += `</div></div>`;
    }

    document.getElementById('modalHeader').innerHTML = headerHtml;
    document.getElementById('modalBody').innerHTML   = bodyHtml;

    const modal = document.getElementById('modal');
    modal.style.display = 'block';
    modal.scrollTop     = 0;

    const closeBtn = document.getElementById('closeModal');
    if (closeBtn) closeBtn.onclick = () => {
        modal.style.display = 'none';
    };
}

// =====================
// HELPERS DE SCHEDULE
// =====================
function _fmtDate(isoStr) {
    if (!isoStr) return '';
    try {
        const d = new Date(isoStr.length === 10 ? isoStr + 'T00:00:00' : isoStr);
        return d.toLocaleDateString('pt-BR', {day:'2-digit', month:'long', year:'numeric'});
    } catch(e) { return isoStr; }
}

function _renderEpisodeItem(ep, num, title, globalIdx, itemId, category) {
    const locked     = ep.locked || (!ep.url);
    const hasStill   = ep.still && ep.still.startsWith('http');
    const releaseStr = ep.release_iso ? _fmtDate(ep.release_iso) : (ep.air_date ? _fmtDate(ep.air_date) : '');

    if (locked) {
        return `<div class="pf-episode-item pf-ep-locked">
            ${hasStill
                ? `<img src="${ep.still}" class="pf-ep-still" loading="lazy" onerror="this.style.display='none'">`
                : '<div class="pf-ep-still pf-still-placeholder"><i class="fas fa-film"></i></div>'}
            <div class="pf-ep-info">
                <div class="pf-ep-title">Capítulo ${num}</div>
                <div class="pf-ep-release"><i class="fas fa-clock"></i> ${releaseStr ? 'Disponível em ' + releaseStr : 'Em breve'}</div>
                ${ep.overview ? `<div class="pf-ep-overview">${ep.overview}</div>` : ''}
            </div>
            <div class="pf-ep-lock"><i class="fas fa-lock"></i></div>
        </div>`;
    }

    const guestHtml = (ep.guest_stars && ep.guest_stars.length)
        ? `<div class="pf-ep-guests">${ep.guest_stars.map(g =>
            `<span class="pf-guest-tag">${g.photo ? `<img src="${g.photo}" loading="lazy" onerror="this.remove()">` : ''}<span>${g.name}</span></span>`
          ).join('')}</div>`
        : '';

    return `<div class="pf-episode-item${ep.still || ep.overview ? ' pf-ep-rich' : ''}" data-action="play-ep" data-url="${ep.url}" data-title="${title}" data-itemid="${itemId}" data-category="${category}" data-index="${globalIdx}">
        ${hasStill
            ? `<img src="${ep.still}" class="pf-ep-still" loading="lazy" onerror="this.remove()">`
            : `<div class="pf-ep-num">${num}</div>`}
        <div class="pf-ep-info">
            <div class="pf-ep-title">${title}</div>
            ${ep.air_date ? `<div class="pf-ep-airdate">${_fmtDate(ep.air_date)}</div>` : ''}
            ${ep.overview ? `<div class="pf-ep-overview">${ep.overview}</div>` : ''}
            ${guestHtml}
        </div>
        <div class="pf-ep-play"><i class="fas fa-play"></i></div>
    </div>`;
}

function _renderNextEpisodeBanner(episodes) {
    if (!episodes || !episodes.length) return '';
    const lastAvail = [...episodes].reverse().find(e => !e.locked && e.url);
    if (!lastAvail) return '';
    const lastNum = lastAvail.episode || 0;
    const nextEp  = episodes.find(e => (e.episode || 0) > lastNum && e.locked);
    if (!nextEp) {
        const hasLocked = episodes.some(e => e.locked);
        if (!hasLocked) return `<div class="pf-next-banner pf-series-ended">
            <i class="fas fa-flag-checkered"></i>
            <div><strong>Fim dos capítulos disponíveis</strong>
            <span>Você chegou ao último capítulo disponível no momento.</span></div>
        </div>`;
        return '';
    }
    const releaseStr = nextEp.release_iso
        ? _fmtDate(nextEp.release_iso)
        : (nextEp.air_date ? _fmtDate(nextEp.air_date) : '');
    return `<div class="pf-next-banner">
        <i class="fas fa-hourglass-half"></i>
        <div>
            <strong>Próximo capítulo: ${nextEp.episode || ''}</strong>
            ${releaseStr ? `<span>Disponível a partir de <b>${releaseStr}</b></span>` : '<span>Em breve</span>'}
        </div>
    </div>`;
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
    
    // Categorias para busca
    const cats = {
        filmes: '🎬', series: '📺', novelas: '💖', 
        animes: '👻', infantil: '🧸'
    };
    
    // Adicionar categorias de TV
    window.TV_CATEGORIES.forEach(cat => {
        cats[cat] = '📡';
    });
    
    const results = [];
    for (const [cat, icon] of Object.entries(cats)) {
        (window.vodData[cat]||[]).forEach((item, idx) => {
            if (normalize(item.title).includes(q)) {
                results.push({
                    item, 
                    cat, 
                    icon, 
                    id: item.id || item.url || idx
                });
            }
        });
    }
    
    if (!results.length) {
        container.innerHTML = '<div class="search-empty">Nenhum resultado para "<strong>' + query + '</strong>"</div>';
        return;
    }
    let html = '<div class="search-count">' + results.length + ' resultado' + (results.length>1?'s':'') + '</div><div class="search-list">';
    results.slice(0,40).forEach(({item, cat, icon, id}) => {
        const poster = getPoster(item, cat);
        const year   = item.year   ? ' · ' + item.year   : '';
        const rating = item.rating ? ' · ⭐' + item.rating : '';
        const nomeCat = window.TV_CATEGORY_NAMES[cat] || cat;
        
        html += '<div class="search-item" data-category="' + cat + '" data-id="' + id + '">'
            + '<img src="' + poster + '" alt="" onerror="this.onerror=null;this.src=window._DEFAULT_POSTER">'
            + '<div class="search-item-info">'
            + '<div class="search-item-title">' + item.title + '</div>'
            + '<div class="search-item-meta">' + icon + ' ' + nomeCat + year + rating + '</div>'
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
    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('open')));
}

// =====================
// CHANNELS
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
    if (!modal) return;

    function closeModal() { modal.style.display = 'none'; }

    modal.addEventListener('click', e => {
        const seasonHeader = e.target.closest('.pf-season-header');
        if (seasonHeader) {
            const collapseId = seasonHeader.dataset.toggle;
            const panel      = document.getElementById(collapseId);
            const chevron    = seasonHeader.querySelector('.pf-season-chevron');
            if (panel) {
                const open = panel.style.display === 'flex';
                panel.style.display = open ? 'none' : 'flex';
                if (chevron) chevron.textContent = open ? '▼' : '▲';
            }
            return;
        }

        const el = e.target.closest('[data-action]');
        if (!el) return;

        if (el.dataset.action === 'play-first') {
            playFirstEpisode(el.dataset.category, el.dataset.id);
        } else if (el.dataset.action === 'play-canal') {
            closeModal();
            playEpisode(el.dataset.url, el.dataset.title||'', el.dataset.id, el.dataset.category, 0);
        } else if (el.dataset.action === 'play-ep') {
            closeModal();
            playEpisode(
                el.dataset.url,
                item_title_from(el.dataset.category, el.dataset.itemid) + ' - ' + (el.dataset.title||''),
                el.dataset.itemid,
                el.dataset.category,
                parseInt(el.dataset.index) || 0
            );
        }
    });

    window.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllModals(); });
    window.addEventListener('popstate', () => {
        if (modal.style.display === 'block' || modal.style.display === 'flex') closeModal();
    });
}

// =====================
// RODAPÉ GLOBAL
// =====================
function injectFooter() {
    if (document.getElementById('pf-global-footer')) return;
    const footer = document.createElement('footer');
    footer.id = 'pf-global-footer';
    footer.innerHTML = `
        <div class="pf-footer-inner">
            <p class="pf-footer-copy">© 2026 — <strong>PirataFlix</strong> — Todos os Direitos Reservados!</p>
            <p class="pf-footer-disclaimer">Esse site não hospeda nenhum vídeo em seu servidor, todo o conteúdo é disponibilizado por terceiros não afiliados.</p>
        </div>`;
    document.body.appendChild(footer);
}

// =====================
// CSS INJETADO
// =====================
(function() {
    if (document.getElementById('pirataflix-shared-css')) return;
    const s = document.createElement('style');
    s.id = 'pirataflix-shared-css';
    s.textContent = `/* (mesmo CSS do seu arquivo original) */`;
    document.head.appendChild(s);
})();

// =====================
// INIT
// =====================
document.addEventListener('DOMContentLoaded', () => {
    initSearch();
    initHamburger();
    setupModalListeners();
    injectFooter();
});

// Exportar
window.getPoster           = getPoster;
window.getLocalPoster      = getLocalPoster;
window.safeImg             = safeImg;
window.item_title_from     = item_title_from;
window.playEpisode         = playEpisode;
window.playFirstEpisode    = playFirstEpisode;
window.openModal           = openModal;
window.openSearch          = openSearch;
window.loadChannels        = loadChannels;
window.setupModalListeners = setupModalListeners;
window.closeAllModals      = closeAllModals;
window.initPosterRotation  = initPosterRotation;
window.stopPosterRotation  = stopPosterRotation;
window.TV_CATEGORIES       = TV_CATEGORIES;
window.TV_CATEGORY_NAMES   = TV_CATEGORY_NAMES;
window.getAllTvChannels    = getAllTvChannels;
console.log('✅ Pirataflix shared.js v4 carregado');
