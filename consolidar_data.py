#!/usr/bin/env python3
"""
Script para consolidar filmes, séries e canais de TV no data.json (SEM DUPLICATAS)
"""
import json
from pathlib import Path
from datetime import datetime

def consolidate_data():
    print("="*60)
    print("🔄 CONSOLIDANDO DADOS NO DATA.JSON (SEM DUPLICATAS)")
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
        print(f"📂 Data.json carregado: {sum(len(v) for v in data.values())} itens totais")
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
    
    # Carregar canais de TV (já vem limpo do download_iptv.py)
    if channels_json.exists():
        with open(channels_json, 'r', encoding='utf-8') as f:
            tv_channels = json.load(f)
        print(f"📺 Canais de TV carregados: {len(tv_channels)} (já estão limpos)")
    else:
        tv_channels = []
        print("⚠️ Nenhum channels.json encontrado")
    
    # CRIAR CONJUNTO DE URLs EXISTENTES (para evitar duplicatas)
    urls_existentes = set()
    
    # Coletar URLs de todas as categorias (exceto TV, que vamos adicionar agora)
    for categoria in ['filmes', 'series', 'novelas', 'animes', 'infantil']:
        for item in data.get(categoria, []):
            # Episódios diretos
            if item.get('episodes'):
                for ep in item['episodes']:
                    if ep.get('url'):
                        urls_existentes.add(ep['url'])
            
            # Episódios por temporada
            if item.get('seasons'):
                for season in item['seasons']:
                    if season.get('episodes'):
                        for ep in season['episodes']:
                            if ep.get('url'):
                                urls_existentes.add(ep['url'])
    
    print(f"🔍 URLs únicas existentes em filmes/séries: {len(urls_existentes)}")
    
    # PROCESSAR CANAIS DE TV (SEM CRIAR DUPLICATAS)
    if 'tv' not in data:
        data['tv'] = []
    
    # URLs já existentes na categoria TV
    urls_tv_existentes = set()
    for canal in data.get('tv', []):
        if canal.get('url'):
            urls_tv_existentes.add(canal['url'])
        if canal.get('episodes'):
            for ep in canal['episodes']:
                if ep.get('url'):
                    urls_tv_existentes.add(ep['url'])
    
    # Estatísticas
    canais_novos = 0
    canais_duplicados_com_filmes = 0
    canais_duplicados_na_tv = 0
    
    for canal in tv_channels:
        url_principal = canal.get('url', '')
        
        # 🚨 VERIFICAR SE URL JÁ EXISTE EM FILMES/SÉRIES
        if url_principal and url_principal in urls_existentes:
            canais_duplicados_com_filmes += 1
            print(f"   ⚠️ Canal ignorado (URL já existe em filmes/séries): {canal.get('title')}")
            continue
        
        # 🚨 VERIFICAR SE URL JÁ EXISTE NA PRÓPRIA TV
        if url_principal and url_principal in urls_tv_existentes:
            canais_duplicados_na_tv += 1
            print(f"   ⚠️ Canal ignorado (já existe na TV): {canal.get('title')}")
            continue
        
        # Verificar episódios
        url_duplicada = False
        if canal.get('episodes'):
            for ep in canal['episodes']:
                if ep.get('url') and ep['url'] in urls_existentes:
                    url_duplicada = True
                    canais_duplicados_com_filmes += 1
                    print(f"   ⚠️ Canal ignorado (episódio já existe em filmes/séries): {canal.get('title')}")
                    break
                if ep.get('url') and ep['url'] in urls_tv_existentes:
                    url_duplicada = True
                    canais_duplicados_na_tv += 1
                    print(f"   ⚠️ Canal ignorado (episódio já existe na TV): {canal.get('title')}")
                    break
        
        if url_duplicada:
            continue
        
        # ✅ ADICIONAR CANAL NOVO
        data['tv'].append(canal)
        canais_novos += 1
        
        # Adicionar URLs ao conjunto
        if url_principal:
            urls_existentes.add(url_principal)
            urls_tv_existentes.add(url_principal)
        if canal.get('episodes'):
            for ep in canal['episodes']:
                if ep.get('url'):
                    urls_existentes.add(ep['url'])
                    urls_tv_existentes.add(ep['url'])
        
        print(f"   ✅ Canal novo adicionado: {canal.get('title')}")
    
    print(f"\n📊 RESULTADOS DA CONSOLIDAÇÃO:")
    print(f"   ✅ Canais novos adicionados: {canais_novos}")
    print(f"   ⚠️ Duplicados com filmes/séries: {canais_duplicados_com_filmes}")
    print(f"   ⚠️ Duplicados na própria TV: {canais_duplicados_na_tv}")
    print(f"   📺 Total de canais na TV: {len(data['tv'])}")
    
    # Estatísticas por categoria
    print(f"\n📊 CATÁLOGO COMPLETO:")
    total_geral = 0
    for categoria in ['filmes', 'series', 'novelas', 'animes', 'infantil', 'tv']:
        qtd = len(data.get(categoria, []))
        print(f"   {categoria}: {qtd} itens")
        total_geral += qtd
    print(f"   📊 TOTAL GERAL: {total_geral} itens")
    
    # Salvar data.json consolidado
    with open(data_json, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Data.json salvo: {data_json}")
    
    # Criar relatório
    relatorio = {
        'data': datetime.now().isoformat(),
        'canais_novos': canais_novos,
        'canais_duplicados_com_filmes': canais_duplicados_com_filmes,
        'canais_duplicados_na_tv': canais_duplicados_na_tv,
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
    """Verifica se há URLs duplicadas no data.json (apenas para debug)"""
    print("\n🔍 Verificando duplicatas no data.json...")
    
    data_json = Path("web/data.json")
    if not data_json.exists():
        print("❌ data.json não encontrado")
        return
    
    with open(data_json, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    todas_urls = []
    for categoria, itens in data.items():
        for item in itens:
            if item.get('type') == 'tv':
                if item.get('url'):
                    todas_urls.append(item['url'])
                if item.get('episodes'):
                    for ep in item['episodes']:
                        if ep.get('url'):
                            todas_urls.append(ep['url'])
            else:
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
    
    # Verificar duplicatas
    urls_vistas = set()
    duplicatas = []
    
    for url in todas_urls:
        if url in urls_vistas:
            duplicatas.append(url)
        else:
            urls_vistas.add(url)
    
    if duplicatas:
        print(f"⚠️ Encontradas {len(duplicatas)} URLs duplicadas!")
        # Mostrar algumas
        for url in duplicatas[:5]:
            print(f"   - {url[:80]}...")
        if len(duplicatas) > 5:
            print(f"   ... e mais {len(duplicatas) - 5}")
    else:
        print("✅ Nenhuma duplicata encontrada! Tudo limpo!")
    
    return duplicatas

def main():
    # Consolidar dados (já sem duplicatas)
    consolidate_data()
    
    # Verificar se realmente não tem duplicatas
    verificar_duplicatas_no_data()
    
    print("\n" + "="*60)
    print("✅ PROCESSO CONCLUÍDO COM SUCESSO!")
    print("📁 Agora execute o script de build:")
    print("   python build.py")
    print("="*60)

if __name__ == "__main__":
    main()
