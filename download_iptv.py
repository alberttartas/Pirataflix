#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
download_iptv.py — Baixa listas IPTV brasileiras e separa por categorias
"""

import requests
import json
import re
import os
import shutil
from pathlib import Path
from datetime import datetime
from utils import normalize_tv_group

print("=" * 60)
print("🚀 DOWNLOAD IPTV — CATEGORIAS SEPARADAS")
print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 60)

# =============================================================
# FONTES DE DOWNLOAD
# Adicione ou remova URLs aqui conforme necessário
# =============================================================
FONTES = [
    {
        'nome':  'iptv-org (Brasil)',
        'url':   'https://iptv-org.github.io/iptv/countries/br.m3u',
        'arquivo': 'iptv_org_br.m3u',
    },
    {
        'nome':  'Ramys IPTV Brasil 2026',
        'url':   'https://raw.githubusercontent.com/Ramys/Iptv-Brasil-2026/master/CanaisBR-Completo.m3u',
        'arquivo': 'ramys_br.m3u',
    },
]

# =============================================================
# MAPEAMENTO DE GRUPOS → CATEGORIAS PT-BR
# =============================================================



def testar_conexao():
    try:
        requests.get('https://iptv-org.github.io', timeout=8)
        return True
    except Exception:
        return False


def baixar_fonte(url: str, destino: Path, nome: str) -> str | None:
    print(f"\n📡 Baixando: {nome}")
    print(f"   URL: {url}")
    try:
        r = requests.get(url, timeout=45, headers={'User-Agent': 'Mozilla/5.0'})
        if r.status_code == 200:
            destino.write_text(r.text, encoding='utf-8')
            linhas = r.text.count('\n')
            print(f"   ✅ OK — {len(r.text)//1024} KB, ~{linhas} linhas")
            return r.text
        else:
            print(f"   ❌ HTTP {r.status_code}")
            return None
    except Exception as e:
        print(f"   ❌ Erro: {e}")
        return None


def parse_m3u(conteudo: str) -> list[dict]:
    """Extrai canais de um conteúdo M3U."""
    canais = []
    linhas = conteudo.splitlines()
    i = 0
    while i < len(linhas):
        linha = linhas[i].strip()
        if linha.startswith('#EXTINF:'):
            info = linha[8:]

            tvg_id    = re.search(r'tvg-id="([^"]*)"',    info)
            tvg_logo  = re.search(r'tvg-logo="([^"]*)"',  info)
            group     = re.search(r'group-title="([^"]*)"', info)
            tvg_name  = re.search(r'tvg-name="([^"]*)"',  info)

            partes = info.split(',', 1)
            titulo = partes[1].strip() if len(partes) > 1 else 'Sem nome'

            i += 1
            # Pular linhas de comentário intermediárias
            while i < len(linhas) and linhas[i].strip().startswith('#'):
                i += 1

            if i < len(linhas):
                url_canal = linhas[i].strip()
                if url_canal and not url_canal.startswith('#'):
                    canais.append({
                        'title':     titulo,
                        'url':       url_canal,
                        'tvg_id':    tvg_id.group(1)   if tvg_id   else '',
                        'tvg_logo':  tvg_logo.group(1) if tvg_logo else '',
                        'tvg_name':  tvg_name.group(1) if tvg_name else titulo,
                        'group_raw': group.group(1)    if group    else '',
                    })
        i += 1
    return canais


def filtrar_brasileiros(canais: list[dict]) -> list[dict]:
    """Filtra canais com indicação brasileira."""
    KW_BR = [
        'globo','sbt','record','band','redetv','cultura','tv brasil',
        'cnn brasil','globo news','sportv','tnt brasil','fox brasil',
        'universal','futura','telecine','premiere','combate','discovery',
        'history','a&e','sony','warner','max ','hbo','multishow','viva',
        'gnt','bis','off ','cartoon','nick ','disney','espn','band sports',
        'canção nova','aparecida','tv senado','tv câmara','tv justiça',
        'brazil','brasil','br:','br |','hd br','sd br', '.br',
        'megapix','woohoo','mtv','paramount','pluto',
    ]
    KW_EXCL = [
        'usa ','united states',' uk ','united kingdom','deutsch',
        'germany','france','italia',' spain ','mexico ','argentina ',
        'colombia','peru ','chile ','portugal ','english','español',
        'french','italian','turkish','arabic','hindi','chinese',
    ]
    resultado = []
    for c in canais:
        texto = f"{c['title']} {c['tvg_id']} {c['group_raw']}".lower()
        if any(x in texto for x in KW_EXCL):
            continue
        if any(x in texto for x in KW_BR) or '.br' in c['tvg_id'].lower():
            resultado.append(c)
    return resultado


def salvar_por_categoria(canais: list[dict], pasta_tv: Path):
    """Salva um .m3u por categoria dentro de input_auto/TV/."""
    # Agrupar
    por_cat: dict[str, list] = {}
    for c in canais:
        cat = normalize_tv_group(c['group_raw'])
        por_cat.setdefault(cat, []).append(c)

    # Limpar arquivos antigos de categoria
    for f in pasta_tv.glob('cat_*.m3u'):
        f.unlink()

    print(f"\n📁 Salvando {len(por_cat)} categorias em {pasta_tv}:")
    for cat, lista in sorted(por_cat.items()):
        # Nome de arquivo seguro
        slug = re.sub(r'[^\w]', '_', cat).strip('_').lower()
        slug = re.sub(r'_+', '_', slug)
        arquivo = pasta_tv / f"cat_{slug}.m3u"
        with open(arquivo, 'w', encoding='utf-8') as f:
            f.write('#EXTM3U\n')
            for c in lista:
                f.write(f'#EXTINF:-1 tvg-id="{c["tvg_id"]}" tvg-logo="{c["tvg_logo"]}" group-title="{cat}",{c["title"]}\n')
                f.write(f'{c["url"]}\n\n')
        print(f"   {cat}: {len(lista)} canais → {arquivo.name}")

    return por_cat


def criar_channels_json(canais: list[dict], web_dir: Path):
    """Cria/atualiza channels.json sem duplicatas, com categoria PT-BR."""
    channels_file = web_dir / 'channels.json'

    # Carregar existentes
    existentes: list[dict] = []
    urls_existentes: set[str] = set()
    if channels_file.exists():
        try:
            existentes = json.loads(channels_file.read_text(encoding='utf-8'))
            for c in existentes:
                if c.get('url'):       urls_existentes.add(c['url'])
                for ep in c.get('episodes', []):
                    if ep.get('url'): urls_existentes.add(ep['url'])
        except Exception as e:
            print(f"   ⚠️ Erro ao ler channels.json: {e}")

    novos = 0
    for c in canais:
        if c['url'] in urls_existentes:
            continue
        cat = normalize_tv_group(c['group_raw'])
        canal_id = c['tvg_id'] or re.sub(r'[^\w]', '_', c['title'].lower()).strip('_')
        existentes.append({
            'id':       canal_id,
            'type':     'tv',
            'title':    c['title'],
            'tvg_id':   c['tvg_id'],
            'tvg_logo': c['tvg_logo'],
            'group':    cat,
            'url':      c['url'],
            'episodes': [{'url': c['url'], 'title': 'AO VIVO'}],
        })
        urls_existentes.add(c['url'])
        novos += 1

    channels_file.write_text(json.dumps(existentes, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"\n✅ channels.json: {novos} novos, {len(existentes)} total")
    return existentes


def main():
    if not testar_conexao():
        print("\n❌ Sem conexão. Abortando.")
        return

    base_dir  = Path(__file__).parent
    pasta_tv  = base_dir / 'input_auto' / 'TV'
    web_dir   = base_dir / 'web'
    pasta_tv.mkdir(parents=True, exist_ok=True)
    web_dir.mkdir(exist_ok=True)

    todos_canais: list[dict] = []

    for fonte in FONTES:
        destino = pasta_tv / fonte['arquivo']
        conteudo = baixar_fonte(fonte['url'], destino, fonte['nome'])
        if not conteudo:
            # Tentar usar cache local
            if destino.exists():
                print(f"   ⚠️ Usando cache: {destino.name}")
                conteudo = destino.read_text(encoding='utf-8', errors='ignore')
            else:
                continue

        canais = parse_m3u(conteudo)
        print(f"   📊 {len(canais)} canais encontrados")

        # A fonte iptv-org/br já é filtrada; Ramys precisa filtrar
        if 'iptv-org' not in fonte['url']:
            canais = filtrar_brasileiros(canais)
            print(f"   🇧🇷 {len(canais)} canais brasileiros")

        todos_canais.extend(canais)

    # Deduplicar por URL
    vistos: set[str] = set()
    unicos: list[dict] = []
    for c in todos_canais:
        if c['url'] not in vistos:
            vistos.add(c['url'])
            unicos.append(c)
    print(f"\n📊 Total único: {len(unicos)} canais de {len(todos_canais)} coletados")

    # Salvar por categoria
    por_cat = salvar_por_categoria(unicos, pasta_tv)

    # Atualizar channels.json
    criar_channels_json(unicos, web_dir)

    print("\n" + "=" * 60)
    cats_resumo = {normalize_tv_group(c['group_raw']): 0 for c in unicos}
    for c in unicos:
        cats_resumo[normalize_tv_group(c['group_raw'])] += 1
    for cat, qtd in sorted(cats_resumo.items(), key=lambda x: -x[1]):
        print(f"   {cat}: {qtd}")
    print("=" * 60)
    print("✅ Concluído! Execute agora: python3 consolidar_data.py")


if __name__ == '__main__':
    main()
