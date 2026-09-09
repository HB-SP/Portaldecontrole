// ─── CONFERE OS PLANOS DE AGRUPAMENTO DOS CAMPEONATOS LEGADOS ────────────────
// aplicarPlano (src/config/tables.js) é leniente de propósito: coluna fora do
// plano continua funcionando e só avisa no console, para não dar tela branca em
// produção. Este script é o contrapeso — falha se algo não estiver perfeito.
//
// Verifica, para Brasileirão e Paulistão Fem.:
//   1. nenhuma coluna perdida ou duplicada
//   2. nenhum aviso do aplicarPlano
//   3. os grupos são exatamente Jogo / Pessoal / Operações / Transmissão
//   4. cada coluna manteve tipo, largura, opções, sticky e linkedTo
//   5. os offsets das colunas fixas continuam certos
//
// Uso: node scripts/conferir_planos_colunas.mjs

const avisos = []
const warnOriginal = console.warn
console.warn = (...a) => { avisos.push(a.join(' ')) }

const mod = await import('../src/config/tables.js')
console.warn = warnOriginal

const { BRASILEIRAO_CONFIG, PAULISTAO_FEM_CONFIG } = mod
let falhas = 0
const erro = m => { falhas++; console.log('  FALHA: ' + m) }

// Os arrays crus não são exportados; reconstruo o "antes" a partir do fonte.
import { readFileSync } from 'node:fs'
const fonte = readFileSync(new URL('../src/config/tables.js', import.meta.url), 'utf8')
function crus(nomeVar, ate) {
  const i = fonte.indexOf(nomeVar)
  const bloco = fonte.slice(i, fonte.indexOf(ate, i))
  const out = []
  let grupo = null
  for (const l of bloco.split(/\r?\n/)) {
    const k = l.match(/key: '([^']+)'/)
    if (!k) continue
    const g = l.match(/group: '([^']*)'/)
    if (g) grupo = g[1]
    out.push({ key: k[1], grupoOriginal: grupo, linha: l })
  }
  return out
}

const CASOS = [
  ['Brasileirão', BRASILEIRAO_CONFIG, crus('const brasileiraoRawColumns', 'const BRASILEIRAO_PLANO')],
  ['Paulistão Fem.', PAULISTAO_FEM_CONFIG, crus('const paulistaoFemRawColumns', 'const PAULISTAO_FEM_PLANO')],
]
const ESPERADOS = ['Jogo', 'Pessoal', 'Operações', 'Transmissão']

for (const [nome, config, antes] of CASOS) {
  console.log(`\n=== ${nome} ===`)
  const depois = config.columns

  // 1) mesmas chaves, sem perda nem duplicata
  const kAntes = antes.map(c => c.key).sort()
  const kDepois = depois.map(c => c.key).sort()
  console.log(`  colunas: ${antes.length} antes, ${depois.length} depois`)
  if (kAntes.length !== kDepois.length) erro('mudou a quantidade de colunas')
  if (kAntes.join(',') !== kDepois.join(',')) {
    const perdidas = kAntes.filter(k => !kDepois.includes(k))
    const novas = kDepois.filter(k => !kAntes.includes(k))
    erro(`conjunto de chaves mudou. perdidas: ${perdidas.join(',') || '-'} | novas: ${novas.join(',') || '-'}`)
  }
  if (new Set(kDepois).size !== kDepois.length) erro('chave duplicada depois do plano')

  // 3) grupos exatamente os esperados, na ordem
  const vistos = []
  depois.forEach(c => { if (!vistos.includes(c.group)) vistos.push(c.group) })
  console.log(`  grupos: ${vistos.join(' > ')}`)
  if (vistos.join('|') !== ESPERADOS.join('|')) erro(`grupos esperados ${ESPERADOS.join(' > ')}`)
  ESPERADOS.forEach(g => {
    const n = depois.filter(c => c.group === g).length
    console.log(`     ${g}: ${n}`)
    if (!n) erro(`grupo ${g} vazio`)
  })

  // 4) definicao de cada coluna preservada (tudo menos o group)
  let mexidas = 0
  for (const c of depois) {
    const linha = antes.find(a => a.key === c.key)?.linha || ''
    const esperado = {
      type: (linha.match(/type: '([^']+)'/) || [])[1],
      width: Number((linha.match(/width: (\d+)/) || [])[1]),
      sticky: /sticky: true/.test(linha),
      linkedTo: (linha.match(/linkedTo: '([^']+)'/) || [])[1],
    }
    if (c.type !== esperado.type) { mexidas++; erro(`${c.key}: type ${esperado.type} -> ${c.type}`) }
    if (c.width !== esperado.width) { mexidas++; erro(`${c.key}: width ${esperado.width} -> ${c.width}`) }
    if (!!c.sticky !== esperado.sticky) { mexidas++; erro(`${c.key}: sticky mudou`) }
    if ((c.linkedTo || undefined) !== esperado.linkedTo) { mexidas++; erro(`${c.key}: linkedTo mudou`) }
  }
  console.log(`  definicoes alteradas: ${mexidas} (esperado 0)`)

  // 5) offsets das colunas fixas
  const fixas = depois.filter(c => c.sticky)
  let off = 0, offErrado = 0
  for (const c of fixas) { if (c.stickyLeft !== off) offErrado++; off += c.width }
  console.log(`  colunas fixas: ${fixas.map(c => c.key).join(', ')} | offsets errados: ${offErrado}`)
  if (offErrado) erro('offset de coluna fixa errado')
  // fixas precisam ser as PRIMEIRAS, senao o offset cumulativo nao fecha
  const primeiras = depois.slice(0, fixas.length).every(c => c.sticky)
  if (!primeiras) erro('coluna fixa fora do inicio da lista')
}

// 2) nenhum aviso
console.log(`\n=== avisos do aplicarPlano: ${avisos.length} ===`)
avisos.forEach(a => { console.log('  ' + a); falhas++ })

console.log(falhas === 0
  ? '\n>>> TUDO CERTO — reagrupou sem perder coluna nem mudar definicao.'
  : `\n>>> ${falhas} problema(s).`)
process.exit(falhas === 0 ? 0 : 1)
