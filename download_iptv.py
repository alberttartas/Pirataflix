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

def filtrar_canais_brasileiros(channels):
    """Filtra apenas canais brasileiros"""
    
    # Palavras-chave para identificar canais brasileiros
    keywords_br = [
        # Canais abertos
        'globo', 'sbt', 'record', 'band', 'rede tv', 'cultura', 'tv Brasil',
        'cnn', 'globo news', 'sportv', 'sporTV', 'tnt', 'fox', 'universal',
        'futura', 'tv escola', 'canal rural', 'megapix', 'telecine', 'premiere',
        'combate', 'woohoo', 'discovery', 'history', 'a&e', 'sony', 'warner',
        'max', 'pluto tv', 'mtv', 'nick', 'cartoon', 'food', 'gnt', 'viva',
        'multishow', 'bis', 'off', 'fashion tv', 'canal brasil', 'curta!',
        'prime video', 'netflix', 'hbo', 'paramount', 'dreamworks',
        
        # Canais regionais
        'tv cultura', 'tv gazeta', 'tv aparecida', 'canção nova',
        'tv senado', 'tv câmara', 'tv justiça', 'tv assembleia',
        
        # Esportes
        'espn', 'fox sports', 'band sports', 'premiere', 'combate',
        
        # Identificadores
        'brazil', 'brasil', 'br ', '.br', 'português', 'portuguese',
        
        # Terminações comuns
        'hd br', 'sd br', 'brazil hd', 'brasil hd'
    ]
    
    # Palavras para EXCLUIR (canais de outros países)
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
        
        # Combinar tudo para busca
        texto_completo = f"{titulo_lower} {tvg_id_lower} {grupo_lower}"
        
        # Verificar se deve EXCLUIR (prioridade)
        excluir = False
        for keyword in keywords_excluir:
            if keyword in texto_completo:
                excluir = True
                break
        
        if excluir:
            continue
        
        # Verificar se é brasileiro
        is_br = False
        for keyword in keywords_br:
            if keyword in texto_completo:
                is_br = True
                break
        
        # Verificar se tem .br no tvg-id
        if '.br' in tvg_id_lower or 'br.' in tvg_id_lower:
            is_br = True
        
        if is_br:
            canais_br.append(canal)
    
    print(f"   📊 Filtrados {len(canais_br)} canais brasileiros de {len(channels)} totais")
    return canais_br

def criar_channels_json(canais_br, pastas):
    """Cria channels.json SEM duplicatas"""
    print("\n📝 Criando channels.json...")
    
    channels_data = []
    urls_vistas = set()
    
    duplicatas = 0
    
    for canal in canais_br:
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
    
    # Carregar channels.json existente
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
    
    # Salvar
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
    
    if not testar_conexao():
        print("\n❌ Sem conexão. Abortando.")
        return False
    
    pastas = criar_estrutura_pastas()
    
    # 🔥 BAIXAR LISTA COMPLETA (MAIS CONFIÁVEL)
    url_completa = 'https://iptv-org.github.io/iptv/index.m3u'
    destino_completo = pastas['tv'] / "iptv_completo.m3u"
    
    conteudo = download_file(url_completa, destino_completo, 'lista_completa')
    
    if not conteudo:
        print("\n❌ Falha no download. Abortando.")
        return False
    
    # Parsear todos os canais
    todos_canais = parse_m3u(conteudo)
    print(f"\n📊 Total de canais na lista: {len(todos_canais)}")
    
    # Filtrar apenas brasileiros
    canais_br = filtrar_canais_brasileiros(todos_canais)
    
    # Salvar lista filtrada
    destino_br = pastas['tv'] / "iptv_canais_br.m3u"
    
    # Criar arquivo M3U filtrado
    with open(destino_br, 'w', encoding='utf-8') as f:
        f.write("#EXTM3U\n")
        for canal in canais_br:
            f.write(f'#EXTINF:-1 tvg-id="{canal["tvg_id"]}" tvg-logo="{canal["tvg_logo"]}" group-title="{canal["group"]}",{canal["title"]}\n')
            f.write(f"{canal['url']}\n\n")
    
    print(f"✅ Lista filtrada salva: {destino_br}")
    
    # Criar channels.json
    criar_channels_json(canais_br, pastas)
    
    print("\n" + "="*60)
    print(f"📊 TOTAL: {len(canais_br)} canais brasileiros")
    print("✅ Agora execute: python3 consolidar_data.py")
    print("="*60)
    
    return True

if __name__ == "__main__":
    download_iptv_sources()
