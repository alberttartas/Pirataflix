# Sistema VOD M3U8 Pessoal

Sistema automatizado para geração de lista VOD M3U8 com interface web estilo Netflix.

## Funcionalidades

- ✅ Geração automática de arquivo `vod.m3u8`
- ✅ Verificação de links ativos com cache
- ✅ Interface web responsiva
- ✅ Filtros por categoria
- ✅ Busca em tempo real
- ✅ Atualização automática via GitHub Actions

## Como usar

1. Clone o repositório
2. Adicione seus arquivos `.m3u` nas pastas correspondentes:
   - `input/filmes/` para filmes
   - `input/series/Nome da Série/` para séries
   - etc.
3. Execute `python build.py` localmente
4. Faça commit e push para ativar o GitHub Actions

## Estrutura de arquivos

- `build.py` - Script principal de processamento
- `.github/workflows/build.yml` - Workflow de automação
- `web/` - Interface web completa
- `output/vod.m3u8` - Playlist gerada
- `cache/links_validos.txt` - Cache de links verificados

## Configuração

O sistema funciona imediatamente após configurar os arquivos `.m3u` nas pastas corretas.

Para personalizar:
- Edite `CATEGORIES` em `build.py`
- Adicione imagens em `assets/capas/` e `assets/backgrounds/`
- Personalize `web/style.css` para alterar o visual