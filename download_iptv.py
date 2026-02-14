import requests
from pathlib import Path
import json
from datetime import datetime
import sys
import os

def criar_estrutura_pastas():
    """Cria toda a estrutura de pastas necessária"""
    
    base_dir = Path(__file__).parent
    
    # Pastas principais
    pastas = [
        base_dir / "input_auto",
        base_dir / "input_auto" / "Filmes",
        base_dir / "input_auto" / "Series",
        base_dir / "input_auto" / "Novelas",
        base_dir / "logs",  # Pasta para logs
    ]
    
    for pasta in pastas:
        if not pasta.exists():
            pasta.mkdir(parents=True, exist_ok=True)
            print(f"📁 Pasta criada: {pasta}")
        else:
            print(f"📁 Pasta já existe: {pasta}")
    
    return {
        'auto_dir': base_dir / "input_auto",
        'filmes': base_dir / "input_auto" / "Filmes",
        'series': base_dir / "input_auto" / "Series",
        'novelas': base_dir / "input_auto" / "Novelas",
        'logs': base_dir / "logs"
    }

def download_iptv_sources():
    """Baixa fontes do iptv-org com logging melhorado"""
    
    print("\n" + "="*50)
    print("📡 INICIANDO DOWNLOAD DAS FONTES IPTV")
    print("="*50)
    
    # CRIAR PASTAS AUTOMATICAMENTE
    pastas = criar_estrutura_pastas()
    
    # URLs do iptv-org
    fontes = {
        'filmes': {
            'url': 'https://iptv-org.github.io/iptv/categories/movies/br.m3u',
            'pasta': pastas['filmes'],
            'nome': 'iptv_filmes'
        },
        'series': {
            'url': 'https://iptv-org.github.io/iptv/categories/series/br.m3u',
            'pasta': pastas['series'],
            'nome': 'iptv_series'
        },
        'canais_br': {
            'url': 'https://iptv-org.github.io/iptv/countries/br.m3u',
            'pasta': pastas['novelas'],
            'nome': 'iptv_canais'
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
    
    # ... resto do código continua igual ...
    
    # Salvar relatório na pasta de logs
    relatorio_path = pastas['logs'] / f'download_report_{datetime.now().strftime("%Y%m%d")}.json'
    with open(relatorio_path, 'w', encoding='utf-8') as f:
        json.dump(relatorio, f, indent=2, ensure_ascii=False)
    
    print(f"\n📁 Relatório salvo em: {relatorio_path}")
    
    return resultados

def verificar_arquivos_existentes():
    """Verifica se já existem arquivos baixados hoje"""
    base_dir = Path(__file__).parent
    auto_dir = base_dir / "input_auto"
    
    if not auto_dir.exists():
        print("📁 Pasta input_auto não existe ainda. Será criada no download.")
        return False
    
    hoje = datetime.now().strftime('%Y%m%d')
    arquivos_hoje = list(auto_dir.rglob(f"*{hoje}.m3u"))
    
    if arquivos_hoje:
        print(f"\n📋 Encontrados {len(arquivos_hoje)} arquivos de hoje:")
        for arq in arquivos_hoje:
            print(f"   - {arq.name}")
        return True
    
    return False

if __name__ == "__main__":
    # Verificar se já baixou hoje
    if verificar_arquivos_existentes():
        print("\n⏳ Arquivos de hoje já existem.")
        resposta = input("Deseja baixar novamente? (s/N): ").lower()
        if resposta != 's':
            print("❌ Download cancelado.")
            sys.exit(0)
    
    download_iptv_sources()
