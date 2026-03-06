#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
consolidar_data.py — Consolida filmes, séries e canais de TV no data.json
Mantém categorias de TV separadas por grupo
Versão corrigida com mapeamento completo de grupos
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
    '💖 Novelas':         'tv_novelas',      # NOVA CATEGORIA
    '👻 Animes':          'tv_animes',       # NOVA CATEGORIA
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
    """Carrega arquivo JSON com tratamento de erro"""
    if path.exists():
        try:
            return json.loads(path.read_text(encoding='utf-8'))
        except json.JSONDecodeError as e:
            print(f"   ⚠️ Erro de sintaxe JSON em {path.name}: {e}")
            return [] if path.suffix == '.json' and 'channels' in path.name else {}
        except Exception as e:
            print(f"   ⚠️ Erro ao ler {path.name}: {e}")
            return [] if path.suffix == '.json' and 'channels' in path.name else {}
    return [] if path.suffix == '.json' and 'channels' in path.name else {}


def coletar_urls_vod(data: dict) -> set[str]:
    """Coleta todas as URLs de filmes e séries"""
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
    """Coleta todas as URLs de canais de TV"""
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
    """Extrai URLs de um canal"""
    if canal.get('url'):     
        urls.add(canal['url'])
    for ep in canal.get('episodes', []):
        if ep.get('url'):    
            urls.add(ep['url'])


def normalizar_grupo_completo(raw: str) -> str:
    """
    Versão unificada da normalização de grupos
    Converte qualquer string de grupo para o formato PT-BR com emojis
    """
    if not raw or not isinstance(raw, str):
        return '📺 Geral'
    
    # Mapeamento completo de termos para categorias
    MAP_COMPLETO = {
        # Geral / Indefinido
        'geral': '📺 Geral',
        'general': '📺 Geral',
        'undefined': '📺 Geral',
        'variados': '📺 Geral',
        'outros': '📺 Geral',
        
        # Entretenimento
        'entretenimento': '🎭 Entretenimento',
        'entertainment': '🎭 Entretenimento',
        'variedades': '🎭 Entretenimento',
        'variety': '🎭 Entretenimento',
        'show': '🎭 Entretenimento',
        'talkshow': '🎭 Entretenimento',
        
        # Filmes
        'filmes': '🎬 Filmes',
        'movies': '🎬 Filmes',
        'filme': '🎬 Filmes',
        'movie': '🎬 Filmes',
        'cinema': '🎬 Filmes',
        
        # Séries
        'series': '📺 Séries',
        'serie': '📺 Séries',
        
        # Novelas
        'novelas': '💖 Novelas',
        'novela': '💖 Novelas',
        'soap': '💖 Novelas',
        'telenovela': '💖 Novelas',
        
        # Animes
        'animes': '👻 Animes',
        'anime': '👻 Animes',
        'animação japonesa': '👻 Animes',
        'japanese animation': '👻 Animes',
        
        # Esportes
        'esportes': '⚽ Esportes',
        'sports': '⚽ Esportes',
        'futebol': '⚽ Esportes',
        'sport': '⚽ Esportes',
        'basquete': '⚽ Esportes',
        'volei': '⚽ Esportes',
        
        # Notícias
        'notícias': '📰 Notícias',
        'noticias': '📰 Notícias',
        'news': '📰 Notícias',
        'jornalismo': '📰 Notícias',
        'jornal': '📰 Notícias',
        
        # Religioso
        'religioso': '✝️ Religioso',
        'religiosa': '✝️ Religioso',
        'religious': '✝️ Religioso',
        'católica': '✝️ Religioso',
        'evangélica': '✝️ Religioso',
        'catolico': '✝️ Religioso',
        'evangelico': '✝️ Religioso',
        'gospel': '✝️ Religioso',
        'cristão': '✝️ Religioso',
        'crista': '✝️ Religioso',
        
        # Educação
        'educação': '📚 Educação',
        'educacao': '📚 Educação',
        'education': '📚 Educação',
        'educativo': '📚 Educação',
        'educativa': '📚 Educação',
        'aprendizado': '📚 Educação',
        
        # Música
        'música': '🎵 Música',
        'musica': '🎵 Música',
        'music': '🎵 Música',
        'musical': '🎵 Música',
        'videoclipes': '🎵 Música',
        'clipes': '🎵 Música',
        
        # Cultura
        'cultura': '🎨 Cultura',
        'culture': '🎨 Cultura',
        'artes': '🎨 Cultura',
        'arte': '🎨 Cultura',
        
        # Documentário
        'documentário': '🎥 Documentário',
        'documentario': '🎥 Documentário',
        'documentary': '🎥 Documentário',
        'doc': '🎥 Documentário',
        
        # Natureza
        'natureza': '🌿 Natureza',
        'nature': '🌿 Natureza',
        'outdoor': '🌿 Natureza',
        'animais': '🌿 Natureza',
        'animais selvagens': '🌿 Natureza',
        'wildlife': '🌿 Natureza',
        
        # Legislativo
        'legislativo': '🏛️ Legislativo',
        'legislative': '🏛️ Legislativo',
        'política': '🏛️ Legislativo',
        'politica': '🏛️ Legislativo',
        'camara': '🏛️ Legislativo',
        'senado': '🏛️ Legislativo',
        'governo': '🏛️ Legislativo',
        'publico': '🏛️ Legislativo',
        
        # Comédia
        'comédia': '😂 Comédia',
        'comedia': '😂 Comédia',
        'comedy': '😂 Comédia',
        'humor': '😂 Comédia',
        'stand-up': '😂 Comédia',
        
        # Shopping
        'shopping': '🛍️ Shopping',
        'shop': '🛍️ Shopping',
        'compras': '🛍️ Shopping',
        'vendas': '🛍️ Shopping',
        'telecompras': '🛍️ Shopping',
        
        # Culinária
        'culinária': '🍳 Culinária',
        'culinaria': '🍳 Culinária',
        'cooking': '🍳 Culinária',
        'gastronomia': '🍳 Culinária',
        'receitas': '🍳 Culinária',
        'comida': '🍳 Culinária',
        
        # Viagem
        'viagem': '✈️ Viagem',
        'travel': '✈️ Viagem',
        'turismo': '✈️ Viagem',
        'viagens': '✈️ Viagem',
        
        # Automóvel
        'automóvel': '🚗 Automóvel',
        'automovel': '🚗 Automóvel',
        'auto': '🚗 Automóvel',
        'carros': '🚗 Automóvel',
        'motors': '🚗 Automóvel',
        'automotive': '🚗 Automóvel',
        
        # Ciência
        'ciência': '🔬 Ciência',
        'ciencia': '🔬 Ciência',
        'science': '🔬 Ciência',
        'cientifico': '🔬 Ciência',
        'tecnologia': '🔬 Ciência',
        'tech': '🔬 Ciência',
        
        # Clássicos
        'clássicos': '🎞️ Clássicos',
        'classicos': '🎞️ Clássicos',
        'classic': '🎞️ Clássicos',
        'retro': '🎞️ Clássicos',
        
        # Família
        'família': '👨‍👩‍👧 Família',
        'familia': '👨‍👩‍👧 Família',
        'family': '👨‍👩‍👧 Família',
        'familiar': '👨‍👩‍👧 Família',
        
        # Negócios
        'negócios': '💼 Negócios',
        'negocios': '💼 Negócios',
        'business': '💼 Negócios',
        'economia': '💼 Negócios',
        'finanças': '💼 Negócios',
        
        # Clima
        'clima': '🌦️ Clima',
        'weather': '🌦️ Clima',
        'tempo': '🌦️ Clima',
        'meteorologia': '🌦️ Clima',
        
        # Lifestyle
        'lifestyle': '💅 Lifestyle',
        'estilo': '💅 Lifestyle',
        'moda': '💅 Lifestyle',
        'beleza': '💅 Lifestyle',
        
        # Animação
        'animação': '🎨 Animação',
        'animacao': '🎨 Animação',
        'animation': '🎨 Animação',
        'desenhos': '🎨 Animação',
        
        # Infantil
        'infantil': '🧸 Infantil',
        'kids': '🧸 Infantil',
        'infantojuvenil': '🧸 Infantil',
        'crianças': '🧸 Infantil',
        'criancas': '🧸 Infantil',
    }
    
    texto = raw.lower().strip()
    
    # Verificar correspondências exatas primeiro
    if texto in MAP_COMPLETO:
        return MAP_COMPLETO[texto]
    
    # Verificar se o texto começa com algum termo do mapa
    for termo, categoria in MAP_COMPLETO.items():
        if texto.startswith(termo) or termo in texto:
            return categoria
    
    # Verificar grupos compostos separados por ; | ,
    separadores = [';', '|', ',', '/', '-']
    for sep in separadores:
        if sep in texto:
            partes = [p.strip() for p in texto.split(sep)]
            for parte in partes:
                if parte in MAP_COMPLETO:
                    return MAP_COMPLETO[parte]
                for termo, categoria in MAP_COMPLETO.items():
                    if termo in parte:
                        return categoria
    
    # Verificar palavras-chave especiais para canais brasileiros
    if 'globo' in texto or 'sbt' in texto or 'record' in texto or 'band' in texto:
        return '📺 Geral'
    
    # Se não encontrou nada
    return '📺 Geral'


def consolidate():
    """Função principal de consolidação"""
    base_dir      = Path(__file__).parent
    web_dir       = base_dir / 'web'
    data_json     = web_dir / 'data.json'
    channels_json = web_dir / 'channels.json'

    # ── Criar diretório web se não existir ────────────────────
    web_dir.mkdir(exist_ok=True)

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
            
        # Verificar duplicatas
        if url in urls_vod:
            dup_vod += 1
            continue
        if url in urls_tv:
            dup_tv += 1
            continue

        # Normalizar grupo usando a função completa
        grupo_raw = canal.get('group', canal.get('group_raw', ''))
        grupo_pt = normalizar_grupo_completo(grupo_raw)
        
        # Garantir que o grupo está no formato correto
        canal['group'] = grupo_pt
        
        # Se o canal já tem group_raw, manter para referência
        if 'group_raw' not in canal and grupo_raw:
            canal['group_raw'] = grupo_raw

        # Verificar se o grupo está mapeado em TV_CATS
        chave_cat = TV_CATS.get(grupo_pt)
        if chave_cat:
            por_cat[chave_cat].append(canal)
        else:
            # Se não tem categoria específica, vai para legado
            legado.append(canal)
            print(f"   ⚠️ Grupo não mapeado: '{grupo_pt}' (raw: '{grupo_raw}')")

        urls_tv.add(url)
        novos += 1

    # ── Mesclar com existentes (sem duplicar) ─────────────────
    for chave, lista in por_cat.items():
        # Evitar duplicatas dentro da mesma categoria
        urls_existentes = {c['url'] for c in data.get(chave, []) if c.get('url')}
        for canal in lista:
            if canal['url'] not in urls_existentes:
                data[chave].append(canal)
                urls_existentes.add(canal['url'])

    # Legado vai para tv_geral
    urls_geral = {c['url'] for c in data.get('tv_geral', []) if c.get('url')}
    for canal in legado:
        if canal['url'] not in urls_geral:
            data['tv_geral'].append(canal)
            urls_geral.add(canal['url'])

    # ── Criar lista unificada para TV_LEGACY_KEY ──────────────
    todos_tv: list[dict] = []
    seen_urls: set[str] = set()
    
    # Primeiro adicionar canais das categorias específicas
    for chave in TV_CATS.values():
        for canal in data.get(chave, []):
            u = canal.get('url', '')
            if u and u not in seen_urls:
                seen_urls.add(u)
                # Garantir que o grupo está presente
                if 'group' not in canal:
                    canal['group'] = '📺 Geral'
                todos_tv.append(canal)
    
    # Depois adicionar legado (tv_geral) se não estiver já incluído
    for canal in data.get('tv_geral', []):
        u = canal.get('url', '')
        if u and u not in seen_urls:
            seen_urls.add(u)
            if 'group' not in canal:
                canal['group'] = '📺 Geral'
            todos_tv.append(canal)
    
    data[TV_LEGACY_KEY] = todos_tv

    # ── Remover categorias vazias ─────────────────────────────
    for chave in list(TV_CATS.values()) + ['tv_geral']:
        if chave in data and not data[chave]:
            del data[chave]

    # ── Resultado ─────────────────────────────────────────────
    print(f"\n📊 RESULTADO:")
    print(f"   ✅ Novos canais adicionados: {novos}")
    print(f"   ⚠️  Duplicados com VOD: {dup_vod}")
    print(f"   ⚠️  Duplicados na TV: {dup_tv}")
    
    print(f"\n📺 CANAIS POR CATEGORIA:")
    categorias_com_canais = []
    for grupo_pt, chave in sorted(TV_CATS.items()):
        qtd = len(data.get(chave, []))
        if qtd:
            print(f"   {grupo_pt}: {qtd}")
            categorias_com_canais.append((grupo_pt, qtd))
    
    qtd_geral = len(data.get('tv_geral', []))
    if qtd_geral:
        print(f"   📺 Geral (não categorizados): {qtd_geral}")
    
    print(f"   Total TV (unificado): {len(data[TV_LEGACY_KEY])}")

    # ── Salvar ────────────────────────────────────────────────
    try:
        data_json.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), 
            encoding='utf-8'
        )
        
        # Calcular total de itens
        total_itens = sum(len(data.get(c, [])) for c in CATS_VOD)
        total_itens += len(data.get(TV_LEGACY_KEY, []))
        
        print(f"\n💾 data.json salvo — {total_itens} itens totais")
        print("=" * 60)
        print("✅ Concluído! Execute agora: python3 build.py")
        
    except Exception as e:
        print(f"\n❌ Erro ao salvar data.json: {e}")


if __name__ == '__main__':
    consolidate()
