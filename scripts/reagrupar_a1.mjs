// ─── REAGRUPA AS COLUNAS DO CONTROLE DO PAULISTAO A1 ─────────────────────────
// Pedido: separar PESSOAL (quem) de OPERACOES (o que), com PERIFERICO em
// coluna propria (essa vem da secao irma, ver usePerifericoIrmao) e TRANSMISSAO
// com o satelite e o resto tecnico.
//
// Os grupos das colunas sao o que a Visao Geral transforma em painel, entao
// mudar aqui muda a tela. Somente dados — nenhum codigo depende dos nomes,
// exceto 'Pessoal', que faz as funcoes da Escala Geral entrarem nesse painel
// (ver GRUPO_PESSOAL em JogosOverview).
//
// Uso: node scripts/reagrupar_a1.mjs [--conferir]

import { readFileSync } from 'node:fs'

const URL = 'https://buubjnddzsadzcumrvdt.supabase.co'
const SLUG = 'paulistao-a1'
const KEY = (readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .find(l => /^SUPABASE_SERVICE_KEY=/.test(l)) || '').split('=').slice(1).join('=').trim()
if (!KEY) { console.error('Sem SUPABASE_SERVICE_KEY em .env.local'); process.exit(1) }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

async function api(caminho, opcoes = {}) {
  const r = await fetch(`${URL}/rest/v1/${caminho}`, { ...opcoes, headers: { ...H, ...(opcoes.headers || {}) } })
  const t = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${caminho} :: ${t.slice(0, 300)}`)
  return t ? JSON.parse(t) : null
}

// Ordem dos paineis = ordem daqui. Dentro de cada um, a ordem das chaves.
const PLANO = [
  ['Jogo', ['rod', 'data', 'mandante', 'visitante', 'dia', 'hora_brt', 'estadio', 'cidade', 'padrao', 'detentor']],
  ['Pessoal', ['supervisor_um_host', 'sup_virtual', 'dtv', 'op_vmix', 'op_audio']],
  ['Operações', ['um', 'nome_numero', 'um_virtual', 'um_by', 'camera_by', 'sng', 'gerador', 'liveu']],
  ['Transmissão', [
    'teleporto', 'satelite', 'banda', 'status', 'reserva', 'transponder', 'uplink', 'downlink',
    'service_start_gmt', 'abertura_brt', 'service_end_gmt', 'fechamento_brt', 'total_horas',
    'satelite_feedb', 'status_feedb', 'reserva_feedb', 'transponder_feedb', 'uplink_feedb', 'downlink_feedb',
    'aspecto', 'compressao', 'transmissao', 'modulacao', 'sr', 'fec', 'biss_code',
  ]],
]

const [comp] = await api(`competitions?slug=eq.${SLUG}&select=id,label`)
if (!comp) { console.error(`campeonato ${SLUG} nao encontrado`); process.exit(1) }
const atuais = await api(`competition_columns?competition_id=eq.${comp.id}&select=key,label,col_group,sort_order&order=sort_order`)
console.log(`${comp.label}: ${atuais.length} colunas hoje`)

// Toda coluna do banco tem que estar no plano, e vice-versa — senao alguma
// ficaria sem grupo (invisivel na Visao Geral) ou eu erraria uma chave.
const noPlano = PLANO.flatMap(([, ks]) => ks)
const noBanco = atuais.map(c => c.key)
const faltando = noBanco.filter(k => !noPlano.includes(k))
const sobrando = noPlano.filter(k => !noBanco.includes(k))
if (faltando.length) { console.error('colunas do banco fora do plano:', faltando.join(', ')); process.exit(1) }
if (sobrando.length) { console.error('chaves do plano que nao existem no banco:', sobrando.join(', ')); process.exit(1) }
if (new Set(noPlano).size !== noPlano.length) { console.error('chave repetida no plano'); process.exit(1) }
console.log('plano cobre exatamente as colunas do banco: OK\n')

const alvo = new Map()
let ordem = 0
for (const [grupo, chaves] of PLANO) {
  for (const k of chaves) { ordem += 10; alvo.set(k, { col_group: grupo, sort_order: ordem }) }
}

const mudar = atuais.filter(c => {
  const a = alvo.get(c.key)
  return c.col_group !== a.col_group || c.sort_order !== a.sort_order
})
console.log(`a mudar: ${mudar.length} de ${atuais.length}`)
mudar.slice(0, 60).forEach(c => {
  const a = alvo.get(c.key)
  console.log(`  ${c.key.padEnd(20)} ${String(c.col_group).padEnd(16)} -> ${a.col_group}`)
})

if (process.argv.includes('--conferir')) { console.log('\n(modo conferir — nada gravado)'); process.exit(0) }
if (!mudar.length) { console.log('nada a fazer'); process.exit(0) }

for (const c of mudar) {
  const a = alvo.get(c.key)
  await api(`competition_columns?competition_id=eq.${comp.id}&key=eq.${encodeURIComponent(c.key)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(a),
  })
}
console.log(`\ngravado. ${mudar.length} colunas reagrupadas.`)

const depois = await api(`competition_columns?competition_id=eq.${comp.id}&select=key,col_group&order=sort_order`)
const cont = {}
depois.forEach(c => { cont[c.col_group] = (cont[c.col_group] || 0) + 1 })
console.log('\ngrupos agora (na ordem em que aparecem):')
const vistos = new Set()
depois.forEach(c => { if (!vistos.has(c.col_group)) { vistos.add(c.col_group); console.log(`  ${c.col_group}: ${cont[c.col_group]}`) } })
