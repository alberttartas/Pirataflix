#!/usr/bin/env python3
# DIAGNÓSTICO COMPLETO DO SISTEMA VOD

import os
import json
import sys

print("=" * 60)
print("🔍 DIAGNÓSTICO DO SISTEMA VOD")
print("=" * 60)

# 1. Verificar estrutura
print("\n📁 ESTRUTURA DO PROJETO:")
project_root = os.getcwd()
print(f"Pasta atual: {project_root}")

# Verificar diretórios
dirs = ["input", "output", "cache", "web", "assets/capas", "assets/backgrounds"]
for dir_path in dirs:
    full_path = os.path.join(project_root, dir_path)
    if os.path.exists(full_path):
        print(f"✅ {dir_path}/")
    else:
        print(f"❌ {dir_path}/ (NÃO EXISTE)")

# 2. Verificar arquivos gerados
print("\n📄 ARQUIVOS GERADOS:")

data_json_path = os.path.join(project_root, "web", "data.json")
if os.path.exists(data_json_path):
    size = os.path.getsize(data_json_path)
    print(f"✅ web/data.json ({size} bytes)")
    
    # Ler e analisar JSON
    try:
        with open(data_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"   📊 {len(data)} itens no JSON")
        
        if len(data) > 0:
            print(f"   🎬 Primeiros 3 itens:")
            for i, item in enumerate(data[:3]):
                print(f"      {i+1}. {item.get('title', 'Sem título')} ({item.get('category', 'Sem categoria')})")
        
        # Analisar categorias
        categories = {}
        for item in data:
            cat = item.get('category', 'Desconhecida')
            categories[cat] = categories.get(cat, 0) + 1
        
        print(f"\n   📈 DISTRIBUIÇÃO POR CATEGORIA:")
        for cat, count in categories.items():
            print(f"      • {cat}: {count} itens")
            
    except json.JSONDecodeError as e:
        print(f"   ❌ JSON INVÁLIDO: {e}")
    except Exception as e:
        print(f"   ❌ ERRO AO LER: {e}")
else:
    print(f"❌ web/data.json (NÃO ENCONTRADO)")

# 3. Verificar playlist
m3u_path = os.path.join(project_root, "output", "vod.m3u8")
if os.path.exists(m3u_path):
    size = os.path.getsize(m3u_path)
    print(f"\n✅ output/vod.m3u8 ({size} bytes)")
    
    # Contar linhas
    with open(m3u_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        extinf_count = sum(1 for line in lines if line.startswith('#EXTINF'))
        print(f"   📝 {len(lines)} linhas, {extinf_count} entradas")
else:
    print(f"\n❌ output/vod.m3u8 (NÃO ENCONTRADO)")

# 4. Verificar cache
cache_path = os.path.join(project_root, "cache", "links_validos.txt")
if os.path.exists(cache_path):
    size = os.path.getsize(cache_path)
    print(f"✅ cache/links_validos.txt ({size} bytes)")
    
    with open(cache_path, 'r', encoding='utf-8') as f:
        links = [line.strip() for line in f if line.strip() and not line.startswith('#')]
        print(f"   🔗 {len(links)} links no cache")
else:
    print(f"❌ cache/links_validos.txt (NÃO ENCONTRADO)")

# 5. Testar servidor web
print("\n🌐 TESTE DE ACESSO WEB:")

# Criar arquivo HTML de teste
test_html = os.path.join(project_root, "web", "teste_simples.html")
with open(test_html, 'w', encoding='utf-8') as f:
    f.write('''<!DOCTYPE html>
<html>
<head><title>Teste Simples</title></head>
<body>
<h1>Teste de Carregamento</h1>
<div id="result"></div>
<script>
// Tentar carregar data.json
fetch('data.json')
    .then(r => {
        document.getElementById('result').innerHTML += 
            'Status: ' + r.status + '<br>';
        return r.ok ? r.json() : Promise.reject('Erro ' + r.status);
    })
    .then(data => {
        document.getElementById('result').innerHTML += 
            '✅ JSON carregado: ' + data.length + ' itens<br>';
        if (data.length > 0) {
            document.getElementById('result').innerHTML += 
                'Primeiro: ' + data[0].title;
        }
    })
    .catch(err => {
        document.getElementById('result').innerHTML += 
            '❌ Erro: ' + err;
    });
</script>
</body>
</html>''')

print(f"✅ Arquivo de teste criado: web/teste_simples.html")
print("   Acesse via: http://localhost:8000/web/teste_simples.html")

# 6. Recomendações
print("\n" + "=" * 60)
print("💡 RECOMENDAÇÕES:")

if not os.path.exists(data_json_path):
    print("1. Execute o build.py novamente:")
    print("   python build.py")
elif os.path.getsize(data_json_path) < 100:
    print("1. O data.json está muito pequeno (possivelmente vazio)")
    print("   Execute: python build.py")
else:
    print("1. Inicie o servidor web:")
    print("   python -m http.server 8000")
    print("2. Acesse: http://localhost:8000/web/")

print("\n3. Para forçar regeneração:")
print("   del web\\data.json")
print("   del output\\vod.m3u8")
print("   python build.py")

# 7. Criar index.html de emergência
emergency_html = os.path.join(project_root, "web", "index_emergencia.html")
with open(emergency_html, 'w', encoding='utf-8') as f:
    f.write('''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Meu VOD - Modo Emergência</title>
    <style>
        body { font-family: Arial; background: #141414; color: white; margin: 20px; }
        h1 { color: #e50914; }
        .item { background: #1f1f1f; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .category { color: #e50914; font-weight: bold; }
        a { color: #4dabf7; text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>🎬 Meu Catálogo VOD (Modo Emergência)</h1>
    <div id="content">Carregando...</div>
    
    <script>
        // Dados diretos (fallback)
        const data = [
            {"title": "Maria do Bairro - Episódio 1", "category": "Novelas", "link": "#"},
            {"title": "Maria do Bairro - Episódio 2", "category": "Novelas", "link": "#"},
            {"title": "Três Graças - Episódio 1", "category": "Novelas", "link": "#"}
        ];
        
        // Tentar carregar do arquivo
        fetch('data.json')
            .then(r => r.ok ? r.json() : data)
            .then(items => {
                const content = document.getElementById('content');
                content.innerHTML = `<p>Total: ${items.length} itens</p>`;
                
                items.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'item';
                    div.innerHTML = `
                        <div class="category">${item.category}</div>
                        <div><strong>${item.title}</strong></div>
                        ${item.series ? `<div>Série: ${item.series}</div>` : ''}
                        <div><a href="${item.link}" target="_blank">▶ Assistir</a></div>
                    `;
                    content.appendChild(div);
                });
            })
            .catch(err => {
                document.getElementById('content').innerHTML = 
                    'Erro: ' + err + '<br>Execute: python build.py';
            });
    </script>
</body>
</html>''')

print(f"\n✅ Página de emergência: web/index_emergencia.html")

print("\n" + "=" * 60)
input("Pressione Enter para executar o build.py automaticamente...")

# Executar build.py
print("\n🔄 EXECUTANDO BUILD.PY...")
os.system("python build.py")