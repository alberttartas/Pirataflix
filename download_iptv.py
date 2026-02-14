import requests
from pathlib import Path
import json
from datetime import datetime
import sys

def download_iptv_sources():
    """Baixa fontes do iptv-org com logging melhorado"""
    
    print("\n" + "="*50)
    print("📡 INICIANDO DOWNLOAD DAS FONTES IPTV")
    print("="*50)
    
    base_dir = Path(__file__).parent
    auto_dir = base_dir / "input_auto"
    
    # Criar subpastas
    pastas = {
        'Filmes': auto_dir / 'Filmes',
        'Series': auto_dir / 'Series',
        'Novelas': auto_dir / 'Novelas',
    }
    
    for nome, pasta in pastas.items():
        pasta.mkdir(parents=True, exist_ok=True)
        print(f"📁 Pasta criada/verificada: {nome}")
    
    # URLs do iptv-org
    fontes = {
        'filmes': {
            'url': 'https://iptv-org.github.io/iptv/categories/movies/br.m3u',
            'pasta': pastas['Filmes'],
            'nome': 'iptv_filmes'
        },
        'series': {
            'url': 'https://iptv-org.github.io/iptv/categories/series/br.m3u',
            'pasta': pastas['Series'],
            'nome': 'iptv_series'
        },
        'canais_br': {
            'url': 'https://iptv-org.github.io/iptv/countries/br.m3u',
            'pasta': pastas['Novelas'],
            'nome': 'iptv_canais'
        },
        # Fontes adicionais
        'filmes_pt': {
            'url': 'https://iptv-org.github.io/iptv/categories/movies/pt.m3u',
            'pasta': pastas['Filmes'],
            'nome': 'iptv_filmes_pt'
        },
        'series_pt': {
            'url': 'https://iptv-org.github.io/iptv/categories/series/pt.m3u',
            'pasta': pastas['Series'],
            'nome': 'iptv_series_pt'
        }
    }
    
    resultados = {}
    total_links = 0
    
    for chave, info in fontes.items():
        print(f"\n📡 Baixando {chave}...")
        print(f"   URL: {info['url']}")
        
        try:
            response = requests.get(
                info['url'], 
                timeout=30, 
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            )
            
            if response.status_code == 200:
                # Nome do arquivo com data
                data_str = datetime.now().strftime('%Y%m%d')
                nome_arquivo = f"{info['nome']}_{data_str}.m3u"
                destino = info['pasta'] / nome_arquivo
                
                # Salvar arquivo
                with open(destino, 'w', encoding='utf-8') as f:
                    f.write(response.text)
                
                # Estatísticas
                linhas = response.text.split('\n')
                links = [l for l in linhas if l and not l.startswith('#')]
                qtd_links = len(links)
                total_links += qtd_links
                
                print(f"   ✅ {qtd_links} streams encontrados")
                print(f"   💾 Salvo em: {destino.name}")
                
                # Mostrar exemplo dos primeiros streams
                if links:
                    print(f"   📺 Exemplos:")
                    for i, link in enumerate(links[:3]):
                        print(f"      {i+1}. {link[:50]}...")
                
                resultados[chave] = {
                    'status': 'sucesso',
                    'links': qtd_links,
                    'arquivo': str(destino)
                }
            else:
                print(f"   ❌ Erro HTTP: {response.status_code}")
                resultados[chave] = {
                    'status': 'erro',
                    'codigo': response.status_code
                }
                
        except Exception as e:
            print(f"   ❌ Exceção: {e}")
            resultados[chave] = {
                'status': 'erro',
                'mensagem': str(e)
            }
    
    # Salvar relatório
    relatorio = {
        'data': datetime.now().isoformat(),
        'total_links': total_links,
        'resultados': resultados
    }
    
    relatorio_path = auto_dir / 'download_report.json'
    with open(relatorio_path, 'w', encoding='utf-8') as f:
        json.dump(relatorio, f, indent=2, ensure_ascii=False)
    
    print("\n" + "="*50)
    print("📊 RESUMO DO DOWNLOAD")
    print("="*50)
    print(f"📅 Data: {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print(f"📊 Total de streams: {total_links}")
    print(f"📁 Relatório salvo em: {relatorio_path}")
    print("="*50)
    
    return resultados

def verificar_arquivos_existentes():
    """Verifica se já existem arquivos baixados hoje"""
    base_dir = Path(__file__).parent
    auto_dir = base_dir / "input_auto"
    
    if not auto_dir.exists():
        return False
    
    hoje = datetime.now().strftime('%Y%m%d')
    arquivos_hoje = list(auto_dir.rglob(f"*{hoje}.m3u"))
    
    if arquivos_hoje:
        print(f"\n📋 Encontrados {len(arquivos_hoje)} arquivos de hoje:")
        for arq in arquivos_hoje:
            print(f"   - {arq.name}")
        return True
    
    return False

if __name__ == "__main__":
    # Verificar se já baixou hoje
    if verificar_arquivos_existentes():
        print("\n⏳ Arquivos de hoje já existem.")
        resposta = input("Deseja baixar novamente? (s/N): ").lower()
        if resposta != 's':
            print("❌ Download cancelado.")
            sys.exit(0)
    
    download_iptv_sources()
