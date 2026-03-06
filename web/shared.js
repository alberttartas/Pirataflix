// ============================================
// PIRATAFLIX shared.js v3
// ============================================

window.RAW_BASE        = 'https://raw.githubusercontent.com/alberttartas/Pirataflix/main';
window._DEFAULT_POSTER = window.RAW_BASE + '/assets/Capas/default.jpg';
window.vodData         = {};
window.channelsDict    = {};

// =====================
// HELPERS
// =====================
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
    const item = category === 'tv' ? items[parseInt(itemId)] : items.find(i => i.id === itemId);
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
// ALTERNÂNCIA DE CAPAS
// Alterna entre capa local e poster TMDB a cada 5s com fade
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
            // dataset já decodifica &quot; automaticamente via getAttribute
            posters = JSON.parse(postersRaw);
        } catch(e) { return; }
        if (!posters || posters.length < 2) return;

        let idx = 0;

        // Offset aleatório para não trocarem todos ao mesmo tempo
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
// MODAL ELEGANTE
// =====================
function openModal(category, itemId) {
    history.pushState({ pirataflixModal: true, category, itemId }, '');
    _renderModal(category, itemId);
}

function _renderModal(category, itemId) {
    const items = window.vodData[category];
    if (!items) return;
    const item = category === 'tv' ? items[parseInt(itemId)] : items.find(i => i.id === itemId);
    if (!item) return;

    const posterUrl   = getPoster(item, category);
    const backdropUrl = item.backdrop || posterUrl;
    const typeLabel   = {filmes:'Filme',series:'Série',novelas:'Novela',animes:'Anime',infantil:'Infantil',tv:'Canal de TV'}[category] || category;

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
                    ${category === 'tv' ? '<span class="pf-badge pf-badge-live">🔴 Ao Vivo</span>' : ''}
                </div>
                ${item.genres && item.genres.length ? `
                <div class="pf-modal-genres">
                    ${item.genres.map(g => `<span class="pf-genre-tag">${g}</span>`).join('')}
                </div>` : ''}
                ${item.overview ? `<p class="pf-modal-overview">${item.overview}</p>` : ''}
                <div class="pf-modal-actions">
                    <button class="pf-play-btn" data-action="play-first" data-category="${category}" data-id="${itemId}">
                        <i class="fas fa-play"></i> ${category === 'tv' ? 'Assistir ao Vivo' : 'Assistir'}
                    </button>
                </div>
            </div>
        </div>`;

    // ---- BODY ----
    let bodyHtml = '';

    // Elenco
    if (item.cast && item.cast.length) {
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
    if (category === 'tv') {
        const canais = window.vodData['tv'] || [];
        bodyHtml += `<div class="pf-eps-section">
            <h3 class="pf-section-title"><i class="fas fa-satellite-dish"></i> Todos os Canais</h3>
            <div class="pf-episode-list">`;
        canais.forEach((canal, idx) => {
            const isAtual  = String(idx) === String(itemId);
            const canalUrl = (canal.episodes && canal.episodes[0]) ? canal.episodes[0].url : canal.url || '';
            bodyHtml += `<div class="pf-episode-item${isAtual ? ' pf-ep-active' : ''}" data-action="play-canal" data-url="${canalUrl}" data-id="${idx}" data-title="${canal.title.replace(/"/g,'')}" data-category="tv">
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
            // Banner de próximo episódio bloqueado após o último disponível
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
        // Banner de próximo episódio após o último
        bodyHtml += _renderNextEpisodeBanner(item.episodes);
        bodyHtml += `</div></div>`;
    }

    document.getElementById('modalHeader').innerHTML = headerHtml;
    document.getElementById('modalBody').innerHTML   = bodyHtml;

    const modal = document.getElementById('modal');
    modal.style.display = 'block';
    modal.scrollTop     = 0;

    // Re-bind close button (foi recriado no innerHTML)
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
        // Verificar se é realmente o último ou apenas não tem mais dados
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
        // Toggle temporadas
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
            playEpisode(el.dataset.url, el.dataset.title||'', el.dataset.id, 'tv', 0);
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

    // Fechar clicando fora
    window.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    // ESC
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllModals(); });
    // Botão Voltar do navegador
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
    s.textContent = `
    /* ---- SEARCH ---- */
    #search-trigger{background:none;border:none;color:#e5e5e5;font-size:1.1rem;cursor:pointer;padding:6px 10px;transition:color .2s;margin-left:8px;}
    #search-trigger:hover{color:#e50914;}
    #search-modal{display:none;position:fixed;inset:0;z-index:99999;align-items:flex-start;justify-content:center;}
    .search-overlay{position:absolute;inset:0;background:rgba(0,0,0,.88);display:flex;justify-content:center;align-items:flex-start;padding-top:70px;}
    .search-box{background:#1a1a1a;border-radius:12px;width:90%;max-width:680px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.9);border:1px solid rgba(255,255,255,.08);}
    .search-input-wrap{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08);}
    .search-icon-inp{color:#555;font-size:.95rem;}
    #searchInput{flex:1;background:none;border:none;outline:none;color:white;font-size:1.05rem;}
    #searchInput::placeholder{color:#444;}
    #searchClose{background:none;border:none;color:#555;font-size:.9rem;cursor:pointer;padding:4px;transition:color .2s;}
    #searchClose:hover{color:white;}
    #searchResults{overflow-y:auto;padding:8px 0;}
    .search-count{color:#666;font-size:.82rem;padding:8px 20px;}
    .search-list{display:flex;flex-direction:column;}
    .search-item{display:flex;align-items:center;gap:14px;padding:10px 20px;cursor:pointer;transition:background .15s;}
    .search-item:hover{background:rgba(255,255,255,.06);}
    .search-item img{width:46px;height:64px;object-fit:cover;border-radius:4px;flex-shrink:0;background:#111;}
    .search-item-title{font-weight:bold;font-size:.92rem;margin-bottom:3px;}
    .search-item-meta{font-size:.78rem;color:#666;}
    .search-empty{color:#555;text-align:center;padding:28px 20px;font-size:.9rem;}

    /* ---- HAMBURGER ---- */
    .hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;background:none;border:none;padding:5px;}
    .hamburger span{display:block;width:23px;height:2px;background:white;border-radius:2px;transition:.3s;}
    @media(max-width:768px){
        .hamburger{display:flex;}
        .nav-links{display:none;position:fixed;top:60px;left:0;right:0;background:rgba(15,15,15,.98);flex-direction:column;padding:16px 20px;gap:12px;z-index:200;border-bottom:1px solid rgba(255,255,255,.08);}
        .nav-links.open{display:flex;}
        .nav-link{font-size:.95rem;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);}
    }

    /* ---- ALTERNÂNCIA DE CAPAS ---- */
    .item-poster{transition:opacity .4s ease;}

    /* ---- MODAL ELEGANTE ---- */
    #modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2000;overflow-y:auto;backdrop-filter:blur(4px);}
    .modal-content{background:#181818;border-radius:12px;max-width:900px;margin:40px auto 60px;position:relative;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.8);}

    /* Header backdrop */
    .modal-header{position:relative;min-height:300px;overflow:hidden;padding:0;}
    .pf-modal-backdrop{position:absolute;inset:0;background-size:cover;background-position:center top;transform:scale(1.05);transition:transform 8s ease;filter:brightness(.4);}
    .modal-content:hover .pf-modal-backdrop{transform:scale(1.0);}
    .pf-modal-backdrop-grad{position:absolute;inset:0;background:linear-gradient(to right,rgba(18,18,18,.97) 0%,rgba(18,18,18,.6) 55%,rgba(18,18,18,.1) 100%),linear-gradient(to top,rgba(18,18,18,1) 0%,transparent 40%);}
    .pf-modal-close{position:absolute;top:14px;right:14px;background:rgba(0,0,0,.65);border:1px solid rgba(255,255,255,.15);color:white;width:34px;height:34px;border-radius:50%;font-size:13px;cursor:pointer;z-index:10;display:flex;align-items:center;justify-content:center;transition:background .2s,border-color .2s;}
    .pf-modal-close:hover{background:#e50914;border-color:#e50914;}

    .pf-modal-header-info{position:relative;z-index:2;display:flex;gap:22px;padding:26px 26px 22px;align-items:flex-start;}
    .pf-modal-poster-wrap{flex-shrink:0;width:125px;}
    .pf-modal-poster{width:125px;height:188px;object-fit:cover;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,.8);border:2px solid rgba(255,255,255,.08);}
    .pf-modal-header-text{flex:1;padding-top:6px;}
    .pf-modal-title{font-size:1.65rem;font-weight:800;color:#fff;margin-bottom:9px;line-height:1.2;text-shadow:0 2px 10px rgba(0,0,0,.9);}
    .pf-modal-badges{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:9px;}
    .pf-badge{background:rgba(255,255,255,.1);border-radius:4px;padding:3px 9px;font-size:.74rem;color:#bbb;border:1px solid rgba(255,255,255,.09);}
    .pf-badge-type{background:rgba(229,9,20,.16);border-color:rgba(229,9,20,.28);color:#ff7070;}
    .pf-badge-rating{background:rgba(255,215,0,.1);border-color:rgba(255,215,0,.28);color:#ffd700;}
    .pf-badge-live{background:rgba(229,9,20,.22);border-color:rgba(229,9,20,.45);color:#ff4444;animation:pf-pulse-live 2s ease-in-out infinite;}
    @keyframes pf-pulse-live{0%,100%{opacity:1}50%{opacity:.55}}
    .pf-modal-genres{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;}
    .pf-genre-tag{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:2px 9px;font-size:.71rem;color:#999;}
    .pf-modal-overview{color:#aaa;font-size:.85rem;line-height:1.65;margin-bottom:14px;max-height:95px;overflow-y:auto;padding-right:3px;}
    .pf-modal-overview::-webkit-scrollbar{width:3px;}.pf-modal-overview::-webkit-scrollbar-thumb{background:#3a3a3a;}
    .pf-modal-actions{margin-top:4px;}
    .pf-play-btn{background:#e50914;color:white;border:none;padding:10px 26px;border-radius:6px;font-size:.92rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:all .2s;letter-spacing:.2px;}
    .pf-play-btn:hover{background:#f40612;transform:scale(1.04);box-shadow:0 4px 22px rgba(229,9,20,.45);}

    /* Body */
    .modal-body{padding:0 0 2px;}

    /* Elenco */
    .pf-cast-section{padding:18px 26px 6px;}
    .pf-section-title{font-size:.82rem;font-weight:700;color:#e50914;margin-bottom:12px;display:flex;align-items:center;gap:7px;letter-spacing:.8px;text-transform:uppercase;}
    .pf-cast-scroll{display:flex;gap:10px;overflow-x:auto;padding-bottom:8px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;}
    .pf-cast-scroll::-webkit-scrollbar{height:2px;}.pf-cast-scroll::-webkit-scrollbar-thumb{background:#2a2a2a;}
    .pf-cast-card{flex-shrink:0;width:76px;text-align:center;scroll-snap-align:start;}
    .pf-cast-photo{width:68px;height:68px;border-radius:50%;overflow:hidden;margin:0 auto 5px;background:#1e1e1e;border:2px solid rgba(255,255,255,.08);position:relative;}
    .pf-cast-photo img{width:100%;height:100%;object-fit:cover;}
    .pf-cast-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#444;font-size:1.3rem;}
    .pf-cast-name{font-size:.65rem;font-weight:600;color:#ccc;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
    .pf-cast-char{font-size:.6rem;color:#555;margin-top:2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}

    /* Episódios */
    .pf-eps-section{padding:14px 26px 18px;}
    .pf-episode-list{display:flex;flex-direction:column;gap:5px;max-height:360px;overflow-y:auto;padding-right:3px;}
    .pf-episode-list::-webkit-scrollbar{width:3px;}.pf-episode-list::-webkit-scrollbar-thumb{background:#2a2a2a;}
    .pf-episode-item{display:flex;align-items:center;gap:11px;padding:10px 13px;background:rgba(255,255,255,.035);border-radius:6px;cursor:pointer;transition:background .15s,border-color .15s;border:1px solid rgba(255,255,255,.04);}
    .pf-episode-item:hover{background:rgba(229,9,20,.09);border-color:rgba(229,9,20,.18);}
    .pf-ep-active{background:rgba(229,9,20,.11) !important;border-left:3px solid #e50914 !important;}
    .pf-ep-num{background:#e50914;color:white;min-width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.78rem;flex-shrink:0;}
    .pf-ep-logo{width:38px;height:38px;object-fit:contain;background:#0d0d0d;border-radius:4px;flex-shrink:0;}
    .pf-ep-info{flex:1;min-width:0;}
    .pf-ep-title{font-size:.83rem;font-weight:500;color:#d0d0d0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .pf-ep-play{color:#444;font-size:.72rem;flex-shrink:0;transition:color .15s;}
    .pf-episode-item:hover .pf-ep-play{color:#e50914;}
    .pf-live-dot{color:#e50914;font-size:.72rem;margin-left:4px;}

    /* Episódios com schedule (thumbnail, sinopse, convidados) */
    .pf-ep-rich{align-items:flex-start !important;padding:10px 13px 12px !important;}
    .pf-ep-still{width:96px;height:58px;object-fit:cover;border-radius:5px;flex-shrink:0;background:#111;}
    .pf-still-placeholder{width:96px;height:58px;border-radius:5px;background:#1a1a1a;display:flex;align-items:center;justify-content:center;color:#333;font-size:1.2rem;flex-shrink:0;}
    .pf-ep-airdate{font-size:.68rem;color:#555;margin-top:2px;}
    .pf-ep-overview{font-size:.74rem;color:#888;line-height:1.5;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
    .pf-ep-guests{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;}
    .pf-guest-tag{display:flex;align-items:center;gap:4px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);border-radius:20px;padding:2px 8px 2px 4px;font-size:.65rem;color:#aaa;}
    .pf-guest-tag img{width:18px;height:18px;border-radius:50%;object-fit:cover;}

    /* Episódios bloqueados */
    .pf-ep-locked{cursor:default !important;opacity:.75;}
    .pf-ep-locked:hover{background:rgba(255,255,255,.035) !important;border-color:rgba(255,255,255,.04) !important;}
    .pf-ep-release{font-size:.7rem;color:#e50914;margin-top:3px;display:flex;align-items:center;gap:4px;}
    .pf-ep-lock{color:#555;font-size:.85rem;flex-shrink:0;margin-left:auto;}

    /* Banner de próximo episódio */
    .pf-next-banner{display:flex;align-items:center;gap:12px;padding:12px 14px;margin:8px 0 4px;background:linear-gradient(135deg,rgba(229,9,20,.08),rgba(229,9,20,.04));border:1px solid rgba(229,9,20,.2);border-radius:8px;}
    .pf-next-banner i{color:#e50914;font-size:1.1rem;flex-shrink:0;}
    .pf-next-banner div{display:flex;flex-direction:column;gap:2px;}
    .pf-next-banner strong{font-size:.82rem;color:#eee;}
    .pf-next-banner span{font-size:.75rem;color:#888;}
    .pf-next-banner span b{color:#ccc;}
    .pf-series-ended{background:linear-gradient(135deg,rgba(70,211,105,.06),rgba(70,211,105,.02)) !important;border-color:rgba(70,211,105,.2) !important;}
    .pf-series-ended i{color:#46d369 !important;}

    /* Temporadas colapsáveis */
    .pf-season-block{margin-bottom:5px;border-radius:7px;overflow:hidden;border:1px solid rgba(255,255,255,.06);}
    .pf-season-header{display:flex;align-items:center;gap:9px;padding:11px 14px;background:rgba(255,255,255,.045);cursor:pointer;transition:background .2s;user-select:none;}
    .pf-season-header:hover{background:rgba(229,9,20,.09);}
    .pf-season-label{font-size:.9rem;font-weight:700;color:#eee;flex:1;}
    .pf-season-count{font-size:.72rem;color:#666;background:rgba(255,255,255,.06);padding:2px 8px;border-radius:10px;}
    .pf-season-chevron{font-size:.62rem;color:#555;margin-left:3px;}
    .pf-season-episodes{padding:6px 8px;max-height:none !important;border-radius:0;}

    /* Rodapé global */
    #pf-global-footer{background:#0c0c0c;border-top:1px solid rgba(255,255,255,.05);padding:24px 20px 18px;margin-top:44px;}
    .pf-footer-inner{max-width:860px;margin:0 auto;text-align:center;}
    .pf-footer-copy{font-size:.8rem;color:#484848;margin-bottom:5px;}
    .pf-footer-copy strong{color:#c0392b;}
    .pf-footer-disclaimer{font-size:.72rem;color:#2e2e2e;line-height:1.65;}

    @media(max-width:600px){
        .pf-modal-header-info{flex-direction:column;align-items:center;text-align:center;padding:20px 16px 18px;}
        .pf-modal-poster-wrap{width:105px;}
        .pf-modal-poster{width:105px;height:158px;}
        .pf-modal-title{font-size:1.25rem;}
        .pf-modal-badges,.pf-modal-genres,.pf-modal-actions{justify-content:center;}
        .modal-content{margin:0;border-radius:0;min-height:100vh;}
        .pf-cast-card{width:64px;}
        .pf-cast-photo{width:56px;height:56px;}
        .pf-cast-section,.pf-eps-section{padding-left:14px;padding-right:14px;}
    }
    `;
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
console.log('✅ Pirataflix shared.js v3 carregado');
