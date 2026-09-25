// ─── APONTA A LOGO DE UM CAMPEONATO ──────────────────────────────────────────
// O banco guarda o ENDEREÇO da imagem, não a imagem. Assim trocar a logo é
// trocar um arquivo, sem migração de dado.
//
// Uso:
//   node scripts/logo_campeonato.mjs                             # lista
//   node scripts/logo_campeonato.mjs brasileirao /campeonatos/br.png
//   node scripts/logo_campeonato.mjs brasileirao --tirar

import { readFileSync } from 'node:fs'
import pg from 'pg'

const url = (readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .find(l => l.startsWith('DATABASE_URL=')) || '').slice(13)
const [slug, valor] = process.argv.slice(2)

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await c.connect()

if (!slug) {
  const r = await c.query('SELECT slug, label, logo_url FROM competitions ORDER BY sort_order')
  console.log('CAMPEONATO           SLUG                  LOGO')
  for (const x of r.rows) {
    console.log(`  ${String(x.label).padEnd(20)} ${String(x.slug).padEnd(22)} ${x.logo_url || '— usa as iniciais'}`)
  }
  await c.end()
  process.exit(0)
}

// O Git Bash troca um caminho que comeca com "/" por um caminho do Windows
// antes mesmo de o Node ver o argumento: "/campeonatos/ffu.png" chega aqui
// como "C:/Users/.../campeonatos/ffu.png", e o banco guarda um endereco que
// nenhum navegador consegue abrir. Gravou calado em 25/09/2026.
if (/^[A-Za-z]:[\/]/.test(valor || '')) {
  console.error(`O caminho chegou convertido: ${valor}

  Isso e o Git Bash mexendo no argumento. Rode de novo assim:
    MSYS_NO_PATHCONV=1 node scripts/logo_campeonato.mjs ${slug} /campeonatos/arquivo.png`)
  process.exit(1)
}

const novo = (!valor || valor === '--tirar') ? null : valor
const r = await c.query(
  'UPDATE competitions SET logo_url = $1 WHERE slug = $2 RETURNING label, logo_url', [novo, slug]
)
if (!r.rows.length) console.error(`Não achei o campeonato "${slug}".`)
else console.log(`${r.rows[0].label}: ${r.rows[0].logo_url || 'voltou a usar as iniciais'}`)
await c.end()
