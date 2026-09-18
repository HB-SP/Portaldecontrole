// ─── SALDO INICIAL: A TELA COMEÇA DO NÚMERO QUE A EQUIPE RECONHECE ───────────
// As planilhas trazem, no alto de cada coluna, um saldo de folgas mantido à mão.
// É o número que a equipe usa hoje. Não adianta a tela discutir com ele: o que
// vale é a tela PARTIR dele e andar sozinha daí em diante.
//
// Este script grava um ajuste por pessoa, datado de hoje, com a diferença entre
// o que a tela calcula e o que a planilha diz — na tabela folgas_ajustes, que
// existe exatamente para isso e guarda quem fez, quando e por quê.
//
// FICA DE FORA quem a equipe classificou como duvidoso (18/09/2026):
//   · coluna muito vazia — o saldo calculado não é confiável nem para ajustar;
//   · Yuji, cujo saldo na planilha carrega um zeramento manual que nenhum dado
//     registra.
// Para esses, a equipe define o número certo e a gente grava depois.
//
// Uso:
//   node --import ./scripts/resolver_ext.mjs scripts/saldo_inicial_folgas.mjs
//   node --import ./scripts/resolver_ext.mjs scripts/saldo_inicial_folgas.mjs --gravar

import { readFileSync } from 'node:fs'
import { saldoDoAno, hojeIso } from '../src/lib/folgas.js'

const BASE = 'https://buubjnddzsadzcumrvdt.supabase.co'
const KEY = (readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .find(l => /^SUPABASE_SERVICE_KEY=/.test(l)) || '').split('=').slice(1).join('=').trim()
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const api = async (c, o = {}) => {
  const r = await fetch(`${BASE}/rest/v1/${c}`, { ...o, headers: { ...H, ...(o.headers || {}) } })
  const t = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${c} :: ${t.slice(0, 300)}`)
  return t ? JSON.parse(t) : null
}

// Saldo escrito no alto das planilhas, em 18/09/2026. Positivo = folgas a tirar.
const PLANILHA = {
  'WJ': 30, 'Gatti': 31, 'Gui Soria': 18, 'Previde': 27, 'Laís': 16, 'Natan': 21, 'Ana Clara': 22,
  'Flávio': 44, 'Lucas': 46, 'Belezinha': 62, 'Junior': 60, 'Anny': 24, 'Rafa': 14, 'Yuji': 6,
  'Pardal': -1,
}

// Quem a equipe deixou de fora, e por quê.
const DUVIDOSOS = {
  'Yuji': 'saldo da planilha traz um zeramento manual que nenhum dado registra',
  'Junior': 'coluna com 169 dias em branco',
  'Gui Soria': 'coluna com 81 dias em branco',
  'Flávio': 'coluna com 53 dias em branco',
  'Belezinha': 'coluna com 32 dias em branco',
}

const ANO = 2026
const hoje = hojeIso()
const gravar = process.argv.includes('--gravar')

const pessoas = (await api('folgas_pessoas?select=id,nome,ativo&order=ordem')).filter(p => p.ativo)
const cats = await api('folgas_categorias?select=id,conta_folga,eh_deslocamento')
const ehFolga = id => !!cats.find(c => c.id === id)?.conta_folga
const ehDesloc = id => !!cats.find(c => c.id === id)?.eh_deslocamento
const feriados = new Set((await api('folgas_feriados?select=dia')).map(f => f.dia))
const jaTem = await api('folgas_ajustes?select=pessoa_id,motivo')

const ids = pessoas.map(p => `"${p.id}"`).join(',')
const todas = []
for (let de = 0; de < 40000; de += 1000) {
  const p = await api(`folgas_dias?pessoa_id=in.(${ids})&dia=gte.${ANO}-01-01&dia=lte.${ANO}-12-31&select=pessoa_id,dia,categoria_id&order=pessoa_id,dia&offset=${de}&limit=1000`)
  todas.push(...p); if (p.length < 1000) break
}
const por = new Map(pessoas.map(p => [p.id, new Map()]))
todas.forEach(l => por.get(l.pessoa_id)?.set(l.dia, { ...l, eh_deslocamento: ehDesloc(l.categoria_id) }))

const MOTIVO = `Saldo inicial conferido com a planilha em ${hoje.split('-').reverse().join('/')}`
const plano = []
for (const p of pessoas) {
  if (!(p.nome in PLANILHA)) { plano.push({ nome: p.nome, acao: 'sem número na planilha' }); continue }
  if (p.nome in DUVIDOSOS) { plano.push({ nome: p.nome, acao: `DE FORA — ${DUVIDOSOS[p.nome]}` }); continue }
  if (jaTem.some(a => a.pessoa_id === p.id && a.motivo === MOTIVO)) { plano.push({ nome: p.nome, acao: 'já ajustado antes' }); continue }

  const s = saldoDoAno({ dias: por.get(p.id), feriados, ehFolga, ajustes: [], ano: ANO, hoje })
  const tela = -s.aTirar
  const alvo = PLANILHA[p.nome]
  // aTirar = usadas − direito − ajuste, e a tela mostra −aTirar, ou seja
  // (direito + ajuste − usadas). Para a tela virar `alvo`, o ajuste tem de
  // valer (alvo − tela). Na primeira tentativa escrevi (tela − alvo) e o saldo
  // andou para o lado contrário — o WJ foi de 32 para 34 em vez de 30.
  const delta = alvo - tela
  plano.push({ id: p.id, nome: p.nome, tela, alvo, delta, acao: delta === 0 ? 'já bate' : 'ajustar' })
}

console.log(`Saldo em ${hoje} · positivo = folgas a tirar\n`)
console.log(`${'PESSOA'.padEnd(12)} ${'TELA'.padStart(5)} ${'PLANILHA'.padStart(9)} ${'AJUSTE'.padStart(7)}   O QUE FAZ`)
console.log('─'.repeat(78))
for (const x of plano) {
  console.log(`${x.nome.padEnd(12)} ${String(x.tela ?? '').padStart(5)} ${String(x.alvo ?? '').padStart(9)} ${String(x.delta ?? '').padStart(7)}   ${x.acao}`)
}

const gravaveis = plano.filter(x => x.acao === 'ajustar')
console.log('─'.repeat(78))
console.log(`${gravaveis.length} ajustes a gravar · ${plano.filter(x => x.acao.startsWith('DE FORA')).length} deixados de fora`)

if (!gravar) {
  console.log('\nSIMULAÇÃO — nada gravado. Rode com --gravar para valer.')
} else {
  await api('folgas_ajustes', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(gravaveis.map(x => ({
      pessoa_id: x.id, vale_de: hoje, delta: x.delta, motivo: MOTIVO,
    }))),
  })
  console.log(`\ngravados ${gravaveis.length} ajustes.`)

  console.log('\nCOMO FICOU')
  console.log('─'.repeat(50))
  const agora = await api('folgas_ajustes?select=pessoa_id,delta,vale_de,motivo')
  for (const p of pessoas) {
    if (!(p.nome in PLANILHA)) continue
    const meus = agora.filter(a => a.pessoa_id === p.id)
    const s = saldoDoAno({ dias: por.get(p.id), feriados, ehFolga, ajustes: meus, ano: ANO, hoje })
    const marca = p.nome in DUVIDOSOS ? '  (deixado de fora)' : (-s.aTirar === PLANILHA[p.nome] ? '  ✓ igual à planilha' : '  ← ainda diferente')
    console.log(`  ${p.nome.padEnd(12)} tela ${String(-s.aTirar).padStart(4)} · planilha ${String(PLANILHA[p.nome]).padStart(4)}${marca}`)
  }
}
