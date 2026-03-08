"""
utils.py — Funções utilitárias compartilhadas entre build.py,
           download_iptv.py e consolidar_data.py.

Regra: qualquer lógica usada em mais de um arquivo vive aqui.
"""

# Mapeamento canônico: group-title M3U (inglês) → categoria PT-BR com emoji.
# Suporta grupos compostos ("Animation;Kids") — usa apenas a primeira parte.
_GROUP_MAP = {
    # Geral / indefinido
    'undefined':        '📺 Geral',
    'general':          '📺 Geral',
    '':                 '📺 Geral',
    '📺 tv ao vivo':    '📺 Geral',

    # Entretenimento
    'entertainment':    '🎭 Entretenimento',
    'comedy':           '😂 Comédia',
    'culture':          '🎨 Cultura',
    'lifestyle':        '💅 Lifestyle',
    'classic':          '🎞️ Clássicos',
    'family':           '👨‍👩‍👧 Família',

    # Filmes / Séries
    'movies':           '🎬 Filmes',
    'series':           '📺 Séries',
    'animation':        '🎨 Animação',

    # Notícias
    'news':             '📰 Notícias',
    'legislative':      '🏛️ Legislativo',
    'business':         '💼 Negócios',
    'weather':          '🌦️ Clima',

    # Esportes
    'sports':           '⚽ Esportes',

    # Religião / Educação
    'religious':        '✝️ Religioso',
    'education':        '📚 Educação',
    'science':          '🔬 Ciência',

    # Música
    'music':            '🎵 Música',

    # Documentário / Natureza
    'documentary':      '🎥 Documentário',
    'outdoor':          '🌿 Natureza',

    # Infantil
    'kids':             '🧸 Infantil',

    # Outros
    'shop':             '🛍️ Shopping',
    'cooking':          '🍳 Culinária',
    'travel':           '✈️ Viagem',
    'auto':             '🚗 Automóvel',

    # Grupos compostos comuns do iptv-org
    'lame | brazil vip': '📺 Geral',
    'brazil':           '📺 Geral',
    'brasil':           '📺 Geral',
}


def normalize_tv_group(raw_group: str) -> str:
    """Mapeia group-title M3U para categoria PT-BR com emoji.

    - Aceita inglês ('News'), PT-BR ('Notícias') e grupos compostos ('Animation;Kids').
    - Já normalizado (ex: '📺 Geral') é devolvido sem alteração.
    - Fallback: '📺 Geral'.
    """
    g = (raw_group or '').strip()
    # Grupos compostos: pegar apenas a primeira parte
    first = g.split(';')[0].split('|')[0].strip().lower()
    result = _GROUP_MAP.get(first)
    if result:
        return result
    # Tentativa com o valor original em lowercase (já pode estar em PT-BR)
    result = _GROUP_MAP.get(g.lower())
    if result:
        return result
    # Se já parece uma categoria PT-BR válida (contém emoji), devolver como está
    if any(c in g for c in '📺🎬📰⚽✝️🧸🎵📚🎥🌿🎨😂🏛️🔬🛍️🍳✈️🚗💅🎞️👨💼🌦️🎭'):
        return g
    return '📺 Geral'
