import os
import json
import re
import unicodedata
from pathlib import Path
from datetime import datetime, timedelta
from utils import normalize_tv_group

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


def clean_episode_title(raw_title, episode_num, prefix='Ep', is_chapter=False):
    """Formata título de episódio removendo prefixos redundantes. Elimina duplicação de código."""
    if raw_title and raw_title not in (f'Episódio {episode_num}', f'Capítulo {episode_num}'):
        if is_chapter:
            titulo_limpo = re.sub(r'^Cap[ií]tulo\s*\d+\s*-\s*', '', raw_title, flags=re.IGNORECASE)
        else:
            titulo_limpo = re.sub(r'^E\d+\s*-\s*', '', raw_title, flags=re.IGNORECASE)
            titulo_limpo = re.sub(r'^Epis[oó]dio\s*\d+\s*-\s*', '', titulo_limpo, flags=re.IGNORECASE)
        return titulo_limpo.strip() or raw_title
    return None


def normalize_poster_url(poster, base_url):
    """Normaliza URL de poster para URL absoluta. Elimina duplicação no EPG."""
    if not poster:
        return poster
    if poster.startswith('/'):
        return f"{base_url}{poster}"
    if not poster.startswith('http'):
        return f"{base_url}/{poster}"
    return poster



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
                    titulo_limpo = clean_episode_title(ep.get("title"), episode_num)
                    episode_title = (
                        f"S{season_num:02d}E{episode_num:02d} - {titulo_limpo}"
                        if titulo_limpo else f"S{season_num:02d}E{episode_num:02d}"
                    )
                    add_item(title=episode_title, url=ep["url"], group="📺 Séries",
                             logo=serie.get("poster", ""), tvg_id=tvg_id, tvg_name=tvg_name)
        elif serie.get("episodes"):
            tvg_id = f"{serie_id}_T01"
            for ep in serie["episodes"]:
                episode_num = ep.get("episode", 0)
                titulo_limpo = clean_episode_title(ep.get("title"), episode_num)
                episode_title = (
                    f"Ep {episode_num:02d} - {titulo_limpo}"
                    if titulo_limpo else f"Ep {episode_num:02d}"
                )
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
                    titulo_limpo = clean_episode_title(ep.get("title"), episode_num, is_chapter=True)
                    episode_title = (
                        f"Cap {episode_num:02d} - {titulo_limpo}"
                        if titulo_limpo else f"Cap {episode_num:02d}"
                    )
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
                    titulo_limpo = clean_episode_title(ep.get("title"), episode_num)
                    episode_title = (
                        f"Ep {episode_num:02d} - {titulo_limpo}"
                        if titulo_limpo else f"Ep {episode_num:02d}"
                    )
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
                    titulo_limpo = clean_episode_title(ep.get("title"), episode_num)
                    episode_title = (
                        f"Ep {episode_num:02d} - {titulo_limpo}"
                        if titulo_limpo else f"Ep {episode_num:02d}"
                    )
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
                    poster_url = normalize_poster_url(item["poster"], BASE_URL)
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
                            poster_url = normalize_poster_url(item["poster"], BASE_URL)
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

    web_dir = base_dir / "web"
    web_dir.mkdir(exist_ok=True)
    json_path = web_dir / "data.json"

    # Canais de TV sempre recarregados do channels.json com grupos normalizados.
    # Não reutilizamos data.json anterior para TV — ele pode ter grupos em inglês ou incorretos.
    channels_path = web_dir / "channels.json"
    if channels_path.exists():
        try:
            with open(channels_path, 'r', encoding='utf-8') as f:
                tv_canais = json.load(f)
            for canal in tv_canais:
                canal['group'] = normalize_tv_group(canal.get('group', ''))
            output['tv'] = tv_canais
            print(f"\n📺 TV carregada do channels.json: {len(tv_canais)} canais (grupos normalizados)")
        except Exception as e:
            print(f"\n⚠️  Erro ao ler channels.json: {e}")

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

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\n✅ JSON salvo: {json_path}")
    print(f"   📺 TV: {len(output.get('tv', []))} canais")
    print(f"   🎬 Filmes: {len(output.get('filmes', []))}")
    print(f"   📺 Séries: {len(output.get('series', []))}")

    # Enriquecer com TMDB (só itens sem overview já)
    items_sem_meta = [
        i for cat in ['filmes','series','novelas','animes','infantil']
        for i in output.get(cat, []) if not i.get('overview')
    ]
    if items_sem_meta:
        enrich_with_tmdb(output)

    # Enriquecer episódios com schedule para títulos configurados
    enrich_episode_schedule(output)

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\n✅ JSON final salvo com metadados TMDB")

    generate_html_with_correct_paths(base_dir, output)

    output_dir = base_dir / "iptv_playlists"
    output_dir.mkdir(exist_ok=True)
    generate_m3u_with_grouping(output, output_dir)
    generate_epg(output, output_dir)
    print(f"\n🌐 Interface web atualizada")
    print(f"📍 Acesse: http://localhost:8000/web/")


TMDB_API_KEY = '6862f118a59693b921840e5bbbdabb74'
TMDB_BASE    = 'https://api.themoviedb.org/3'
TMDB_IMG     = 'https://image.tmdb.org/t/p/w500'

def _load_tmdb_map() -> dict:
    """Carrega tmdb_map.json da raiz — edite esse arquivo para mapear títulos."""
    import unicodedata as _ud
    map_path = Path(__file__).parent / 'tmdb_map.json'
    if not map_path.exists():
        return {}
    try:
        raw = json.loads(map_path.read_text(encoding='utf-8'))
        return {k: v for k, v in raw.items() if not k.startswith('_')}
    except Exception as e:
        print(f"   ⚠️  tmdb_map.json com erro: {e}")
        return {}

TMDB_MAP = _load_tmdb_map()

def _resolve_tmdb(title: str) -> dict | None:
    """Procura o título (slug, normalizado, com espaços) no TMDB_MAP."""
    import unicodedata as _ud
    key = title.lower().strip()
    key_ascii = _ud.normalize('NFKD', key).encode('ASCII', 'ignore').decode('ASCII')
    key_ascii = re.sub(r'[^\w\s]', '', key_ascii).strip()
    key_slug  = re.sub(r'\s+', '_', key_ascii)
    for k in (key, key_ascii, key_slug):
        if k in TMDB_MAP:
            return TMDB_MAP[k]
    return None


def fetch_tmdb_metadata(title, media_type='movie'):
    """Busca metadados do TMDB: poster, sinopse, ano, gêneros, nota.
    Se tmdb_id estiver no mapeamento, busca diretamente pelo ID (resultado exato).
    """
    import urllib.request, urllib.parse, time

    mapped = _resolve_tmdb(title)
    if mapped:
        media_type = mapped.get('type', media_type)

    try:
        # ── Busca por ID direto (resultado garantido) ──────────────
        if mapped and mapped.get('tmdb_id'):
            tmdb_id  = mapped['tmdb_id']
            url_item = f"{TMDB_BASE}/{media_type}/{tmdb_id}?api_key={TMDB_API_KEY}&language=pt-BR"
            req_item = urllib.request.Request(url_item, headers={'User-Agent': 'Pirataflix/1.0'})
            with urllib.request.urlopen(req_item, timeout=8) as r:
                item = json.loads(r.read())
            if item.get('status_code'):  # erro da API
                return {}
        # ── Busca por texto ────────────────────────────────────────
        else:
            search_title = mapped['search'] if mapped and mapped.get('search') else title
            query = urllib.parse.quote(search_title)
            url   = f"{TMDB_BASE}/search/{media_type}?api_key={TMDB_API_KEY}&query={query}&language=pt-BR"
            req   = urllib.request.Request(url, headers={'User-Agent': 'Pirataflix/1.0'})
            with urllib.request.urlopen(req, timeout=8) as r:
                data = json.loads(r.read())
            results = data.get('results', [])
            if not results:
                url2 = f"{TMDB_BASE}/search/{media_type}?api_key={TMDB_API_KEY}&query={query}"
                req2 = urllib.request.Request(url2, headers={'User-Agent': 'Pirataflix/1.0'})
                with urllib.request.urlopen(req2, timeout=8) as r2:
                    data = json.loads(r2.read())
                results = data.get('results', [])
            if not results:
                return {}
            item    = results[0]
            tmdb_id = item.get('id', '')

        tmdb_id = item.get('id', tmdb_id if mapped else '')
        poster  = (TMDB_IMG + item['poster_path']) if item.get('poster_path') else ''
        # Backdrop em alta resolução (w1280)
        backdrop = ('https://image.tmdb.org/t/p/w1280' + item['backdrop_path']) if item.get('backdrop_path') else ''
        genres = []
        genre_map = {
            28:'Ação',18:'Drama',35:'Comédia',27:'Terror',878:'Ficção Científica',
            10749:'Romance',12:'Aventura',16:'Animação',99:'Documentário',
            80:'Crime',9648:'Mistério',14:'Fantasia',10402:'Música',36:'História',
            10751:'Família',37:'Faroeste',53:'Suspense',10752:'Guerra',
            10770:'Filme de TV',
            10759:'Ação & Aventura',10762:'Kids',10763:'News',10764:'Realidade',
            10765:'Sci-Fi & Fantasia',10766:'Novela',10767:'Talk',10768:'Guerra & Política'
        }
        for gid in item.get('genre_ids', [])[:3]:
            if gid in genre_map:
                genres.append(genre_map[gid])
        year_raw = item.get('release_date') or item.get('first_air_date') or ''
        year     = year_raw[:4] if year_raw else ''
        overview = item.get('overview', '')
        vote     = item.get('vote_average', 0)

        # Buscar elenco principal via /credits
        cast = []
        if tmdb_id:
            try:
                credits_url = f"{TMDB_BASE}/{media_type}/{tmdb_id}/credits?api_key={TMDB_API_KEY}&language=pt-BR"
                req_c = urllib.request.Request(credits_url, headers={'User-Agent': 'Pirataflix/1.0'})
                with urllib.request.urlopen(req_c, timeout=8) as rc:
                    credits_data = json.loads(rc.read())
                for actor in credits_data.get('cast', [])[:8]:
                    profile = ('https://image.tmdb.org/t/p/w185' + actor['profile_path']) if actor.get('profile_path') else ''
                    cast.append({
                        'name':      actor.get('name', ''),
                        'character': actor.get('character', ''),
                        'profile':   profile
                    })
            except Exception:
                pass

        # Buscar múltiplas capas via /images
        posters = []
        if tmdb_id:
            try:
                images_url = f"{TMDB_BASE}/{media_type}/{tmdb_id}/images?api_key={TMDB_API_KEY}&include_image_language=pt,null,en"
                req_i = urllib.request.Request(images_url, headers={'User-Agent': 'Pirataflix/1.0'})
                with urllib.request.urlopen(req_i, timeout=8) as ri:
                    images_data = json.loads(ri.read())
                for p in images_data.get('posters', [])[:6]:
                    if p.get('file_path'):
                        url_p = 'https://image.tmdb.org/t/p/w500' + p['file_path']
                        if url_p not in posters:
                            posters.append(url_p)
            except Exception:
                pass
        # Garantir que o poster principal está na lista
        if poster and poster not in posters:
            posters.insert(0, poster)

        return {
            'tmdb_poster':   poster,
            'posters':       posters,
            'backdrop':      backdrop,
            'overview':      overview,
            'year':          year,
            'genres':        genres,
            'rating':        round(vote, 1) if vote else 0,
            'tmdb_id':       tmdb_id,
            'cast':          cast
        }
    except Exception as e:
        return {}

def enrich_with_tmdb(output):
    """Enriquece filmes e séries com metadados do TMDB."""
    import time
    CATEGORY_TYPE = {
        'filmes': 'movie', 'series': 'tv', 'novelas': 'tv',
        'animes': 'tv', 'infantil': 'tv'
    }
    total = sum(len(output.get(c, [])) for c in CATEGORY_TYPE)
    done  = 0
    print(f"\n🎬 Buscando metadados TMDB para {total} itens...")
    for cat, mtype in CATEGORY_TYPE.items():
        for item in output.get(cat, []):
            done += 1
            meta = fetch_tmdb_metadata(item['title'], mtype)
            if meta:
                if meta.get('tmdb_poster') and not item.get('poster','').startswith('http'):
                    item['local_poster'] = item['poster']
                    item['poster'] = meta['tmdb_poster']
                elif meta.get('tmdb_poster') and item.get('poster','').startswith('http'):
                    item['tmdb_poster'] = meta['tmdb_poster']
                if meta.get('posters'):    item['posters']  = meta['posters']
                if meta.get('backdrop'):   item['backdrop'] = meta['backdrop']
                if meta.get('overview'):   item['overview'] = meta['overview']
                if meta.get('year'):       item['year']     = meta['year']
                if meta.get('genres'):     item['genres']   = meta['genres']
                if meta.get('rating'):     item['rating']   = meta['rating']
                if meta.get('cast'):       item['cast']     = meta['cast']
                print(f"   ✅ [{done}/{total}] {item['title']} ({meta.get('year','')})")
            else:
                print(f"   ⚠️  [{done}/{total}] {item['title']} — não encontrado no TMDB")
            time.sleep(0.26)   # respeitar rate limit TMDB (40 req/10s)
    print("✅ TMDB concluído!")

# =========================
# AGENDA DE EPISÓDIOS (TMDB)
# Títulos que devem ter schedule completo com lock/unlock por data
# =========================
EPISODE_SCHEDULE_TITLES = {
    # slug_do_titulo : tmdb_id (série)
    'tres_gracas': 289996,
    'dona_beja': 152401,
    'one_piece': 37854,
    'naruto': 46260,
    'naruto_shippuden': 31910,
    'spy_x_family': 120089,
    'historias_novo_testamento': 212879,
    
    }
# Delay de liberação: servidor leva ~5h após meia-noite do air_date
SCHEDULE_RELEASE_DELAY_HOURS = 21

def fetch_episode_schedule(tmdb_id: int, season: int = 1) -> list[dict]:
    """Busca dados por episódio de uma temporada: air_date, overview, still, guest_stars."""
    import urllib.request, json, time as _time
    BASE = 'https://api.themoviedb.org/3'
    IMG  = 'https://image.tmdb.org/t/p/w400'

    url = f"{BASE}/tv/{tmdb_id}/season/{season}?api_key={TMDB_API_KEY}&language=pt-BR"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Pirataflix/1.0'})
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())
    except Exception as e:
        print(f"   ⚠️ Erro ao buscar schedule TMDB id={tmdb_id} s{season}: {e}")
        return []

    episodes = []
    for ep in data.get('episodes', []):
        still = (IMG + ep['still_path']) if ep.get('still_path') else ''
        guests = []
        for g in ep.get('guest_stars', [])[:4]:
            photo = ('https://image.tmdb.org/t/p/w185' + g['profile_path']) if g.get('profile_path') else ''
            guests.append({'name': g.get('name',''), 'character': g.get('character',''), 'photo': photo})
        episodes.append({
            'ep_number':   ep.get('episode_number', 0),
            'air_date':    ep.get('air_date', ''),       # 'YYYY-MM-DD'
            'overview':    ep.get('overview', ''),
            'still':       still,
            'guest_stars': guests,
        })
        _time.sleep(0.05)
    return episodes

def enrich_episode_schedule(output):
    """Enriquece episódios de títulos configurados com schedule do TMDB."""
    import time as _time
    from datetime import datetime, timezone, timedelta

    if not TMDB_API_KEY or TMDB_API_KEY == 'SUA_CHAVE_AQUI':
        return

    # Data/hora atual em Brasília (UTC-3)
    now_br = datetime.now(timezone.utc) - timedelta(hours=3)

    for category in ['novelas', 'series']:
        for item in output.get(category, []):
            item_slug = slugify(item.get('title', ''))
            tmdb_id   = EPISODE_SCHEDULE_TITLES.get(item_slug)
            if not tmdb_id:
                continue

            print(f"\n📅 Buscando agenda de episódios: {item['title']} (TMDB {tmdb_id})")

            # Determinar temporadas existentes
            seasons = item.get('seasons', [])
            if not seasons and item.get('episodes'):
                seasons = [{'season': 1, 'episodes': item['episodes']}]

            for season_obj in seasons:
                season_num    = season_obj.get('season', 1)
                season_eps    = season_obj.get('episodes', [])
                tmdb_eps      = fetch_episode_schedule(tmdb_id, season_num)
                tmdb_by_num   = {e['ep_number']: e for e in tmdb_eps}

                enriched = []
                for local_ep in season_eps:
                    ep_num  = local_ep.get('episode', len(enriched) + 1)
                    tmdb_ep = tmdb_by_num.get(ep_num, {})
                    ep      = dict(local_ep)

                    air_date_str = tmdb_ep.get('air_date', '')
                    locked       = False
                    release_dt   = None

                    if air_date_str:
                        try:
                            air_dt     = datetime.strptime(air_date_str, '%Y-%m-%d')
                            # Libera às 05:00 BRT do dia do air_date (00:00 + 5h do servidor)
                            release_dt = datetime(
                                air_dt.year, air_dt.month, air_dt.day,
                                tzinfo=timezone(timedelta(hours=-3))
                            ) + timedelta(hours=SCHEDULE_RELEASE_DELAY_HOURS)
                            if now_br < release_dt:
                                locked = True
                        except Exception:
                            pass

                    ep['air_date']    = air_date_str
                    ep['overview']    = tmdb_ep.get('overview', '')
                    ep['still']       = tmdb_ep.get('still', '')
                    ep['guest_stars'] = tmdb_ep.get('guest_stars', [])
                    ep['locked']      = locked
                    if locked and release_dt:
                        ep['release_iso'] = release_dt.strftime('%Y-%m-%dT%H:%M:%S')
                    enriched.append(ep)
                    print(f"   {'🔒' if locked else '✅'} Ep {ep_num:03d} | {air_date_str} | {'BLOQUEADO' if locked else 'disponível'}")

                # Inserir episódios futuros que ainda não têm URL no m3u
                ep_nums_locais = {e.get('episode', 0) for e in season_eps}
                for ep_num, tmdb_ep in sorted(tmdb_by_num.items()):
                    if ep_num in ep_nums_locais:
                        continue
                    air_date_str = tmdb_ep.get('air_date', '')
                    locked       = True
                    release_dt   = None
                    if air_date_str:
                        try:
                            air_dt     = datetime.strptime(air_date_str, '%Y-%m-%d')
                            release_dt = datetime(
                                air_dt.year, air_dt.month, air_dt.day,
                                tzinfo=timezone(timedelta(hours=-3))
                            ) + timedelta(hours=SCHEDULE_RELEASE_DELAY_HOURS)
                            if now_br >= release_dt:
                                locked = False  # deveria estar disponível mas não tem URL ainda
                        except Exception:
                            pass
                    ep = {
                        'title':       f'Capítulo {ep_num}',
                        'url':         '',
                        'episode':     ep_num,
                        'air_date':    air_date_str,
                        'overview':    tmdb_ep.get('overview', ''),
                        'still':       tmdb_ep.get('still', ''),
                        'guest_stars': tmdb_ep.get('guest_stars', []),
                        'locked':      locked,
                    }
                    if release_dt:
                        ep['release_iso'] = release_dt.strftime('%Y-%m-%dT%H:%M:%S')
                    enriched.append(ep)
                    print(f"   🔒 Ep {ep_num:03d} | {air_date_str} | SEM URL — futuro")

                enriched.sort(key=lambda e: e.get('episode', 0))
                season_obj['episodes'] = enriched

            # Atualizar item.episodes se temporada única
            if len(seasons) == 1:
                item['episodes'] = seasons[0]['episodes']
            item['has_schedule'] = True
            _time.sleep(0.3)

    print("✅ Agenda de episódios concluída!")



def generate_pwa_files(web_dir):
    """Gera manifest.json, sw.js e ícones PWA na pasta web/"""
    import json as _json

    # --- manifest.json ---
    manifest = {
        "name": "PIRATAFLIX",
        "short_name": "Pirataflix",
        "description": "Sua plataforma de streaming pirata",
        "start_url": "./index.html",
        "display": "standalone",
        "background_color": "#141414",
        "theme_color": "#e50914",
        "orientation": "any",
        "icons": [
            {"src": f"icons/icon-{s}.png", "sizes": f"{s}x{s}", "type": "image/png", "purpose": "any maskable"}
            for s in [72, 96, 128, 144, 152, 192, 384, 512]
        ]
    }
    manifest_path = web_dir / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        _json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"✅ PWA manifest gerado: {manifest_path}")

    # --- sw.js ---
    sw_content = """const CACHE_NAME = 'pirataflix-v2';
const ASSETS = [
  './', './index.html', './filmes.html', './series.html', './novelas.html',
  './animes.html', './infantil.html', './tv.html',
  './style.css', './tv-player.css', './shared.js', './tv-player.js',
  './novo-player.js', './data.json', './channels.json',
  './favicon.png', './manifest.json'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS).catch(() => {})));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request.clone()).then(r => {
      if (r && r.status === 200 && r.type !== 'opaque') {
        const rc = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, rc));
      }
      return r;
    }).catch(() => caches.match(e.request))
  );
});
"""
    sw_path = web_dir / "sw.js"
    with open(sw_path, "w", encoding="utf-8") as f:
        f.write(sw_content)
    print(f"✅ PWA service worker gerado: {sw_path}")

    # --- icons/ ---
    icons_dir = web_dir / "icons"
    icons_dir.mkdir(exist_ok=True)
    favicon_path = web_dir / "favicon.png"
    try:
        from PIL import Image
        base_img = Image.open(favicon_path).convert("RGBA") if favicon_path.exists() else None
        for size in [72, 96, 128, 144, 152, 192, 384, 512]:
            img = Image.new("RGBA", (size, size), (20, 20, 20, 255))
            if base_img:
                icon = base_img.resize((int(size * 0.7), int(size * 0.7)), Image.LANCZOS)
                offset = ((size - icon.width) // 2, (size - icon.height) // 2)
                img.paste(icon, offset, icon)
            img.save(icons_dir / f"icon-{size}.png", "PNG")
        print(f"✅ PWA ícones gerados: {icons_dir}")
    except ImportError:
        print("⚠️  Pillow não instalado — ícones PWA não gerados. Execute: pip install Pillow")


def generate_html_with_correct_paths(base_dir, data):
    """Gera apenas channels-dict.js com o mapeamento dinâmico de logos.
    O index.html é agora um arquivo estático (web/index.html).
    CSS → web/index.css | JS app → web/index-app.js
    """
    channels_path = base_dir / "web" / "channels.json"
    channels_dict = {}
    if channels_path.exists():
        with open(channels_path, 'r', encoding='utf-8') as f:
            channels_list = json.load(f)
            for canal in channels_list:
                logo = canal.get('tvg_logo', '')
                if not logo:
                    continue
                for campo in ['title', 'name', 'tvg_name', 'tvg_id']:
                    valor = canal.get(campo, '')
                    if valor:
                        chave = re.sub(r'[^a-z0-9]', '', valor.lower())
                        if chave:
                            channels_dict[chave] = logo

    channels_js_path = base_dir / "web" / "channels-dict.js"
    channels_json = json.dumps(channels_dict, ensure_ascii=False)
    with open(channels_js_path, "w", encoding="utf-8") as f:
        f.write("// Gerado automaticamente pelo build.py - nao edite manualmente\n")
        f.write(f"window.channelsDict = {channels_json};\n")
    print(f"✅ channels-dict.js gerado: {len(channels_dict)} entradas")

    # Garantir que index.html estático existe (não sobrescrever)
    index_path = base_dir / "web" / "index.html"
    if not index_path.exists():
        print("⚠️  web/index.html não encontrado! Verifique o repositório.")
    else:
        print(f"✅ index.html estático OK ({index_path.stat().st_size // 1024 + 1}KB)")

    # Gerar arquivos PWA (manifest, sw.js, icons)
    generate_pwa_files(base_dir / "web")




if __name__ == '__main__':
    build_vod_with_direct_capas()
