// ─── O SALDO DA TELA CONTRA O SALDO DA PLANILHA ──────────────────────────────
// As duas planilhas trazem, no alto de cada coluna, um saldo de folgas mantido
// À MÃO pela equipe. É o número que elas usam hoje.
//
// Este script põe os dois lado a lado. Onde há diferença, a causa costuma ser
// uma destas, e o script diz qual:
//   · a coluna não vem sendo preenchida (o dia em branco não vira folga);
//   · alguém ajustou o saldo à mão em algum momento (zerou depois de férias);
//   · a planilha acumula de anos anteriores, a tela conta o ano corrente.
//
// Não escreve nada. É insumo para decidir o saldo inicial de cada pessoa.
//
// Uso: node --import ./scripts/resolver_ext.mjs scripts/comparar_saldo_planilha.mjs

import { readFileSync } from 'node:fs'
import { saldoDoAno, hojeIso } from '../src/lib/folgas.js'

const BASE = 'https://buubjnddzsadzcumrvdt.supabase.co'
const KEY = (readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .find(l => /^SUPABASE_SERVICE_KEY=/.test(l)) || '').split('=').slice(1).join('=').trim()
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }
const api = async c => {
  const r = await fetch(`${BASE}/rest/v1/${c}`, { headers: H })
  if (!r.ok) throw new Error(`${r.status} ${c}`)
  return r.json()
}

// Saldo que está escrito no alto de cada coluna das planilhas, conferido com a
// equipe em 18/09/2026. Positivo = folgas a tirar.
// (O CSV exportou o do Pardal como 1; na planilha viva é −1, e vale a planilha.)
const PLANILHA = {
  'WJ': 30, 'Gatti': 31, 'Gui Soria': 18, 'Previde': 27, 'Laís': 16, 'Natan': 21, 'Ana Clara': 22,
  'Flávio': 44, 'Lucas': 46, 'Belezinha': 62, 'Junior': 60, 'Anny': 24, 'Rafa': 14, 'Yuji': 6,
  'Pardal': -1, 'Fernanda': 12,
}

const ANO = 2026
const hoje = hojeIso()
const pessoas = await api('folgas_pessoas?select=id,nome,time_id,ativo&order=ordem')
const cats = await api('folgas_categorias?select=id,conta_folga,eh_deslocamento')
const ehFolga = id => !!cats.find(c => c.id === id)?.conta_folga
const ehDesloc = id => !!cats.find(c => c.id === id)?.eh_deslocamento
const feriados = new Set((await api('folgas_feriados?select=dia')).map(f => f.dia))

const ids = pessoas.map(p => `"${p.id}"`).join(',')
const todas = []
for (let de = 0; de < 40000; de += 1000) {
  const p = await api(`folgas_dias?pessoa_id=in.(${ids})&dia=gte.${ANO}-01-01&dia=lte.${ANO}-12-31&select=pessoa_id,dia,categoria_id&order=pessoa_id,dia&offset=${de}&limit=1000`)
  todas.push(...p); if (p.length < 1000) break
}
const por = new Map(pessoas.map(p => [p.id, new Map()]))
todas.forEach(l => por.get(l.pessoa_id)?.set(l.dia, { ...l, eh_deslocamento: ehDesloc(l.categoria_id) }))

console.log(`Saldo em ${hoje} · positivo = folgas a tirar\n`)
console.log(`${'PESSOA'.padEnd(12)} ${'PLANILHA'.padStart(9)} ${'TELA'.padStart(6)} ${'DIFERENÇA'.padStart(10)}  ${'EM BRANCO'.padStart(10)}  O QUE EXPLICA`)
console.log('─'.repeat(86))

const linhas = []
for (const p of pessoas) {
  if (!(p.nome in PLANILHA)) continue
  const s = saldoDoAno({ dias: por.get(p.id), feriados, ehFolga, ajustes: [], ano: ANO, hoje })
  const tela = -s.aTirar                      // mesma convenção da planilha
  const dif = tela - PLANILHA[p.nome]
  let causa = ''
  if (Math.abs(dif) <= 2) causa = 'bate (diferença de arredondamento/dia)'
  else if (s.emBranco > 40) causa = `coluna com ${s.emBranco} dias em branco`
  else if (dif > 0) causa = 'a tela conta MAIS — planilha deve ter ajuste à mão'
  else causa = 'a tela conta MENOS — planilha pode acumular de anos anteriores'
  linhas.push({ nome: p.nome, planilha: PLANILHA[p.nome], tela, dif, branco: s.emBranco, causa, ativo: p.ativo })
}

for (const l of linhas.sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif))) {
  console.log(
    `${l.nome.padEnd(12)} ${String(l.planilha).padStart(9)} ${String(l.tela).padStart(6)} ` +
    `${String(l.dif > 0 ? '+' + l.dif : l.dif).padStart(10)}  ${String(l.branco).padStart(10)}  ${l.causa}` +
    (l.ativo ? '' : '   (fora da grade)')
  )
}

const batem = linhas.filter(l => Math.abs(l.dif) <= 2).length
console.log('─'.repeat(86))
console.log(`${batem} de ${linhas.length} batem dentro de 2 folgas.`)
console.log(`\nPara a tela começar do número que a equipe reconhece, cada pessoa ganha um`)
console.log(`ajuste de saldo com a diferença, datado de hoje — é para isso que a tabela`)
console.log(`folgas_ajustes existe. Daí em diante a conta anda sozinha.`)
