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
    
    # 🔥 PASSO 1: DEFINIR ESTRUTURA PADRÃO
    estrutura_padrao = {
        "filmes": [],
        "series": [],
        "novelas": [],
        "animes": [],
        "infantil": [],
        "tv": []  # 🔥 GARANTIR QUE TV EXISTE
    }
    
    # Carregar data.json atual ou criar novo
    if data_json.exists():
        with open(data_json, 'r', encoding='utf-8') as f:
            data_antigo = json.load(f)
        
        # 🔥 PASSO 2: GARANTIR QUE TODAS AS CATEGORIAS EXISTEM
        data = estrutura_padrao.copy()
        for categoria in estrutura_padrao.keys():
            if categoria in data_antigo:
                data[categoria] = data_antigo[categoria]
        
        total_itens = sum(len(data.get(cat, [])) for cat in estrutura_padrao.keys())
        print(f"📂 Data.json carregado: {total_itens} itens totais")
    else:
        data = estrutura_padrao.copy()
        print("📂 Criando novo data.json com todas as categorias")
    
    # Carregar canais de TV
    if channels_json.exists():
        with open(channels_json, 'r', encoding='utf-8') as f:
            tv_channels = json.load(f)
        print(f"📺 Canais de TV carregados: {len(tv_channels)}")
    else:
        tv_channels = []
        print("⚠️ Nenhum channels.json encontrado")
    
    # 🔥 PASSO 3: GARANTIR QUE A CATEGORIA TV EXISTE (redundante, mas seguro)
    if 'tv' not in data:
        data['tv'] = []
        print("📺 Criando categoria TV (não existia)")
    
    # Coletar URLs existentes de filmes/séries
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
    
    print(f"🔍 URLs em filmes/séries: {len(urls_existentes)}")
    
    # URLs já na TV
    urls_tv_existentes = set()
    for canal in data.get('tv', []):
        if canal.get('url'):
            urls_tv_existentes.add(canal['url'])
        if canal.get('episodes'):
            for ep in canal['episodes']:
                if ep.get('url'):
                    urls_tv_existentes.add(ep['url'])
    
    print(f"📺 URLs já na TV: {len(urls_tv_existentes)}")
    
    # Adicionar canais novos
    canais_novos = 0
    duplicados_com_filmes = 0
    duplicados_na_tv = 0
    
    # 🔥 PASSO 4: PROCESSAR CADA CANAL
    for canal in tv_channels:
        url_principal = canal.get('url', '')
        
        # Verificar se URL já existe em filmes/séries
        if url_principal and url_principal in urls_existentes:
            duplicados_com_filmes += 1
            continue
        
        # Verificar se URL já existe na própria TV
        if url_principal and url_principal in urls_tv_existentes:
            duplicados_na_tv += 1
            continue
        
        # Verificar episódios
        url_duplicada = False
        if canal.get('episodes'):
            for ep in canal['episodes']:
                if ep.get('url'):
                    if ep['url'] in urls_existentes:
                        duplicados_com_filmes += 1
                        url_duplicada = True
                        break
                    if ep['url'] in urls_tv_existentes:
                        duplicados_na_tv += 1
                        url_duplicada = True
                        break
        
        if url_duplicada:
            continue
        
        # 🔥 PASSO 5: ADICIONAR CANAL NOVO (COM VERIFICAÇÃO DE SEGURANÇA)
        if 'tv' not in data:
            data['tv'] = []
        
        data['tv'].append(canal)
        canais_novos += 1
        
        # Adicionar URLs ao conjunto da TV
        if url_principal:
            urls_tv_existentes.add(url_principal)
        if canal.get('episodes'):
            for ep in canal['episodes']:
                if ep.get('url'):
                    urls_tv_existentes.add(ep['url'])
    
    print(f"\n📊 RESULTADO:")
    print(f"   ✅ Canais novos adicionados: {canais_novos}")
    print(f"   ⚠️ Duplicados com filmes/séries: {duplicados_com_filmes}")
    print(f"   ⚠️ Duplicados na própria TV: {duplicados_na_tv}")
    print(f"   📺 Total na TV: {len(data.get('tv', []))}")
    
    # Total geral
    total_geral = 0
    for cat in estrutura_padrao.keys():
        total_geral += len(data.get(cat, []))
    print(f"   📊 TOTAL GERAL: {total_geral} itens")
    
    # 🔥 PASSO 6: SALVAR (SEM BACKUP)
    with open(data_json, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Data.json atualizado com sucesso!")
    print("="*60)

def verificar_duplicatas():
    """Verificação rápida de duplicatas"""
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
        # Mostrar algumas duplicatas como exemplo
        urls_vistas.clear()
        for url in todas_urls:
            if url in urls_vistas:
                print(f"   Exemplo: {url[:80]}...")
                break
            urls_vistas.add(url)
    else:
        print(f"\n✅ Nenhuma duplicata encontrada!")

def main():
    consolidate_data()
    verificar_duplicatas()
    
    print("\n" + "="*60)
    print("✅ PROCESSO CONCLUÍDO COM SUCESSO!")
    print("📁 Agora execute: python build.py")
    print("="*60)

if __name__ == "__main__":
    main()
