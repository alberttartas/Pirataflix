// Aplicação Web para Streaming Pessoal
class VODApp {
    constructor() {
        this.data = [];
        this.filteredData = [];
        this.currentFilter = 'all';
        this.currentSearch = '';
        this.currentSort = 'title';
        this.currentView = 'grid';
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.featuredIndex = 0;
        this.featuredItems = [];
        
        this.init();
    }
    
    async init() {
        this.bindEvents();
        await this.loadData();
        this.updateStats();
        this.showContent();
    }
    
    bindEvents() {
        // Busca
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.currentSearch = e.target.value;
            this.currentPage = 1;
            this.applyFilters();
        });
        
        document.getElementById('searchBtn').addEventListener('click', () => {
            this.applyFilters();
        });
        
        // Filtros de categoria
        document.querySelectorAll('.cat-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.currentPage = 1;
                this.applyFilters();
            });
        });
        
        // Ordenação
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.applyFilters();
        });
        
        // Controles de visualização
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentView = e.target.dataset.view;
                this.applyFilters();
            });
        });
        
        // Navegação do featured
        document.getElementById('prevFeatured').addEventListener('click', () => {
            this.navigateFeatured(-1);
        });
        
        document.getElementById('nextFeatured').addEventListener('click', () => {
            this.navigateFeatured(1);
        });
        
        // Player modal
        document.getElementById('closePlayer').addEventListener('click', () => {
            this.hidePlayer();
        });
        
        document.getElementById('openExternal').addEventListener('click', () => {
            const currentItem = this.getCurrentPlayerItem();
            if (currentItem && currentItem.link) {
                window.open(currentItem.link, '_blank');
            }
        });
        
        document.getElementById('copyLink').addEventListener('click', () => {
            const currentItem = this.getCurrentPlayerItem();
            if (currentItem && currentItem.link) {
                navigator.clipboard.writeText(currentItem.link)
                    .then(() => this.showNotification('Link copiado!', 'success'))
                    .catch(() => this.showNotification('Erro ao copiar link', 'error'));
            }
        });
        
        // Load more
        document.getElementById('loadMoreBtn')?.addEventListener('click', () => {
            this.loadMore();
        });
        
        // Clear search
        document.getElementById('clearSearchBtn')?.addEventListener('click', () => {
            document.getElementById('searchInput').value = '';
            this.currentSearch = '';
            this.applyFilters();
        });
        
        // Atualização manual
        document.getElementById('manualUpdateBtn')?.addEventListener('click', () => {
            this.checkForUpdates();
        });
        
        // Refresh
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshData();
        });
        
        // Explore
        document.getElementById('exploreBtn')?.addEventListener('click', () => {
            document.getElementById('heroSection')?.classList.add('hidden');
            document.getElementById('content')?.classList.remove('hidden');
        });
        
        // Export M3U
        document.getElementById('exportM3U')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.exportM3U();
        });
        
        // GitHub link
        document.getElementById('githubLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            window.open('https://github.com', '_blank');
        });
        
        // Fechar modal com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hidePlayer();
            }
        });
        
        // Fechar modal clicando fora
        document.getElementById('playerModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'playerModal') {
                this.hidePlayer();
            }
        });
        
        // Auto-refresh a cada 5 minutos
        setInterval(() => this.checkForUpdates(), 5 * 60 * 1000);
    }
    
    async loadData() {
        try {
            this.showLoading(true);
            
            const response = await fetch('data.json');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            this.data = await response.json();
            
            // Selecionar itens em destaque (os mais recentes ou aleatórios)
            this.featuredItems = this.selectFeaturedItems();
            
            this.showNotification('Catálogo carregado com sucesso!', 'success');
            return true;
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            this.showNotification('Erro ao carregar catálogo', 'error');
            
            // Carregar dados de fallback se disponível
            this.loadFallbackData();
            return false;
        } finally {
            this.showLoading(false);
        }
    }
    
    loadFallbackData() {
        // Dados de exemplo para demonstração
        this.data = [
            {
                "title": "Vingadores: Ultimato",
                "category": "Filmes",
                "cover": "https://image.tmdb.org/t/p/w500/7RyHsO4yDXtBv1zUU3mTpHeQ0d5.jpg",
                "background": "./assets/backgrounds/Filmes.jpg",
                "link": "#",
                "type": "movie",
                "year": "2019",
                "rating": "8.4"
            },
            {
                "title": "Stranger Things",
                "series": "Stranger Things",
                "season": "Temporada 4",
                "category": "Séries",
                "cover": "https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfGn8AIqMGskD.jpg",
                "background": "./assets/backgrounds/Séries.jpg",
                "link": "#",
                "type": "series",
                "year": "2022",
                "rating": "8.7"
            }
        ];
        
        this.featuredItems = this.data.slice(0, 3);
        this.showNotification('Usando dados de demonstração', 'warning');
    }
    
    selectFeaturedItems() {
        // Seleciona 5 itens para destaque (os mais recentes ou populares)
        const shuffled = [...this.data].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, Math.min(5, shuffled.length));
    }
    
    applyFilters() {
        let filtered = [...this.data];
        
        // Aplicar filtro de categoria
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(item => item.category === this.currentFilter);
        }
        
        // Aplicar busca
        if (this.currentSearch.trim()) {
            const searchTerm = this.currentSearch.toLowerCase();
            filtered = filtered.filter(item => 
                item.title.toLowerCase().includes(searchTerm) ||
                (item.series && item.series.toLowerCase().includes(searchTerm)) ||
                item.category.toLowerCase().includes(searchTerm) ||
                (item.season && item.season.toLowerCase().includes(searchTerm))
            );
        }
        
        // Aplicar ordenação
        filtered = this.sortData(filtered);
        
        this.filteredData = filtered;
        this.renderContent();
    }
    
    sortData(data) {
        switch (this.currentSort) {
            case 'title':
                return data.sort((a, b) => a.title.localeCompare(b.title));
            case 'title-desc':
                return data.sort((a, b) => b.title.localeCompare(a.title));
            case 'category':
                return data.sort((a, b) => a.category.localeCompare(b.category));
            case 'newest':
                // Se houver campo de ano, ordenar por ele
                return data.sort((a, b) => (b.year || 0) - (a.year || 0));
            default:
                return data;
        }
    }
    
    renderContent() {
        this.renderFeatured();
        this.renderCatalog();
        this.updateResultsInfo();
        
        // Mostrar/ocultar seção de destaque
        const featuredSection = document.getElementById('featuredSection');
        if (this.featuredItems.length > 0 && this.currentFilter === 'all' && !this.currentSearch) {
            featuredSection.classList.remove('hidden');
        } else {
            featuredSection.classList.add('hidden');
        }
        
        // Mostrar/ocultar "sem resultados"
        const noResults = document.getElementById('noResults');
        const content = document.getElementById('content');
        if (this.filteredData.length === 0) {
            noResults.classList.remove('hidden');
            content.classList.add('hidden');
        } else {
            noResults.classList.add('hidden');
            content.classList.remove('hidden');
        }
    }
    
    renderFeatured() {
        const slider = document.getElementById('featuredSlider');
        if (!slider) return;
        
        slider.innerHTML = '';
        slider.style.transform = `translateX(-${this.featuredIndex * 320}px)`;
        
        this.featuredItems.forEach((item, index) => {
            const slide = document.createElement('div');
            slide.className = 'featured-slide';
            slide.innerHTML = this.createCardHTML(item, true);
            slide.addEventListener('click', () => this.showPlayer(item));
            slider.appendChild(slide);
        });
    }
    
    renderCatalog() {
        const container = document.getElementById('catalogContainer');
        if (!container) return;
        
        // Aplicar classe de visualização
        container.className = `catalog-container ${this.currentView}-view`;
        
        // Calcular itens para a página atual
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageItems = this.filteredData.slice(0, endIndex);
        
        container.innerHTML = '';
        
        pageItems.forEach(item => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = this.createCardHTML(item, false);
            card.addEventListener('click', () => this.showPlayer(item));
            container.appendChild(card);
        });
        
        // Mostrar/ocultar botão "Carregar Mais"
        const loadMoreContainer = document.getElementById('loadMoreContainer');
        if (endIndex < this.filteredData.length) {
            loadMoreContainer.classList.remove('hidden');
        } else {
            loadMoreContainer.classList.add('hidden');
        }
    }
    
    createCardHTML(item, isFeatured = false) {
        const year = item.year || '';
        const rating = item.rating || '';
        const season = item.season || '';
        const series = item.series || '';
        
        // Determinar cor da categoria
        const categoryColors = {
            'Filmes': '#e50914',
            'Séries': '#0072ff',
            'Animes': '#00b894',
            'Novelas': '#fd79a8',
            'Infantil': '#fdcb6e'
        };
        
        const categoryColor = categoryColors[item.category] || '#e50914';
        
        if (isFeatured) {
            return `
                <div class="card-image">
                    <img src="${item.cover || 'https://via.placeholder.com/300x450/2d2d2d/808080?text=Sem+Capa'}" 
                         alt="${item.title}"
                         onerror="this.src='https://via.placeholder.com/300x450/2d2d2d/808080?text=Sem+Capa'">
                    <div class="card-overlay">
                        <button class="play-btn">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                </div>
                <div class="card-content">
                    <div class="card-title" title="${item.title}">${item.title}</div>
                    <div class="card-meta">
                        <span class="card-category" style="background-color: ${categoryColor}">${item.category}</span>
                        ${season ? `<span class="card-season">${season}</span>` : ''}
                        ${year ? `<span class="card-year">${year}</span>` : ''}
                    </div>
                </div>
            `;
        }
        
        if (this.currentView === 'list') {
            return `
                <div class="card-image">
                    <img src="${item.cover || 'https://via.placeholder.com/200x120/2d2d2d/808080?text=Sem+Capa'}" 
                         alt="${item.title}"
                         onerror="this.src='https://via.placeholder.com/200x120/2d2d2d/808080?text=Sem+Capa'">
                </div>
                <div class="card-content">
                    <div class="card-title" title="${item.title}">${item.title}</div>
                    <div class="card-meta">
                        <span class="card-category" style="background-color: ${categoryColor}">${item.category}</span>
                        ${series ? `<span class="card-series">${series}</span>` : ''}
                        ${season ? `<span class="card-season">${season}</span>` : ''}
                        ${year ? `<span class="card-year">${year}</span>` : ''}
                        ${rating ? `<span class="card-rating"><i class="fas fa-star"></i> ${rating}</span>` : ''}
                    </div>
                    <p class="card-description">Clique para assistir</p>
                </div>
            `;
        }
        
        // View grid (padrão)
        return `
            <div class="card-image">
                <img src="${item.cover || 'https://via.placeholder.com/300x450/2d2d2d/808080?text=Sem+Capa'}" 
                     alt="${item.title}"
                     onerror="this.src='https://via.placeholder.com/300x450/2d2d2d/808080?text=Sem+Capa'">
                <div class="card-overlay">
                    <button class="play-btn">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
            </div>
            <div class="card-content">
                <div class="card-title" title="${item.title}">${item.title}</div>
                <div class="card-meta">
                    <span class="card-category" style="background-color: ${categoryColor}">${item.category}</span>
                    ${season ? `<span class="card-season">${season}</span>` : ''}
                </div>
            </div>
        `;
    }
    
    showPlayer(item) {
        this.currentPlayerItem = item;
        
        const modal = document.getElementById('playerModal');
        const title = document.getElementById('playerTitle');
        const category = document.getElementById('infoCategory');
        const status = document.getElementById('infoStatus');
        
        title.textContent = item.title;
        category.textContent = item.category;
        
        if (item.season) {
            category.textContent += ` | ${item.season}`;
        }
        
        // Verificar se o link está ativo
        if (item.link && !item.link.startsWith('#')) {
            status.textContent = '● Disponível';
            status.className = 'status-active';
        } else {
            status.textContent = '● Indisponível';
            status.style.color = '#ff6b6b';
        }
        
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
    
    hidePlayer() {
        document.getElementById('playerModal').classList.add('hidden');
        document.body.style.overflow = 'auto';
        this.currentPlayerItem = null;
    }
    
    getCurrentPlayerItem() {
        return this.currentPlayerItem;
    }
    
    navigateFeatured(direction) {
        const total = this.featuredItems.length;
        this.featuredIndex = (this.featuredIndex + direction + total) % total;
        this.renderFeatured();
    }
    
    loadMore() {
        this.currentPage++;
        this.renderCatalog();
    }
    
    updateResultsInfo() {
        const countEl = document.getElementById('resultsCount');
        if (countEl) {
            countEl.textContent = this.filteredData.length;
        }
    }
    
    updateStats() {
        const total = this.data.length;
        const movies = this.data.filter(item => item.category === 'Filmes').length;
        const series = this.data.filter(item => item.category === 'Séries').length;
        const animes = this.data.filter(item => item.category === 'Animes').length;
        const novelas = this.data.filter(item => item.category === 'Novelas').length;
        const infantil = this.data.filter(item => item.category === 'Infantil').length;
        
        document.getElementById('statTotal').textContent = total;
        document.getElementById('statMovies').textContent = movies;
        document.getElementById('statSeries').textContent = series;
        
        // Atualizar data
        const now = new Date();
        document.getElementById('updateDate').textContent = now.toLocaleDateString('pt-BR');
        document.getElementById('updateTime').textContent = now.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Atualizar hero section
        const heroTitle = document.getElementById('heroTitle');
        const heroSubtitle = document.getElementById('heroSubtitle');
        
        if (heroTitle && heroSubtitle) {
            const greetings = [
                `Bem-vindo ao seu catálogo pessoal`,
                `Explore ${total} itens disponíveis`,
                `Sua coleção de entretenimento`
            ];
            
            const subtitles = [
                `Com ${movies} filmes e ${series} séries para assistir`,
                `Conteúdo atualizado automaticamente`,
                `Organizado especialmente para você`
            ];
            
            const randomIndex = Math.floor(Math.random() * greetings.length);
            heroTitle.textContent = greetings[randomIndex];
            heroSubtitle.textContent = subtitles[randomIndex];
        }
    }
    
    showContent() {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('content').classList.remove('hidden');
        document.getElementById('heroSection').classList.remove('hidden');
    }
    
    showLoading(show) {
        const loading = document.getElementById('loading');
        const countEl = document.getElementById('loadingCount');
        
        if (show) {
            loading.classList.remove('hidden');
            // Simular contagem
            let count = 0;
            const interval = setInterval(() => {
                if (count < this.data.length) {
                    count += Math.floor(Math.random() * 5) + 1;
                    if (count > this.data.length) count = this.data.length;
                    if (countEl) countEl.textContent = count;
                } else {
                    clearInterval(interval);
                }
            }, 100);
        } else {
            loading.classList.add('hidden');
        }
    }
    
    async refreshData() {
        this.showNotification('Atualizando catálogo...', 'warning');
        const success = await this.loadData();
        if (success) {
            this.applyFilters();
            this.updateStats();
            this.showNotification('Catálogo atualizado!', 'success');
        }
    }
    
    async checkForUpdates() {
        try {
            const response = await fetch('data.json?t=' + Date.now());
            const newData = await response.json();
            
            if (newData.length !== this.data.length) {
                this.showNotification('Novo conteúdo disponível!', 'success');
                this.data = newData;
                this.applyFilters();
                this.updateStats();
            }
        } catch (error) {
            console.error('Erro ao verificar atualizações:', error);
        }
    }
    
    exportM3U() {
        // Criar conteúdo M3U
        let m3uContent = '#EXTM3U\n\n';
        
        this.data.forEach(item => {
            m3uContent += `#EXTINF:-1 group-title="${item.category}" tvg-logo="${item.cover}",${item.title}\n`;
            m3uContent += `${item.link}\n\n`;
        });
        
        // Criar blob e fazer download
        const blob = new Blob([m3uContent], { type: 'audio/x-mpegurl' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vod-playlist.m3u';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('Playlist M3U exportada!', 'success');
    }
    
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const text = notification.querySelector('.notification-text');
        const icon = notification.querySelector('.notification-icon');
        
        text.textContent = message;
        notification.className = `notification ${type} show`;
        
        // Remover automaticamente após 5 segundos
        setTimeout(() => {
            notification.classList.remove('show');
        }, 5000);
    }
}

// Inicializar a aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    window.vodApp = new VODApp();
});