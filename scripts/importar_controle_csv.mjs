// ─── ACRESCENTA JOGOS DE UMA PLANILHA DE CONTROLE ────────────────────────────
// Só INSERE o que falta. Jogo que já está no banco não é tocado: a planilha é
// baixada num momento e o Portal é editado depois, então sobrescrever apagaria
// o que foi corrigido na tela.
//
// As colunas casam pelo NOME do cabeçalho, normalizado — "Hora (BRT)" encontra
// `hora_brt`, "Op Vmix" encontra `op_vmix`. O que não casa é listado em vez de
// sumir em silêncio: coluna nova na planilha é notícia, não detalhe.
//
// Uso:
//   node scripts/importar_controle_csv.mjs <tabela> <csv>
//   node scripts/importar_controle_csv.mjs <tabela> <csv> --gravar

import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = readFileSync('.env.local', 'utf8').split(/\r?\n/)
const url = (env.find(l => l.startsWith('DATABASE_URL=')) || '').slice(13)

const args = process.argv.slice(2)
const GRAVAR = args.includes('--gravar')
const [tabela, arquivo] = args.filter(a => !a.startsWith('--'))
if (!tabela || !arquivo) {
  console.error('Uso: node scripts/importar_controle_csv.mjs <tabela> <csv> [--gravar]')
  process.exit(1)
}

function parseCsv(t) {
  const L = []; let r = [], c = '', q = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (q) { if (ch === '"' && t[i + 1] === '"') { c += '"'; i++ } else if (ch === '"') q = false; else c += ch }
    else if (ch === '"') q = true
    else if (ch === ',') { r.push(c); c = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; r.push(c); c = ''; L.push(r); r = [] }
    else c += ch
  }
  if (c !== '' || r.length) { r.push(c); L.push(r) }
  return L
}

const norm = s => String(s || '').trim().toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')
// "Hora (BRT)" → hora_brt ; "Op. Vmix" → op_vmix ; "Audio 1/2" → audio_1_2 ;
// "Fornecedor - Drone" → fornecedor_drone
const comoColuna = s => norm(s).replace(/[()./-]/g, ' ').trim().replace(/\s+/g, '_')

// A data no banco às vezes tem ano e às vezes não: comparar sem ele.
const soData = d => String(d || '').trim().replace(/\/\d{4}$/, '')
const chave = (d, m, v) => [soData(d), norm(m), norm(v)].join('|')

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await c.connect()

const colunas = (await c.query(
  'SELECT column_name FROM information_schema.columns WHERE table_name = $1', [tabela]
)).rows.map(r => r.column_name)
if (!colunas.length) { console.error(`Tabela ${tabela} não existe.`); process.exit(1) }

// Sinônimos: o cabeçalho da planilha nem sempre vira o nome da coluna sozinho.
// "Rodada" é o caso mais torto — no Brasileirão a coluna chama `eu`, no
// Feminino chama `rod`, e as duas guardam a mesma coisa.
const APELIDO = {
  rodada: 'eu', rod: 'eu', 'op_vmix': 'op_vmix', 'op_audio': 'op_audio',
  'service_start_gmt': 'service_start_gmt', 'service_end_gmt': 'service_end_gmt',
  'supervisor_um_host': 'supervisor_um_host', 'biss_code': 'biss_code',
  'uplink_g': 'uplink_g', 'satelite_globo': 'satelite_globo',
  total_de_horas: 'total_horas', earcam: 'refcam',
}

const L = parseCsv(readFileSync(arquivo, 'utf8'))
const cab = L[0].map(x => x.trim())
const mapa = [], semPar = []
cab.forEach((rot, i) => {
  if (!rot || rot === 'x') return
  const k = comoColuna(rot)
  const destino = colunas.includes(k) ? k
    : colunas.includes(APELIDO[k]) ? APELIDO[k]
    // "Rodada": tenta `eu` e, não havendo, `rod`
    : (k === 'rodada' && colunas.includes('rod')) ? 'rod'
    : colunas.find(col => col === k.replace(/_/g, '')) || null
  if (destino) mapa.push({ i, rot, destino })
  else semPar.push(rot)
})

const iM = cab.findIndex(x => /^mandante/i.test(x))
const iV = cab.findIndex(x => /^visitante/i.test(x))
const iD = cab.findIndex(x => /^data/i.test(x))
const jogos = L.slice(1).filter(l => String(l[iM] || '').trim() && String(l[iV] || '').trim())

const banco = (await c.query(`SELECT data, mandante, visitante FROM ${tabela}`)).rows
const existe = new Set(banco.map(r => chave(r.data, r.mandante, r.visitante)))

const novos = []
for (const l of jogos) {
  if (existe.has(chave(l[iD], l[iM], l[iV]))) continue
  const reg = {}
  for (const { i, destino } of mapa) {
    const v = String(l[i] ?? '').trim()
    if (v) reg[destino] = v
  }
  novos.push(reg)
}

console.log(`\n══ ${tabela} ══`)
console.log(`   banco ${banco.length} · planilha ${jogos.length} · ${mapa.length} colunas casadas`)
if (semPar.length) console.log(`   colunas da planilha SEM par na tabela: ${semPar.join(', ')}`)
console.log(`   a inserir: ${novos.length}`)
novos.forEach(r => console.log(`      + ${r.data} ${r.mandante} x ${r.visitante}`))

if (!GRAVAR) { console.log('\n(simulação — passe --gravar)'); await c.end(); process.exit(0) }
if (!novos.length) { console.log('\nnada a fazer.'); await c.end(); process.exit(0) }

for (const reg of novos) {
  const cols = Object.keys(reg)
  const vals = cols.map((_, i) => `$${i + 1}`).join(', ')
  await c.query(`INSERT INTO ${tabela} (${cols.join(', ')}) VALUES (${vals})`, Object.values(reg))
}
console.log(`\n${novos.length} inseridos.`)
await c.end()
