// ─── ONDE A PLANILHA E O BANCO DISCORDAM ─────────────────────────────────────
// O import tem dois modos: preencher só o que falta, ou sobrescrever tudo.
// A diferença entre os dois são as células em que os DOIS LADOS têm valor, e
// valores diferentes — e essas merecem ser olhadas, não aplicadas no escuro.
// Uma discordância assim é uma de três coisas:
//   · alguém editou pela tela depois da última importação
//   · a planilha mudou e o banco ficou para trás
//   · a mesma pessoa está escrita de dois jeitos
//
// Uso: node scripts/conferir_escala_csv.mjs <csv>

import { readFileSync } from 'node:fs'

const BASE = 'https://buubjnddzsadzcumrvdt.supabase.co'
const KEY = (readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .find(l => /^SUPABASE_SERVICE_KEY=/.test(l)) || '').split('=').slice(1).join('=').trim()
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }

const arquivo = process.argv.slice(2).find(a => !a.startsWith('--'))
if (!arquivo) { console.error('Passe o caminho do CSV.'); process.exit(1) }

function parseCsv(texto) {
  const linhas = []
  let linha = [], campo = '', dentro = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (dentro) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') dentro = false
      else campo += c
    } else if (c === '"') dentro = true
    else if (c === ',') { linha.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      linha.push(campo); campo = ''
      linhas.push(linha); linha = []
    } else campo += c
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha) }
  return linhas
}

const IDX = {
  campeonato: 1, data: 4, mandante: 8, visitante: 9,
  coordenador_um: 16, coordenador_um_valor: 17,
  produtor_um: 18, produtor_um_valor: 19,
  produtor_campo: 20, producao_executiva: 21, monitoracao: 22,
}
const FUNCOES = ['coordenador_um', 'coordenador_um_valor', 'produtor_um',
  'produtor_um_valor', 'produtor_campo', 'producao_executiva', 'monitoracao']
const ROTULO = {
  coordenador_um: 'Coordenador UM', coordenador_um_valor: 'valor do Coordenador',
  produtor_um: 'Produtor UM', produtor_um_valor: 'valor do Produtor UM',
  produtor_campo: 'Produtor de Campo', producao_executiva: 'Produção Executiva',
  monitoracao: 'Monitoração',
}

const norm = s => String(s || '').trim().toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')
const chave = r => [r.campeonato, r.data, r.mandante, r.visitante].map(norm).join('|')
const CAMP_PADRAO = { br26: 'Brasileirão 26', 'pfem 26': 'Paulistão F 26', 'serie b': 'Série B 26' }

const linhas = parseCsv(readFileSync(arquivo, 'utf8'))
const doCsv = new Map()
for (const l of linhas.slice(1)) {
  const reg = {}
  for (const [col, i] of Object.entries(IDX)) reg[col] = String(l[i] ?? '').trim()
  reg.campeonato = CAMP_PADRAO[norm(reg.campeonato)] || reg.campeonato
  if (!reg.campeonato || !reg.mandante) continue
  if (/legenda/i.test(l.join(','))) continue
  doCsv.set(chave(reg), reg)
}

const banco = await (await fetch(`${BASE}/rest/v1/escala_geral?select=*`, { headers: H })).json()

const porCampo = new Map()
const casos = []
for (const r of banco) {
  const doLado = doCsv.get(chave(r))
  if (!doLado) continue
  for (const k of FUNCOES) {
    const aqui = String(r[k] ?? '').trim()
    const la = String(doLado[k] ?? '').trim()
    // Só interessa quando os DOIS têm valor e eles diferem.
    if (!aqui || !la || aqui === la) continue
    porCampo.set(k, (porCampo.get(k) || 0) + 1)
    casos.push({ campo: k, jogo: `${r.campeonato} ${r.data} ${r.mandante} x ${r.visitante}`, banco: aqui, csv: la })
  }
}

console.log(`${casos.length} células em que os dois lados têm valor, e são diferentes\n`)
console.log('POR COLUNA:')
for (const [k, n] of [...porCampo.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(ROTULO[k] || k).padEnd(24)} ${n}`)
}

console.log('\nEXEMPLOS:')
for (const c of casos.slice(0, 18)) {
  console.log(`  ${ROTULO[c.campo] || c.campo}`)
  console.log(`     ${c.jogo}`)
  console.log(`     banco: "${c.banco}"`)
  console.log(`     csv:   "${c.csv}"`)
}
