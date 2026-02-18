#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
from pathlib import Path
import json
from datetime import datetime
import sys
import os
import re
import shutil

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

def limpar_arquivos_tv_errados():
    """Remove arquivos de TV que foram parar em Novelas"""
    base_dir = Path(__file__).parent
    
    pastas_erradas = [
        base_dir / "input_auto" / "Novelas",
        base_dir / "input" / "Novelas"
    ]
    
    removidos = 0
    
    for pasta in pastas_erradas:
        if pasta.exists():
            for arquivo in pasta.glob("iptv*.m3u"):
                try:
                    arquivo.unlink()
                    print(f"   🗑️ Removido: {pasta.name}/{arquivo.name}")
                    removidos += 1
                except Exception as e:
                    print(f"   ❌ Erro ao remover: {e}")
    
    if removidos > 0:
        print(f"   ✅ {removidos} arquivos de TV removidos das pastas de Novelas")
    
    return removidos

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

def filtrar_canais_brasileiros(channels):
    """Filtra apenas canais brasileiros"""
    
    keywords_br = [
        'globo', 'sbt', 'record', 'band', 'rede tv', 'cultura', 'tv Brasil',
        'cnn', 'globo news', 'sportv', 'sporTV', 'tnt', 'fox', 'universal',
        'futura', 'tv escola', 'canal rural', 'megapix', 'telecine', 'premiere',
        'combate', 'woohoo', 'discovery', 'history', 'a&e', 'sony', 'warner',
        'max', 'pluto tv', 'mtv', 'nick', 'cartoon', 'food', 'gnt', 'viva',
        'multishow', 'bis', 'off', 'fashion tv', 'canal brasil', 'curta!',
        'prime video', 'netflix', 'hbo', 'paramount', 'dreamworks',
        'tv cultura', 'tv gazeta', 'tv aparecida', 'canção nova',
        'tv senado', 'tv câmara', 'tv justiça', 'tv assembleia',
        'espn', 'fox sports', 'band sports', 'premiere', 'combate',
        'brazil', 'brasil', 'br ', '.br', 'português', 'portuguese',
        'hd br', 'sd br', 'brazil hd', 'brasil hd'
    ]
    
    keywords_excluir = [
        'usa ', 'united states', 'uk ', 'united kingdom', 'deutsch',
        'germany', 'france', 'italia', 'spain', 'mexico', 'argentina',
        'colombia', 'peru', 'chile', 'uruguai', 'paraguai', 'bolivia',
        'portugal', 'pt ', 'english', 'español', 'french', 'italian'
    ]
    
    canais_br = []
    
    for canal in channels:
        titulo_lower = canal['title'].lower()
        tvg_id_lower = canal['tvg_id'].lower() if canal['tvg_id'] else ""
        grupo_lower = canal['group'].lower() if canal['group'] else ""
        
        texto_completo = f"{titulo_lower} {tvg_id_lower} {grupo_lower}"
        
        excluir = False
        for keyword in keywords_excluir:
            if keyword in texto_completo:
                excluir = True
                break
        
        if excluir:
            continue
        
        is_br = False
        for keyword in keywords_br:
            if keyword in texto_completo:
                is_br = True
                break
        
        if '.br' in tvg_id_lower or 'br.' in tvg_id_lower:
            is_br = True
        
        if is_br:
            canais_br.append(canal)
    
    print(f"   📊 Filtrados {len(canais_br)} canais brasileiros de {len(channels)} totais")
    return canais_br

def criar_channels_json(canais_br, pastas):
    """Cria channels.json SEM duplicatas, COM campo id"""
    print("\n📝 Criando channels.json...")
    
    channels_data = []
    urls_vistas = set()
    duplicatas = 0
    
    for canal in canais_br:
        if canal['url'] in urls_vistas:
            duplicatas += 1
            continue
        
        urls_vistas.add(canal['url'])
        
        # ✅ Gerar id único e estável: usar tvg_id ou slug do título
        if canal['tvg_id']:
            canal_id = canal['tvg_id']
        else:
            canal_id = re.sub(r'[^\w]', '_', canal['title'].lower()).strip('_')
        
        novo_canal = {
            'id': canal_id,           # ✅ CAMPO ID ADICIONADO
            'type': 'tv',
            'title': canal['title'],
            'tvg_id': canal['tvg_id'],
            'tvg_logo': canal['tvg_logo'],
            'group': "📺 TV Ao Vivo",
            'url': canal['url'],
            'episodes': [{
                'url': canal['url'],
                'title': 'AO VIVO'
            }]
        }
        channels_data.append(novo_canal)
    
    print(f"   ✅ {len(channels_data)} canais únicos")
    print(f"   🗑️ {duplicatas} duplicatas ignoradas")
    
    channels_file = pastas['web'] / 'channels.json'
    
    if channels_file.exists():
        try:
            with open(channels_file, 'r', encoding='utf-8') as f:
                existing = json.load(f)
            
            urls_existentes = set()
            for c in existing:
                if c.get('url'):
                    urls_existentes.add(c['url'])
                if c.get('episodes'):
                    for ep in c['episodes']:
                        if ep.get('url'):
                            urls_existentes.add(ep['url'])
            
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
    
    with open(channels_file, 'w', encoding='utf-8') as f:
        json.dump(channels_data, f, indent=2, ensure_ascii=False)
    
    print(f"✅ channels.json atualizado")
    return channels_data

def download_file(url, destino, nome_fonte):
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
            return response.text
        else:
            print(f"   ❌ Erro HTTP: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"   ❌ Erro: {e}")
        return None

def download_iptv_sources():
    """Baixa a lista completa e filtra canais brasileiros"""
    
    print("\n" + "="*60)
    print("📡 INICIANDO DOWNLOAD - LISTA COMPLETA")
    print("="*60)
    
    limpar_arquivos_tv_errados()
    
    if not testar_conexao():
        print("\n❌ Sem conexão. Abortando.")
        return False
    
    pastas = criar_estrutura_pastas()
    
    url_completa = 'https://iptv-org.github.io/iptv/index.m3u'
    destino_completo = pastas['tv'] / "iptv_completo.m3u"
    
    conteudo = download_file(url_completa, destino_completo, 'lista_completa')
    
    if not conteudo:
        print("\n❌ Falha no download. Abortando.")
        return False
    
    todos_canais = parse_m3u(conteudo)
    print(f"\n📊 Total de canais na lista: {len(todos_canais)}")
    
    canais_br = filtrar_canais_brasileiros(todos_canais)
    
    destino_br = pastas['tv'] / "iptv_canais_br.m3u"
    
    with open(destino_br, 'w', encoding='utf-8') as f:
        f.write("#EXTM3U\n")
        for canal in canais_br:
            f.write(f'#EXTINF:-1 tvg-id="{canal["tvg_id"]}" tvg-logo="{canal["tvg_logo"]}" group-title="📺 TV Ao Vivo",{canal["title"]}\n')
            f.write(f"{canal['url']}\n\n")
    
    print(f"✅ Lista filtrada salva: {destino_br}")
    
    criar_channels_json(canais_br, pastas)
    
    print("\n" + "="*60)
    print(f"📊 TOTAL: {len(canais_br)} canais brasileiros")
    print("✅ Agora execute: python3 consolidar_data.py")
    print("="*60)
    
    return True

if __name__ == "__main__":
    download_iptv_sources()
