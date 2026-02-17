#!/usr/bin/env python3
"""
Script para limpar arquivos de backup do diretório web/
"""
import os
import re
from pathlib import Path

def limpar_backups():
    print("="*60)
    print("🧹 LIMPANDO ARQUIVOS DE BACKUP")
    print("="*60)
    
    web_dir = Path("web")
    if not web_dir.exists():
        print("❌ Pasta web/ não encontrada")
        return
    
    # Padrões de arquivos de backup
    padroes = [
        r'data_backup_.*\.json',
        r'consolidacao_report_.*\.json',
        r'.*_report_.*\.json',
        r'.*_backup_.*\.json'
    ]
    
    arquivos_removidos = 0
    
    for arquivo in web_dir.iterdir():
        if arquivo.is_file():
            nome = arquivo.name
            for padrao in padroes:
                if re.match(padrao, nome):
                    try:
                        arquivo.unlink()
                        print(f"   ✅ Removido: {nome}")
                        arquivos_removidos += 1
                        break
                    except Exception as e:
                        print(f"   ❌ Erro ao remover {nome}: {e}")
    
    print(f"\n📊 Total: {arquivos_removidos} arquivos de backup removidos")
    print("="*60)

if __name__ == "__main__":
    limpar_backups()
