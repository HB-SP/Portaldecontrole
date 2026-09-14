// ─── PAREAMENTO CONTROLE × PERIFÉRICO ────────────────────────────────────────
// Usado pela Visão Geral (usePerifericoIrmao) e pela tela inicial. Vive aqui
// porque duas cópias divergiriam, e este casamento tem regras que custaram
// caro para descobrir:
//
// NÃO dá para reusar o acharEscala do escalaLink. Aquele pareia com a
// escala_geral, que tem UMA linha por jogo, e por isso ignora a fase e aceita
// ±1 dia. Aqui os dois lados repetem o mesmo confronto: cada final tem a linha
// do sinal principal e a do Feed B, mesma data e mesmos times. Com aquela
// lógica, as duas linhas do Controle puxavam a MESMA linha de periférico e
// sobravam duas órfãs — o Feed B mostrando o equipamento do sinal principal.
//
// O que separa as duas é `padrao = 'FeedB'`, marca que as planilhas usam igual.
// A fase (rod) fica de fora de propósito: a planilha de periféricos chama a
// final de 08/03 de "F" e a operacional de "FA".
//
// A tolerância de ±1 dia existe (no Paulistão Fem. o Controle tem 11/08 e
// 13/08 onde o Periférico tem 12/08), mas em SEGUNDA PASSADA e só sobre linha
// ainda não reivindicada — senão o Mirassol × Novorizontino do A1, que está no
// Controle em 01/02 e 02/02 e no Periférico só em 01/02, faria as duas linhas
// apontarem para a mesma.

import { normalizarTime } from './escalaLink'
import { parseData } from './datas'

const UM_DIA = 86400000

export const ehFeedB = r =>
  /feed\s*b/i.test(String(r?.padrao || '')) || /^fb$/i.test(String(r?.rod || '').trim())

const dupla = r => `${normalizarTime(r?.mandante)}|${normalizarTime(r?.visitante)}|${ehFeedB(r) ? 'B' : 'A'}`
const chaveJogo = r => `${String(r?.data || '').trim()}|${dupla(r)}`

// Atribuição GLOBAL, não busca por linha: a 2ª passada precisa saber o que a 1ª
// já reivindicou. Devolve Map<idDoJogo, linhaDePeriferico>.
export function parearPerifericos(jogos, linhasPeriferico) {
  const validas = (linhasPeriferico || []).filter(r => r?.mandante && r?.visitante)
  const exato = new Map()
  for (const r of validas) {
    const k = chaveJogo(r)
    // Chave repetida só acontece com linha duplicada de verdade na planilha: a
    // primeira fica e o aviso vai ao console, em vez de a tela escolher em
    // silêncio.
    if (exato.has(k)) { console.warn('[periferico] duas linhas para o mesmo jogo:', k); continue }
    exato.set(k, r)
  }

  const resultado = new Map()
  const usadas = new Set()
  const sobraram = []

  for (const j of jogos || []) {
    if (!j?.mandante || !j?.visitante) continue
    const hit = exato.get(chaveJogo(j))
    if (hit && !usadas.has(hit)) { resultado.set(j.id, hit); usadas.add(hit) }
    else sobraram.push(j)
  }

  for (const j of sobraram) {
    const d = parseData(j.data)
    if (!d) continue
    const cands = validas.filter(r => {
      if (usadas.has(r)) return false
      if (dupla(r) !== dupla(j)) return false
      const rd = parseData(r.data)
      return rd && Math.abs(rd - d) <= UM_DIA
    })
    if (cands.length === 1) { resultado.set(j.id, cands[0]); usadas.add(cands[0]) }
  }
  return resultado
}
