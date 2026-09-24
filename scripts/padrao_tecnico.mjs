// ─── DESCOBRE O PADRÃO TÉCNICO DE CADA CAMPEONATO ────────────────────────────
// Ninguém precisa digitar o padrão: ele já está escrito nos jogos que existem.
// Este script olha todos eles e, para cada campo, pergunta uma coisa só — "este
// campo tem UM valor em todas as linhas?". Se tem, aquele valor é o padrão do
// campeonato.
//
// Campos com dois ou mais valores ficam de fora, porque são do jogo e não do
// campeonato. E os de HORÁRIO também, mesmo quando batem: eles mudam quando a
// tabela muda, e nascer com o horário do jogo passado é pior que nascer vazio.
//
// Uso:
//   node scripts/padrao_tecnico.mjs            # mostra o que achou
//   node scripts/padrao_tecnico.mjs --gravar

import { readFileSync } from 'node:fs'
import pg from 'pg'

const url = (readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .find(l => l.startsWith('DATABASE_URL=')) || '').slice(13)
const GRAVAR = process.argv.includes('--gravar')

// O que pode virar padrão. Fora daqui, nada é copiado — nome de time, data,
// reserva e BISS são do jogo, e um jogo novo nascer com o BISS do anterior
// seria pior que nascer vazio.
const CANDIDATOS = new Set([
  'teleporto', 'satelite', 'banda', 'aspecto', 'compressao', 'transmissao',
  'modulacao', 'sr', 'symbol_rate', 'fec', 'total_horas', 'total_de_horas',
  'audio_1_2', 'audio_3_4',
  // 'detentor', 'gerador', 'um' e 'padrao' FICARAM DE FORA: eles calharam de
  // ser iguais em alguns campeonatos, mas sao do jogo, nao regra tecnica
  // (equipe, 24/09/2026). Campo que hoje nao varia por acaso volta a variar
  // amanha, e ai o jogo novo ja nasce com a resposta errada.
])

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await c.connect()

const comps = (await c.query(
  'SELECT id, slug, label, legacy_table FROM competitions ORDER BY sort_order'
)).rows

// Um valor só em todas as linhas = padrão. Linha vazia não conta contra: um
// campo preenchido em 40 de 60 jogos, sempre igual, ainda é o padrão.
function unico(valores) {
  const vistos = new Set()
  for (const v of valores) {
    const t = String(v ?? '').trim()
    if (t) vistos.add(t)
    if (vistos.size > 1) return null
  }
  return vistos.size === 1 ? [...vistos][0] : null
}

for (const comp of comps) {
  let linhas = []
  let campos = []

  if (comp.legacy_table) {
    campos = (await c.query(
      'SELECT column_name FROM information_schema.columns WHERE table_name = $1', [comp.legacy_table]
    )).rows.map(r => r.column_name).filter(k => CANDIDATOS.has(k))
    if (!campos.length) campos = []
    linhas = (await c.query(`SELECT ${campos.join(', ')} FROM ${comp.legacy_table}`)).rows
  } else {
    campos = (await c.query(
      'SELECT key FROM competition_columns WHERE competition_id = $1', [comp.id]
    )).rows.map(r => r.key).filter(k => CANDIDATOS.has(k))
    if (!campos.length) campos = []
    linhas = (await c.query(
      'SELECT data FROM competition_events WHERE competition_id = $1', [comp.id]
    )).rows.map(r => r.data || {})
  }

  if (!linhas.length) { console.log(`\n${comp.label}: sem jogos`); continue }

  const padrao = {}
  for (const k of campos) {
    const v = unico(linhas.map(l => l[k]))
    if (v !== null) padrao[k] = v
  }

  console.log(`\n══ ${comp.label} — ${linhas.length} jogos ══`)
  const achou = Object.keys(padrao).length
  if (achou) for (const [k, v] of Object.entries(padrao)) console.log(`   ${k.padEnd(18)} ${v}`)
  else console.log('   nada é igual em todos')

  // Grava SEMPRE, inclusive o vazio. Pular quando não acha nada deixaria o
  // padrão anterior no lugar — foi assim que 'detentor' e 'gerador' ficaram
  // para trás depois de saírem da lista de candidatos.
  if (GRAVAR) {
    await c.query('UPDATE competitions SET padrao_tecnico = $1 WHERE id = $2', [achou ? padrao : null, comp.id])
  }
}

console.log(GRAVAR ? '\ngravado.' : '\n(simulação — passe --gravar)')
await c.end()
