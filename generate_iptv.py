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
        
        print(f"\n🎉 PLAYISTS IPTV GERADAS COM SUCESSO!")
        print(f"📍 Pasta: {output_dir}/")
        
    except Exception as e:
        print(f"❌ Erro: {e}")

def generate_playlists(data, output_dir):
    """Gera arquivos M3U a partir dos dados"""
    
    print("\n🎬 GERANDO PLAYLISTS...")
    
    # Playlist completa
    complete_m3u = output_dir / "pirataflix_completo.m3u"
    with open(complete_m3u, 'w', encoding='utf-8') as f:
        f.write('#EXTM3U\n')
        f.write('#PLAYLIST:PIRATAFLIX - Catálogo Completo\n\n')
        
        total_canais = 0
        
        for category, items in data.items():
            if not items:
                continue
                
            category_name = get_category_name(category)
            print(f"📂 Processando: {category_name} ({len(items)} itens)")
            
            for item in items:
                # Para filmes
                if item.get('type') == 'movie' and item.get('episodes'):
                    for ep in item['episodes']:
                        f.write(f'#EXTINF:-1 group-title="{category_name}",{item["title"]}\n')
                        f.write(f'{ep["url"]}\n\n')
                        total_canais += 1
                
                # Para séries
                elif item.get('type') == 'series':
                    episodes = get_all_episodes(item)
                    for ep in episodes:
                        f.write(f'#EXTINF:-1 group-title="{category_name}",{item["title"]} - {ep["title"]}\n')
                        f.write(f'{ep["url"]}\n\n')
                        total_canais += 1
    
    print(f"✅ Playlist completa: {complete_m3u} ({total_canais} canais)")
    
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
            
            for item in items:
                # Filmes
                if item.get('type') == 'movie' and item.get('episodes'):
                    for ep in item['episodes']:
                        f.write(f'#EXTINF:-1,{item["title"]}\n')
                        f.write(f'{ep["url"]}\n\n')
                        cat_canais += 1
                
                # Séries
                elif item.get('type') == 'series':
                    episodes = get_all_episodes(item)
                    for ep in episodes:
                        f.write(f'#EXTINF:-1,{item["title"]} - {ep["title"]}\n')
                        f.write(f'{ep["url"]}\n\n')
                        cat_canais += 1
        
        print(f"✅ {category_name}: {category_m3u} ({cat_canais} canais)")
    
    # Gerar arquivo README com os links
    generate_readme(output_dir, total_canais)

def get_all_episodes(item):
    """Obtém todos os episódios de uma série"""
    episodes = []
    
    # Episódios diretos
    if item.get('episodes'):
        episodes.extend(item['episodes'])
    
    # Episódios por temporada
    if item.get('seasons'):
        for season in item['seasons']:
            if season.get('episodes'):
                episodes.extend(season['episodes'])
    
    return episodes

def get_category_name(category):
    """Retorna o nome formatado da categoria"""
    names = {
        'filmes': '🎬 FILMES',
        'series': '📺 SÉRIES',
        'novelas': '💖 NOVELAS',
        'animes': '👻 ANIMES',
        'infantil': '🧸 INFANTIL'
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
        for category in ['filmes', 'series', 'novelas', 'animes', 'infantil']:
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