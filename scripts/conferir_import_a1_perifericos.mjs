// Le o SQL gerado DE VOLTA e compara com o CSV original, celula por celula.
// Se o gerador tiver corrompido acento, aspas ou perdido campo, aparece aqui.
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

const CSV_DE = {
  rod: 'Rod', data: 'Data', mandante: 'Mandante', visitante: 'Visitante', dia: 'Dia',
  hora_brt: 'Hora (BRT)', estadio: 'Estádio', cidade: 'Cidade', padrao: 'Padrão',
  detentor: 'Detentor', credenciamento: 'Credenciamento', drone: 'Drone',
  fornecedor_drone: 'Fornecedor - Drone', minidrone: 'MiniDrone',
  fornecedor_minidrone: 'Fornecedor - MiniDrone', dslr: 'DSLR',
  fornecedor_dslr: 'Fornecedor - DSLR', qtde_dslr: 'Qtde. DSLR', golcam: 'GolCam',
  fornecedor_golcam: 'Fornecedor GolCam', earcam: 'EarCam',
  fornecedor_earcam: 'Fornecedor - EarCam', ultracam: 'UltraCam',
  fornecedor_ultracam: 'Fornecedor UltraCam', grua: 'Grua',
  fornecedor_grua: 'Fornecedor - Grua', carrinho: 'Carrinho',
  fornecedor_carrinho: 'Fornecedor - Carrinho', klover: 'Klover',
  fornecedor_klover: 'Fornecedor Klover', micros_especiais: 'Micros Especiais',
  fornecedor_micros: 'Fornecedor - Micros', internet_led: 'Internet LED',
  fornecedor_internet_led: 'Fornecedor - INTERNET LED',
  assinatura_craque: 'Assinatura Craque', cadeirao: 'Cadeirão',
  fornecedor_cadeirao: 'Fornecedor - Cadeirão',
}
const APELIDO = { denadai: 'D Nadai', onesolve: 'OneSolve' }
const limpar = v => {
  const s = String(v ?? '').trim()
  if (!s || s === '#VALUE!' || s === '-') return ''
  return APELIDO[s.toLowerCase()] || s
}

// ── 1) Extrai os blocos JSON do SQL, desfazendo o escape de aspas simples ──
const sql = readFileSync(process.argv[3], 'utf8')
const trecho = sql.slice(sql.indexOf('INSERT INTO competition_events'))
const doSql = []
for (const linha of trecho.split('\n')) {
  const m = linha.match(/^ {2}\('(\{.*\})'\),?$/)
  if (m) {
    let bruto = m[1].split("''").join("'")
    try { doSql.push(JSON.parse(bruto)) }
    catch (e) { console.log('JSON INVALIDO:', bruto.slice(0, 120)); process.exitCode = 1 }
  }
}

// ── 2) Le o CSV do zero ──
const rows = parseCSV(readFileSync(process.argv[2], 'utf8').replace(/^﻿/, ''))
const H = rows[0].map(h => h.trim())
const doCsv = rows.slice(1)
  .filter(r => r.some(c => String(c).trim()))
  .map(r => { const o = {}; H.forEach((h, i) => { o[h] = (r[i] ?? '').trim() }); return o })
  .filter(o => o['Mandante'] && o['Visitante'])

console.log(`jogos no CSV: ${doCsv.length}  |  jogos no SQL: ${doSql.length}`)
if (doCsv.length !== doSql.length) { console.log('DIVERGENCIA na contagem'); process.exitCode = 1 }

// ── 3) Compara celula por celula ──
let celulas = 0, erros = 0, esperadas = 0
doCsv.forEach((c, i) => {
  const s = doSql[i]
  if (!s) return
  for (const [chave, cab] of Object.entries(CSV_DE)) {
    const querido = limpar(c[cab])
    const gravado = s[chave] ?? ''
    esperadas++
    if (querido) celulas++
    if (querido !== gravado) {
      erros++
      if (erros <= 10) console.log(`  linha ${i + 2} campo ${chave}: esperado "${querido}" / gravado "${gravado}"`)
    }
  }
})
console.log(`celulas com conteudo: ${celulas} (de ${esperadas} possiveis)`)
console.log(erros === 0
  ? 'CONFERE: toda celula do CSV esta no SQL, identica.'
  : `FALHA: ${erros} celulas divergentes`)
if (erros) process.exitCode = 1

// ── 4) Acentos preservados? ──
const acentos = doSql.filter(o => /[áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/.test(JSON.stringify(o))).length
console.log(`jogos com acento preservado: ${acentos}`)

// ── 5) Aspas simples no SQL estao balanceadas? ──
const linhasDados = trecho.split('\n').filter(l => /^ {2}\('\{/.test(l))
const desbalanceadas = linhasDados.filter(l => (l.split("'").length - 1) % 2 !== 0)
console.log(`linhas de dados: ${linhasDados.length} | com aspas desbalanceadas: ${desbalanceadas.length}`)
if (desbalanceadas.length) process.exitCode = 1
