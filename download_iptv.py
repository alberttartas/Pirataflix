#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
from pathlib import Path
import json
from datetime import datetime
import sys
import os
import re

print("="*60)
print("🚀 SCRIPT DOWNLOAD IPTV INICIADO")
print(f"📅 Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"📂 Diretório atual: {Path(__file__).parent}")
print("="*60)

def criar_estrutura_pastas():
    """Cria toda a estrutura de pastas necessária"""
    print("\n📁 Verificando/criando pastas...")
    
    base_dir = Path(__file__).parent
    
    pastas = {
        'auto_dir': base_dir / "input_auto",
        'filmes': base_dir / "input_auto" / "Filmes",
        'series': base_dir / "input_auto" / "Series",
        'novelas': base_dir / "input_auto" / "Novelas",
        'tv': base_dir / "input_auto" / "TV",
        'web': base_dir / "web"
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

def parse_m3u(content):
    """Analisa conteúdo M3U e extrai canais com suas informações"""
    channels = []
    lines = content.split('\n')
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        if line.startswith('#EXTINF:'):
            info = line[8:]
            
            # Extrair tvg-id
            tvg_id_match = re.search(r'tvg-id="([^"]*)"', info)
            tvg_id = tvg_id_match.group(1) if tvg_id_match else ""
            
            # Extrair tvg-logo
            tvg_logo_match = re.search(r'tvg-logo="([^"]*)"', info)
            tvg_logo = tvg_logo_match.group(1) if tvg_logo_match else ""
            
            # Extrair group-title
            group_match = re.search(r'group-title="([^"]*)"', info)
            group = group_match.group(1) if group_match else "Outros"
            
            # Extrair nome do canal
            name_parts = info.split(',')
            title = name_parts[-1].strip() if len(name_parts) > 1 else "Sem nome"
            
            i += 1
            if i < len(lines):
                url = lines[i].strip()
                if url and not url.startswith('#'):
                    channels.append({
                        'title': title,
                        'url': url,
                        'tvg_id': tvg_id,
                        'tvg_logo': tvg_logo,
                        'group': group
                    })
        i += 1
    
    return channels

def criar_channels_json(canais_br, pastas):
    """
    Cria o arquivo channels.json JÁ LIMPO, sem duplicatas
    """
    print("\n📝 Criando channels.json (já com limpeza de duplicatas)...")
    
    channels_data = []
    urls_vistas = set()
    
    # Lista de palavras-chave para canais brasileiros
    keywords = [
        'globo', 'sbt', 'record', 'band', 'rede tv', 'cultura', 
        'cnn', 'globo news', 'sportv', 'sporTV', 'tnt', 'fox',
        'universal', 'futura', 'tv escola', 'tv brasil', 'canal rural',
        'megapix', 'telecine', 'premiere', 'combate', 'woohoo',
        'discovery', 'history', 'a&e', 'sony', 'warner', 'max',
        'pluto tv', 'mtv', 'nick', 'cartoon', 'food', 'gnt', 'viva'
    ]
    
    duplicatas_encontradas = 0
    
    for canal in canais_br:
        titulo = canal['title'].lower()
        
        # Filtrar apenas canais brasileiros relevantes
        if any(keyword in titulo for keyword in keywords) or 'br' in canal.get('tvg_id', '').lower():
            
            # 🚨 VERIFICAR SE URL JÁ EXISTE (EVITA DUPLICATAS)
            if canal['url'] in urls_vistas:
                duplicatas_encontradas += 1
                print(f"   ⚠️ URL duplicada ignorada: {canal['title']}")
                continue
            
            # Adicionar URL ao conjunto de vistas
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
            print(f"   ✅ Canal: {canal['title']}")
    
    print(f"\n📊 Estatísticas da limpeza:")
    print(f"   📺 Canais únicos: {len(channels_data)}")
    print(f"   🗑️ Duplicatas ignoradas: {duplicatas_encontradas}")
    
    # Carregar channels.json existente (se houver) e COMBINAR SEM DUPLICAR
    channels_file = pastas['web'] / 'channels.json'
    
    if channels_file.exists():
        try:
            with open(channels_file, 'r', encoding='utf-8') as f:
                existing = json.load(f)
            
            # URLs existentes
            urls_existentes = {c['url'] for c in existing if c.get('url')}
            for c in existing:
                if c.get('episodes'):
                    for ep in c['episodes']:
                        if ep.get('url'):
                            urls_existentes.add(ep['url'])
            
            # Adicionar apenas canais NOVOS (que não existiam)
            canais_novos = 0
            for canal in channels_data:
                if canal['url'] not in urls_existentes:
                    existing.append(canal)
                    canais_novos += 1
                    print(f"   ✅ Novo canal adicionado: {canal['title']}")
            
            channels_data = existing
            print(f"   📦 Combinado com {len(existing)} canais existentes")
            print(f"   ✨ Canais realmente novos: {canais_novos}")
            
        except Exception as e:
            print(f"   ⚠️ Erro ao ler channels.json existente: {e}")
    
    # Salvar channels.json
    with open(channels_file, 'w', encoding='utf-8') as f:
        json.dump(channels_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ channels.json criado/atualizado com {len(channels_data)} canais ÚNICOS")
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
            
            # Se for canais brasileiros, criar channels.json (JÁ LIMPO!)
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
            if pasta_nome == 'web':
                arquivos = list(pasta.glob("*.json"))
            else:
                arquivos = list(pasta.glob("*.m3u"))
            
            if arquivos:
                print(f"   {pasta_nome}: {len(arquivos)} arquivo(s)")
                for arq in arquivos[-3:]:
                    tamanho = arq.stat().st_size
                    print(f"      - {arq.name} ({tamanho} bytes)")
    
    print("\n" + "="*60)
    print("📺 INTEGRAÇÃO COM PIRATAFLIX")
    print("="*60)
    print("✅ channels.json criado/atualizado (JÁ LIMPO - SEM DUPLICATAS)")
    print("✅ Agora execute o script de consolidação:")
    print("   python3 consolidar_data.py")
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
