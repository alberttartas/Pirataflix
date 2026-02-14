import requests
from pathlib import Path
import json
from datetime import datetime

def download_iptv_sources():
    """Baixa fontes do iptv-org sem afetar arquivos existentes"""
    
    base_dir = Path(__file__).parent
    auto_dir = base_dir / "input_auto"
    
    # Criar subpastas
    pastas = {
        'filmes': auto_dir / 'Filmes',
        'series': auto_dir / 'Series',
        'novelas': auto_dir / 'Novelas',
    }
    
    for pasta in pastas.values():
        pasta.mkdir(parents=True, exist_ok=True)
    
    # URLs do iptv-org
    fontes = {
        'filmes': 'https://iptv-org.github.io/iptv/categories/movies/br.m3u',
        'series': 'https://iptv-org.github.io/iptv/categories/series/br.m3u',
        'canais_br': 'https://iptv-org.github.io/iptv/countries/br.m3u',
    }
    
    resultados = {}
    
    for nome, url in fontes.items():
        print(f"\n📡 Baixando {nome}...")
        try:
            response = requests.get(url, timeout=30, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            
            if response.status_code == 200:
                # Determinar pasta de destino
                if nome == 'filmes':
                    destino = pastas['filmes'] / f"iptv_filmes_{datetime.now().strftime('%Y%m%d')}.m3u"
                elif nome == 'series':
                    destino = pastas['series'] / f"iptv_series_{datetime.now().strftime('%Y%m%d')}.m3u"
                else:
                    destino = pastas['novelas'] / f"iptv_canais_{datetime.now().strftime('%Y%m%d')}.m3u"
                
                # Salvar arquivo
                with open(destino, 'w', encoding='utf-8') as f:
                    f.write(response.text)
                
                # Estatísticas
                linhas = response.text.split('\n')
                total_links = len([l for l in linhas if l and not l.startswith('#')])
                print(f"   ✅ {total_links} streams salvos em: {destino.name}")
                resultados[nome] = total_links
            else:
                print(f"   ❌ Erro HTTP: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ Erro: {e}")
    
    print(f"\n📊 Resumo do download:")
    for nome, qtd in resultados.items():
        print(f"   {nome}: {qtd} streams")
    
    return resultados

if __name__ == "__main__":
    download_iptv_sources()
