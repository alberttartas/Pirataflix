#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
from pathlib import Path
import json
from datetime import datetime
import sys
import os

print("="*60)
print("🚀 SCRIPT DOWNLOAD IPTV INICIADO")
print(f"📅 Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"📂 Diretório atual: {Path(__file__).parent}")
print("="*60)

def criar_estrutura_pastas():
    """Cria toda a estrutura de pastas necessária"""
    print("\n📁 Verificando/criando pastas...")
    
    base_dir = Path(__file__).parent
    
    # Pastas principais
    pastas = {
        'raiz': base_dir / "input_auto",
        'filmes': base_dir / "input_auto" / "Filmes",
        'series': base_dir / "input_auto" / "Series",
        'novelas': base_dir / "input_auto" / "Novelas",
        'logs': base_dir / "logs",
    }
    
    for nome, pasta in pastas.items():
        if not pasta.exists():
            pasta.mkdir(parents=True, exist_ok=True)
            print(f"   ✅ Criada: {nome} -> {pasta}")
        else:
            print(f"   📁 Já existe: {nome} -> {pasta}")
    
    return pastas

def testar_conexao():
    """Testa se consegue acessar o iptv-org"""
    print("\n🌐 Testando conexão com iptv-org...")
    try:
        response = requests.get(
            "https://iptv-org.github.io/iptv/index.m3u",
            timeout=10,
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        if response.status_code == 200:
            print("   ✅ Conexão OK!")
            return True
        else:
            print(f"   ❌ Erro HTTP: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Erro de conexão: {e}")
        return False

def download_iptv_sources():
    """Baixa fontes do iptv-org com logging melhorado"""
    
    print("\n" + "="*60)
    print("📡 INICIANDO DOWNLOAD DAS FONTES IPTV")
    print("="*60)
    
    # Testar conexão primeiro
    if not testar_conexao():
        print("\n❌ Sem conexão com iptv-org. Abortando.")
        return False
    
    # CRIAR PASTAS AUTOMATICAMENTE
    pastas = criar_estrutura_pastas()
    
    # URLs do iptv-org
    fontes = {
        'filmes_br': {
            'url': 'https://iptv-org.github.io/iptv/categories/movies/br.m3u',
            'pasta': pastas['filmes'],
            'nome': 'iptv_filmes_br'
        },
        'series_br': {
            'url': 'https://iptv-org.github.io/iptv/categories/series/br.m3u',
            'pasta': pastas['series'],
            'nome': 'iptv_series_br'
        },
        'canais_br': {
            'url': 'https://iptv-org.github.io/iptv/countries/br.m3u',
            'pasta': pastas['novelas'],
            'nome': 'iptv_canais_br'
        },
        'filmes_pt': {
            'url': 'https://iptv-org.github.io/iptv/categories/movies/pt.m3u',
            'pasta': pastas['filmes'],
            'nome': 'iptv_filmes_pt'
        },
        'series_pt': {
            'url': 'https://iptv-org.github.io/iptv/categories/series/pt.m3u',
            'pasta': pastas['series'],
            'nome': 'iptv_series_pt'
        }
    }
    
    resultados = {}
    total_links = 0
    
    for chave, info in fontes.items():
        print(f"\n📡 Baixando {chave}...")
        print(f"   URL: {info['url']}")
        
        try:
            response = requests.get(
                info['url'], 
                timeout=30, 
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            )
            
            print(f"   Status HTTP: {response.status_code}")
            
            if response.status_code == 200:
                # Nome do arquivo com data
                data_str = datetime.now().strftime('%Y%m%d')
                nome_arquivo = f"{info['nome']}_{data_str}.m3u"
                destino = info['pasta'] / nome_arquivo
                
                # Salvar arquivo
                with open(destino, 'w', encoding='utf-8') as f:
                    f.write(response.text)
                
                # Estatísticas
                linhas = response.text.split('\n')
                links = [l for l in linhas if l and not l.startswith('#')]
                qtd_links = len(links)
                total_links += qtd_links
                
                print(f"   ✅ {qtd_links} streams encontrados")
                print(f"   💾 Salvo em: {destino}")
                print(f"   📊 Tamanho: {len(response.text)} bytes")
                
                resultados[chave] = {
                    'status': 'sucesso',
                    'links': qtd_links,
                    'arquivo': str(destino),
                    'tamanho': len(response.text)
                }
            else:
                print(f"   ❌ Erro HTTP: {response.status_code}")
                resultados[chave] = {
                    'status': 'erro',
                    'codigo': response.status_code
                }
                
        except Exception as e:
            print(f"   ❌ Exceção: {type(e).__name__}: {e}")
            resultados[chave] = {
                'status': 'erro',
                'mensagem': str(e),
                'tipo': type(e).__name__
            }
    
    # Salvar relatório
    relatorio = {
        'data': datetime.now().isoformat(),
        'total_links': total_links,
        'resultados': resultados,
        'ambiente': {
            'python_version': sys.version,
            'plataforma': sys.platform
        }
    }
    
    relatorio_path = pastas['logs'] / f'download_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
    with open(relatorio_path, 'w', encoding='utf-8') as f:
        json.dump(relatorio, f, indent=2, ensure_ascii=False)
    
    print("\n" + "="*60)
    print("📊 RESUMO DO DOWNLOAD")
    print("="*60)
    print(f"📅 Data: {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print(f"📊 Total de streams: {total_links}")
    print(f"📁 Relatório salvo em: {relatorio_path}")
    print("="*60)
    
    return True

if __name__ == "__main__":
    try:
        sucesso = download_iptv_sources()
        if sucesso:
            print("\n✅ Processo concluído com sucesso!")
        else:
            print("\n❌ Processo falhou!")
            sys.exit(1)
    except Exception as e:
        print(f"\n💥 Erro fatal: {e}")
        sys.exit(1)
