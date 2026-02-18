import os
import json
import re
import unicodedata
from pathlib import Path
from datetime import datetime, timedelta

# =========================
# FUNÇÕES AUXILIARES
# =========================

def slugify(text):
    """Converte texto para slug (ID compatível)"""
    if not text:
        return "unknown"
    
    # Remove acentos
    text = unicodedata.normalize('NFKD', text)
    text = text.encode('ASCII', 'ignore').decode('ASCII')
    
    # Substitui caracteres especiais
    text = re.sub(r'[^\w\s-]', '', text.lower())
    text = re.sub(r'[-\s]+', '_', text)
    
    return text.strip('-_')

def clean_name(name):
    """Limpa nome"""
    name = re.sub(r'\.m3u8?$', '', name, flags=re.IGNORECASE)
    name = name.replace('_', ' ').strip()
    words = name.split()
    if len(words) == 1 and words[0].isupper():
        return words[0]
    return ' '.join(word.capitalize() for word in words)

def extract_series_name(filename):
    """Extrai nome da série"""
    name = clean_name(filename)
    name = re.sub(r'\s+\d+$', '', name)
    return name

def extract_season_number(filename):
    """Extrai número da temporada"""
    patterns = [
        r'(?:_T|_S|_Season|_Temporada)(\d+)',
        r'_(\d+)$'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, filename, re.IGNORECASE)
        if match:
            return int(match.group(1))
    
    return 1

def extract_episode_number(title):
    """Extrai número do episódio do título"""
    patterns = [
        r'EP?\s*(\d+)',  # EP 01, EP01, E01
        r'Episódio\s*(\d+)',
        r'Capítulo\s*(\d+)',
        r'(\d+)\s*-\s*',  # 01 - Título
        r'^\s*(\d+)\s*$',  # Apenas número
        r'E(\d+)',  # E01
        r'Ep\.\s*(\d+)',  # Ep. 01
        r'#(\d+)'  # #01
    ]
    
    for pattern in patterns:
        match = re.search(pattern, title, re.IGNORECASE)
        if match:
            try:
                return int(match.group(1))
            except:
                continue
    
    # Tentar encontrar último número no título
    numbers = re.findall(r'\d+', title)
    if numbers:
        try:
            return int(numbers[-1])
        except:
            pass
    
    return None

def parse_m3u(m3u_file):
    """Faz parse de arquivo M3U e extrai números de episódios"""
    episodes = []
    
    try:
        with open(m3u_file, 'r', encoding='utf-8', errors='ignore') as f:
            lines = [line.strip() for line in f if line.strip()]
        
        episode_num = 1
        
        for i in range(len(lines)):
            if lines[i].startswith('#EXTINF:'):
                if i + 1 < len(lines) and not lines[i + 1].startswith('#'):
                    # Extrair título
                    parts = lines[i].split(',', 1)
                    raw_title = parts[1] if len(parts) > 1 else f"Episódio {episode_num}"
                    
                    # Tentar extrair número do episódio do título
                    ep_number = extract_episode_number(raw_title)
                    
                    episodes.append({
                        'title': raw_title.strip(),
                        'url': lines[i + 1].strip(),
                        'episode': ep_number or episode_num
                    })
                    episode_num += 1
        
        return episodes
        
    except Exception as e:
        print(f"      ⚠️  Parse error: {m3u_file.name} - {e}")
        return []

def get_poster_path_direct(item_name, category=""):
    """
    Retorna path ABSOLUTO da capa
    Compatível com GitHub Pages (/Pirataflix)
    Compatível com Vercel (/)
    """
    base_dir = Path(__file__).parent
    capas_dir = base_dir / "assets" / "Capas"

    # Detecta se está rodando no GitHub Pages
    BASE_URL = "/Pirataflix" if (base_dir / ".github").exists() else ""

    DEFAULT_POSTER = f"{BASE_URL}/assets/Capas/default.jpg"

    if not capas_dir.exists():
        return DEFAULT_POSTER

    name_slug = slugify(item_name)

    extensions = [".jpg", ".jpeg", ".png", ".webp"]
    candidates = []

    for ext in extensions:
        candidates.append(f"{name_slug}{ext}")
        if category:
            candidates.append(f"{name_slug}_{slugify(category)}{ext}")

    # 1️⃣ Busca exata
    for filename in candidates:
        file_path = capas_dir / filename
        if file_path.exists():
            return f"{BASE_URL}/assets/Capas/{filename}"

    # 2️⃣ Busca por similaridade
    for file in capas_dir.iterdir():
        if file.suffix.lower() in extensions:
            file_slug = slugify(file.stem)
            if name_slug in file_slug or file_slug in name_slug:
                return f"{BASE_URL}/assets/Capas/{file.name}"

    # 3️⃣ Fallback
    return DEFAULT_POSTER

# =========================
# FUNÇÕES DE PROCESSAMENTO
# =========================

def process_movie(m3u_file, output_list, category):
    """Processa um arquivo M3U de filme"""
    try:
        movie_name = clean_name(m3u_file.stem)
        episodes = parse_m3u(m3u_file)
        
        if episodes:
            # Usar caminho direto para a capa
            poster_path = get_poster_path_direct(movie_name, "filme")
            
            # Criar ID único usando slugify para consistência
            item_id = slugify(movie_name)
            
            movie_data = {
                'id': item_id,
                'title': movie_name,
                'poster': poster_path,
                'episodes': episodes,
                'type': 'movie'
            }
            output_list.append(movie_data)
            print(f"   🎬 {movie_name} - {len(episodes)} link(s) (ID: {item_id})")
            
    except Exception as e:
        print(f"   ❌ Erro em {m3u_file.name}: {e}")

def process_single_m3u(m3u_file, output_list, folder_name, category, series_name=None):
    """Processa um único arquivo M3U como série"""
    try:
        if not series_name:
            series_name = clean_name(m3u_file.stem)
        
        episodes = parse_m3u(m3u_file)
        if not episodes:
            print(f"   ⚠️  {series_name}: Nenhum episódio")
            return
        
        # Usar caminho direto para a capa
        poster_path = get_poster_path_direct(series_name, category)
        
        # Criar ID único usando slugify para consistência
        item_id = slugify(series_name)
        
        series_data = {
            'id': item_id,
            'title': series_name,
            'poster': poster_path,
            'seasons': [{
                'season': 1,
                'episodes': episodes
            }],
            'episodes': episodes,
            'type': 'series',
            'category': category
        }
        
        output_list.append(series_data)
        print(f"   📺 {series_name}: 1 temporada, {len(episodes)} episódios (ID: {item_id})")
        
    except Exception as e:
        print(f"   ❌ Erro em {m3u_file.name}: {e}")

def process_multi_m3u(series_name, m3u_files, output_list, folder_name, category):
    """Processa múltiplos arquivos M3U como série com temporadas"""
    try:
        # Criar ID único usando slugify para consistência
        series_id = slugify(series_name)
        
        # Usar caminho direto para a capa
        poster_path = get_poster_path_direct(series_name, category)
        
        series_data = {
            'id': series_id,
            'title': series_name,
            'poster': poster_path,
            'seasons': [],
            'type': 'series',
            'category': category
        }
        
        # Ordenar arquivos
        m3u_files.sort()
        
        for m3u_file in m3u_files:
            season_num = extract_season_number(m3u_file.stem)
            episodes = parse_m3u(m3u_file)
            
            if episodes:
                season_data = {
                    'season': season_num,
                    'episodes': episodes
                }
                series_data['seasons'].append(season_data)
        
        # Ordenar temporadas
        series_data['seasons'].sort(key=lambda x: x['season'])
        
        # Adicionar lista plana de episódios se só tiver 1 temporada
        if len(series_data['seasons']) == 1:
            series_data['episodes'] = series_data['seasons'][0]['episodes']
        
        if series_data['seasons']:
            total_eps = sum(len(s['episodes']) for s in series_data['seasons'])
            output_list.append(series_data)
            print(f"   📺 {series_name}: {len(series_data['seasons'])} temp, {total_eps} eps (ID: {series_id})")
            
    except Exception as e:
        print(f"   ❌ Erro na série {series_name}: {e}")

def process_root_m3u_files(m3u_files, output_list, folder_name, category):
    """Processa arquivos .m3u na raiz de uma categoria"""
    # Agrupar por nome de série
    series_dict = {}
    
    for m3u_file in m3u_files:
        series_name = extract_series_name(m3u_file.stem)
        if series_name not in series_dict:
            series_dict[series_name] = []
        series_dict[series_name].append(m3u_file)
    
    # Processar cada série
    for series_name, files in series_dict.items():
        if len(files) == 1:
            process_single_m3u(files[0], output_list, folder_name, category, series_name)
        else:
            process_multi_m3u(series_name, files, output_list, folder_name, category)

def process_series_folder(folder, output_list, folder_name, category):
    """Processa uma pasta como série"""
    try:
        series_name = clean_name(folder.name)
        series_id = slugify(series_name)
        
        # Procurar arquivos M3U na pasta
        m3u_files = list(folder.glob("*.m3u")) + list(folder.glob("*.m3u8"))
        
        if not m3u_files:
            print(f"   ⏭️  {series_name}: Nenhum arquivo .m3u")
            return
        
        if len(m3u_files) == 1:
            process_single_m3u(m3u_files[0], output_list, folder_name, category, series_name)
        else:
            process_multi_m3u(series_name, m3u_files, output_list, folder_name, category)
            
    except Exception as e:
        print(f"   ❌ Erro na pasta {folder.name}: {e}")

# =========================
# GERADOR M3U COM AGRUPAMENTO
# =========================

def generate_m3u_with_grouping(data, output_dir):
    """Gera M3U com agrupamento por ID para séries e novelas - VERSÃO UNIVERSAL"""
    
    M3U_FILE = os.path.join(output_dir, "vod_grouped.m3u")
    
    # ✅ URL BASE para GitHub Pages
    BASE_URL = "https://alberttartas.github.io/Pirataflix"
    
    m3u = f'''#EXTM3U x-tvg-url="{BASE_URL}/iptv_playlists/epg.xml"
#PLAYLIST-VERSION:2024
#GENERATED-BY:Pirataflix
#ENCODING:UTF-8

'''
    
    def add_item(title, url, group, logo="", tvg_id="", tvg_name=""):
        nonlocal m3u, BASE_URL
        
        # ✅ CORREÇÃO DAS LOGOS - URLs absolutas
        if logo:
            if logo.startswith("/Pirataflix"):
                logo = f"{BASE_URL}{logo[len('/Pirataflix'):]}"
            elif logo.startswith("assets/Capas/"):
                logo = f"{BASE_URL}/{logo}"
            elif logo.startswith("/assets/Capas/"):
                logo = f"{BASE_URL}{logo}"
            elif logo.startswith(BASE_URL):
                logo = logo
            elif not logo.startswith("http"):
                filename = os.path.basename(logo)
                logo = f"{BASE_URL}/assets/Capas/{filename}"
        
        # ✅ FORMATO UNIVERSAL IPTV
        # group-title para categoria
        # tvg-id IGUAL para todos episódios da mesma série/temporada
        m3u += f'#EXTINF:-1 group-title="{group}" tvg-id="{tvg_id}" tvg-logo="{logo}",{title}\n'
        m3u += f"{url}\n\n"
    
    # ============================================
    # FILMES - Cada filme tem seu próprio ID
    # ============================================
    for movie in data.get("filmes", []):
        movie_id = movie.get("id", slugify(movie["title"]))
        # ID único para cada filme
        tvg_id = f"{movie_id.upper()}"
        
        for ep in movie.get("episodes", []):
            add_item(
                title=movie["title"],
                url=ep["url"],
                group="🎬 Filmes",
                logo=movie.get("poster", ""),
                tvg_id=tvg_id,
                tvg_name=movie["title"]
            )
    
    # ============================================
    # SÉRIES - Todos episódios da mesma temporada com mesmo ID
    # ============================================
    for serie in data.get("series", []):
        serie_id = serie.get("id", slugify(serie["title"]))
        serie_id_upper = serie_id.upper()
        
        # 🎯 CASO 1: Série com temporadas
        if serie.get("seasons"):
            for season in serie.get("seasons", []):
                season_num = season.get("season", 1)
                
                # ✅ ID ÚNICO para TODA a temporada
                # Formato: NOMEDASERIE_T01
                tvg_id = f"{serie_id_upper}_T{season_num:02d}"
                tvg_name = f"{serie['title']} - Temporada {season_num}"
                
                for ep in season.get("episodes", []):
                    episode_num = ep.get("episode", 0)
                    
                    # Título do episódio
                    if "title" in ep and ep["title"] and ep["title"] != f"Episódio {episode_num}":
                        # Limpar título
                        titulo_limpo = re.sub(r'^E\d+\s*-\s*', '', ep["title"], flags=re.IGNORECASE)
                        titulo_limpo = re.sub(r'^Episódio\s*\d+\s*-\s*', '', titulo_limpo, flags=re.IGNORECASE)
                        episode_title = f"S{season_num:02d}E{episode_num:02d} - {titulo_limpo}"
                    else:
                        episode_title = f"S{season_num:02d}E{episode_num:02d}"
                    
                    add_item(
                        title=episode_title,
                        url=ep["url"],
                        group="📺 Séries",
                        logo=serie.get("poster", ""),
                        tvg_id=tvg_id,  # ✅ MESMO ID para toda temporada
                        tvg_name=tvg_name
                    )
        
        # 🎯 CASO 2: Série sem temporadas (episódios diretos)
        elif serie.get("episodes"):
            # ✅ ID ÚNICO para TODA a série (temporada única)
            tvg_id = f"{serie_id_upper}_T01"
            tvg_name = serie['title']
            
            for ep in serie.get("episodes", []):
                episode_num = ep.get("episode", 0)
                
                if "title" in ep and ep["title"] and ep["title"] != f"Episódio {episode_num}":
                    titulo_limpo = re.sub(r'^E\d+\s*-\s*', '', ep["title"], flags=re.IGNORECASE)
                    titulo_limpo = re.sub(r'^Episódio\s*\d+\s*-\s*', '', titulo_limpo, flags=re.IGNORECASE)
                    episode_title = f"Ep {episode_num:02d} - {titulo_limpo}"
                else:
                    episode_title = f"Ep {episode_num:02d}"
                
                add_item(
                    title=episode_title,
                    url=ep["url"],
                    group="📺 Séries",
                    logo=serie.get("poster", ""),
                    tvg_id=tvg_id,  # ✅ MESMO ID para todos episódios
                    tvg_name=tvg_name
                )
    
    # ============================================
    # NOVELAS - Mesma lógica das séries
    # ============================================
    for novela in data.get("novelas", []):
        novela_id = novela.get("id", slugify(novela["title"]))
        novela_id_upper = novela_id.upper()
        
        if novela.get("seasons"):
            for season in novela.get("seasons", []):
                season_num = season.get("season", 1)
                tvg_id = f"{novela_id_upper}_T{season_num:02d}"
                tvg_name = f"{novela['title']} - Temporada {season_num}"
                
                for ep in season.get("episodes", []):
                    episode_num = ep.get("episode", 0)
                    
                    if "title" in ep and ep["title"] and ep["title"] != f"Capítulo {episode_num}":
                        titulo_limpo = re.sub(r'^Capítulo\s*\d+\s*-\s*', '', ep["title"], flags=re.IGNORECASE)
                        episode_title = f"Cap {episode_num:02d} - {titulo_limpo}"
                    else:
                        episode_title = f"Cap {episode_num:02d}"
                    
                    add_item(
                        title=episode_title,
                        url=ep["url"],
                        group="📖 Novelas",
                        logo=novela.get("poster", ""),
                        tvg_id=tvg_id,
                        tvg_name=tvg_name
                    )
    
    # ============================================
    # ANIMES
    # ============================================
    for anime in data.get("animes", []):
        anime_id = anime.get("id", slugify(anime["title"]))
        anime_id_upper = anime_id.upper()
        
        if anime.get("seasons"):
            for season in anime.get("seasons", []):
                season_num = season.get("season", 1)
                tvg_id = f"{anime_id_upper}_T{season_num:02d}"
                tvg_name = f"{anime['title']} - Temporada {season_num}"
                
                for ep in season.get("episodes", []):
                    episode_num = ep.get("episode", 0)
                    
                    if "title" in ep and ep["title"] and ep["title"] != f"Episódio {episode_num}":
                        titulo_limpo = re.sub(r'^E\d+\s*-\s*', '', ep["title"], flags=re.IGNORECASE)
                        titulo_limpo = re.sub(r'^Episódio\s*\d+\s*-\s*', '', titulo_limpo, flags=re.IGNORECASE)
                        episode_title = f"Ep {episode_num:02d} - {titulo_limpo}"
                    else:
                        episode_title = f"Ep {episode_num:02d}"
                    
                    add_item(
                        title=episode_title,
                        url=ep["url"],
                        group="👻 Animes",
                        logo=anime.get("poster", ""),
                        tvg_id=tvg_id,
                        tvg_name=tvg_name
                    )
    
    # ============================================
    # INFANTIL
    # ============================================
    for infantil in data.get("infantil", []):
        infantil_id = infantil.get("id", slugify(infantil["title"]))
        infantil_id_upper = infantil_id.upper()
        
        if infantil.get("seasons"):
            for season in infantil.get("seasons", []):
                season_num = season.get("season", 1)
                tvg_id = f"{infantil_id_upper}_T{season_num:02d}"
                tvg_name = f"{infantil['title']} - Temporada {season_num}"
                
                for ep in season.get("episodes", []):
                    episode_num = ep.get("episode", 0)
                    
                    if "title" in ep and ep["title"] and ep["title"] != f"Episódio {episode_num}":
                        titulo_limpo = re.sub(r'^E\d+\s*-\s*', '', ep["title"], flags=re.IGNORECASE)
                        titulo_limpo = re.sub(r'^Episódio\s*\d+\s*-\s*', '', titulo_limpo, flags=re.IGNORECASE)
                        episode_title = f"Ep {episode_num:02d} - {titulo_limpo}"
                    else:
                        episode_title = f"Ep {episode_num:02d}"
                    
                    add_item(
                        title=episode_title,
                        url=ep["url"],
                        group="🧸 Infantil",
                        logo=infantil.get("poster", ""),
                        tvg_id=tvg_id,
                        tvg_name=tvg_name
                    )
    
    # ============================================
    # CANAIS DE TV (se existirem)
    # ============================================
    for canal in data.get("tv", []):
        canal_id = canal.get("tvg_id") or slugify(canal.get("title", ""))
        canal_id_upper = canal_id.upper() if canal_id else ""
        
        add_item(
            title=canal.get("title", "Canal sem nome"),
            url=canal.get("url", ""),
            group=canal.get("group", "📺 TV"),
            logo=canal.get("tvg_logo", ""),
            tvg_id=canal_id_upper,
            tvg_name=canal.get("title", "")
        )
    
    # Salvar arquivo
    with open(M3U_FILE, "w", encoding="utf-8") as f:
        f.write(m3u)
    
    print(f"\n✅ M3U gerado: {M3U_FILE}")
    print(f"📊 Estatísticas:")
    
    # Contar itens por grupo
    groups = {}
    for line in m3u.split('\n'):
        if line.startswith('#EXTINF:'):
            group_match = re.search(r'group-title="([^"]*)"', line)
            if group_match:
                group = group_match.group(1)
                groups[group] = groups.get(group, 0) + 1
    
    for group, count in groups.items():
        print(f"   {group}: {count} itens")
    
    print(f"\n📡 URL da playlist: {BASE_URL}/iptv_playlists/vod_grouped.m3u")
    
    return M3U_FILE
    
# =========================
# GERADOR EPG (VERSÃO SEM REQUESTS)
# =========================

def generate_epg(data, output_dir):
    """Gera EPG XML sem depender de requests/IMDb"""
    
    EPG_FILE = os.path.join(output_dir, "epg.xml")
    
    epg = '<?xml version="1.0" encoding="UTF-8"?>\n'
    epg += '<tv generator-info-name="Pirataflix VOD">\n'
    
    print("📺 Gerando EPG básico...")
    
    # Mapeamento de categorias
    category_map = {
        "filmes": "🎬 Filmes",
        "series": "📺 Séries", 
        "novelas": "💖 Novelas",
        "animes": "👻 Animes",
        "infantil": "🧸 Infantil"
    }
    
    # URL base para imagens
    BASE_URL = "https://alberttartas.github.io/Pirataflix"
    
    # Criar canais
    for category, cat_name in category_map.items():
        items = data.get(category, [])
        for item in items:
            base_id = item.get("id", slugify(item["title"]))
            base_id_upper = base_id.upper().replace('_', '')
            
            # Processar filmes
            if category == "filmes":
                channel_id = f"FILME.{base_id_upper}"
                epg += f'  <channel id="{channel_id}">\n'
                epg += f'    <display-name>{item["title"]}</display-name>\n'
                
                # Adicionar poster se existir
                if item.get("poster"):
                    poster_url = item["poster"]
                    if poster_url.startswith("/"):
                        poster_url = f"{BASE_URL}{poster_url}"
                    elif not poster_url.startswith("http"):
                        poster_url = f"{BASE_URL}/{poster_url}"
                    epg += f'    <icon src="{poster_url}"/>\n'
                
                epg += f'    <url>https://pirataflix-seven.vercel.app/</url>\n'
                epg += '  </channel>\n'
            
            # Processar séries/novelas/animes/infantil
            elif category in ["series", "novelas", "animes", "infantil"]:
                if item.get("seasons"):
                    for season in item["seasons"]:
                        season_num = season.get("season", 1)
                        channel_id = f"{base_id_upper}.T{season_num:02d}"
                        
                        epg += f'  <channel id="{channel_id}">\n'
                        epg += f'    <display-name>{item["title"]} - Temporada {season_num}</display-name>\n'
                        
                        if item.get("poster"):
                            poster_url = item["poster"]
                            if poster_url.startswith("/"):
                                poster_url = f"{BASE_URL}{poster_url}"
                            elif not poster_url.startswith("http"):
                                poster_url = f"{BASE_URL}/{poster_url}"
                            epg += f'    <icon src="{poster_url}"/>\n'
                        
                        epg += f'    <url>https://pirataflix-seven.vercel.app/</url>\n'
                        epg += '  </channel>\n'
    
    # Adicionar programas (próximas 24 horas)
    now = datetime.utcnow()
    
    for hour in range(24):
        current_time = now + timedelta(hours=hour)
        time_str = current_time.strftime("%Y%m%d%H%M%S +0000")
        
        for category, cat_name in category_map.items():
            items = data.get(category, [])
            for item in items:
                base_id = item.get("id", slugify(item["title"]))
                base_id_upper = base_id.upper().replace('_', '')
                
                # Programas para filmes
                if category == "filmes":
                    channel_id = f"FILME.{base_id_upper}"
                    for ep in item.get("episodes", [])[:1]:  # Primeiro episódio apenas
                        start = time_str
                        end = (current_time + timedelta(hours=2)).strftime("%Y%m%d%H%M%S +0000")
                        
                        epg += f'  <programme channel="{channel_id}" start="{start}" stop="{end}">\n'
                        epg += f'    <title>{item["title"]}</title>\n'
                        epg += f'    <desc>🎬 {item["title"]}</desc>\n'
                        epg += f'    <category>{cat_name}</category>\n'
                        epg += '  </programme>\n'
                
                # Programas para séries
                elif category in ["series", "novelas", "animes", "infantil"]:
                    if item.get("seasons"):
                        for season in item["seasons"]:
                            season_num = season.get("season", 1)
                            channel_id = f"{base_id_upper}.T{season_num:02d}"
                            
                            for ep in season.get("episodes", [])[:1]:  # Primeiro episódio de cada temporada
                                episode_num = ep.get("episode", 1)
                                start = time_str
                                end = (current_time + timedelta(hours=1)).strftime("%Y%m%d%H%M%S +0000")
                                
                                epg += f'  <programme channel="{channel_id}" start="{start}" stop="{end}">\n'
                                epg += f'    <title>{item["title"]} - Episódio {episode_num}</title>\n'
                                epg += f'    <desc>{cat_name} - {item["title"]} Temporada {season_num}</desc>\n'
                                epg += f'    <category>{cat_name}</category>\n'
                                epg += f'    <episode-num system="onscreen">S{season_num:02d}E{episode_num:02d}</episode-num>\n'
                                epg += '  </programme>\n'
    
    epg += "</tv>"
    
    # Garantir que o diretório existe
    os.makedirs(output_dir, exist_ok=True)
    
    # Salvar arquivo
    with open(EPG_FILE, "w", encoding="utf-8") as f:
        f.write(epg)
    
    print(f"✅ EPG gerado: {EPG_FILE}")
    return EPG_FILE


# =========================
# FUNÇÃO PRINCIPAL ATUALIZADA
# =========================

def build_vod_with_direct_capas():
    base_dir = Path(__file__).parent
    
    categories = {
        'Filmes': 'filmes',
        'Series': 'series',
        'Novelas': 'novelas', 
        'Animes': 'animes',
        'Infantil': 'infantil'
    }
    
    # ===== NOVO: Incluir pasta auto se existir =====
    auto_dir = base_dir / "input_auto"
    if auto_dir.exists():
        print("\n📁 Pasta input_auto encontrada! Incluindo no processamento...")
        
        # Lista de arquivos já existentes no input/
        arquivos_existentes = set()
        for pasta in ['Filmes', 'Series', 'Novelas', 'Animes', 'Infantil', 'TV']:
            pasta_input = base_dir / "input" / pasta
            if pasta_input.exists():
                for m3u in pasta_input.glob("*.m3u"):
                    arquivos_existentes.add(m3u.name)
        
        print(f"   📋 Arquivos já existentes: {len(arquivos_existentes)}")
        
        # Copiar apenas arquivos NOVOS
        copiados = 0
        ignorados = 0
        
        for subpasta in auto_dir.iterdir():
            if subpasta.is_dir():
                destino = base_dir / "input" / subpasta.name
                destino.mkdir(exist_ok=True)
                
                for m3u in subpasta.glob("*.m3u"):
                    if m3u.name not in arquivos_existentes:
                        import shutil
                        shutil.copy2(m3u, destino / m3u.name)
                        print(f"   ✅ Copiado: {subpasta.name}/{m3u.name}")
                        copiados += 1
                    else:
                        print(f"   ⏭️  Ignorado (já existe): {subpasta.name}/{m3u.name}")
                        ignorados += 1
        
        print(f"   📊 Resumo: {copiados} copiados, {ignorados} ignorados")
    # ===============================================#
    
    # O output DEVE vir DEPOIS do bloco if, mas DENTRO da função
    output = {cat_id: [] for cat_id in categories.values()}
    
    print("============================================================")
    print("🎬 SISTEMA VOD - CAPAS DIRETAS DA PASTA")
    print("============================================================")
    
    
    # Processar cada categoria
    for cat_folder, cat_id in categories.items():
        cat_path = base_dir / "input" / cat_folder
        
        if not cat_path.exists():
            print(f"\n▶️  {cat_folder}: Pasta não existe")
            continue
            
        print(f"\n▶️  Processando: input/{cat_folder}")
        
        # Para FILMES
        if cat_folder == 'Filmes':
            m3u_files = list(cat_path.glob("*.m3u")) + list(cat_path.glob("*.m3u8"))
            for m3u_file in m3u_files:
                process_movie(m3u_file, output[cat_id], cat_id)
        
        # Para outras categorias
        else:
            # Primeiro: arquivos .m3u na raiz
            root_m3u_files = list(cat_path.glob("*.m3u")) + list(cat_path.glob("*.m3u8"))
            if root_m3u_files:
                process_root_m3u_files(root_m3u_files, output[cat_id], cat_folder, cat_id)
            
            # Segundo: pastas dentro da categoria
            subfolders = [f for f in cat_path.iterdir() if f.is_dir()]
            for folder in subfolders:
                process_series_folder(folder, output[cat_id], cat_folder, cat_id)
    
    # Salvar JSON
    web_dir = base_dir / "web"
    web_dir.mkdir(exist_ok=True)
    
    json_path = web_dir / "data.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ JSON salvo em: {json_path}")
    
    # Gerar HTML atualizado
    generate_html_with_correct_paths(base_dir, output)
    

    # ============================================
    # CÓPIA DO INTEGRATE-PLAYER.JS (CORRIGIDO)
    # ============================================
    print("\n📋 VERIFICANDO CÓPIA DO INTEGRATE-PLAYER.JS:")
    print(f"   Diretório atual: {base_dir}")
    print(f"   Procurando arquivo fonte em: {base_dir / 'integrate-player.js'}")
    
    integrate_js_path = base_dir / "integrate-player.js"
    web_integrate_path = web_dir / "integrate-player.js"
    
    # Verificar se arquivo fonte existe
    if integrate_js_path.exists():
        tamanho = integrate_js_path.stat().st_size
        print(f"   ✅ Arquivo fonte ENCONTRADO!")
        print(f"   📏 Tamanho: {tamanho} bytes")
        
        # Mostrar primeiras linhas para confirmar
        with open(integrate_js_path, 'r', encoding='utf-8') as f:
            primeiras_linhas = f.readlines()[:3]
            print("   📝 Primeiras linhas:")
            for linha in primeiras_linhas:
                print(f"      {linha.strip()}")
        
        # Copiar arquivo
        with open(integrate_js_path, 'r', encoding='utf-8') as src:
            conteudo = src.read()
            with open(web_integrate_path, 'w', encoding='utf-8') as dst:
                dst.write(conteudo)
        
        # Verificar se copiou
        if web_integrate_path.exists():
            tamanho_copia = web_integrate_path.stat().st_size
            print(f"   ✅ Arquivo COPIADO com sucesso!")
            print(f"   📏 Tamanho original: {tamanho} bytes, Cópia: {tamanho_copia} bytes")
            print(f"   📍 Destino: {web_integrate_path}")
        else:
            print(f"   ❌ FALHA NA CÓPIA! Arquivo não aparece no destino")
    else:
        print(f"   ❌ Arquivo fonte NÃO ENCONTRADO em: {integrate_js_path}")
        print(f"   📋 Listando arquivos .js na raiz:")
        for arquivo in base_dir.glob("*.js"):
            print(f"      - {arquivo.name}")
        print(f"   📋 Listando TODOS os arquivos na raiz:")
        for arquivo in base_dir.glob("*"):
            if arquivo.is_file():
                print(f"      - {arquivo.name}")
    
    # ============================================
    # CONTINUAÇÃO NORMAL
    # ============================================
    
    # Criar diretório para playlists
    output_dir = base_dir / "iptv_playlists"
    output_dir.mkdir(exist_ok=True)
    
    # Gerar M3U com agrupamento
    generate_m3u_with_grouping(output, output_dir)
    
    # Gerar EPG
    generate_epg(output, output_dir)
    
    print(f"\n🌐 Interface web atualizada")
    print(f"📍 Acesse: http://localhost:8000/web/")
    
    
def generate_html_with_correct_paths(base_dir, data):
    """Gera HTML estilo Netflix com carrosséis e navegação"""
    html_template = '''<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PIRATAFLIX</title>
    
    <link rel="icon" type="image/png" href="favicon.png">
    
    <!-- jQuery e Owl Carousel para os carrosséis -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/OwlCarousel2/2.3.4/assets/owl.carousel.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/OwlCarousel2/2.3.4/assets/owl.theme.default.min.css">
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/OwlCarousel2/2.3.4/owl.carousel.min.js"></script>
    <!-- Font Awesome para ícones -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">

    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Arial', sans-serif; 
            background: #141414; 
            color: white; 
            line-height: 1.4;
        }
        
        /* Header Netflix-style */
        .header {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            padding: 20px 50px;
            background: linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%);
            z-index: 100;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .logo {
            font-size: 2.5rem;
            color: #e50914;
            font-weight: bold;
            text-decoration: none;
        }
        
        .nav-links {
            display: flex;
            gap: 20px;
        }
        
        .nav-link {
            color: #e5e5e5;
            text-decoration: none;
            font-size: 0.9rem;
            transition: color 0.3s;
        }
        
        .nav-link:hover {
            color: #fff;
        }
        
        /* Main content */
        .main-content {
            padding-top: 80px;
        }
        
        /* Category sections */
        .category-section {
            margin-bottom: 40px;
            padding: 0 50px;
            position: relative;
        }
        
        .category-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        
        .category-title {
            font-size: 1.4rem;
            color: #fff;
            font-weight: bold;
        }
        
        .see-all-link {
            color: #e50914;
            text-decoration: none;
            font-size: 0.9rem;
            padding: 5px 10px;
            border-radius: 3px;
            transition: background 0.3s;
        }
        
        .see-all-link:hover {
            background: rgba(229, 9, 20, 0.2);
        }
        
        /* Navegação do carrossel */
        .nav_items_module {
            display: flex;
            gap: 10px;
        }
        
        .nav-btn {
            background: rgba(0, 0, 0, 0.5);
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background 0.3s;
            border: 1px solid rgba(255,255,255,0.1);
        }
        
        .nav-btn:hover {
            background: #e50914;
        }
        
        /* Carrossel */
        .owl-carousel .item-card {
            margin: 0 5px;
            width: auto;
        }
        
        .item-card {
            border-radius: 4px;
            overflow: hidden;
            transition: transform 0.3s;
            cursor: pointer;
            position: relative;
            height: 100%;
        }
        
        .item-card:hover {
            transform: scale(1.05);
            z-index: 10;
        }
        
        .item-card:hover .item-poster {
            opacity: 0.5;
        }
        
        .item-card:hover .item-info {
            opacity: 1;
        }
        
        .item-poster {
            width: 100%;
            height: 320px;
            object-fit: cover;
            display: block;
            transition: opacity 0.3s;
        }
        
        .item-info {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%);
            padding: 20px;
            opacity: 0;
            transition: opacity 0.3s;
        }
        
        .item-title {
            font-size: 1rem;
            margin-bottom: 5px;
            font-weight: bold;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .item-meta {
            font-size: 0.8rem;
            color: #b3b3b3;
        }
        
        /* Rating badge */
        .rating {
            position: absolute;
            top: 10px;
            right: 10px;
            background: #e50914;
            color: white;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 0.8rem;
            font-weight: bold;
            z-index: 2;
        }
        
        /* Loading state */
        .loading {
            text-align: center;
            padding: 100px 20px;
            color: #e50914;
            font-size: 1.2rem;
        }
        
        .error {
            text-align: center;
            padding: 100px 20px;
            color: #e50914;
        }
        
        /* Modal Netflix-style */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            z-index: 1000;
            overflow-y: auto;
        }
        
        .modal-content {
            background: #181818;
            border-radius: 8px;
            max-width: 850px;
            margin: 50px auto;
            position: relative;
            overflow: hidden;
        }
        
        .modal-header {
            position: relative;
            height: 450px;
            overflow: hidden;
        }
        
        .modal-backdrop {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-size: cover;
            background-position: center;
            opacity: 0.4;
        }
        
        .modal-close {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(0,0,0,0.7);
            border: none;
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            font-size: 24px;
            cursor: pointer;
            z-index: 1001;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .modal-close:hover {
            background: #e50914;
        }
        
        .modal-body {
            padding: 30px;
            position: relative;
            z-index: 1;
        }
        
        .modal-title {
            font-size: 2rem;
            margin-bottom: 20px;
            color: #fff;
        }
        
        .modal-meta {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
            color: #b3b3b3;
        }
        
        /* Episode list */
        .episodes-section {
            margin-top: 30px;
        }
        
        .episode-list {
            display: grid;
            gap: 10px;
            max-height: 400px;
            overflow-y: auto;
        }
        
        .episode-item {
            background: #2d2d2d;
            border-radius: 4px;
            padding: 15px;
            cursor: pointer;
            transition: background 0.3s;
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .episode-item:hover {
            background: #3d3d3d;
        }
        
        .episode-number {
            background: #e50914;
            color: white;
            width: 35px;
            height: 35px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            flex-shrink: 0;
        }
        
        .episode-info {
            flex: 1;
        }
        
        .episode-title {
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        /* Play button */
        .play-button {
            background: #e50914;
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 4px;
            font-size: 1rem;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 20px;
            transition: background 0.3s;
        }
        
        .play-button:hover {
            background: #f40612;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .header {
                padding: 20px;
            }
            
            .logo {
                font-size: 2rem;
            }
            
            .category-section {
                padding: 0 20px;
            }
            
            .item-poster {
                height: 260px;
            }
            
            .modal-content {
                margin: 20px;
            }
            
            .modal-header {
                height: 300px;
            }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <header class="header">
        <a href="#" class="logo">PIRATAFLIX</a>
        <nav class="nav-links">
            <a href="#filmes" class="nav-link">Filmes</a>
            <a href="#series" class="nav-link">Séries</a>
            <a href="#novelas" class="nav-link">Novelas</a>
            <a href="#animes" class="nav-link">Animes</a>
            <a href="#infantil" class="nav-link">Infantil</a>
        </nav>
    </header>

    <!-- Main Content -->
    <main class="main-content" id="content">
        <div class="loading">Carregando catálogo...</div>
    </main>

    <!-- Modal -->
    <div class="modal" id="modal">
        <div class="modal-content">
            <div class="modal-header" id="modalHeader">
                <button class="modal-close" id="closeModal"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body" id="modalBody">
                <!-- Conteúdo será carregado aqui -->
            </div>
        </div>
    </div>

    <script>
    // Dados carregados
    window.vodData = {};
    let currentItem = null;
    
    // URLs base
    const RAW_BASE = 'https://raw.githubusercontent.com/alberttartas/Pirataflix/main';
    
    /// Carregar dados
async function loadData() {
    try {
        const response = await fetch('data.json');
        window.vodData = await response.json();
        displayContent();
        
        // 🔥 VERIFICAR se Owl Carousel existe antes de chamar
        setTimeout(function() {
            if (typeof $.fn.owlCarousel === 'function') {
                initCarousels();
                console.log('✅ Carrosséis inicializados');
            } else {
                console.error('❌ Owl Carousel não carregado!');
                // Fallback: scroll manual
                initFallbackScroll();
            }
        }, 500);
    } catch (error) {
        document.getElementById('content').innerHTML = 
            '<div class="error">Erro ao carregar dados: ' + error.message + '</div>';
    }
}

// Fallback se Owl Carousel falhar
function initFallbackScroll() {
    console.log('🔄 Usando fallback de scroll');
    $('.owl-carousel').css({
        'display': 'flex',
        'overflow-x': 'auto',
        'gap': '10px',
        'padding': '10px 0'
    });
    
    $('.owl-carousel .item-card').css({
        'flex': '0 0 auto',
        'width': '220px'
    });
    
    // Botões ainda funcionam com scroll
    $('[class^="prev-"]').off('click').on('click', function(e) {
        e.preventDefault();
        const carouselId = this.className.match(/prev-(carousel-\w+)/)[1];
        $(`#${carouselId}`).animate({ scrollLeft: '-=300' }, 300);
    });
    
    $('[class^="next-"]').off('click').on('click', function(e) {
        e.preventDefault();
        const carouselId = this.className.match(/next-(carousel-\w+)/)[1];
        $(`#${carouselId}`).animate({ scrollLeft: '+=300' }, 300);
    });
}
    
    // Inicializar carrosséis
function initCarousels() {
    // Aguarda um momento para garantir que o DOM está pronto
    setTimeout(function() {
        $('.owl-carousel').each(function() {
            const $carousel = $(this);
            const carouselId = $carousel.attr('id');
            
            if (!$carousel.data('owlCarousel')) { // Evita inicializar duas vezes
                $carousel.owlCarousel({
                    items: 7,
                    margin: 10,
                    loop: false,
                    nav: false,
                    dots: false,
                    responsive: {
                        0: { items: 2 },
                        480: { items: 3 },
                        640: { items: 4 },
                        768: { items: 5 },
                        1024: { items: 6 },
                        1280: { items: 7 }
                    },
                    onInitialized: function() {
                        console.log('✅ Carrossel iniciado:', carouselId);
                    }
                });
            }
            
            // Remover eventos antigos antes de adicionar novos (evita duplicação)
            $(`.next-${carouselId}`).off('click');
            $(`.prev-${carouselId}`).off('click');
            
            // Botão PRÓXIMO (seta DIREITA) deve ir para NEXT
            $(`.next-${carouselId}`).on('click', function(e) {
                e.preventDefault();
                console.log('➡️ Avançar:', carouselId);
                $carousel.trigger('next.owl.carousel');
            });
            
            // Botão ANTERIOR (seta ESQUERDA) deve ir para PREV
            $(`.prev-${carouselId}`).on('click', function(e) {
                e.preventDefault();
                console.log('⬅️ Voltar:', carouselId);
                $carousel.trigger('prev.owl.carousel');
            });
        });
    }, 300); // Pequeno delay para garantir que o DOM carregou
}
    
    // Exibir conteúdo
    function displayContent() {
        const contentDiv = document.getElementById('content');
        let html = '';
        
        // Ordem das categorias
        const categoryOrder = ['filmes', 'series', 'novelas', 'animes', 'infantil'];
        const categoryNames = {
            'filmes': '🎬 Filmes',
            'series': '📺 Séries', 
            'novelas': '💖 Novelas',
            'animes': '👻 Animes',
            'infantil': '🧸 Infantil'
        };
        
        const categoryPages = {
            'filmes': 'filmes.html',
            'series': 'series.html', 
            'novelas': 'novelas.html',
            'animes': 'animes.html',
            'infantil': 'infantil.html'
        };
        
        categoryOrder.forEach(category => {
            const items = vodData[category];
            if (!items || items.length === 0) return;
            
            const carouselId = `carousel-${category}`;
            
            html += `
            <section class="category-section" id="${category}">
                <div class="category-header">
                    <h2 class="category-title">${categoryNames[category]}</h2>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <div class="nav_items_module">
                            <a class="nav-btn prev-${carouselId}"><i class="fas fa-chevron-left"></i></a>
                            <a class="nav-btn next-${carouselId}"><i class="fas fa-chevron-right"></i></a>
                        </div>
                        <a href="${categoryPages[category]}" class="see-all-link">Ver Tudo <i class="fas fa-arrow-right"></i></a>
                    </div>
                </div>
                <div id="${carouselId}" class="owl-carousel">`;
            
            items.forEach(item => {
                const nomeArquivo = item.poster ? item.poster.split('/').pop() : 'default.jpg';
                const poster = `${RAW_BASE}/assets/Capas/${nomeArquivo}`;
                
                const type = category === 'filmes' ? 'Filme' : 'Série';
                const episodeCount = item.episodes ? item.episodes.length : 0;
                const seasonCount = item.seasons ? item.seasons.length : 0;
                
                let meta = '';
                if (category === 'filmes') {
                    meta = `Filme`;
                } else if (seasonCount > 1) {
                    meta = `${seasonCount} temporadas`;
                } else {
                    meta = `${episodeCount} episódios`;
                }
                
                // Rating aleatório para exemplo (você pode substituir por dados reais)
                const rating = (Math.random() * 2 + 7).toFixed(1);
                
                html += `
                <div class="item-card" onclick="openModal('${category}', '${item.id}')">
                    <img src="${poster}" alt="${item.title}" class="item-poster"
                         onerror="this.onerror=null; this.src='${RAW_BASE}/assets/Capas/default.jpg';">
                    <div class="rating">${rating}</div>
                    <div class="item-info">
                        <div class="item-title">${item.title}</div>
                        <div class="item-meta">${meta}</div>
                    </div>
                </div>`;
            });
            
            html += `</div></section>`;
        });
        
        contentDiv.innerHTML = html || '<div class="loading">Nenhum conteúdo encontrado</div>';
    }
    
    // Abrir modal
    function openModal(category, itemId) {
        const items = vodData[category];
        if (!items) return;
        
        const item = items.find(i => i.id === itemId);
        if (!item) return;
        
        currentItem = item;
        
        let modalBodyHtml = '';
        let modalHeaderHtml = '';
        
        // Header do modal com backdrop
        if (item.poster) {
            const nomeArquivo = item.poster.split('/').pop();
            const posterUrl = `${RAW_BASE}/assets/Capas/${nomeArquivo}`;
            
            modalHeaderHtml = `
                <div class="modal-backdrop" style="background-image: url('${posterUrl}')"></div>
                <button class="play-button" onclick="playFirstEpisode('${category}', '${item.id}')" style="position: absolute; bottom: 30px; left: 30px;">
                    <i class="fas fa-play"></i> Assistir
                </button>
            `;
        }
        
        // Corpo do modal
        modalBodyHtml = `
            <h2 class="modal-title">${item.title}</h2>
            <div class="modal-meta">
                <span>${category === 'filmes' ? 'Filme' : 'Série'}</span>
                ${item.episodes ? `<span>${item.episodes.length} episódios</span>` : ''}
                ${item.seasons ? `<span>${item.seasons.length} temporadas</span>` : ''}
            </div>
            <button class="play-button" onclick="playFirstEpisode('${category}', '${item.id}')">
                <i class="fas fa-play"></i> Assistir
            </button>
        `;
        
        // Listar episódios
        if (item.episodes && item.episodes.length > 0) {
            modalBodyHtml += `
            <div class="episodes-section">
                <h3 style="margin-bottom: 20px; font-size: 1.3rem;">Episódios</h3>
                <div class="episode-list">`;
            
            item.episodes.forEach((ep, index) => {
                modalBodyHtml += `
                <div class="episode-item" onclick="playEpisode('${ep.url}', '${item.title} - ${ep.title}', '${item.id}', '${category}', ${index})">
                    <div class="episode-number">${index + 1}</div>
                    <div class="episode-info">
                        <div class="episode-title">${ep.title}</div>
                    </div>
                </div>`;
            });
            
            modalBodyHtml += `</div></div>`;
        } else if (item.seasons && item.seasons.length > 0) {
            modalBodyHtml += `<div class="episodes-section">`;
            
            item.seasons.forEach(season => {
                modalBodyHtml += `
                <div style="margin-bottom: 30px;">
                    <h3 style="margin-bottom: 15px; font-size: 1.2rem;">Temporada ${season.season}</h3>
                    <div class="episode-list">`;
                
                if (season.episodes && season.episodes.length > 0) {
                    season.episodes.forEach((ep, index) => {
                        modalBodyHtml += `
                        <div class="episode-item" onclick="playEpisode('${ep.url}', '${item.title} - Temp ${season.season} - ${ep.title}', '${item.id}', '${category}', ${index})">
                            <div class="episode-number">${index + 1}</div>
                            <div class="episode-info">
                                <div class="episode-title">${ep.title}</div>
                            </div>
                        </div>`;
                    });
                }
                
                modalBodyHtml += `</div></div>`;
            });
            
            modalBodyHtml += `</div>`;
        }
        
        // Atualizar modal
        document.getElementById('modalHeader').innerHTML = modalHeaderHtml;
        document.getElementById('modalBody').innerHTML = modalBodyHtml;
        document.getElementById('modal').style.display = 'block';
        document.getElementById('modal').scrollTop = 0;
    }
    
    // Reproduzir primeiro episódio
    function playFirstEpisode(category, itemId) {
        const items = vodData[category];
        if (!items) return;
        
        const item = items.find(i => i.id === itemId);
        if (!item) return;
        
        let url = '';
        let title = '';
        
        if (item.episodes && item.episodes.length > 0) {
            url = item.episodes[0].url;
            title = `${item.title} - ${item.episodes[0].title}`;
            playEpisode(url, title, item.id, category, 0);
        } else if (item.seasons && item.seasons.length > 0 && item.seasons[0].episodes.length > 0) {
            url = item.seasons[0].episodes[0].url;
            title = `${item.title} - Temp 1 - ${item.seasons[0].episodes[0].title}`;
            playEpisode(url, title, item.id, category, 0);
        }
    }
    
    // Reproduzir episódio
    function playEpisode(url, title, itemId, category, episodeIndex) {
        if (typeof window.playWithModernPlayer === 'function') {
            window.playWithModernPlayer(url, title, '', itemId, category, episodeIndex);
            document.getElementById('modal').style.display = 'none';
        } else {
            window.open(url, '_blank');
        }
    }
    
    // Fechar modal
    document.getElementById('closeModal').onclick = function() {
        document.getElementById('modal').style.display = 'none';
    };
    
    window.onclick = function(event) {
        const modal = document.getElementById('modal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
    
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            document.getElementById('modal').style.display = 'none';
        }
    });
    
    // Carregar dados ao iniciar
    loadData();
    </script>
    
    <!-- Player scripts -->
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
    <script src="novo-player.js" defer></script>
</body>
</html>'''
    
    html_path = base_dir / "web" / "index.html"
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_template)
    
    print(f"✅ HTML gerado com carrosséis: {html_path}")
    

if __name__ == "__main__":
    build_vod_with_direct_capas()



