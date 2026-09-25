// ─── RASCUNHO OU PUBLICADA ───────────────────────────────────────────────────
// Escala em rascunho é planejamento. Dá para escalar novembro inteiro sem que
// ninguém de fora veja, porque planejar é testar: o nome entra, sai, troca de
// lugar (equipe, 25/09/2026). Quem tem login do portal continua vendo tudo,
// com a marca dizendo o que ainda é ensaio. Quem NÃO vê é o prestador — a
// função `escala_do_prestador` no banco só devolve linha publicada, e é lá que
// o corte precisa morar: filtrar na tela deixaria o dado sair do banco assim
// mesmo.
//
// Aqui só a REGRA, sem React e sem banco, para poder ser conferida fora do
// navegador (scripts/conferir_publicar.mjs) — mesmo motivo de lib/folgas.js.

// A escala de um jogo mora em até TRÊS linhas: a do Controle, a do Periférico e
// a da Escala Geral. Cada uma tem o seu próprio `escala_publicada`, e a função
// do banco confere a marca de cada tabela em separado — publicar só uma
// deixaria o resto escondido de quem está escalado nela.
//
// O modelo dinâmico (competition_events) não tem essa coluna, e o link do
// prestador nem lê essas tabelas. Nesses campeonatos quem carrega a publicação
// é a linha da Escala Geral, que vale para todos.
export function alvosDePublicacao(jogo) {
  const alvos = []
  if (jogo.cfg?.tableName && jogo.row?.id) {
    alvos.push({ tabela: jogo.cfg.tableName, id: jogo.row.id, onde: 'controle' })
  }
  if (jogo.cfgPerif?.tableName && jogo.perif?.id) {
    alvos.push({ tabela: jogo.cfgPerif.tableName, id: jogo.perif.id, onde: 'periferico' })
  }
  if (jogo.escala?.id) {
    alvos.push({ tabela: 'escala_geral', id: jogo.escala.id, onde: 'escala' })
  }
  return alvos
}

export const LINHA_DE = { controle: 'row', periferico: 'perif', escala: 'escala' }

// 'publicada' · 'rascunho' · 'parcial' · 'sem'.
//
// "parcial" não é invenção: as telas antigas (Escala Geral, Periféricos) têm o
// botão de publicar UMA tabela de cada vez, então já existe jogo meio publicado
// desde antes desta tela. Chamar isso de rascunho esconderia que parte da
// escala já está no ar.
export function estadoPublicacao(jogo) {
  const alvos = alvosDePublicacao(jogo)
  if (!alvos.length) return 'sem'
  const marcas = alvos.map(a => !!jogo[LINHA_DE[a.onde]]?.escala_publicada)
  if (marcas.every(Boolean)) return 'publicada'
  return marcas.some(Boolean) ? 'parcial' : 'rascunho'
}
