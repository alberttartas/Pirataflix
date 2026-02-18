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
    
    text = unicodedata.normalize('NFKD', text)
    text = text.encode('ASCII', 'ignore').decode('ASCII')
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
        r'EP?\s*(\d+)',
        r'Episódio\s*(\d+)',
        r'Capítulo\s*(\d+)',
        r'(\d+)\s*-\s*',
        r'^\s*(\d+)\s*$',
        r'E(\d+)',
        r'Ep\.\s*(\d+)',
        r'#(\d+)'
    ]
    for pattern in patterns:
        match = re.search(pattern, title, re.IGNORECASE)
        if match:
            try:
                return int(match.group(1))
            except:
                continue
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
                    parts = lines[i].split(',', 1)
                    raw_title = parts[1] if len(parts) > 1 else f"Episódio {episode_num}"
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
    """Retorna path da capa compatível com GitHub Pages e Vercel"""
    base_dir = Path(__file__).parent
    capas_dir = base_dir / "assets" / "Capas"
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

    for filename in candidates:
        file_path = capas_dir / filename
        if file_path.exists():
            return f"{BASE_URL}/assets/Capas/{filename}"

    for file in capas_dir.iterdir():
        if file.suffix.lower() in extensions:
            file_slug = slugify(file.stem)
            if name_slug in file_slug or file_slug in name_slug:
                return f"{BASE_URL}/assets/Capas/{file.name}"

    return DEFAULT_POSTER

# =========================
# FUNÇÕES DE PROCESSAMENTO
# =========================

def process_movie(m3u_file, output_list, category):
    try:
        movie_name = clean_name(m3u_file.stem)
        episodes = parse_m3u(m3u_file)
        if episodes:
            poster_path = get_poster_path_direct(movie_name, "filme")
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
    try:
        if not series_name:
            series_name = clean_name(m3u_file.stem)
        episodes = parse_m3u(m3u_file)
        if not episodes:
            print(f"   ⚠️  {series_name}: Nenhum episódio")
            return
        poster_path = get_poster_path_direct(series_name, category)
        item_id = slugify(series_name)
        series_data = {
            'id': item_id,
            'title': series_name,
            'poster': poster_path,
            'seasons': [{'season': 1, 'episodes': episodes}],
            'episodes': episodes,
            'type': 'series',
            'category': category
        }
        output_list.append(series_data)
        print(f"   📺 {series_name}: 1 temporada, {len(episodes)} episódios (ID: {item_id})")
    except Exception as e:
        print(f"   ❌ Erro em {m3u_file.name}: {e}")

def process_multi_m3u(series_name, m3u_files, output_list, folder_name, category):
    try:
        series_id = slugify(series_name)
        poster_path = get_poster_path_direct(series_name, category)
        series_data = {
            'id': series_id,
            'title': series_name,
            'poster': poster_path,
            'seasons': [],
            'type': 'series',
            'category': category
        }
        m3u_files.sort()
        for m3u_file in m3u_files:
            season_num = extract_season_number(m3u_file.stem)
            episodes = parse_m3u(m3u_file)
            if episodes:
                series_data['seasons'].append({'season': season_num, 'episodes': episodes})
        series_data['seasons'].sort(key=lambda x: x['season'])
        if len(series_data['seasons']) == 1:
            series_data['episodes'] = series_data['seasons'][0]['episodes']
        if series_data['seasons']:
            total_eps = sum(len(s['episodes']) for s in series_data['seasons'])
            output_list.append(series_data)
            print(f"   📺 {series_name}: {len(series_data['seasons'])} temp, {total_eps} eps (ID: {series_id})")
    except Exception as e:
        print(f"   ❌ Erro na série {series_name}: {e}")

def process_root_m3u_files(m3u_files, output_list, folder_name, category):
    series_dict = {}
    for m3u_file in m3u_files:
        series_name = extract_series_name(m3u_file.stem)
        if series_name not in series_dict:
            series_dict[series_name] = []
        series_dict[series_name].append(m3u_file)
    for series_name, files in series_dict.items():
        if len(files) == 1:
            process_single_m3u(files[0], output_list, folder_name, category, series_name)
        else:
            process_multi_m3u(series_name, files, output_list, folder_name, category)

def process_series_folder(folder, output_list, folder_name, category):
    try:
        series_name = clean_name(folder.name)
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
    M3U_FILE = os.path.join(output_dir, "vod_grouped.m3u")
    BASE_URL = "https://alberttartas.github.io/Pirataflix"
    
    m3u = f'#EXTM3U x-tvg-url="{BASE_URL}/iptv_playlists/epg.xml"\n'
    m3u += '#PLAYLIST-VERSION:2024\n#GENERATED-BY:Pirataflix\n#ENCODING:UTF-8\n\n'

    def add_item(title, url, group, logo="", tvg_id="", tvg_name=""):
        nonlocal m3u, BASE_URL
        if logo:
            if logo.startswith("/Pirataflix"):
                logo = f"{BASE_URL}{logo[len('/Pirataflix'):]}"
            elif logo.startswith("assets/Capas/"):
                logo = f"{BASE_URL}/{logo}"
            elif logo.startswith("/assets/Capas/"):
                logo = f"{BASE_URL}{logo}"
            elif not logo.startswith("http") and not logo.startswith(BASE_URL):
                filename = os.path.basename(logo)
                logo = f"{BASE_URL}/assets/Capas/{filename}"
        m3u += f'#EXTINF:-1 group-title="{group}" tvg-id="{tvg_id}" tvg-logo="{logo}",{title}\n'
        m3u += f"{url}\n\n"

    for movie in data.get("filmes", []):
        movie_id = movie.get("id", slugify(movie["title"]))
        tvg_id = movie_id.upper()
        for ep in movie.get("episodes", []):
            add_item(title=movie["title"], url=ep["url"], group="🎬 Filmes",
                     logo=movie.get("poster", ""), tvg_id=tvg_id, tvg_name=movie["title"])

    for serie in data.get("series", []):
        serie_id = serie.get("id", slugify(serie["title"])).upper()
        if serie.get("seasons"):
            for season in serie["seasons"]:
                season_num = season.get("season", 1)
                tvg_id = f"{serie_id}_T{season_num:02d}"
                tvg_name = f"{serie['title']} - Temporada {season_num}"
                for ep in season.get("episodes", []):
                    episode_num = ep.get("episode", 0)
                    if "title" in ep and ep["title"] and ep["title"] != f"Episódio {episode_num}":
                        titulo_limpo = re.sub(r'^E\d+\s*-\s*', '', ep["title"], flags=re.IGNORECASE)
                        titulo_limpo = re.sub(r'^Episódio\s*\d+\s*-\s*', '', titulo_limpo, flags=re.IGNORECASE)
                        episode_title = f"S{season_num:02d}E{episode_num:02d} - {titulo_limpo}"
                    else:
                        episode_title = f"S{season_num:02d}E{episode_num:02d}"
                    add_item(title=episode_title, url=ep["url"], group="📺 Séries",
                             logo=serie.get("poster", ""), tvg_id=tvg_id, tvg_name=tvg_name)
        elif serie.get("episodes"):
            tvg_id = f"{serie_id}_T01"
            for ep in serie["episodes"]:
                episode_num = ep.get("episode", 0)
                if "title" in ep and ep["title"] and ep["title"] != f"Episódio {episode_num}":
                    titulo_limpo = re.sub(r'^E\d+\s*-\s*', '', ep["title"], flags=re.IGNORECASE)
                    titulo_limpo = re.sub(r'^Episódio\s*\d+\s*-\s*', '', titulo_limpo, flags=re.IGNORECASE)
                    episode_title = f"Ep {episode_num:02d} - {titulo_limpo}"
                else:
                    episode_title = f"Ep {episode_num:02d}"
                add_item(title=episode_title, url=ep["url"], group="📺 Séries",
                         logo=serie.get("poster", ""), tvg_id=tvg_id, tvg_name=serie["title"])

    for novela in data.get("novelas", []):
        novela_id = novela.get("id", slugify(novela["title"])).upper()
        if novela.get("seasons"):
            for season in novela["seasons"]:
                season_num = season.get("season", 1)
                tvg_id = f"{novela_id}_T{season_num:02d}"
                tvg_name = f"{novela['title']} - Temporada {season_num}"
                for ep in season.get("episodes", []):
                    episode_num = ep.get("episode", 0)
                    if "title" in ep and ep["title"] and ep["title"] != f"Capítulo {episode_num}":
                        titulo_limpo = re.sub(r'^Capítulo\s*\d+\s*-\s*', '', ep["title"], flags=re.IGNORECASE)
                        episode_title = f"Cap {episode_num:02d} - {titulo_limpo}"
                    else:
                        episode_title = f"Cap {episode_num:02d}"
                    add_item(title=episode_title, url=ep["url"], group="📖 Novelas",
                             logo=novela.get("poster", ""), tvg_id=tvg_id, tvg_name=tvg_name)

    for anime in data.get("animes", []):
        anime_id = anime.get("id", slugify(anime["title"])).upper()
        if anime.get("seasons"):
            for season in anime["seasons"]:
                season_num = season.get("season", 1)
                tvg_id = f"{anime_id}_T{season_num:02d}"
                tvg_name = f"{anime['title']} - Temporada {season_num}"
                for ep in season.get("episodes", []):
                    episode_num = ep.get("episode", 0)
                    if "title" in ep and ep["title"] and ep["title"] != f"Episódio {episode_num}":
                        titulo_limpo = re.sub(r'^E\d+\s*-\s*', '', ep["title"], flags=re.IGNORECASE)
                        titulo_limpo = re.sub(r'^Episódio\s*\d+\s*-\s*', '', titulo_limpo, flags=re.IGNORECASE)
                        episode_title = f"Ep {episode_num:02d} - {titulo_limpo}"
                    else:
                        episode_title = f"Ep {episode_num:02d}"
                    add_item(title=episode_title, url=ep["url"], group="👻 Animes",
                             logo=anime.get("poster", ""), tvg_id=tvg_id, tvg_name=tvg_name)

    for infantil in data.get("infantil", []):
        infantil_id = infantil.get("id", slugify(infantil["title"])).upper()
        if infantil.get("seasons"):
            for season in infantil["seasons"]:
                season_num = season.get("season", 1)
                tvg_id = f"{infantil_id}_T{season_num:02d}"
                tvg_name = f"{infantil['title']} - Temporada {season_num}"
                for ep in season.get("episodes", []):
                    episode_num = ep.get("episode", 0)
                    if "title" in ep and ep["title"] and ep["title"] != f"Episódio {episode_num}":
                        titulo_limpo = re.sub(r'^E\d+\s*-\s*', '', ep["title"], flags=re.IGNORECASE)
                        titulo_limpo = re.sub(r'^Episódio\s*\d+\s*-\s*', '', titulo_limpo, flags=re.IGNORECASE)
                        episode_title = f"Ep {episode_num:02d} - {titulo_limpo}"
                    else:
                        episode_title = f"Ep {episode_num:02d}"
                    add_item(title=episode_title, url=ep["url"], group="🧸 Infantil",
                             logo=infantil.get("poster", ""), tvg_id=tvg_id, tvg_name=tvg_name)

    for canal in data.get("tv", []):
        canal_id = (canal.get("tvg_id") or slugify(canal.get("title", ""))).upper()
        add_item(title=canal.get("title", "Canal sem nome"), url=canal.get("url", ""),
                 group=canal.get("group", "📺 TV"), logo=canal.get("tvg_logo", ""),
                 tvg_id=canal_id, tvg_name=canal.get("title", ""))

    with open(M3U_FILE, "w", encoding="utf-8") as f:
        f.write(m3u)

    print(f"\n✅ M3U gerado: {M3U_FILE}")
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
# GERADOR EPG
# =========================

def generate_epg(data, output_dir):
    EPG_FILE = os.path.join(output_dir, "epg.xml")
    epg = '<?xml version="1.0" encoding="UTF-8"?>\n'
    epg += '<tv generator-info-name="Pirataflix VOD">\n'
    print("📺 Gerando EPG básico...")

    category_map = {
        "filmes": "🎬 Filmes", "series": "📺 Séries",
        "novelas": "💖 Novelas", "animes": "👻 Animes", "infantil": "🧸 Infantil"
    }
    BASE_URL = "https://alberttartas.github.io/Pirataflix"

    for category, cat_name in category_map.items():
        items = data.get(category, [])
        for item in items:
            base_id = item.get("id", slugify(item["title"])).upper().replace('_', '')
            if category == "filmes":
                channel_id = f"FILME.{base_id}"
                epg += f'  <channel id="{channel_id}">\n'
                epg += f'    <display-name>{item["title"]}</display-name>\n'
                if item.get("poster"):
                    poster_url = item["poster"]
                    if poster_url.startswith("/"):
                        poster_url = f"{BASE_URL}{poster_url}"
                    elif not poster_url.startswith("http"):
                        poster_url = f"{BASE_URL}/{poster_url}"
                    epg += f'    <icon src="{poster_url}"/>\n'
                epg += f'    <url>https://pirataflix-seven.vercel.app/</url>\n'
                epg += '  </channel>\n'
            elif category in ["series", "novelas", "animes", "infantil"]:
                if item.get("seasons"):
                    for season in item["seasons"]:
                        season_num = season.get("season", 1)
                        channel_id = f"{base_id}.T{season_num:02d}"
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

    now = datetime.utcnow()
    for hour in range(24):
        current_time = now + timedelta(hours=hour)
        time_str = current_time.strftime("%Y%m%d%H%M%S +0000")
        for category, cat_name in category_map.items():
            items = data.get(category, [])
            for item in items:
                base_id = item.get("id", slugify(item["title"])).upper().replace('_', '')
                if category == "filmes":
                    channel_id = f"FILME.{base_id}"
                    for ep in item.get("episodes", [])[:1]:
                        end = (current_time + timedelta(hours=2)).strftime("%Y%m%d%H%M%S +0000")
                        epg += f'  <programme channel="{channel_id}" start="{time_str}" stop="{end}">\n'
                        epg += f'    <title>{item["title"]}</title>\n'
                        epg += f'    <desc>🎬 {item["title"]}</desc>\n'
                        epg += f'    <category>{cat_name}</category>\n'
                        epg += '  </programme>\n'
                elif category in ["series", "novelas", "animes", "infantil"]:
                    if item.get("seasons"):
                        for season in item["seasons"]:
                            season_num = season.get("season", 1)
                            channel_id = f"{base_id}.T{season_num:02d}"
                            for ep in season.get("episodes", [])[:1]:
                                episode_num = ep.get("episode", 1)
                                end = (current_time + timedelta(hours=1)).strftime("%Y%m%d%H%M%S +0000")
                                epg += f'  <programme channel="{channel_id}" start="{time_str}" stop="{end}">\n'
                                epg += f'    <title>{item["title"]} - Episódio {episode_num}</title>\n'
                                epg += f'    <desc>{cat_name} - {item["title"]} Temporada {season_num}</desc>\n'
                                epg += f'    <category>{cat_name}</category>\n'
                                epg += f'    <episode-num system="onscreen">S{season_num:02d}E{episode_num:02d}</episode-num>\n'
                                epg += '  </programme>\n'

    epg += "</tv>"
    os.makedirs(output_dir, exist_ok=True)
    with open(EPG_FILE, "w", encoding="utf-8") as f:
        f.write(epg)
    print(f"✅ EPG gerado: {EPG_FILE}")
    return EPG_FILE

# =========================
# FUNÇÃO PRINCIPAL
# =========================

def build_vod_with_direct_capas():
    base_dir = Path(__file__).parent
    categories = {
        'Filmes': 'filmes', 'Series': 'series', 'Novelas': 'novelas',
        'Animes': 'animes', 'Infantil': 'infantil'
    }

    auto_dir = base_dir / "input_auto"
    if auto_dir.exists():
        print("\n📁 Pasta input_auto encontrada! Incluindo no processamento...")
        arquivos_existentes = set()
        for pasta in ['Filmes', 'Series', 'Novelas', 'Animes', 'Infantil', 'TV']:
            pasta_input = base_dir / "input" / pasta
            if pasta_input.exists():
                for m3u in pasta_input.glob("*.m3u"):
                    arquivos_existentes.add(m3u.name)
        print(f"   📋 Arquivos já existentes: {len(arquivos_existentes)}")
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

    output = {cat_id: [] for cat_id in categories.values()}
    print("============================================================")
    print("🎬 SISTEMA VOD - CAPAS DIRETAS DA PASTA")
    print("============================================================")

    for cat_folder, cat_id in categories.items():
        cat_path = base_dir / "input" / cat_folder
        if not cat_path.exists():
            print(f"\n▶️  {cat_folder}: Pasta não existe")
            continue
        print(f"\n▶️  Processando: input/{cat_folder}")
        if cat_folder == 'Filmes':
            m3u_files = list(cat_path.glob("*.m3u")) + list(cat_path.glob("*.m3u8"))
            for m3u_file in m3u_files:
                process_movie(m3u_file, output[cat_id], cat_id)
        else:
            root_m3u_files = list(cat_path.glob("*.m3u")) + list(cat_path.glob("*.m3u8"))
            if root_m3u_files:
                process_root_m3u_files(root_m3u_files, output[cat_id], cat_folder, cat_id)
            subfolders = [f for f in cat_path.iterdir() if f.is_dir()]
            for folder in subfolders:
                process_series_folder(folder, output[cat_id], cat_folder, cat_id)

    web_dir = base_dir / "web"
    web_dir.mkdir(exist_ok=True)
    json_path = web_dir / "data.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\n✅ JSON salvo em: {json_path}")

    generate_html_with_correct_paths(base_dir, output)

    print("\n📋 VERIFICANDO CÓPIA DO INTEGRATE-PLAYER.JS:")
    integrate_js_path = base_dir / "integrate-player.js"
    web_integrate_path = web_dir / "integrate-player.js"
    if integrate_js_path.exists():
        tamanho = integrate_js_path.stat().st_size
        print(f"   ✅ Arquivo fonte ENCONTRADO! Tamanho: {tamanho} bytes")
        with open(integrate_js_path, 'r', encoding='utf-8') as src:
            conteudo = src.read()
        with open(web_integrate_path, 'w', encoding='utf-8') as dst:
            dst.write(conteudo)
        if web_integrate_path.exists():
            print(f"   ✅ Arquivo COPIADO com sucesso!")
    else:
        print(f"   ❌ Arquivo fonte NÃO ENCONTRADO em: {integrate_js_path}")

    output_dir = base_dir / "iptv_playlists"
    output_dir.mkdir(exist_ok=True)
    generate_m3u_with_grouping(output, output_dir)
    generate_epg(output, output_dir)
    print(f"\n🌐 Interface web atualizada")
    print(f"📍 Acesse: http://localhost:8000/web/")


def generate_html_with_correct_paths(base_dir, data):
    """Gera HTML estilo Netflix com carrosséis e navegação"""

    channels_path = base_dir / "web" / "channels.json"
    channels_dict = {}
    if channels_path.exists():
        with open(channels_path, 'r', encoding='utf-8') as f:
            channels_list = json.load(f)
            for canal in channels_list:
                if 'tvg_logo' in canal and canal['tvg_logo']:
                    nome_limpo = canal.get('name', canal.get('tvg_name', '')).lower()
                    nome_limpo = re.sub(r'[^a-z0-9]', '', nome_limpo)
                    channels_dict[nome_limpo] = canal['tvg_logo']

    channels_json = json.dumps(channels_dict)

    # ESTRATÉGIA: Todo JS problemático vai para um bloco <script> separado,
    # fora do f-string Python. Só {channels_json} é interpolado via f-string.
    # O restante do JS usa {{ }} para escapar chaves literais.

    html_template = f'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PIRATAFLIX</title>
    <link rel="icon" type="image/png" href="favicon.png">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/OwlCarousel2/2.3.4/assets/owl.carousel.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/OwlCarousel2/2.3.4/assets/owl.theme.default.min.css">
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/OwlCarousel2/2.3.4/owl.carousel.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: Arial, sans-serif; background: #141414; color: white; line-height: 1.4; }}
        .header {{
            position: fixed; top: 0; left: 0; width: 100%; padding: 20px 50px;
            background: linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%);
            z-index: 100; display: flex; justify-content: space-between; align-items: center;
        }}
        .logo {{ font-size: 2.5rem; color: #e50914; font-weight: bold; text-decoration: none; }}
        .nav-links {{ display: flex; gap: 20px; }}
        .nav-link {{ color: #e5e5e5; text-decoration: none; font-size: 0.9rem; transition: color 0.3s; }}
        .nav-link:hover {{ color: #fff; }}
        .main-content {{ padding-top: 80px; }}
        .category-section {{ margin-bottom: 40px; padding: 0 50px; position: relative; }}
        .category-header {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }}
        .category-title {{ font-size: 1.4rem; color: #fff; font-weight: bold; }}
        .see-all-link {{ color: #e50914; text-decoration: none; font-size: 0.9rem; padding: 5px 10px; border-radius: 3px; transition: background 0.3s; }}
        .see-all-link:hover {{ background: rgba(229,9,20,0.2); }}
        .nav_items_module {{ display: flex; gap: 10px; }}
        .nav-btn {{
            background: rgba(0,0,0,0.5); color: white; width: 40px; height: 40px;
            border-radius: 50%; display: flex; align-items: center; justify-content: center;
            cursor: pointer; transition: background 0.3s; border: 1px solid rgba(255,255,255,0.1);
        }}
        .nav-btn:hover {{ background: #e50914; }}
        .owl-carousel .item-card {{ margin: 0 5px; }}
        .item-card {{
            border-radius: 4px; overflow: hidden; transition: transform 0.3s;
            cursor: pointer; position: relative;
        }}
        .item-card:hover {{ transform: scale(1.05); z-index: 10; }}
        .item-card:hover .item-poster {{ opacity: 0.5; }}
        .item-card:hover .item-info {{ opacity: 1; }}
        .item-poster {{ width: 100%; height: 320px; object-fit: cover; display: block; transition: opacity 0.3s; }}
        .item-info {{
            position: absolute; bottom: 0; left: 0; right: 0;
            background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%);
            padding: 20px; opacity: 0; transition: opacity 0.3s;
        }}
        .item-title {{ font-size: 1rem; margin-bottom: 5px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
        .item-meta {{ font-size: 0.8rem; color: #b3b3b3; }}
        .loading {{ text-align: center; padding: 100px 20px; color: #e50914; font-size: 1.2rem; }}
        .error {{ text-align: center; padding: 100px 20px; color: #e50914; }}
        .modal {{
            display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.9); z-index: 1000; overflow-y: auto;
        }}
        .modal-content {{
            background: #181818; border-radius: 8px; max-width: 850px;
            margin: 50px auto; position: relative; overflow: hidden;
        }}
        .modal-header {{ position: relative; height: 450px; overflow: hidden; }}
        .modal-backdrop {{
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background-size: cover; background-position: center; opacity: 0.4;
        }}
        .modal-close {{
            position: absolute; top: 20px; right: 20px; background: rgba(0,0,0,0.7);
            border: none; color: white; width: 40px; height: 40px; border-radius: 50%;
            font-size: 24px; cursor: pointer; z-index: 1001;
            display: flex; align-items: center; justify-content: center;
        }}
        .modal-close:hover {{ background: #e50914; }}
        .modal-body {{ padding: 30px; }}
        .modal-title {{ font-size: 2rem; margin-bottom: 20px; color: #fff; }}
        .modal-meta {{ display: flex; gap: 20px; margin-bottom: 20px; color: #b3b3b3; }}
        .episodes-section {{ margin-top: 30px; }}
        .episode-list {{ display: grid; gap: 10px; max-height: 400px; overflow-y: auto; }}
        .episode-item {{
            background: #2d2d2d; border-radius: 4px; padding: 15px; cursor: pointer;
            transition: background 0.3s; display: flex; align-items: center; gap: 15px;
        }}
        .episode-item:hover {{ background: #3d3d3d; }}
        .episode-number {{
            background: #e50914; color: white; width: 35px; height: 35px;
            border-radius: 50%; display: flex; align-items: center; justify-content: center;
            font-weight: bold; flex-shrink: 0;
        }}
        .episode-info {{ flex: 1; }}
        .episode-title {{ font-weight: bold; margin-bottom: 5px; }}
        .play-button {{
            background: #e50914; color: white; border: none; padding: 12px 30px;
            border-radius: 4px; font-size: 1rem; font-weight: bold; cursor: pointer;
            display: flex; align-items: center; gap: 10px; margin-top: 20px; transition: background 0.3s;
        }}
        .play-button:hover {{ background: #f40612; }}
        @media (max-width: 768px) {{
            .header {{ padding: 20px; }}
            .logo {{ font-size: 2rem; }}
            .category-section {{ padding: 0 20px; }}
            .item-poster {{ height: 260px; }}
            .modal-content {{ margin: 20px; }}
            .modal-header {{ height: 300px; }}
        }}
        .continue-watching .item-poster {{ height: 180px !important; }}
        .continue-watching .progress-bar-wrap {{
            position: absolute; bottom: 0; left: 0; width: 100%;
            height: 4px; background: rgba(255,255,255,0.3); z-index: 3;
        }}
        .continue-watching .progress-fill {{ height: 100%; background: #e50914; }}
        .continue-watching .watch-badge {{
            position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.7);
            color: #fff; padding: 3px 8px; border-radius: 3px; font-size: 0.7rem;
            font-weight: bold; z-index: 3; border-left: 3px solid #e50914;
        }}
    </style>
</head>
<body>
    <header class="header">
        <a href="#" class="logo">PIRATAFLIX</a>
        <nav class="nav-links">
            <a href="#filmes" class="nav-link">Filmes</a>
            <a href="#series" class="nav-link">Séries</a>
            <a href="#novelas" class="nav-link">Novelas</a>
            <a href="#animes" class="nav-link">Animes</a>
            <a href="#infantil" class="nav-link">Infantil</a>
            <a href="#tv" class="nav-link">TV Ao Vivo</a>
        </nav>
    </header>

    <main class="main-content" id="content">
        <div class="loading">Carregando catálogo...</div>
    </main>

    <div class="modal" id="modal">
        <div class="modal-content">
            <div class="modal-header" id="modalHeader">
                <button class="modal-close" id="closeModal"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body" id="modalBody"></div>
        </div>
    </div>

    <!-- Dados dos canais injetados pelo Python -->
    <script>
        window.channelsDict = {channels_json};
    </script>

    <!-- Todo o JS da aplicação num bloco separado, sem f-string Python -->
    <script id="app-script">
    (function() {{
        var RAW_BASE = 'https://raw.githubusercontent.com/alberttartas/Pirataflix/main';
        var DEFAULT_POSTER = RAW_BASE + '/assets/Capas/default.jpg';
        window._DEFAULT_POSTER = DEFAULT_POSTER;
        window.vodData = {{}};

        // =====================
        // CARREGAR DADOS
        // =====================
        async function loadData() {{
            try {{
                var response = await fetch('data.json');
                window.vodData = await response.json();
                displayContent();
                setTimeout(function() {{
                    if (typeof $.fn.owlCarousel === 'function') {{
                        initCarousels();
                    }} else {{
                        initFallbackScroll();
                    }}
                }}, 500);
            }} catch (error) {{
                document.getElementById('content').innerHTML =
                    '<div class="error">Erro ao carregar: ' + error.message + '</div>';
            }}
        }}

        // =====================
        // FALLBACK SCROLL
        // =====================
        function initFallbackScroll() {{
            $('.owl-carousel').css({{ display: 'flex', 'overflow-x': 'auto', gap: '10px' }});
            $('.owl-carousel .item-card').css({{ flex: '0 0 auto', width: '220px' }});
        }}

        // =====================
        // CARROSSÉIS
        // =====================
        function initCarousels() {{
            setTimeout(function() {{
                $('.owl-carousel').each(function() {{
                    var $c = $(this);
                    var cId = $c.attr('id');
                    var isCont = cId === 'carousel-continue';
                    if (!$c.data('owlCarousel')) {{
                        $c.owlCarousel({{
                            items: isCont ? 8 : 7,
                            margin: isCont ? 8 : 10,
                            loop: false, nav: false, dots: false,
                            responsive: {{
                                0:    {{ items: isCont ? 3 : 2 }},
                                480:  {{ items: isCont ? 4 : 3 }},
                                640:  {{ items: isCont ? 5 : 4 }},
                                768:  {{ items: isCont ? 6 : 5 }},
                                1024: {{ items: isCont ? 7 : 6 }},
                                1280: {{ items: isCont ? 8 : 7 }}
                            }}
                        }});
                    }}
                    $('.next-' + cId).off('click').on('click', function(e) {{
                        e.preventDefault(); $c.trigger('next.owl.carousel');
                    }});
                    $('.prev-' + cId).off('click').on('click', function(e) {{
                        e.preventDefault(); $c.trigger('prev.owl.carousel');
                    }});
                }});
            }}, 300);
        }}

        // =====================
        // HELPERS
        // =====================
        function getPoster(item, category) {{
            if (category === 'tv') {{
                var key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');
                return (window.channelsDict && window.channelsDict[key])
                    ? window.channelsDict[key]
                    : RAW_BASE + '/assets/Capas/tv_default.jpg';
            }}
            var file = item.poster ? item.poster.split('/').pop() : 'default.jpg';
            return RAW_BASE + '/assets/Capas/' + file;
        }}

        function safeImg(poster, altText) {{
            return '<img src="' + poster + '" alt="' + altText.replace(/"/g, '') +
                   '" class="item-poster" onerror="this.onerror=null;this.src=window._DEFAULT_POSTER">';
        }}

        // =====================
        // EXIBIR CONTEÚDO
        // =====================
        function displayContent() {{
            var contentDiv = document.getElementById('content');
            var html = '';

            // Continuar assistindo
            var continueList = [];
            try {{
                var saved = localStorage.getItem('continueWatching');
                continueList = saved ? JSON.parse(saved) : [];
            }} catch(e) {{ continueList = []; }}

            if (continueList.length > 0) {{
                html += '<section class="category-section continue-watching">';
                html += '<div class="category-header">';
                html += '<h2 class="category-title">⏯️ Continuar Assistindo</h2>';
                html += '<div class="nav_items_module">';
                html += '<a class="nav-btn prev-carousel-continue"><i class="fas fa-chevron-left"></i></a>';
                html += '<a class="nav-btn next-carousel-continue"><i class="fas fa-chevron-right"></i></a>';
                html += '</div></div>';
                html += '<div id="carousel-continue" class="owl-carousel">';
                continueList.forEach(function(item) {{
                    var progress = item.progress || 45;
                    var timeLeft = item.timeLeft || '45 min restantes';
                    var poster = item.poster ? (RAW_BASE + '/assets/Capas/' + item.poster.split('/').pop()) : DEFAULT_POSTER;
                    html += '<div class="item-card" data-category="' + item.category + '" data-id="' + item.id + '">';
                    html += safeImg(poster, item.title);
                    html += '<div class="watch-badge">⏯️ Continuar</div>';
                    html += '<div class="progress-bar-wrap"><div class="progress-fill" style="width:' + progress + '%;"></div></div>';
                    html += '<div class="item-info">';
                    html += '<div class="item-title">' + item.title + '</div>';
                    html += '<div class="item-meta">' + (item.episode || '') + ' • ' + timeLeft + '</div>';
                    html += '</div></div>';
                }});
                html += '</div></section>';
            }}

            // Categorias normais
            var categoryOrder = ['filmes', 'series', 'novelas', 'animes', 'infantil', 'tv'];
            var categoryNames = {{
                filmes: '🎬 Filmes', series: '📺 Séries', novelas: '💖 Novelas',
                animes: '👻 Animes', infantil: '🧸 Infantil', tv: '📡 TV AO VIVO'
            }};
            var categoryPages = {{
                filmes: 'filmes.html', series: 'series.html', novelas: 'novelas.html',
                animes: 'animes.html', infantil: 'infantil.html', tv: 'tv.html'
            }};

            categoryOrder.forEach(function(category) {{
                var items = window.vodData[category];
                if (!items || items.length === 0) return;
                var carouselId = 'carousel-' + category;
                html += '<section class="category-section" id="' + category + '">';
                html += '<div class="category-header">';
                html += '<h2 class="category-title">' + categoryNames[category] + '</h2>';
                html += '<div style="display:flex;gap:10px;align-items:center;">';
                html += '<div class="nav_items_module">';
                html += '<a class="nav-btn prev-' + carouselId + '"><i class="fas fa-chevron-left"></i></a>';
                html += '<a class="nav-btn next-' + carouselId + '"><i class="fas fa-chevron-right"></i></a>';
                html += '</div>';
                html += '<a href="' + categoryPages[category] + '" class="see-all-link">Ver Tudo <i class="fas fa-arrow-right"></i></a>';
                html += '</div></div>';
                html += '<div id="' + carouselId + '" class="owl-carousel">';

                items.forEach(function(item) {{
                    var poster = getPoster(item, category);
                    var episodeCount = item.episodes ? item.episodes.length : 0;
                    var meta = category === 'filmes' ? 'Filme'
                             : category === 'tv' ? '📡 Ao Vivo'
                             : (item.seasons && item.seasons.length > 1) ? item.seasons.length + ' temporadas'
                             : episodeCount + ' episódios';
                    html += '<div class="item-card" data-category="' + category + '" data-id="' + item.id + '">';
                    html += safeImg(poster, item.title);
                    html += '<div class="item-info">';
                    html += '<div class="item-title">' + item.title + '</div>';
                    html += '<div class="item-meta">' + meta + '</div>';
                    html += '</div></div>';
                }});

                html += '</div></section>';
            }});

            contentDiv.innerHTML = html || '<div class="loading">Nenhum conteúdo encontrado</div>';

            // Delegação de eventos — ZERO onclick inline
            contentDiv.addEventListener('click', function(e) {{
                var card = e.target.closest('.item-card');
                if (card) {{
                    var cat = card.dataset.category;
                    var id  = card.dataset.id;
                    if (cat && id) openModal(cat, id);
                }}
            }});
        }}

        // =====================
        // MODAL
        // =====================
        function openModal(category, itemId) {{
            var items = window.vodData[category];
            if (!items) return;
            var item = items.find(function(i) {{ return i.id === itemId; }});
            if (!item) return;

            var posterUrl = getPoster(item, category);

            var headerHtml = '<div class="modal-backdrop" style="background-image:url(\'' + posterUrl + '\')"></div>';
            if (category === 'tv') {{
                headerHtml += '<div style="position:absolute;top:30px;left:30px;background:#e50914;color:white;padding:8px 16px;border-radius:4px;font-weight:bold;">🔴 AO VIVO</div>';
            }}
            headerHtml += '<button class="play-button" data-action="play-first" data-category="' + category + '" data-id="' + itemId + '" style="position:absolute;bottom:30px;left:30px;">';
            headerHtml += '<i class="fas fa-play"></i> ' + (category === 'tv' ? 'Assistir ao Vivo' : 'Assistir') + '</button>';

            var bodyHtml = '<h2 class="modal-title">' + item.title + '</h2>';
            bodyHtml += '<div class="modal-meta">';
            bodyHtml += '<span>' + (category === 'filmes' ? 'Filme' : category === 'tv' ? 'Canal de TV' : 'Série') + '</span>';
            if (category === 'tv') bodyHtml += '<span>🔴 Ao Vivo</span>';
            if (item.episodes) bodyHtml += '<span>' + item.episodes.length + (category === 'tv' ? ' canais' : ' episódios') + '</span>';
            bodyHtml += '</div>';
            bodyHtml += '<button class="play-button" data-action="play-first" data-category="' + category + '" data-id="' + itemId + '">';
            bodyHtml += '<i class="fas fa-play"></i> ' + (category === 'tv' ? 'Assistir ao Vivo' : 'Assistir') + '</button>';

            if (item.episodes && item.episodes.length > 0) {{
                var label = category === 'tv' ? 'Canais Disponíveis' : 'Episódios';
                bodyHtml += '<div class="episodes-section"><h3 style="margin-bottom:20px;font-size:1.3rem;">' + label + '</h3>';
                bodyHtml += '<div class="episode-list">';
                item.episodes.forEach(function(ep, index) {{
                    bodyHtml += '<div class="episode-item" data-action="play-ep" data-url="' + ep.url + '" data-title="' + (ep.title || '').replace(/"/g, '') + '" data-itemid="' + itemId + '" data-category="' + category + '" data-index="' + index + '">';
                    bodyHtml += '<div class="episode-number">' + (index + 1) + '</div>';
                    bodyHtml += '<div class="episode-info"><div class="episode-title">' + (ep.title || item.title) + '</div>';
                    bodyHtml += '<div>' + (category === 'tv' ? '🔴 Ao Vivo' : '') + '</div></div></div>';
                }});
                bodyHtml += '</div></div>';
            }}

            document.getElementById('modalHeader').innerHTML = headerHtml;
            document.getElementById('modalBody').innerHTML = bodyHtml;
            document.getElementById('modal').style.display = 'block';
            document.getElementById('modal').scrollTop = 0;
        }}

        // Delegação de eventos para o modal
        document.getElementById('modal').addEventListener('click', function(e) {{
            var el = e.target.closest('[data-action]');
            if (!el) return;
            var action = el.dataset.action;
            var cat    = el.dataset.category;
            var id     = el.dataset.id;

            if (action === 'play-first') {{
                playFirstEpisode(cat, id);
            }} else if (action === 'play-ep') {{
                playEpisode(el.dataset.url, item_title_from(cat, id) + ' - ' + el.dataset.title,
                            id, cat, parseInt(el.dataset.index));
            }}
        }});

        function item_title_from(category, itemId) {{
            var items = window.vodData[category];
            if (!items) return '';
            var item = items.find(function(i) {{ return i.id === itemId; }});
            return item ? item.title : '';
        }}

        function playFirstEpisode(category, itemId) {{
            var items = window.vodData[category];
            if (!items) return;
            var item = items.find(function(i) {{ return i.id === itemId; }});
            if (!item) return;
            if (item.episodes && item.episodes.length > 0) {{
                playEpisode(item.episodes[0].url, item.title + ' - ' + item.episodes[0].title, itemId, category, 0);
            }} else if (item.seasons && item.seasons.length > 0 && item.seasons[0].episodes.length > 0) {{
                var ep = item.seasons[0].episodes[0];
                playEpisode(ep.url, item.title + ' - Temp 1 - ' + ep.title, itemId, category, 0);
            }}
        }}

        function playEpisode(url, title, itemId, category, episodeIndex) {{
            if (typeof window.playWithModernPlayer === 'function') {{
                window.playWithModernPlayer(url, title, '', itemId, category, episodeIndex);
                document.getElementById('modal').style.display = 'none';
            }} else {{
                window.open(url, '_blank');
            }}
        }}

        // Fechar modal
        document.getElementById('closeModal').onclick = function() {{
            document.getElementById('modal').style.display = 'none';
        }};
        window.onclick = function(event) {{
            var modal = document.getElementById('modal');
            if (event.target === modal) modal.style.display = 'none';
        }};
        document.addEventListener('keydown', function(event) {{
            if (event.key === 'Escape') document.getElementById('modal').style.display = 'none';
        }});

        loadData();
    }})();
    </script>

    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
    <script src="novo-player.js" defer></script>
</body>
</html>'''

    html_path = base_dir / "web" / "index.html"
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_template)
    print(f"✅ HTML gerado com carrosséis e TV: {html_path}")


if __name__ == "__main__":
    build_vod_with_direct_capas()
