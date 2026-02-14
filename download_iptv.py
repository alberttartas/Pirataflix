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
        'auto_dir': base_dir / "input_auto",
        'filmes': base_dir / "input_auto" / "Filmes",
        'series': base_dir / "input_auto" / "Series",
        'novelas': base_dir / "input_auto" / "Novelas",
    }
    
    for nome, pasta in pastas.items():
        try:
            if not pasta.exists():
                pasta.mkdir(parents=True, exist_ok=True)
                print(f"   ✅ Criada: {nome} -> {pasta}")
            else:
                print(f"   📁 Já existe: {nome} -> {pasta}")
        except Exception as e:
            print(f"   ❌ Erro ao criar {nome}: {e}")
    
    return pastas

def testar_conexao():
    """Testa se consegue acessar o iptv-org"""
    print("\n🌐 Testando conexão com iptv-org...")
    try:
        response = requests.get(
            "https://iptv-org.github.io/iptv/index.m3u",
            timeout=10,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        )
        if response.status_code == 200:
            print("   ✅ Conexão OK!")
            return True
        else:
            print(f"   ❌ Erro HTTP: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"   ❌ Erro de conexão: {e}")
        return False

def download_file(url, destino, nome_fonte):
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
            # Salvar arquivo
            with open(destino, 'w', encoding='utf-8') as f:
                f.write(response.text)
            
            # Estatísticas
            linhas = response.text.split('\n')
            links = [l for l in linhas if l and not l.startswith('#')]
            qtd_links = len(links)
            
            print(f"   ✅ {qtd_links} streams encontrados")
            print(f"   💾 Salvo em: {destino}")
            print(f"   📊 Tamanho: {len(response.text)} bytes")
            
            return {
                'status': 'sucesso',
                'links': qtd_links,
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
            'pasta': pastas['novelas'],
            'arquivo': f"iptv_canais_br_{datetime.now().strftime('%Y%m%d')}.m3u"
        }
    ]
    
    resultados = {}
    total_links = 0
    
    for fonte in fontes:
        destino = fonte['pasta'] / fonte['arquivo']
        resultado = download_file(fonte['url'], destino, fonte['nome'])
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
            arquivos = list(pasta.glob("*.m3u"))
            if arquivos:
                print(f"   {pasta_nome}: {len(arquivos)} arquivo(s)")
                for arq in arquivos[-3:]:  # Mostra últimos 3
                    tamanho = arq.stat().st_size
                    print(f"      - {arq.name} ({tamanho} bytes)")
    
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
