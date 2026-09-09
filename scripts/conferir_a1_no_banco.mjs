// ─── CONFERE O PAULISTAO A1 CONTRA AS PLANILHAS, LENDO O BANCO ───────────────
// Le o que esta gravado e compara com os dois CSV originais, celula por
// celula. Somente leitura. Chave de servico vem de .env.local.
//
// Uso: node scripts/conferir_a1_no_banco.mjs <csv-operacional> <csv-perifericos>

import { readFileSync } from 'node:fs'

const URL = 'https://buubjnddzsadzcumrvdt.supabase.co'
const env = readFileSync('.env.local', 'utf8').split(/\r?\n/)
const KEY = (env.find(l => /^SUPABASE_SERVICE_KEY=/.test(l)) || '').split('=').slice(1).join('=').trim()
if (!KEY) { console.error('Sem SUPABASE_SERVICE_KEY em .env.local'); process.exit(1) }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }

async function api(c) {
  const r = await fetch(`${URL}/rest/v1/${c}`, { headers: H })
  const t = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${c} :: ${t.slice(0, 200)}`)
  return JSON.parse(t)
}

function parseCSV(t) {
  const rs = []; let r = [], c = '', q = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { c += '"'; i++ }
      else if (ch === '"') q = false
      else c += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { r.push(c); c = '' }
    else if (ch === '\r') { /* ignora */ }
    else if (ch === '\n') { r.push(c); rs.push(r); r = []; c = '' }
    else c += ch
  }
  if (c || r.length) { r.push(c); rs.push(r) }
  return rs
}
const lerCSV = f => parseCSV(readFileSync(f, 'utf8').replace(/^﻿/, ''))
const APELIDO = { 'multvideo.': 'Multvideo', denadai: 'D Nadai', onesolve: 'OneSolve' }
const limpar = v => {
  const s = String(v ?? '').trim()
  if (!s || s === '#VALUE!' || s === '-') return ''
  return APELIDO[s.toLowerCase()] || s
}
const ident = d => [d.rod, d.data, d.mandante, d.visitante].join('|')

// operacional: [indiceCSV, chave]
const OP = [[0, 'rod'], [2, 'data'], [4, 'mandante'], [6, 'visitante'], [1, 'dia'], [3, 'hora_brt'],
  [7, 'estadio'], [8, 'cidade'], [9, 'padrao'], [10, 'detentor'], [32, 'status'],
  [11, 'um'], [12, 'nome_numero'], [13, 'sng'], [14, 'camera_by'], [15, 'gerador'],
  [16, 'um_virtual'], [17, 'supervisor_um_host'], [18, 'liveu'], [19, 'sup_virtual'],
  [20, 'dtv'], [21, 'op_vmix'], [22, 'op_audio'], [23, 'teleporto'], [49, 'um_by'],
  [24, 'service_start_gmt'], [25, 'abertura_brt'], [26, 'service_end_gmt'],
  [27, 'fechamento_brt'], [28, 'total_horas'], [30, 'satelite'], [29, 'banda'], [31, 'reserva'],
  [33, 'transponder'], [34, 'uplink'], [35, 'downlink'], [36, 'satelite_feedb'],
  [38, 'status_feedb'], [37, 'reserva_feedb'], [39, 'transponder_feedb'], [40, 'uplink_feedb'],
  [41, 'downlink_feedb'], [42, 'aspecto'], [43, 'compressao'], [44, 'transmissao'],
  [45, 'modulacao'], [46, 'sr'], [47, 'fec'], [48, 'biss_code']]

// perifericos: cabecalho do CSV -> chave
const PER = { Rod: 'rod', Data: 'data', Mandante: 'mandante', Visitante: 'visitante', Dia: 'dia',
  'Hora (BRT)': 'hora_brt', 'Estádio': 'estadio', Cidade: 'cidade', 'Padrão': 'padrao',
  Detentor: 'detentor', Credenciamento: 'credenciamento', Drone: 'drone',
  'Fornecedor - Drone': 'fornecedor_drone', MiniDrone: 'minidrone',
  'Fornecedor - MiniDrone': 'fornecedor_minidrone', DSLR: 'dslr',
  'Fornecedor - DSLR': 'fornecedor_dslr', 'Qtde. DSLR': 'qtde_dslr', GolCam: 'golcam',
  'Fornecedor GolCam': 'fornecedor_golcam', EarCam: 'earcam',
  'Fornecedor - EarCam': 'fornecedor_earcam', UltraCam: 'ultracam',
  'Fornecedor UltraCam': 'fornecedor_ultracam', Grua: 'grua', 'Fornecedor - Grua': 'fornecedor_grua',
  Carrinho: 'carrinho', 'Fornecedor - Carrinho': 'fornecedor_carrinho', Klover: 'klover',
  'Fornecedor Klover': 'fornecedor_klover', 'Micros Especiais': 'micros_especiais',
  'Fornecedor - Micros': 'fornecedor_micros_especiais', 'Internet LED': 'internet_led',
  'Fornecedor - INTERNET LED': 'fornecedor_internet_led', 'Assinatura Craque': 'assinatura_craque',
  'Cadeirão': 'cadeirao', 'Fornecedor - Cadeirão': 'fornecedor_cadeirao' }

let falhas = 0

async function conferir(slug, rotulo, esperados) {
  const [c] = await api(`competitions?slug=eq.${slug}&select=id,label,section_kind,escala_camps`)
  const cols = await api(`competition_columns?competition_id=eq.${c.id}&select=key,label,type,col_group,sticky,status_color&order=sort_order`)
  const evs = await api(`competition_events?competition_id=eq.${c.id}&select=data,status`)
  console.log(`\n=== ${rotulo} ===`)
  console.log(`  label: ${c.label} | secao: ${c.section_kind} | escala_camps: ${c.escala_camps ?? '(vazio)'}`)
  console.log(`  jogos: ${evs.length} (esperado ${esperados})`)
  if (evs.length !== esperados) { falhas++; console.log('  ^ DIVERGENCIA') }
  const grupos = {}
  cols.forEach(k => { grupos[k.col_group] = (grupos[k.col_group] || 0) + 1 })
  console.log(`  colunas: ${cols.length} em ${Object.keys(grupos).length} grupos`)
  Object.entries(grupos).forEach(([g, n]) => console.log(`     ${g}: ${n}`))
  return { c, cols, evs }
}

const { cols: colsOp, evs: evsOp } = await conferir('paulistao-a1', 'CONTROLE (operacional)', 75)
const { cols: colsPer, evs: evsPer } = await conferir('paulistao-a1-periferico', 'PERIFERICO', 74)

// grupos iguais aos do Brasileirao?
const BR = { Jogo: 10, 'Equipe Técnica': 13, 'Transmissão': 13, 'Técnico': 8, Globo: 6 }
const gOp = {}; colsOp.forEach(k => { gOp[k.col_group] = (gOp[k.col_group] || 0) + 1 })
console.log('\n=== grupos do Controle vs Brasileirao ===')
;[['Jogo', 'Jogo'], ['Equipe Técnica', 'Equipe Técnica'], ['Transmissão', 'Transmissão'],
  ['FEED B', 'Globo'], ['Técnico', 'Técnico']].forEach(([a1, br]) => {
  const n = gOp[a1] ?? 0, e = BR[br]
  const ok = a1 === 'Técnico' ? n === e - 1 : n === e   // Técnico: A1 nao tem ficha_jogo
  console.log(`  ${a1.padEnd(16)} ${n} (Brasileirão ${br}: ${e}) ${ok ? 'OK' : 'DIFERENTE'}`)
  if (!ok) falhas++
})

// equipamentos derivaveis na aba Periferico?
const chaves = new Set(colsPer.map(k => k.key))
const equip = colsPer.filter(k => k.type === 'simnao')
console.log(`\n=== equipamentos que a aba Periferico vai mostrar: ${equip.length} ===`)
equip.forEach(k => {
  const f = chaves.has(`fornecedor_${k.key}`) ? `fornecedor_${k.key}` : '(sem fornecedor)'
  console.log(`  ${k.label.padEnd(18)} -> ${f}`)
})
if (equip.length !== 13) { falhas++; console.log('  ^ esperado 13') }

// ── comparacao celula por celula com os CSV ──
function compara(rotulo, evs, linhas, mapa, porIndice) {
  const porId = new Map(evs.map(e => [ident(e.data || {}), e]))
  let cel = 0, err = 0, semPar = 0
  linhas.forEach((r, i) => {
    const idBase = porIndice
      ? [limpar(r[0]), limpar(r[2]), limpar(r[4]), limpar(r[6])]
      : [limpar(r.Rod), limpar(r.Data), limpar(r.Mandante), limpar(r.Visitante)]
    const e = porId.get(idBase.join('|'))
    if (!e) { semPar++; return }
    const pares = porIndice ? mapa : Object.entries(mapa)
    for (const par of pares) {
      const [origem, chave] = par
      const querido = limpar(porIndice ? r[origem] : r[origem])
      const gravado = chave === 'status' ? (e.status ?? '') : ((e.data || {})[chave] ?? '')
      if (querido) cel++
      if (querido !== gravado) {
        err++
        if (err <= 8) console.log(`   linha ${i + 2} ${chave}: planilha "${querido}" / banco "${gravado}"`)
      }
    }
  })
  console.log(`\n=== ${rotulo}: ${cel} celulas com conteudo, ${err} divergentes, ${semPar} sem par no banco ===`)
  if (err || semPar) falhas++
}

const rowsOp = lerCSV(process.argv[2])
compara('CONTROLE vs planilha operacional', evsOp,
  rowsOp.slice(1).filter(r => String(r[4] ?? '').trim() && String(r[6] ?? '').trim()), OP, true)

const rowsPer = lerCSV(process.argv[3])
const HPer = rowsPer[0].map(h => h.trim())
const objsPer = rowsPer.slice(1)
  .map(r => { const o = {}; HPer.forEach((h, i) => { o[h] = (r[i] ?? '').trim() }); return o })
  .filter(o => o.Mandante && o.Visitante)
compara('PERIFERICO vs planilha de perifericos', evsPer, objsPer, PER, false)

console.log(falhas === 0
  ? '\n>>> TUDO CONFERE — nada divergente.'
  : `\n>>> ${falhas} verificacao(oes) com problema.`)
process.exit(falhas === 0 ? 0 : 1)
