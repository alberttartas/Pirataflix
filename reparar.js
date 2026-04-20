const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE = path.join(__dirname, 'input', 'Novelas');
const CACHE_FILE = path.join(__dirname, 'cache.json');

// 🔥 lista de hosts conhecidos
const HOSTS = [
  'lwqde8tgxh4n76i',
  'crew3b5943fmmi9',
  'cbb87jx3ss9597i',
  'mcnd3jbm3ye91yu'
  'wscuh2cjilknbj3'
];

// ----------------------------

function carregarCache() {
  if (!fs.existsSync(CACHE_FILE)) return {};
  return JSON.parse(fs.readFileSync(CACHE_FILE));
}

function salvarCache(cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function extrairPath(url) {
  const match = url.match(/https:\/\/[a-z0-9]+\.cdn-novflix\.com(.*)/);
  return match ? match[1] : null;
}

function testarUrl(url) {
  return new Promise(resolve => {
    const req = https.get(url, res => {
      resolve(res.statusCode === 200 || res.statusCode === 206);
    });

    req.on('error', () => resolve(false));

    req.setTimeout(4000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function descobrirHost(primeiraUrl, cacheHost) {
  const pathFinal = extrairPath(primeiraUrl);

  // ⚡ tenta cache primeiro
  if (cacheHost) {
    const teste = `https://${cacheHost}.cdn-novflix.com${pathFinal}`;
    const ok = await testarUrl(teste);

    if (ok) {
      console.log(`⚡ Usando cache: ${cacheHost}`);
      return cacheHost;
    }
  }

  // 🔁 tenta lista
  for (const host of HOSTS) {
    const teste = `https://${host}.cdn-novflix.com${pathFinal}`;

    console.log(`🔍 Testando host: ${host}`);

    const ok = await testarUrl(teste);

    if (ok) {
      console.log(`✅ Funcionou: ${host}`);
      return host;
    }
  }

  return null;
}

async function corrigirArquivo(filePath, nomeNovela, cache) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const linhas = content.split('\n');

  const primeiraUrl = linhas.find(l => l.startsWith('http'));

  if (!primeiraUrl) {
    console.log(`❌ Sem links: ${filePath}`);
    return;
  }

  const host = await descobrirHost(primeiraUrl, cache[nomeNovela]);

  if (!host) {
    console.log(`❌ Nenhum host válido para ${nomeNovela}`);
    return;
  }

  // 💾 salva cache
  cache[nomeNovela] = host;

  // 🔧 corrige
  content = content.replace(
    /https:\/\/[a-z0-9]+\.cdn-novflix\.com/g,
    `https://${host}.cdn-novflix.com`
  );

  fs.writeFileSync(filePath, content);

  console.log(`🎉 Corrigido: ${nomeNovela}`);
}

async function run() {
  const cache = carregarCache();

  const novelas = fs.readdirSync(BASE, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const novela of novelas) {
    const pasta = path.join(BASE, novela);
    const arquivos = fs.readdirSync(pasta).filter(f => f.endsWith('.m3u'));

    for (const file of arquivos) {
      const filePath = path.join(pasta, file);

      console.log(`\n📺 ${novela}/${file}`);

      await corrigirArquivo(filePath, novela, cache);
    }
  }

  salvarCache(cache);

  console.log('\n🚀 Tudo atualizado!');
}

run();
