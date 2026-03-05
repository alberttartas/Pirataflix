#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
consolidar_data.py — Consolida filmes, séries e canais de TV no data.json
Mantém categorias de TV separadas por grupo
"""

import json
import re
from pathlib import Path

print("=" * 60)
print("🔄 CONSOLIDANDO DADOS NO DATA.JSON")
print("=" * 60)

# Categorias base do VOD
CATS_VOD = ['filmes', 'series', 'novelas', 'animes', 'infantil']

# Categorias de TV que viram subcategorias no data.json
# Chave: nome PT-BR (igual ao normalizar_grupo), Valor: chave no data.json
TV_CATS = {
    '📺 Geral':           'tv_geral',
    '📰 Notícias':        'tv_noticias',
    '⚽ Esportes':        'tv_esportes',
    '🎬 Filmes':          'tv_filmes',
    '📺 Séries':          'tv_series',
    '🎭 Entretenimento':  'tv_entretenimento',
    '✝️ Religioso':       'tv_religioso',
    '🧸 Infantil':        'tv_infantil',
    '🎵 Música':          'tv_musica',
    '📚 Educação':        'tv_educacao',
    '🎥 Documentário':    'tv_documentario',
    '🌿 Natureza':        'tv_natureza',
    '🎨 Animação':        'tv_animacao',
    '😂 Comédia':         'tv_comedia',
    '🎨 Cultura':         'tv_cultura',
    '🏛️ Legislativo':     'tv_legislativo',
    '🔬 Ciência':         'tv_ciencia',
    '🛍️ Shopping':        'tv_shopping',
    '🍳 Culinária':       'tv_culinaria',
    '✈️ Viagem':          'tv_viagem',
    '🚗 Automóvel':       'tv_automovel',
    '💅 Lifestyle':       'tv_lifestyle',
    '🎞️ Clássicos':       'tv_classicos',
    '👨‍👩‍👧 Família':        'tv_familia',
    '💼 Negócios':        'tv_negocios',
    '🌦️ Clima':           'tv_clima',
}

# Chave legada que o site usa para TV ao vivo
TV_LEGACY_KEY = 'tv'


def carregar_json(path: Path) -> list | dict:
    if path.exists():
        try:
            return json.loads(path.read_text(encoding='utf-8'))
        except Exception as e:
            print(f"   ⚠️ Erro ao ler {path.name}: {e}")
    return [] if path.suffix == '.json' and 'channels' in path.name else {}


def coletar_urls_vod(data: dict) -> set[str]:
    urls = set()
    for cat in CATS_VOD:
        for item in data.get(cat, []):
            for ep in item.get('episodes', []):
                if ep.get('url'): urls.add(ep['url'])
            for season in item.get('seasons', []):
                for ep in season.get('episodes', []):
                    if ep.get('url'): urls.add(ep['url'])
    return urls


def coletar_urls_tv(data: dict) -> set[str]:
    urls = set()
    # Chave legada
    for canal in data.get(TV_LEGACY_KEY, []):
        _extrair_urls_canal(canal, urls)
    # Subcategorias
    for chave in TV_CATS.values():
        for canal in data.get(chave, []):
            _extrair_urls_canal(canal, urls)
    return urls


def _extrair_urls_canal(canal: dict, urls: set):
    if canal.get('url'):     urls.add(canal['url'])
    for ep in canal.get('episodes', []):
        if ep.get('url'):    urls.add(ep['url'])


def consolidate():
    base_dir      = Path(__file__).parent
    web_dir       = base_dir / 'web'
    data_json     = web_dir / 'data.json'
    channels_json = web_dir / 'channels.json'

    # ── Carregar data.json existente ──────────────────────────
    data_antigo = carregar_json(data_json)
    if not isinstance(data_antigo, dict):
        data_antigo = {}

    # Estrutura base
    data: dict = {cat: data_antigo.get(cat, []) for cat in CATS_VOD}
    # Preservar TV legada e subcategorias existentes
    data[TV_LEGACY_KEY] = data_antigo.get(TV_LEGACY_KEY, [])
    for chave in TV_CATS.values():
        data[chave] = data_antigo.get(chave, [])

    total_vod = sum(len(data[c]) for c in CATS_VOD)
    print(f"📂 VOD carregado: {total_vod} itens")

    # ── Carregar channels.json ────────────────────────────────
    tv_channels: list[dict] = carregar_json(channels_json)
    if not isinstance(tv_channels, list):
        tv_channels = []
    print(f"📺 channels.json: {len(tv_channels)} canais")

    # ── Coletar URLs já existentes ────────────────────────────
    urls_vod = coletar_urls_vod(data)
    urls_tv  = coletar_urls_tv(data)
    print(f"🔍 URLs VOD: {len(urls_vod)} | URLs TV existentes: {len(urls_tv)}")

    # ── Separar canais por categoria ──────────────────────────
    # Inicializar acumuladores por subcategoria
    por_cat: dict[str, list] = {chave: [] for chave in TV_CATS.values()}
    legado: list = []

    novos = dup_vod = dup_tv = 0

    for canal in tv_channels:
        url = canal.get('url', '')
        if not url:
            continue
        if url in urls_vod:
            dup_vod += 1
            continue
        if url in urls_tv:
            dup_tv += 1
            continue

        # Normalizar grupo
        grupo_raw = canal.get('group', canal.get('group_raw', ''))
        grupo_pt  = grupo_raw  # já deve estar em PT-BR vindo do download_iptv.py

        # Se ainda vier em inglês, converter
        if grupo_pt not in TV_CATS:
            grupo_pt = _fallback_grupo(grupo_raw)

        canal['group'] = grupo_pt

        chave_cat = TV_CATS.get(grupo_pt)
        if chave_cat:
            por_cat[chave_cat].append(canal)
        else:
            legado.append(canal)

        urls_tv.add(url)
        novos += 1

    # ── Mesclar com existentes (sem duplicar) ─────────────────
    for chave, lista in por_cat.items():
        data[chave].extend(lista)

    # Legado vai para tv_geral ou TV_LEGACY_KEY
    data['tv_geral'].extend(legado)

    # Manter TV_LEGACY_KEY como união de todos para compatibilidade
    todos_tv: list[dict] = []
    seen_urls: set[str] = set()
    for chave in [TV_LEGACY_KEY] + list(TV_CATS.values()):
        for canal in data.get(chave, []):
            u = canal.get('url', '')
            if u and u not in seen_urls:
                seen_urls.add(u)
                todos_tv.append(canal)
    data[TV_LEGACY_KEY] = todos_tv

    # ── Resultado ─────────────────────────────────────────────
    print(f"\n📊 RESULTADO:")
    print(f"   ✅ Novos canais adicionados: {novos}")
    print(f"   ⚠️  Duplicados com VOD: {dup_vod}")
    print(f"   ⚠️  Duplicados na TV: {dup_tv}")
    print(f"\n📺 CANAIS POR CATEGORIA:")
    for grupo_pt, chave in sorted(TV_CATS.items()):
        qtd = len(data.get(chave, []))
        if qtd:
            print(f"   {grupo_pt}: {qtd}")
    print(f"   Total TV (legado): {len(data[TV_LEGACY_KEY])}")

    # ── Salvar ────────────────────────────────────────────────
    data_json.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"\n💾 data.json salvo — {sum(len(data.get(c,[])) for c in list(CATS_VOD)+[TV_LEGACY_KEY])} itens totais")
    print("=" * 60)
    print("✅ Concluído! Execute agora: python3 build.py")


def _fallback_grupo(raw: str) -> str:
    """Converte grupos em inglês ainda não convertidos."""
    MAP = {
        'news': '📰 Notícias', 'sports': '⚽ Esportes',
        'movies': '🎬 Filmes', 'series': '📺 Séries',
        'kids': '🧸 Infantil', 'music': '🎵 Música',
        'religious': '✝️ Religioso', 'education': '📚 Educação',
        'documentary': '🎥 Documentário', 'entertainment': '🎭 Entretenimento',
        'animation': '🎨 Animação', 'comedy': '😂 Comédia',
        'outdoor': '🌿 Natureza', 'science': '🔬 Ciência',
        'legislative': '🏛️ Legislativo', 'culture': '🎨 Cultura',
        'shop': '🛍️ Shopping', 'cooking': '🍳 Culinária',
        'travel': '✈️ Viagem', 'auto': '🚗 Automóvel',
        'lifestyle': '💅 Lifestyle', 'classic': '🎞️ Clássicos',
        'family': '👨‍👩‍👧 Família', 'business': '💼 Negócios',
        'weather': '🌦️ Clima', 'general': '📺 Geral',
        'undefined': '📺 Geral',
    }
    chave = raw.lower().split(';')[0].split('|')[0].strip()
    for k, v in MAP.items():
        if k in chave:
            return v
    return '📺 Geral'


if __name__ == '__main__':
    consolidate()
