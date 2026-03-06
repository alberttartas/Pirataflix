#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
consolidar_data.py — Consolida filmes, séries e canais de TV no data.json
VERSÃO CORRIGIDA - Força a inclusão de canais de TV
"""

import json
import re
from pathlib import Path

print("=" * 60)
print("🔄 CONSOLIDANDO DADOS NO DATA.JSON")
print("=" * 60)

# Categorias base do VOD
CATS_VOD = ['filmes', 'series', 'novelas', 'animes', 'infantil']

# Categorias de TV
TV_CATS = {
    '📺 Geral': 'tv_geral',
    '📰 Notícias': 'tv_noticias',
    '⚽ Esportes': 'tv_esportes',
    '🎬 Filmes': 'tv_filmes',
    '📺 Séries': 'tv_series',
    '💖 Novelas': 'tv_novelas',
    '👻 Animes': 'tv_animes',
    '🎭 Entretenimento': 'tv_entretenimento',
    '✝️ Religioso': 'tv_religioso',
    '🧸 Infantil': 'tv_infantil',
    '🎵 Música': 'tv_musica',
    '📚 Educação': 'tv_educacao',
    '🎥 Documentário': 'tv_documentario',
    '🌿 Natureza': 'tv_natureza',
    '🎨 Animação': 'tv_animacao',
    '😂 Comédia': 'tv_comedia',
    '🎨 Cultura': 'tv_cultura',
    '🏛️ Legislativo': 'tv_legislativo',
    '🔬 Ciência': 'tv_ciencia',
    '🛍️ Shopping': 'tv_shopping',
    '🍳 Culinária': 'tv_culinaria',
    '✈️ Viagem': 'tv_viagem',
    '🚗 Automóvel': 'tv_automovel',
    '💅 Lifestyle': 'tv_lifestyle',
    '🎞️ Clássicos': 'tv_classicos',
    '👨‍👩‍👧 Família': 'tv_familia',
    '💼 Negócios': 'tv_negocios',
    '🌦️ Clima': 'tv_clima',
}

TV_LEGACY_KEY = 'tv'

def carregar_json(path: Path) -> list | dict:
    if path.exists():
        try:
            return json.loads(path.read_text(encoding='utf-8'))
        except Exception as e:
            print(f"   ⚠️ Erro ao ler {path.name}: {e}")
    return [] if 'channels' in str(path) else {}

def normalizar_grupo_simples(raw: str) -> str:
    """Versão simplificada para não perder canais"""
    if not raw:
        return '📺 Geral'
    
    raw_lower = raw.lower()
    
    # Mapeamento direto
    if 'notícia' in raw_lower or 'news' in raw_lower:
        return '📰 Notícias'
    if 'esporte' in raw_lower or 'sport' in raw_lower:
        return '⚽ Esportes'
    if 'filme' in raw_lower or 'movie' in raw_lower:
        return '🎬 Filmes'
    if 'série' in raw_lower or 'series' in raw_lower:
        return '📺 Séries'
    if 'novela' in raw_lower or 'soap' in raw_lower:
        return '💖 Novelas'
    if 'anime' in raw_lower:
        return '👻 Animes'
    if 'infantil' in raw_lower or 'kids' in raw_lower:
        return '🧸 Infantil'
    if 'religioso' in raw_lower or 'religious' in raw_lower:
        return '✝️ Religioso'
    if 'educação' in raw_lower or 'education' in raw_lower:
        return '📚 Educação'
    if 'música' in raw_lower or 'music' in raw_lower:
        return '🎵 Música'
    if 'cultura' in raw_lower:
        return '🎨 Cultura'
    if 'documentário' in raw_lower or 'documentary' in raw_lower:
        return '🎥 Documentário'
    if 'natureza' in raw_lower or 'nature' in raw_lower:
        return '🌿 Natureza'
    if 'animação' in raw_lower or 'animation' in raw_lower:
        return '🎨 Animação'
    if 'comédia' in raw_lower or 'comedy' in raw_lower:
        return '😂 Comédia'
    if 'legislativo' in raw_lower:
        return '🏛️ Legislativo'
    if 'shopping' in raw_lower:
        return '🛍️ Shopping'
    if 'culinária' in raw_lower or 'cooking' in raw_lower:
        return '🍳 Culinária'
    if 'viagem' in raw_lower or 'travel' in raw_lower:
        return '✈️ Viagem'
    if 'automóvel' in raw_lower or 'auto' in raw_lower:
        return '🚗 Automóvel'
    if 'ciência' in raw_lower or 'science' in raw_lower:
        return '🔬 Ciência'
    if 'clássico' in raw_lower or 'classic' in raw_lower:
        return '🎞️ Clássicos'
    if 'família' in raw_lower or 'family' in raw_lower:
        return '👨‍👩‍👧 Família'
    if 'negócio' in raw_lower or 'business' in raw_lower:
        return '💼 Negócios'
    if 'clima' in raw_lower or 'weather' in raw_lower:
        return '🌦️ Clima'
    if 'lifestyle' in raw_lower:
        return '💅 Lifestyle'
    
    return '📺 Geral'

def consolidate():
    base_dir = Path(__file__).parent
    web_dir = base_dir / 'web'
    data_json = web_dir / 'data.json'
    channels_json = web_dir / 'channels.json'

    web_dir.mkdir(exist_ok=True)

    # Carregar dados existentes
    data_antigo = carregar_json(data_json)
    if not isinstance(data_antigo, dict):
        data_antigo = {}

    # Inicializar estrutura
    data = {}
    for cat in CATS_VOD:
        data[cat] = data_antigo.get(cat, [])
    
    # Inicializar categorias de TV
    data[TV_LEGACY_KEY] = []
    for chave in TV_CATS.values():
        data[chave] = []

    print(f"📂 VOD carregado: {sum(len(data[c]) for c in CATS_VOD)} itens")

    # Carregar channels.json
    tv_channels = carregar_json(channels_json)
    if not isinstance(tv_channels, list):
        tv_channels = []
    print(f"📺 channels.json: {len(tv_channels)} canais")

    # Distribuir canais por categoria
    canais_por_categoria = {chave: [] for chave in TV_CATS.values()}
    canais_sem_categoria = []
    urls_processadas = set()

    for canal in tv_channels:
        url = canal.get('url', '')
        if not url or url in urls_processadas:
            continue
            
        urls_processadas.add(url)
        
        # Normalizar grupo
        grupo_raw = canal.get('group', canal.get('group_raw', ''))
        grupo_pt = normalizar_grupo_simples(grupo_raw)
        canal['group'] = grupo_pt
        
        # Adicionar à categoria correspondente
        chave_cat = TV_CATS.get(grupo_pt)
        if chave_cat:
            canais_por_categoria[chave_cat].append(canal)
        else:
            canais_sem_categoria.append(canal)

    # Adicionar aos dados finais
    for chave, canais in canais_por_categoria.items():
        data[chave] = canais
        print(f"   📺 {chave}: {len(canais)} canais")
    
    data['tv_geral'].extend(canais_sem_categoria)
    print(f"   📺 tv_geral: {len(canais_sem_categoria)} canais")

    # Criar lista unificada para compatibilidade
    todos_canais = []
    urls_unificadas = set()
    
    for chave in list(TV_CATS.values()) + ['tv_geral']:
        for canal in data.get(chave, []):
            url = canal.get('url', '')
            if url and url not in urls_unificadas:
                urls_unificadas.add(url)
                todos_canais.append(canal)
    
    data[TV_LEGACY_KEY] = todos_canais

    print(f"\n📊 RESULTADO:")
    print(f"   ✅ Total canais processados: {len(urls_processadas)}")
    print(f"   📺 Total na TV unificada: {len(todos_canais)}")

    # Salvar
    try:
        data_json.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding='utf-8'
        )
        
        total_itens = sum(len(data.get(c, [])) for c in CATS_VOD)
        total_itens += len(data.get(TV_LEGACY_KEY, []))
        
        print(f"\n💾 data.json salvo — {total_itens} itens totais")
        print("=" * 60)
        print("✅ Concluído! Execute agora: python3 build.py")
        
    except Exception as e:
        print(f"\n❌ Erro ao salvar data.json: {e}")

if __name__ == '__main__':
    consolidate()
