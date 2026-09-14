// ─── RESUMO DA ESCALA DE UM JOGO ─────────────────────────────────────────────
// Monta as três linhas que a tela inicial mostra dentro do card: PESSOAL,
// OPERAÇÕES e PERIFÉRICOS. Transmissão fica de fora de propósito — é
// importante, mas não é o que se olha ao abrir o Portal.
//
// A regra que faz isso caber: MOSTRA SÓ O QUE ESTÁ PREENCHIDO. Medido na base
// em 14/09/2026, um jogo tem em média 4,4 de 9 campos de Pessoal, 3,3 de 8 de
// Operações e 3,9 de 8 equipamentos marcados "Sim" — ou seja ~11 itens, não os
// 44 possíveis. Listar os vazios encheria o card de "—" sem informar nada; o
// que importa deles é a CONTAGEM de pendências, que vai à parte.
//
// Periférico e fornecedor viram um item só ("Drone · OneSolve") em vez de dois
// campos, que é o que derruba os 27 campos de periférico do A1 para as 3 ou 4
// linhas que aquele jogo realmente usa.

import { FUNCOES_ESCALA, naoTemFuncao, semEscala } from './escalaLink'
import { equipamentosDaConfig } from '../config/equipamentos'

const cheio = v => v !== null && v !== undefined && String(v).trim() !== ''

// Colunas de um grupo do Controle, fora as que já estão no cabeçalho do card
const CHAVES_CABECALHO = new Set([
  'eu', 'rod', 'dia', 'data', 'hora_brt', 'mandante', 'visitante',
  'cidade', 'padrao', 'detentor', 'estadio', 'hub_jogo_id',
])
function colunasDoGrupo(config, grupo) {
  return (config?.columns || []).filter(c => c.group === grupo && !CHAVES_CABECALHO.has(c.key))
}

// { itens: [{label, valor}], preenchidos, total }
// `total` conta os campos que fazem sentido para aquele jogo, para a pendência
// ser honesta: função marcada "Não" na Escala Geral não é buraco.
function bloco(itens, total) {
  return { itens, preenchidos: itens.length, total: Math.max(total, itens.length) }
}

export function resumoPessoal(row, escala, config) {
  const itens = []
  let total = 0

  // As 4 funções de produção vêm da Escala Geral (outra planilha, outro dono)
  if (escala && !semEscala(escala)) {
    for (const fn of FUNCOES_ESCALA) {
      const v = escala[fn.key]
      if (naoTemFuncao(v)) continue   // "Não" = o jogo não terá essa função
      total++
      if (cheio(v)) itens.push({ label: fn.label, valor: String(v).trim() })
    }
  }

  // O resto das pessoas vem do próprio Controle
  for (const c of colunasDoGrupo(config, 'Pessoal')) {
    total++
    if (cheio(row?.[c.key])) itens.push({ label: c.label, valor: String(row[c.key]).trim() })
  }
  return bloco(itens, total)
}

export function resumoOperacoes(row, config) {
  const itens = []
  let total = 0
  for (const c of colunasDoGrupo(config, 'Operações')) {
    total++
    const v = row?.[c.key]
    if (!cheio(v)) continue
    // Colunas Sim/Não só entram quando são "Sim" — um "Não" não é informação
    // que valha uma linha do card.
    if (c.type === 'simnao') { if (String(v).trim() === 'Sim') itens.push({ label: c.label, valor: 'Sim' }) }
    else itens.push({ label: c.label, valor: String(v).trim() })
  }
  return bloco(itens, total)
}

export function resumoPerifericos(perif, perifConfig) {
  if (!perif || !perifConfig) return bloco([], 0)
  const equipamentos = equipamentosDaConfig(perifConfig)
  const itens = []
  let total = 0
  for (const eq of equipamentos) {
    if (perif[eq.key] !== 'Sim') continue    // só o que o jogo realmente usa
    total++
    const forn = eq.fornecedor ? perif[eq.fornecedor] : null
    const qt = eq.qtde ? perif[eq.qtde] : null
    const rotulo = eq.label + (cheio(qt) ? ` ×${String(qt).trim()}` : '')
    // Equipamento marcado mas sem fornecedor é pendência: entra na contagem
    // mas não vira item preenchido.
    if (eq.fornecedor && !cheio(forn)) continue
    itens.push({ label: rotulo, valor: cheio(forn) ? String(forn).trim() : 'Sim' })
  }
  return bloco(itens, total)
}

// Tudo junto, na ordem em que aparece no card.
export function resumoDoJogo({ row, escala, perif, config, perifConfig }) {
  const pessoal = resumoPessoal(row, escala, config)
  const operacoes = resumoOperacoes(row, config)
  const perifericos = resumoPerifericos(perif, perifConfig)
  // Bloco escondido quando o campeonato não tem aquele serviço: o Paulistão
  // Feminino não usa periférico (confirmado com a equipe em 14/09/2026 — se
  // usar, só na final), e mostrar "Periféricos —" em todo card daria a
  // impressão de dado faltando.
  const blocos = [
    { chave: 'pessoal', titulo: 'Pessoal', ...pessoal },
    { chave: 'operacoes', titulo: 'Operações', ...operacoes },
    { chave: 'perifericos', titulo: 'Periféricos', ...perifericos },
  ].map(b => ({ ...b, vazio: b.total === 0 }))

  // NÃO existe "quantos faltam". A maioria das colunas do grupo é opcional —
  // um jogo com um supervisor só não tem "Supervisores 2" faltando, ele
  // simplesmente não usa esse serviço. Só dá para afirmar o que ESTÁ escalado.
  const escalados = blocos.reduce((s, b) => s + b.preenchidos, 0)
  return { blocos, escalados, semEscala: escalados === 0 }
}
