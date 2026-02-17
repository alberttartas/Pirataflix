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
print("="*60)

def criar_estrutura_pastas():
    """Cria apenas as pastas necessárias"""
    print("\n📁 Verificando pastas...")
    
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
        if not pasta.exists():
            pasta.mkdir(parents=True, exist_ok=True)
            print(f"   ✅ Criada: {nome}")
    
    return pastas

def testar_conexao():
    """Testa conexão rapidamente"""
    try:
        response = requests.get(
            "https://iptv-org.github.io/iptv/index.m3u",
            timeout=10,
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        return response.status_code == 200
    except:
        return False

def parse_m3u(content):
    """Analisa conteúdo M3U e extrai canais"""
    channels = []
    lines = content.split('\n')
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        if line.startswith('#EXTINF:'):
            info = line[8:]
            
            tvg_id_match = re.search(r'tvg-id="([^"]*)"', info)
            tvg_id = tvg_id_match.group(1) if tvg_id_match else ""
            
            tvg_logo_match = re.search(r'tvg-logo="([^"]*)"', info)
            tvg_logo = tvg_logo_match.group(1) if tvg_logo_match else ""
            
            group_match = re.search(r'group-title="([^"]*)"', info)
            group = group_match.group(1) if group_match else "Outros"
            
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
    """Cria channels.json SEM duplicatas (SEM backups)"""
    print("\n📝 Criando channels.json...")
    
    channels_data = []
    urls_vistas = set()
    
    # Palavras-chave para canais brasileiros
    keywords = [
        'globo', 'sbt', 'record', 'band', 'rede tv', 'cultura', 
        'cnn', 'globo news', 'sportv', 'tnt', 'fox',
        'universal', 'futura', 'tv escola', 'tv brasil', 'canal rural',
        'megapix', 'telecine', 'premiere', 'combate', 'woohoo',
        'discovery', 'history', 'a&e', 'sony', 'warner', 'max',
        'pluto tv', 'mtv', 'nick', 'cartoon', 'food', 'gnt', 'viva'
    ]
    
    duplicatas = 0
    
    for canal in canais_br:
        titulo = canal['title'].lower()
        
        if any(keyword in titulo for keyword in keywords) or 'br' in canal.get('tvg_id', '').lower():
            if canal['url'] in urls_vistas:
                duplicatas += 1
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
    
    print(f"   ✅ {len(channels_data)} canais únicos")
    print(f"   🗑️ {duplicatas} duplicatas ignoradas")
    
    # Carregar channels.json existente e COMBINAR (sem duplicar)
    channels_file = pastas['web'] / 'channels.json'
    
    if channels_file.exists():
        try:
            with open(channels_file, 'r', encoding='utf-8') as f:
                existing = json.load(f)
            
            # URLs existentes
            urls_existentes = set()
            for c in existing:
                if c.get('url'):
                    urls_existentes.add(c['url'])
                if c.get('episodes'):
                    for ep in c['episodes']:
                        if ep.get('url'):
                            urls_existentes.add(ep['url'])
            
            # Adicionar apenas canais NOVOS
            canais_novos = 0
            for canal in channels_data:
                if canal['url'] not in urls_existentes:
                    existing.append(canal)
                    canais_novos += 1
            
            channels_data = existing
            print(f"   ✨ {canais_novos} canais novos adicionados")
            print(f"   📦 Total: {len(channels_data)} canais")
            
        except Exception as e:
            print(f"   ⚠️ Erro ao ler channels.json: {e}")
    
    # Salvar SEM backup
    with open(channels_file, 'w', encoding='utf-8') as f:
        json.dump(channels_data, f, indent=2, ensure_ascii=False)
    
    print(f"✅ channels.json atualizado")
    
    return channels_data

def download_file(url, destino, nome_fonte, pastas):
    """Baixa um arquivo"""
    print(f"\n📡 Baixando {nome_fonte}...")
    
    try:
        response = requests.get(
            url, 
            timeout=30, 
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        
        if response.status_code == 200:
            with open(destino, 'w', encoding='utf-8') as f:
                f.write(response.text)
            
            canais = parse_m3u(response.text)
            print(f"   ✅ {len(canais)} streams")
            
            if nome_fonte == 'canais_br':
                criar_channels_json(canais, pastas)
            
            return len(canais)
        else:
            print(f"   ❌ Erro HTTP: {response.status_code}")
            return 0
            
    except Exception as e:
        print(f"   ❌ Erro: {e}")
        return 0

def download_iptv_sources():
    """Baixa fontes do iptv-org - SEM RELATÓRIOS"""
    
    print("\n" + "="*60)
    print("📡 INICIANDO DOWNLOAD")
    print("="*60)
    
    if not testar_conexao():
        print("\n❌ Sem conexão. Abortando.")
        return False
    
    pastas = criar_estrutura_pastas()
    
    fontes = [
        {
            'nome': 'filmes_br',
            'url': 'https://iptv-org.github.io/iptv/categories/movies/br.m3u',
            'pasta': pastas['filmes'],
            'arquivo': f"iptv_filmes_br.m3u"  # Nome fixo, sem data
        },
        {
            'nome': 'series_br',
            'url': 'https://iptv-org.github.io/iptv/categories/series/br.m3u',
            'pasta': pastas['series'],
            'arquivo': f"iptv_series_br.m3u"  # Nome fixo
        },
        {
            'nome': 'canais_br',
            'url': 'https://iptv-org.github.io/iptv/countries/br.m3u',
            'pasta': pastas['tv'],
            'arquivo': f"iptv_canais_br.m3u"  # Nome fixo
        }
    ]
    
    total_links = 0
    
    for fonte in fontes:
        destino = fonte['pasta'] / fonte['arquivo']
        links = download_file(fonte['url'], destino, fonte['nome'], pastas)
        total_links += links
    
    print("\n" + "="*60)
    print(f"📊 TOTAL: {total_links} streams")
    print("✅ Agora execute: python3 consolidar_data.py")
    print("="*60)
    
    return True

if __name__ == "__main__":
    download_iptv_sources()
