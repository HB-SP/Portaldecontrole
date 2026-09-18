// ─── A CONTA DE FOLGAS CONTRA A PRÓPRIA PLANILHA ─────────────────────────────
// A planilha do Sinal Inter fecha cada mês com uma linha "FOLGA" que traz, por
// pessoa, dois números: quantas folgas ela tinha DE DIREITO e quantas USOU.
// Isso é gabarito escrito pela própria equipe — melhor que qualquer número que
// eu inventasse para testar.
//
// Este script recalcula os dois com src/lib/folgas.js, a partir do que está no
// BANCO, e compara mês a mês. Diferença aqui é diferença de regra, e precisa
// ser explicada, não arredondada.
//
// Uso: node --import ./scripts/resolver_ext.mjs scripts/testa_folgas.mjs

import { readFileSync } from 'node:fs'
import { saldoDoMes, iso } from '../src/lib/folgas.js'

const BASE = 'https://buubjnddzsadzcumrvdt.supabase.co'
const KEY = (readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .find(l => /^SUPABASE_SERVICE_KEY=/.test(l)) || '').split('=').slice(1).join('=').trim()
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }
const api = async c => {
  const r = await fetch(`${BASE}/rest/v1/${c}`, { headers: H })
  const t = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${c} :: ${t.slice(0, 200)}`)
  return t ? JSON.parse(t) : null
}

// ── o gabarito, direto do CSV ────────────────────────────────────────────────
const CSV = 'C:/Users/ajanguas/Downloads/Planejamento HB LiveMode - Time Sinal Inter.csv'
const linhas = readFileSync(CSV, 'utf8').split(/\r?\n/).map(l => l.split(','))
const NOMES = [2, 4, 6, 8, 10, 12, 14].map(i => (linhas[0][i] || '').trim())
const ehData = s => /^\d{1,2}\/\d{1,2}$/.test(String(s || '').trim())

// Percorre o arquivo guardando o mês corrente; quando cai numa linha "FOLGA",
// ela é o fechamento do mês que acabou de passar.
const gabarito = []   // { ano, mes, pessoa, direito, usadas }
let ano = 2024, mesAnterior = null, mesAtual = null
for (const l of linhas) {
  if (ehData(l[0])) {
    const m = Number(l[0].trim().split('/')[1])
    if (mesAnterior !== null && m < mesAnterior) ano++
    mesAnterior = m
    mesAtual = { ano, mes: m }
    continue
  }
  if (String(l[0] || '').trim().toUpperCase() !== 'FOLGA' || !mesAtual) continue
  NOMES.forEach((nome, k) => {
    const direito = Number(l[1 + k * 2])
    const usadas = Number(l[2 + k * 2])
    // Os primeiros meses só trazem um dos dois números — não servem de gabarito.
    if (!Number.isFinite(direito) || !Number.isFinite(usadas)) return
    if (String(l[1 + k * 2]).trim() === '' || String(l[2 + k * 2]).trim() === '') return
    gabarito.push({ ...mesAtual, pessoa: nome, direito, usadas })
  })
}
console.log(`Gabarito tirado da planilha: ${gabarito.length} fechamentos de mês (pessoa × mês)\n`)

// ── o mesmo cálculo, a partir do banco ───────────────────────────────────────
const pessoas = await api('folgas_pessoas?select=id,nome,time_id&time_id=eq.sinal-inter')
const cats = await api('folgas_categorias?select=id,conta_folga,eh_deslocamento')
const ehFolga = id => !!cats.find(c => c.id === id)?.conta_folga
const feriadosLista = await api('folgas_feriados?select=dia')
const feriados = new Set(feriadosLista.map(f => f.dia))

const ids = pessoas.map(p => `"${p.id}"`).join(',')
const todas = []
for (let de = 0; de < 40000; de += 1000) {
  const p = await api(`folgas_dias?pessoa_id=in.(${ids})&select=pessoa_id,dia,categoria_id&order=pessoa_id,dia&offset=${de}&limit=1000`)
  todas.push(...p)
  if (p.length < 1000) break
}
const porPessoa = new Map(pessoas.map(p => [p.id, new Map()]))
todas.forEach(l => porPessoa.get(l.pessoa_id)?.set(l.dia, l))
const idDe = nome => pessoas.find(p => p.nome === nome)?.id

// Os meses do gabarito já passaram, então "hoje" é o fim do próprio mês: o
// direito do mês fechado é o mês inteiro.
let iguais = 0, difDireito = 0, difUsadas = 0
const amostras = []
for (const g of gabarito) {
  const pid = idDe(g.pessoa)
  if (!pid) continue
  const fimDoMes = iso(g.ano, g.mes - 1, new Date(g.ano, g.mes, 0).getDate())
  const s = saldoDoMes({
    dias: porPessoa.get(pid), feriados, ehFolga, ajustes: [],
    ano: g.ano, mes: g.mes - 1, hoje: fimDoMes,
  })
  const okD = s.direito === g.direito, okU = s.usadas === g.usadas
  if (okD && okU) iguais++
  else {
    if (!okD) difDireito++
    if (!okU) difUsadas++
    if (amostras.length < 14) amostras.push(
      `  ${g.ano}-${String(g.mes).padStart(2, '0')} ${g.pessoa.padEnd(10)} ` +
      `direito planilha=${String(g.direito).padStart(2)} calculado=${String(s.direito).padStart(2)}${okD ? '' : '  ←'}   ` +
      `usadas planilha=${String(g.usadas).padStart(2)} calculado=${String(s.usadas).padStart(2)}${okU ? '' : '  ←'}`
    )
  }
}

console.log(`iguais nos dois números: ${iguais} de ${gabarito.length}`)
console.log(`  "de direito" diferente: ${difDireito}`)
console.log(`  "usadas" diferente:     ${difUsadas}`)
if (amostras.length) {
  console.log(`\nprimeiras diferenças:`)
  amostras.forEach(a => console.log(a))
}

// ── por que o "de direito" diverge? ──
// Fins de semana por mês, sem feriado nenhum — é o piso do direito.
console.log(`\nreferência: fins de semana por mês (sem feriado)`)
for (const [a, m] of [[2026, 1], [2026, 2], [2026, 3], [2026, 4], [2026, 5]]) {
  let fds = 0, fer = 0
  const dim = new Date(a, m, 0).getDate()
  for (let d = 1; d <= dim; d++) {
    const dow = new Date(a, m - 1, d).getDay()
    if (dow === 0 || dow === 6) fds++
    else if (feriados.has(iso(a, m - 1, d))) fer++
  }
  console.log(`  ${a}-${String(m).padStart(2, '0')}: ${fds} de fim de semana + ${fer} feriado em dia útil = ${fds + fer}`)
}
