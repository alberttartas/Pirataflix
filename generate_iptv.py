#!/usr/bin/env python3
"""
Script para gerar playlists IPTV a partir do data.json
"""
import json
import requests
from pathlib import Path

def generate_iptv_from_github():
    # URL do seu data.json no GitHub
    data_url = "https://raw.githubusercontent.com/alberttartas/Pirataflix/main/web/data.json"
    
    print("📡 BAIXANDO DADOS DO GITHUB...")
    print(f"📥 URL: {data_url}")
    
    try:
        # Baixar o data.json
        response = requests.get(data_url)
        response.raise_for_status()
        data = response.json()
        
        print(f"✅ Dados baixados com sucesso!")
        
        # Criar diretório para as playlists
        output_dir = Path("iptv_playlists")
        output_dir.mkdir(exist_ok=True)
        
        # Gerar playlists
        generate_playlists(data, output_dir)
        
        print(f"\n🎉 PLAYLISTS IPTV GERADAS COM SUCESSO!")
        print(f"📍 Pasta: {output_dir}/")
        
    except Exception as e:
        print(f"❌ Erro: {e}")

def generate_playlists(data, output_dir):
    """Gera arquivos M3U a partir dos dados"""
    
    print("\n🎬 GERANDO PLAYLISTS...")
    
    # Adicionar canais de TV se existirem
    if 'tv' not in data:
        data['tv'] = load_tv_channels()
    
    # Playlist completa
    complete_m3u = output_dir / "pirataflix_completo.m3u"
    with open(complete_m3u, 'w', encoding='utf-8') as f:
        f.write('#EXTM3U\n')
        f.write('#PLAYLIST:PIRATAFLIX - Catálogo Completo\n\n')
        
        total_canais = 0
        urls_unicas = set()
        
        for category, items in data.items():
            if not items:
                continue
                
            category_name = get_category_name(category)
            print(f"📂 Processando: {category_name} ({len(items)} itens)")
            
            for item in items:
                # Processar episódios da série/filme/canal
                episodios_processados = processar_episodios(item)
                
                for ep in episodios_processados:
                    # Verificar se URL já foi processada
                    if ep['url'] in urls_unicas:
                        continue
                    
                    urls_unicas.add(ep['url'])
                    
                    # Para filmes
                    if item.get('type') == 'movie':
                        f.write(f'#EXTINF:-1 group-title="{category_name}",{item["title"]}\n')
                        f.write(f'{ep["url"]}\n\n')
                        total_canais += 1
                    
                    # Para séries
                    elif item.get('type') == 'series':
                        titulo_ep = f"{item['title']} - {ep.get('title', f'Episódio {ep.get("episode", "?")}')}"
                        if ep.get('season'):
                            titulo_ep = f"{item['title']} - T{ep['season']:02d}E{ep.get('episode', '?'):02d} - {ep.get('title', '')}"
                        
                        f.write(f'#EXTINF:-1 group-title="{category_name}",{titulo_ep}\n')
                        f.write(f'{ep["url"]}\n\n')
                        total_canais += 1
                    
                    # Para canais de TV
                    elif item.get('type') == 'tv':
                        f.write(f'#EXTINF:-1 group-title="{category_name}",{item["title"]}\n')
                        if ep.get('tvg_logo'):
                            f.write(f'#EXTIMG:{ep["tvg_logo"]}\n')
                        if ep.get('tvg_id'):
                            f.write(f'#EXTTVG-ID:{ep["tvg_id"]}\n')
                        f.write(f'{ep["url"]}\n\n')
                        total_canais += 1
    
    print(f"✅ Playlist completa: {complete_m3u} ({total_canais} canais únicos)")
    
    # Playlists por categoria
    for category, items in data.items():
        if not items:
            continue
            
        category_m3u = output_dir / f"pirataflix_{category}.m3u"
        category_name = get_category_name(category)
        
        with open(category_m3u, 'w', encoding='utf-8') as f:
            f.write('#EXTM3U\n')
            f.write(f'#PLAYLIST:PIRATAFLIX - {category_name}\n\n')
            
            cat_canais = 0
            urls_categoria = set()
            
            for item in items:
                episodios_processados = processar_episodios(item)
                
                for ep in episodios_processados:
                    if ep['url'] in urls_categoria:
                        continue
                    
                    urls_categoria.add(ep['url'])
                    
                    if item.get('type') == 'movie':
                        f.write(f'#EXTINF:-1,{item["title"]}\n')
                        f.write(f'{ep["url"]}\n\n')
                        cat_canais += 1
                    
                    elif item.get('type') == 'series':
                        titulo_ep = f"{item['title']} - {ep.get('title', f'Episódio {ep.get("episode", "?")}')}"
                        if ep.get('season'):
                            titulo_ep = f"{item['title']} - T{ep['season']:02d}E{ep.get('episode', '?'):02d}"
                        
                        f.write(f'#EXTINF:-1,{titulo_ep}\n')
                        f.write(f'{ep["url"]}\n\n')
                        cat_canais += 1
                    
                    elif item.get('type') == 'tv':
                        f.write(f'#EXTINF:-1,{item["title"]}\n')
                        if ep.get('tvg_logo'):
                            f.write(f'#EXTIMG:{ep["tvg_logo"]}\n')
                        if ep.get('tvg_id'):
                            f.write(f'#EXTTVG-ID:{ep["tvg_id"]}\n')
                        f.write(f'{ep["url"]}\n\n')
                        cat_canais += 1
        
        print(f"✅ {category_name}: {category_m3u} ({cat_canais} canais)")
    
    # Gerar arquivo README com os links
    generate_readme(output_dir, total_canais)

def load_tv_channels():
    """Carrega os canais de TV do arquivo channels.json"""
    try:
        channels_file = Path("web/channels.json")
        if channels_file.exists():
            with open(channels_file, 'r', encoding='utf-8') as f:
                channels = json.load(f)
                # Adicionar tipo 'tv' para cada canal
                for channel in channels:
                    channel['type'] = 'tv'
                    if 'episodes' not in channel:
                        channel['episodes'] = [{
                            'url': channel.get('url', ''),
                            'title': 'AO VIVO'
                        }]
                print(f"📺 Carregados {len(channels)} canais de TV")
                return channels
    except Exception as e:
        print(f"⚠️ Erro ao carregar canais de TV: {e}")
    
    # Dados de exemplo caso não exista o arquivo
    return [
        {
            "type": "tv",
            "title": "Globo",
            "tvg_id": "globo.br",
            "tvg_logo": "https://example.com/globo.png",
            "episodes": [{"url": "http://example.com/globo.m3u8", "title": "AO VIVO"}]
        },
        {
            "type": "tv",
            "title": "SBT",
            "tvg_id": "sbt.br",
            "tvg_logo": "https://example.com/sbt.png",
            "episodes": [{"url": "http://example.com/sbt.m3u8", "title": "AO VIVO"}]
        },
        {
            "type": "tv",
            "title": "Record",
            "tvg_id": "record.br",
            "tvg_logo": "https://example.com/record.png",
            "episodes": [{"url": "http://example.com/record.m3u8", "title": "AO VIVO"}]
        }
    ]

def processar_episodios(item):
    """Processa todos os episódios de um item sem duplicatas"""
    episodios = []
    urls_vistas = set()
    
    # Para canais de TV
    if item.get('type') == 'tv':
        if item.get('episodes'):
            for ep in item['episodes']:
                if ep.get('url') and ep['url'] not in urls_vistas:
                    urls_vistas.add(ep['url'])
                    episodios.append(ep)
        else:
            # Canal sem episódios explícitos
            episodios.append({
                'url': item.get('url', ''),
                'title': 'AO VIVO'
            })
        return episodios
    
    # Processar episódios diretos (filmes)
    if item.get('episodes'):
        for ep in item['episodes']:
            if ep.get('url') and ep['url'] not in urls_vistas:
                urls_vistas.add(ep['url'])
                episodios.append(ep)
    
    # Processar episódios por temporada (séries)
    if item.get('seasons'):
        for season in item['seasons']:
            season_num = season.get('season', 1)
            if season.get('episodes'):
                for ep in season['episodes']:
                    if ep.get('url') and ep['url'] not in urls_vistas:
                        urls_vistas.add(ep['url'])
                        ep['season'] = season_num
                        episodios.append(ep)
    
    return episodios

def get_category_name(category):
    """Retorna o nome formatado da categoria"""
    names = {
        'filmes': '🎬 FILMES',
        'series': '📺 SÉRIES',
        'novelas': '💖 NOVELAS',
        'animes': '👻 ANIMES',
        'infantil': '🧸 INFANTIL',
        'tv': '📡 TV AO VIVO'
    }
    return names.get(category, category.upper())

def generate_readme(output_dir, total_canais):
    """Gera um arquivo README com os links"""
    readme_file = output_dir / "README.md"
    
    with open(readme_file, 'w', encoding='utf-8') as f:
        f.write('# 📡 PIRATAFLIX - LINKS IPTV\n\n')
        f.write(f'**Total de canais:** {total_canais}\n\n')
        f.write('## 🔗 LINKS DISPONÍVEIS\n\n')
        f.write('### Playlist Completa\n')
        f.write('```\n')
        f.write('https://raw.githubusercontent.com/alberttartas/Pirataflix/main/iptv_playlists/pirataflix_completo.m3u\n')
        f.write('```\n\n')
        
        f.write('### Por Categoria\n')
        for category in ['filmes', 'series', 'novelas', 'animes', 'infantil', 'tv']:
            cat_name = get_category_name(category)
            f.write(f'#### {cat_name}\n')
            f.write('```\n')
            f.write(f'https://raw.githubusercontent.com/alberttartas/Pirataflix/main/iptv_playlists/pirataflix_{category}.m3u\n')
            f.write('```\n\n')
        
        f.write('## 📱 COMO USAR\n\n')
        f.write('1. **TiviMate:** Settings → Playlists → Add Playlist → URL\n')
        f.write('2. **IPTV Smarters:** Add Playlist → Enter URL\n')
        f.write('3. **OTT Navigator:** Import → From URL\n')
        f.write('4. **VLC Media Player:** Media → Open Network Stream\n\n')
        
        f.write('## 🚀 ATUALIZAÇÃO AUTOMÁTICA\n\n')
        f.write('As playlists são atualizadas automaticamente quando você executa o `build.py`\n')

if __name__ == "__main__":
    generate_iptv_from_github()
