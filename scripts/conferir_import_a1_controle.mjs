// Le o SQL operacional de volta e compara com o CSV, celula por celula.
import { readFileSync } from 'node:fs'

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

// indice do CSV -> chave gravada (mesmo mapa do gerador, por INDICE)
const MAPA = [
  [0, 'rod'], [2, 'data'], [4, 'mandante'], [6, 'visitante'], [1, 'dia'], [3, 'hora_brt'],
  [7, 'estadio'], [8, 'cidade'], [9, 'padrao'], [10, 'detentor'], [32, 'status'],
  [11, 'um'], [12, 'nome_numero'], [13, 'sng'], [14, 'camera_by'], [15, 'gerador'],
  [16, 'um_virtual'], [17, 'supervisor_um_host'], [18, 'liveu'], [19, 'sup_virtual'],
  [20, 'dtv'], [21, 'op_vmix'], [22, 'op_audio'], [23, 'teleporto'], [49, 'um_by'],
  [24, 'service_start_gmt'], [25, 'abertura_brt'], [26, 'service_end_gmt'],
  [27, 'fechamento_brt'], [28, 'total_horas'],
  [30, 'satelite'], [29, 'banda'], [31, 'reserva'], [33, 'transponder'], [34, 'uplink'], [35, 'downlink'],
  [36, 'satelite_feedb'], [37, 'reserva_feedb'], [38, 'status_feedb'],
  [39, 'transponder_feedb'], [40, 'uplink_feedb'], [41, 'downlink_feedb'],
  [42, 'aspecto'], [43, 'compressao'], [44, 'transmissao'], [45, 'modulacao'],
  [46, 'sr'], [47, 'fec'], [48, 'biss_code'],
]
const APELIDO = { 'multvideo.': 'Multvideo' }
const limpar = v => {
  const s = String(v ?? '').trim()
  if (!s || s === '#VALUE!' || s === '-') return ''
  return APELIDO[s.toLowerCase()] || s
}

// ── extrai (data, status) do SQL ──
const sql = readFileSync(process.argv[3], 'utf8')
const trecho = sql.slice(sql.indexOf('INSERT INTO competition_events (competition_id, data, status)'))
const doSql = []
for (const linha of trecho.split('\n')) {
  const m = linha.match(/^ {2}\('(\{.*\})',\s*'([^']*(?:''[^']*)*)'\),?$/)
  if (!m) continue
  const bruto = m[1].split("''").join("'")
  const st = m[2].split("''").join("'")
  try { doSql.push({ d: JSON.parse(bruto), status: st }) }
  catch { console.log('JSON INVALIDO:', bruto.slice(0, 140)); process.exitCode = 1 }
}

// ── le o CSV ──
const rows = parseCSV(readFileSync(process.argv[2], 'utf8').replace(/^﻿/, ''))
const jogos = rows.slice(1).filter(r => String(r[4] ?? '').trim() && String(r[6] ?? '').trim())

console.log(`jogos no CSV: ${jogos.length}  |  jogos no SQL: ${doSql.length}`)
if (jogos.length !== doSql.length) { console.log('DIVERGENCIA na contagem'); process.exitCode = 1 }

let comConteudo = 0, erros = 0
jogos.forEach((r, i) => {
  const s = doSql[i]; if (!s) return
  for (const [idx, chave] of MAPA) {
    const querido = limpar(r[idx])
    // status mora fora do JSONB
    const gravado = chave === 'status' ? (s.status ?? '') : (s.d[chave] ?? '')
    if (querido) comConteudo++
    if (querido !== gravado) {
      erros++
      if (erros <= 10) console.log(`  linha ${i + 2} ${chave}: esperado "${querido}" / gravado "${gravado}"`)
    }
  }
})
console.log(`celulas com conteudo: ${comConteudo}`)
console.log(erros === 0 ? 'CONFERE: toda celula do CSV esta no SQL, identica.' : `FALHA: ${erros} divergentes`)
if (erros) process.exitCode = 1

// status deve estar FORA do JSONB
const vazouStatus = doSql.filter(s => 'status' in s.d).length
console.log(`status indevidamente dentro do JSONB: ${vazouStatus}`)
if (vazouStatus) process.exitCode = 1

const comStatus = doSql.filter(s => s.status).length
console.log(`jogos com status preenchido: ${comStatus}`)
const acentos = doSql.filter(s => /[áàâãéêíóôõúüçÁÉÊÍÓÔÕÚÇ]/.test(JSON.stringify(s.d))).length
console.log(`jogos com acento preservado: ${acentos}`)
const desbal = trecho.split('\n').filter(l => /^ {2}\('\{/.test(l)).filter(l => (l.split("'").length - 1) % 2 !== 0)
console.log(`linhas com aspas desbalanceadas: ${desbal.length}`)
if (desbal.length) process.exitCode = 1
