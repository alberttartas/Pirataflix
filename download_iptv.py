#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
from pathlib import Path
import json
from datetime import datetime
import sys
import re

# [Seu código existente até a função download_file...]

def criar_channels_json(canais_br, pastas):
    """Cria o arquivo channels.json sem duplicatas"""
    print("\n📝 Criando channels.json para integração...")
    
    channels_data = []
    urls_vistas = set()
    
    for canal in canais_br:
        # Filtrar apenas canais brasileiros relevantes
        titulo = canal['title'].lower()
        if any(palavra in titulo for palavra in 
               ['globo', 'sbt', 'record', 'band', 'rede tv', 'cultura', 
                'cnn', 'globo news', 'sportv', 'sporTV', 'tnt', 'fox',
                'universal', 'futura', 'tv escola', 'tv brasil', 'canal rural']):
            
            # Verificar se URL já existe
            if canal['url'] in urls_vistas:
                print(f"   ⚠️ URL duplicada ignorada: {canal['title']}")
                continue
            
            urls_vistas.add(canal['url'])
            
            novo_canal = {
                'type': 'tv',
                'title': canal['title'],
                'tvg_id': canal['tvg_id'],
                'tvg_logo': canal['tvg_logo'],
                'group': canal['group'],
                'url': canal['url'],
                'episodes': [{
                    'url': canal['url'],
                    'title': 'AO VIVO'
                }]
            }
            channels_data.append(novo_canal)
    
    # Salvar channels.json na pasta web
    channels_file = pastas['web'] / 'channels.json'
    
    # Se já existe, combinar com os existentes (sem duplicar)
    if channels_file.exists():
        try:
            with open(channels_file, 'r', encoding='utf-8') as f:
                existing = json.load(f)
            
            # URLs existentes
            urls_existentes = {c['url'] for c in existing}
            
            # Adicionar apenas novos canais
            for canal in channels_data:
                if canal['url'] not in urls_existentes:
                    existing.append(canal)
                    print(f"   ✅ Novo canal: {canal['title']}")
            
            channels_data = existing
            print(f"   📦 Combinado com {len(existing)} canais existentes")
        except:
            pass
    
    with open(channels_file, 'w', encoding='utf-8') as f:
        json.dump(channels_data, f, indent=2, ensure_ascii=False)
    
    print(f"   ✅ channels.json criado/atualizado com {len(channels_data)} canais únicos")
    print(f"   💾 Local: {channels_file}")
    
    return channels_data

def download_file(url, destino, nome_fonte, pastas):
    """Baixa um arquivo e retorna estatísticas"""
    print(f"\n📡 Baixando {nome_fonte}...")
    print(f"   URL: {url}")
    
    try:
        response = requests.get(
            url, 
            timeout=30, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        )
        
        print(f"   Status HTTP: {response.status_code}")
        
        if response.status_code == 200:
            # Salvar arquivo M3U original
            with open(destino, 'w', encoding='utf-8') as f:
                f.write(response.text)
            
            # Analisar M3U para estatísticas
            canais = parse_m3u(response.text)
            
            print(f"   ✅ {len(canais)} streams encontrados")
            print(f"   💾 Salvo em: {destino}")
            print(f"   📊 Tamanho: {len(response.text)} bytes")
            
            # Se for canais brasileiros, criar channels.json
            if nome_fonte == 'canais_br':
                criar_channels_json(canais, pastas)
            
            return {
                'status': 'sucesso',
                'links': len(canais),
                'arquivo': str(destino),
                'tamanho': len(response.text)
            }
        else:
            print(f"   ❌ Erro HTTP: {response.status_code}")
            return {
                'status': 'erro',
                'codigo': response.status_code
            }
            
    except Exception as e:
        print(f"   ❌ Exceção: {type(e).__name__}: {e}")
        return {
            'status': 'erro',
            'mensagem': str(e),
            'tipo': type(e).__name__
        }

def download_iptv_sources():
    """Baixa fontes do iptv-org"""
    
    print("\n" + "="*60)
    print("📡 INICIANDO DOWNLOAD DAS FONTES IPTV")
    print("="*60)
    
    # Testar conexão primeiro
    if not testar_conexao():
        print("\n❌ Sem conexão com iptv-org. Abortando.")
        return False
    
    # CRIAR PASTAS
    pastas = criar_estrutura_pastas()
    
    # URLs do iptv-org
    fontes = [
        {
            'nome': 'filmes_br',
            'url': 'https://iptv-org.github.io/iptv/categories/movies/br.m3u',
            'pasta': pastas['filmes'],
            'arquivo': f"iptv_filmes_br_{datetime.now().strftime('%Y%m%d')}.m3u"
        },
        {
            'nome': 'series_br',
            'url': 'https://iptv-org.github.io/iptv/categories/series/br.m3u',
            'pasta': pastas['series'],
            'arquivo': f"iptv_series_br_{datetime.now().strftime('%Y%m%d')}.m3u"
        },
        {
            'nome': 'canais_br',
            'url': 'https://iptv-org.github.io/iptv/countries/br.m3u',
            'pasta': pastas['tv'],
            'arquivo': f"iptv_canais_br_{datetime.now().strftime('%Y%m%d')}.m3u"
        }
    ]
    
    resultados = {}
    total_links = 0
    
    for fonte in fontes:
        destino = fonte['pasta'] / fonte['arquivo']
        resultado = download_file(fonte['url'], destino, fonte['nome'], pastas)
        resultados[fonte['nome']] = resultado
        
        if resultado.get('status') == 'sucesso':
            total_links += resultado.get('links', 0)
    
    # Salvar relatório
    relatorio = {
        'data': datetime.now().isoformat(),
        'total_links': total_links,
        'resultados': resultados,
        'pastas_criadas': {k: str(v) for k, v in pastas.items()}
    }
    
    # Criar pasta de logs se não existir
    log_dir = Path(__file__).parent / "logs"
    log_dir.mkdir(exist_ok=True)
    
    relatorio_path = log_dir / f'download_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
    with open(relatorio_path, 'w', encoding='utf-8') as f:
        json.dump(relatorio, f, indent=2, ensure_ascii=False)
    
    print("\n" + "="*60)
    print("📊 RESUMO DO DOWNLOAD")
    print("="*60)
    print(f"📅 Data: {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print(f"📊 Total de streams: {total_links}")
    print(f"📁 Relatório salvo em: {relatorio_path}")
    
    # Listar arquivos baixados
    print("\n📂 Arquivos baixados:")
    for pasta_nome, pasta in pastas.items():
        if pasta.exists():
            arquivos = list(pasta.glob("*.m3u")) if pasta_nome != 'web' else list(pasta.glob("*.json"))
            if arquivos:
                print(f"   {pasta_nome}: {len(arquivos)} arquivo(s)")
                for arq in arquivos[-3:]:  # Mostra últimos 3
                    tamanho = arq.stat().st_size
                    print(f"      - {arq.name} ({tamanho} bytes)")
    
    print("\n" + "="*60)
    print("📺 INTEGRAÇÃO COM PIRATAFLIX")
    print("="*60)
    print("✅ channels.json atualizado na pasta web/")
    print("✅ Agora execute o script de geração de playlists:")
    print("   python3 gerar_playlists.py")
    print("="*60)
    
    return True

if __name__ == "__main__":
    try:
        sucesso = download_iptv_sources()
        if sucesso:
            print("\n✅ Processo concluído com sucesso!")
            sys.exit(0)
        else:
            print("\n❌ Processo falhou!")
            sys.exit(1)
    except Exception as e:
        print(f"\n💥 Erro fatal: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
