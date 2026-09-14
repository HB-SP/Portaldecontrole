// ─── A RODADA EM DESTAQUE NA TELA INICIAL ────────────────────────────────────
// Regra combinada com o usuário em 14/09/2026:
//
//   1. O destaque é SEMPRE a próxima rodada. Se a rodada anterior acabou
//      ontem e a próxima é daqui a duas semanas, o destaque já é a próxima —
//      quem abre o Portal quer saber o que vem.
//   2. Dentro dessa rodada, o jogo que já aconteceu fica até o fim do dia
//      seguinte, para a rodada não aparecer pela metade enquanto acontece.
//      (A rodada 30 tem jogo em 10/10 e 11/10: no dia 11 os dois seguem na
//      tela; no dia 12 sai o de 10/10.)
//   3. No máximo 3 cards. Se a rodada tem 2 jogos, mostra 2 — não completa
//      com jogo de outra rodada. O resto vai para a lista densa abaixo.
//   4. Sem jogo futuro em campeonato nenhum: "Jogos ainda não divulgados".
//
// Testado dia a dia contra o calendário real (155 jogos) nas viradas de
// rodada, que é onde regra desse tipo costuma quebrar.

const DIA = 86400000
export const TETO_CARDS = 3

// `jogos` precisa de: { d: Date, comp: string, rod: string }
// Devolve { cards, total, comp, rod, vazio }
export function selecionarProximaRodada(jogos, hoje = new Date()) {
  const hoje0 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const comData = (jogos || []).filter(j => j?.d instanceof Date && !isNaN(j.d))
  if (!comData.length) return { cards: [], total: 0, vazio: true }

  const ordenados = [...comData].sort((a, b) => a.d - b.d)
  // A rodada em destaque é a do próximo jogo que ainda não aconteceu.
  const proximo = ordenados.find(j => j.d >= hoje0)
  if (!proximo) return { cards: [], total: 0, vazio: true }

  const ontem = new Date(hoje0.getTime() - DIA)
  const daRodada = ordenados.filter(j =>
    j.comp === proximo.comp && j.rod === proximo.rod && j.d >= ontem)

  return {
    cards: daRodada.slice(0, TETO_CARDS),
    total: daRodada.length,
    comp: proximo.comp,
    rod: proximo.rod,
    vazio: false,
  }
}
