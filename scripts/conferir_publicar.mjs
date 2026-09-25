// ─── CONFERE A REGRA DE PUBLICAÇÃO SEM ABRIR O NAVEGADOR ─────────────────────
// Importa as funções DE VERDADE da tela Escalar e roda casos montados à mão.
// O build não pega isto: ele compila igual se a regra estiver errada.
//
//   node --import ./scripts/resolver_ext.mjs scripts/conferir_publicar.mjs

import { alvosDePublicacao, estadoPublicacao } from '../src/lib/publicacao'

const casos = [
  ['legado, nada publicado', {
    cfg: { tableName: 'brasileirao_jogos' }, row: { id: 'r1', escala_publicada: false },
    cfgPerif: { tableName: 'perifericos_brasileirao' }, perif: { id: 'p1', escala_publicada: false },
    escala: { id: 'e1', escala_publicada: false },
  }, 'rascunho', 3],

  ['legado, tudo publicado', {
    cfg: { tableName: 'brasileirao_jogos' }, row: { id: 'r1', escala_publicada: true },
    cfgPerif: { tableName: 'perifericos_brasileirao' }, perif: { id: 'p1', escala_publicada: true },
    escala: { id: 'e1', escala_publicada: true },
  }, 'publicada', 3],

  ['so a Escala Geral publicada — o caso das telas antigas', {
    cfg: { tableName: 'brasileirao_jogos' }, row: { id: 'r1', escala_publicada: false },
    cfgPerif: { tableName: 'perifericos_brasileirao' }, perif: { id: 'p1', escala_publicada: false },
    escala: { id: 'e1', escala_publicada: true },
  }, 'parcial', 3],

  ['sem linha de periferico ainda', {
    cfg: { tableName: 'brasileirao_jogos' }, row: { id: 'r1', escala_publicada: true },
    cfgPerif: { tableName: 'perifericos_brasileirao' }, perif: null,
    escala: { id: 'e1', escala_publicada: true },
  }, 'publicada', 2],

  ['dinamico (Copinha): so a Escala Geral pode publicar', {
    cfg: { competitionId: 7 }, row: { id: 'r1' },
    cfgPerif: { competitionId: 8 }, perif: { id: 'p1' },
    escala: { id: 'e1', escala_publicada: false },
  }, 'rascunho', 1],

  ['dinamico sem linha na Escala Geral: nada a publicar', {
    cfg: { competitionId: 7 }, row: { id: 'r1' },
    cfgPerif: null, perif: null, escala: null,
  }, 'sem', 0],
]

let erros = 0
for (const [nome, jogo, esperado, nAlvos] of casos) {
  const estado = estadoPublicacao(jogo)
  const alvos = alvosDePublicacao(jogo)
  const ok = estado === esperado && alvos.length === nAlvos
  if (!ok) erros++
  console.log(`${ok ? 'ok  ' : 'ERRO'}  ${nome}`)
  if (!ok) console.log(`      esperava ${esperado}/${nAlvos} alvos, veio ${estado}/${alvos.length}`)
}
console.log(erros ? `\n${erros} caso(s) errado(s)` : '\ntodos os casos passaram')
process.exit(erros ? 1 : 0)
