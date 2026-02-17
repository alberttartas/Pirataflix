#!/usr/bin/env python3
"""
Script para consolidar filmes, séries e canais de TV no data.json (SEM DUPLICATAS)
SEM backups, SEM relatórios, apenas o essencial
"""
import json
from pathlib import Path

def consolidate_data():
    print("="*60)
    print("🔄 CONSOLIDANDO DADOS NO DATA.JSON")
    print("="*60)
    
    web_dir = Path("web")
    data_json = web_dir / "data.json"
    channels_json = web_dir / "channels.json"
    
    # Carregar data.json atual
    if data_json.exists():
        with open(data_json, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"📂 Data.json atual: {sum(len(v) for v in data.values())} itens")
    else:
        data = {
            "filmes": [],
            "series": [],
            "novelas": [],
            "animes": [],
            "infantil": [],
            "tv": []
        }
        print("📂 Criando novo data.json")
    
    # Carregar canais de TV
    if channels_json.exists():
        with open(channels_json, 'r', encoding='utf-8') as f:
            tv_channels = json.load(f)
        print(f"📺 Canais de TV: {len(tv_channels)}")
    else:
        tv_channels = []
        print("⚠️ Nenhum channels.json encontrado")
    
    # Coletar URLs existentes
    urls_existentes = set()
    for categoria in ['filmes', 'series', 'novelas', 'animes', 'infantil']:
        for item in data.get(categoria, []):
            if item.get('episodes'):
                for ep in item['episodes']:
                    if ep.get('url'):
                        urls_existentes.add(ep['url'])
            if item.get('seasons'):
                for season in item['seasons']:
                    if season.get('episodes'):
                        for ep in season['episodes']:
                            if ep.get('url'):
                                urls_existentes.add(ep['url'])
    
    print(f"🔍 URLs existentes: {len(urls_existentes)}")
    
    # URLs já na TV
    urls_tv_existentes = set()
    for canal in data.get('tv', []):
        if canal.get('url'):
            urls_tv_existentes.add(canal['url'])
        if canal.get('episodes'):
            for ep in canal['episodes']:
                if ep.get('url'):
                    urls_tv_existentes.add(ep['url'])
    
    # Adicionar canais novos
    canais_novos = 0
    duplicados = 0
    
    for canal in tv_channels:
        url_principal = canal.get('url', '')
        
        # Verificar duplicatas
        if url_principal and (url_principal in urls_existentes or url_principal in urls_tv_existentes):
            duplicados += 1
            continue
        
        # Verificar episódios
        url_duplicada = False
        if canal.get('episodes'):
            for ep in canal['episodes']:
                if ep.get('url') and (ep['url'] in urls_existentes or ep['url'] in urls_tv_existentes):
                    url_duplicada = True
                    duplicados += 1
                    break
        
        if url_duplicada:
            continue
        
        # Adicionar canal novo
        data['tv'].append(canal)
        canais_novos += 1
        
        if url_principal:
            urls_tv_existentes.add(url_principal)
        if canal.get('episodes'):
            for ep in canal['episodes']:
                if ep.get('url'):
                    urls_tv_existentes.add(ep['url'])
    
    print(f"\n📊 RESULTADO:")
    print(f"   ✅ Canais novos: {canais_novos}")
    print(f"   ⚠️ Duplicados ignorados: {duplicados}")
    print(f"   📺 Total na TV: {len(data['tv'])}")
    
    # Total geral
    total_geral = sum(len(data.get(cat, [])) for cat in ['filmes', 'series', 'novelas', 'animes', 'infantil', 'tv'])
    print(f"   📊 TOTAL GERAL: {total_geral} itens")
    
    # Salvar SEM backup
    with open(data_json, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Data.json atualizado")
    print("="*60)

def verificar_duplicatas():
    """Verificação rápida de duplicatas (opcional)"""
    data_json = Path("web/data.json")
    if not data_json.exists():
        return
    
    with open(data_json, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    todas_urls = []
    for categoria, itens in data.items():
        for item in itens:
            if item.get('episodes'):
                for ep in item['episodes']:
                    if ep.get('url'):
                        todas_urls.append(ep['url'])
            if item.get('seasons'):
                for season in item['seasons']:
                    if season.get('episodes'):
                        for ep in season['episodes']:
                            if ep.get('url'):
                                todas_urls.append(ep['url'])
    
    urls_vistas = set()
    duplicatas = 0
    
    for url in todas_urls:
        if url in urls_vistas:
            duplicatas += 1
        else:
            urls_vistas.add(url)
    
    if duplicatas > 0:
        print(f"\n⚠️ ATENÇÃO: {duplicatas} URLs duplicadas encontradas!")
    else:
        print(f"\n✅ Nenhuma duplicata encontrada!")

def main():
    consolidate_data()
    verificar_duplicatas()
    
    print("\n" + "="*60)
    print("✅ PROCESSO CONCLUÍDO")
    print("📁 Execute: python build.py")
    print("="*60)

if __name__ == "__main__":
    main()
