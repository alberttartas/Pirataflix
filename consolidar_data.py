#!/usr/bin/env python3
"""
Script para consolidar filmes, séries e canais de TV no data.json sem repetições
"""
import json
import requests
from pathlib import Path
from datetime import datetime

def consolidate_data():
    print("="*60)
    print("🔄 CONSOLIDANDO DADOS NO DATA.JSON")
    print("="*60)
    
    # Caminhos dos arquivos
    web_dir = Path("web")
    data_json = web_dir / "data.json"
    channels_json = web_dir / "channels.json"
    
    # Backup do data.json atual
    if data_json.exists():
        backup_file = web_dir / f"data_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(data_json, 'r', encoding='utf-8') as f:
            backup_data = json.load(f)
        with open(backup_file, 'w', encoding='utf-8') as f:
            json.dump(backup_data, f, indent=2, ensure_ascii=False)
        print(f"✅ Backup criado: {backup_file}")
    
    # Carregar data.json atual
    if data_json.exists():
        with open(data_json, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"📂 Data.json carregado: {len(data.get('filmes', []))} filmes, {len(data.get('series', []))} séries")
    else:
        data = {
            "filmes": [],
            "series": [],
            "novelas": [],
            "animes": [],
            "infantil": [],
            "tv": []  # Nova categoria para TV
        }
        print("📂 Criando novo data.json")
    
    # Carregar canais de TV
    if channels_json.exists():
        with open(channels_json, 'r', encoding='utf-8') as f:
            tv_channels = json.load(f)
        print(f"📺 Canais de TV carregados: {len(tv_channels)}")
    else:
        tv_channels = []
        print("⚠️ Nenhum channels.json encontrado")
    
    # Criar conjunto de URLs únicas existentes
    urls_existentes = set()
    
    # Coletar URLs de filmes
    for filme in data.get('filmes', []):
        if filme.get('episodes'):
            for ep in filme['episodes']:
                if ep.get('url'):
                    urls_existentes.add(ep['url'])
    
    # Coletar URLs de séries
    for serie in data.get('series', []):
        # Episódios diretos
        if serie.get('episodes'):
            for ep in serie['episodes']:
                if ep.get('url'):
                    urls_existentes.add(ep['url'])
        
        # Episódios por temporada
        if serie.get('seasons'):
            for season in serie['seasons']:
                if season.get('episodes'):
                    for ep in season['episodes']:
                        if ep.get('url'):
                            urls_existentes.add(ep['url'])
    
    # Coletar URLs de novelas
    for novela in data.get('novelas', []):
        if novela.get('episodes'):
            for ep in novela['episodes']:
                if ep.get('url'):
                    urls_existentes.add(ep['url'])
    
    # Coletar URLs de animes
    for anime in data.get('animes', []):
        if anime.get('episodes'):
            for ep in anime['episodes']:
                if ep.get('url'):
                    urls_existentes.add(ep['url'])
    
    # Coletar URLs de infantil
    for infantil in data.get('infantil', []):
        if infantil.get('episodes'):
            for ep in infantil['episodes']:
                if ep.get('url'):
                    urls_existentes.add(ep['url'])
    
    print(f"🔍 URLs únicas existentes: {len(urls_existentes)}")
    
    # Adicionar canais de TV (apenas os novos)
    tv_canais_novos = 0
    tv_canais_duplicados = 0
    
    # Garantir que a categoria tv existe
    if 'tv' not in data:
        data['tv'] = []
    
    # URLs existentes na categoria tv
    urls_tv_existentes = set()
    for canal in data.get('tv', []):
        if canal.get('url'):
            urls_tv_existentes.add(canal['url'])
        if canal.get('episodes'):
            for ep in canal['episodes']:
                if ep.get('url'):
                    urls_tv_existentes.add(ep['url'])
    
    for canal in tv_channels:
        # Verificar URL principal
        url_principal = canal.get('url', '')
        if url_principal and url_principal in urls_existentes:
            tv_canais_duplicados += 1
            print(f"   ⚠️ Canal duplicado ignorado: {canal.get('title')} - URL já existe")
            continue
        
        # Verificar URLs dos episódios
        url_duplicada = False
        if canal.get('episodes'):
            for ep in canal['episodes']:
                if ep.get('url') and ep['url'] in urls_existentes:
                    url_duplicada = True
                    tv_canais_duplicados += 1
                    print(f"   ⚠️ Canal duplicado ignorado: {canal.get('title')} - URL de episódio já existe")
                    break
        
        if url_duplicada:
            continue
        
        # Verificar se já existe na categoria tv
        if url_principal and url_principal in urls_tv_existentes:
            tv_canais_duplicados += 1
            print(f"   ⚠️ Canal já existe na categoria TV: {canal.get('title')}")
            continue
        
        # Adicionar canal novo
        data['tv'].append(canal)
        tv_canais_novos += 1
        urls_existentes.add(url_principal)
        if canal.get('episodes'):
            for ep in canal['episodes']:
                if ep.get('url'):
                    urls_existentes.add(ep['url'])
        
        print(f"   ✅ Canal novo adicionado: {canal.get('title')}")
    
    print(f"\n📊 Resultados:")
    print(f"   ✅ Canais novos adicionados: {tv_canais_novos}")
    print(f"   ⚠️ Canais duplicados ignorados: {tv_canais_duplicados}")
    print(f"   📺 Total de canais na categoria TV: {len(data['tv'])}")
    
    # Estatísticas gerais
    total_geral = 0
    for categoria, itens in data.items():
        if categoria == 'tv':
            qtd = len(itens)
        else:
            qtd = len(itens)
        total_geral += qtd
        print(f"   {categoria}: {qtd} itens")
    
    print(f"   📊 TOTAL GERAL: {total_geral} itens")
    
    # Salvar data.json consolidado
    with open(data_json, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Data.json salvo: {data_json}")
    
    # Criar relatório
    relatorio = {
        'data': datetime.now().isoformat(),
        'canais_novos': tv_canais_novos,
        'canais_duplicados': tv_canais_duplicados,
        'total_tv': len(data['tv']),
        'totais_por_categoria': {k: len(v) for k, v in data.items()},
        'total_geral': total_geral
    }
    
    relatorio_file = web_dir / f"consolidacao_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(relatorio_file, 'w', encoding='utf-8') as f:
        json.dump(relatorio, f, indent=2, ensure_ascii=False)
    
    print(f"📊 Relatório salvo: {relatorio_file}")
    print("="*60)
    
    return data

def verificar_duplicatas_no_data():
    """Verifica se há URLs duplicadas dentro do próprio data.json"""
    print("\n🔍 Verificando duplicatas internas no data.json...")
    
    data_json = Path("web/data.json")
    if not data_json.exists():
        print("❌ data.json não encontrado")
        return
    
    with open(data_json, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    todas_urls = []
    urls_por_categoria = {}
    
    for categoria, itens in data.items():
        urls_por_categoria[categoria] = []
        for item in itens:
            if item.get('type') == 'tv':
                if item.get('url'):
                    todas_urls.append((categoria, item.get('title'), item['url']))
                    urls_por_categoria[categoria].append(item['url'])
                if item.get('episodes'):
                    for ep in item['episodes']:
                        if ep.get('url'):
                            todas_urls.append((categoria, item.get('title'), ep['url']))
                            urls_por_categoria[categoria].append(ep['url'])
            else:
                if item.get('episodes'):
                    for ep in item['episodes']:
                        if ep.get('url'):
                            todas_urls.append((categoria, item.get('title'), ep['url']))
                            urls_por_categoria[categoria].append(ep['url'])
                if item.get('seasons'):
                    for season in item['seasons']:
                        if season.get('episodes'):
                            for ep in season['episodes']:
                                if ep.get('url'):
                                    todas_urls.append((categoria, item.get('title'), ep['url']))
                                    urls_por_categoria[categoria].append(ep['url'])
    
    # Verificar duplicatas globais
    urls_vistas = set()
    duplicatas = []
    
    for categoria, titulo, url in todas_urls:
        if url in urls_vistas:
            duplicatas.append((categoria, titulo, url))
        else:
            urls_vistas.add(url)
    
    if duplicatas:
        print(f"⚠️ Encontradas {len(duplicatas)} URLs duplicadas:")
        for cat, titulo, url in duplicatas[:10]:  # Mostra apenas as 10 primeiras
            print(f"   - {cat} | {titulo}: {url[:50]}...")
        if len(duplicatas) > 10:
            print(f"   ... e mais {len(duplicatas) - 10}")
    else:
        print("✅ Nenhuma duplicata encontrada!")
    
    return duplicatas

def main():
    # Consolidar dados
    consolidate_data()
    
    # Verificar duplicatas
    verificar_duplicatas_no_data()
    
    print("\n" + "="*60)
    print("✅ PROCESSO CONCLUÍDO!")
    print("📁 Agora execute o script de geração de playlists")
    print("="*60)

if __name__ == "__main__":
    main()
