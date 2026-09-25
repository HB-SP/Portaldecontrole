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

const novo = (!valor || valor === '--tirar') ? null : valor
const r = await c.query(
  'UPDATE competitions SET logo_url = $1 WHERE slug = $2 RETURNING label, logo_url', [novo, slug]
)
if (!r.rows.length) console.error(`Não achei o campeonato "${slug}".`)
else console.log(`${r.rows[0].label}: ${r.rows[0].logo_url || 'voltou a usar as iniciais'}`)
await c.end()
