import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { PAR_PERIFERICO, PERIFERICO_BR_CONFIG, PERIFERICO_PF_CONFIG } from '../config/tables'
import { normalizarTime } from '../lib/escalaLink'
import { parseData } from '../lib/datas'

// No legado as colunas da irmã vivem no config hardcoded, não no banco.
const COLUNAS_LEGADO = {
  perifericos_brasileirao: PERIFERICO_BR_CONFIG,
  perifericos_paulistao: PERIFERICO_PF_CONFIG,
}

// ─── PERIFÉRICOS DO MESMO JOGO, VISTOS DE FORA ───────────────────────────────
// A Visão Geral mostra um card por jogo e, até aqui, só conhecia duas fontes:
// a própria seção (Controle) e a escala_geral. Os periféricos ficam em OUTRA
// seção, com linhas próprias — então não apareciam no card.
//
// Este hook busca a seção irmã de periféricos e devolve, por jogo, a linha
// correspondente + as colunas dela (para os rótulos).
//
// O CASAMENTO NÃO PODE reusar o acharEscala do escalaLink. Aquele pareia com a
// escala_geral, que tem UMA linha por jogo, e por isso ignora a fase e aceita
// ±1 dia. Aqui os dois lados repetem o mesmo confronto: cada final tem a linha
// do sinal principal e a do Feed B, mesma data e mesmos times. Com aquela
// lógica, as duas linhas do Controle puxavam a MESMA linha de periférico e
// sobravam duas órfãs — mostrando equipamento do sinal errado.
//
// O que separa as duas é `padrao = 'FeedB'`, e as duas planilhas usam essa
// marca igual. Então a chave é data + times + é-Feed-B. A fase (rod) fica de
// fora de propósito: a planilha de periféricos chama a final de 08/03 de "F" e
// a operacional de "FA".
//
// A tolerância de ±1 dia existe (as duas tabelas divergem na data do mesmo
// jogo — no Paulistão Fem. o Controle tem 11/08 e 13/08 onde o Periférico tem
// 12/08), mas em SEGUNDA PASSADA e só sobre linha ainda não reivindicada:
//
//   1ª passada — casamento exato (data + times + é-Feed-B)
//   2ª passada — para o que sobrou, mesma dupla e mesmo sinal a ±1 dia,
//                aceitando só se houver UM candidato livre
//
// Sem a segunda condição, o Mirassol × Novorizontino do A1 (que está no
// Controle em 01/02 e 02/02 e no Periférico só em 01/02) fazia as duas linhas
// apontarem para a mesma — o de 02/02 roubava por aproximação a linha que já
// era do de 01/02. Agora ele fica honestamente sem par.
const ehFeedB = r => /feed\s*b/i.test(String(r?.padrao || '')) || /^fb$/i.test(String(r?.rod || '').trim())
const dupla = r => `${normalizarTime(r?.mandante)}|${normalizarTime(r?.visitante)}|${ehFeedB(r) ? 'B' : 'A'}`
const chaveJogo = r => `${String(r?.data || '').trim()}|${dupla(r)}`
const UM_DIA = 86400000

export function usePerifericoIrmao(config, jogos) {
  const [linhas, setLinhas] = useState([])
  const [colunas, setColunas] = useState([])

  const legacyTabela = config?.isLegacy ? PAR_PERIFERICO[config.tableName]?.tabela : null
  const competitionId = config?.isLegacy === false ? config.competitionId : null

  const carregar = useCallback(async () => {
    if (!isConfigured) return
    // ── Legado: tabela física irmã, colunas vindas do config hardcoded ──
    if (legacyTabela) {
      const { data, error } = await supabase.from(legacyTabela).select('*')
      if (!error) setLinhas(data || [])
      return
    }
    // ── Dinâmico: seção filha com section_kind 'periferico' ──
    if (!competitionId) return
    const { data: filho } = await supabase
      .from('competitions')
      .select('id')
      .eq('parent_competition_id', competitionId)
      .eq('section_kind', 'periferico')
      .maybeSingle()
    if (!filho?.id) { setLinhas([]); setColunas([]); return }

    const [colsRes, evsRes] = await Promise.all([
      supabase.from('competition_columns').select('*').eq('competition_id', filho.id).order('sort_order'),
      supabase.from('competition_events').select('*').eq('competition_id', filho.id),
    ])
    if (!colsRes.error) {
      setColunas((colsRes.data || []).map(c => ({
        key: c.key, label: c.label, type: c.type, group: c.col_group || undefined,
      })))
    }
    if (!evsRes.error) {
      // Achata como o useCompetitionEvents faz, para ler row.drone direto
      setLinhas((evsRes.data || []).map(e => ({ ...(e.data || {}), id: e.id, status: e.status })))
    }
  }, [legacyTabela, competitionId])

  useEffect(() => {
    if (!isConfigured || (!legacyTabela && !competitionId)) return
    carregar()
    const alvo = legacyTabela || 'competition_events'
    const canal = supabase
      .channel(`perif_irmao_${legacyTabela || competitionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: alvo }, carregar)
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [carregar, legacyTabela, competitionId])

  // Atribuicao GLOBAL, nao busca por linha: a 2a passada precisa saber o que a
  // 1a ja reivindicou. Resultado chaveado pelo id do jogo do Controle.
  const jogosKey = (jogos || []).map(j => j?.id).join(',')
  const porJogo = useMemo(() => {
    const validas = linhas.filter(r => r?.mandante && r?.visitante)
    const exato = new Map()
    for (const r of validas) {
      const k = chaveJogo(r)
      // Chave repetida so acontece com linha duplicada de verdade na planilha:
      // a primeira fica e o aviso vai ao console, em vez de a tela escolher em
      // silencio.
      if (exato.has(k)) { console.warn('[periferico] duas linhas para o mesmo jogo:', k); continue }
      exato.set(k, r)
    }

    const resultado = new Map()
    const usadas = new Set()
    const sobraram = []

    // 1a passada: casamento exato
    for (const j of jogos || []) {
      if (!j?.mandante || !j?.visitante) continue
      const hit = exato.get(chaveJogo(j))
      if (hit && !usadas.has(hit)) { resultado.set(j.id, hit); usadas.add(hit) }
      else sobraram.push(j)
    }

    // 2a passada: +-1 dia, mesma dupla e mesmo sinal, so sobre linha livre e
    // so quando o candidato e UNICO
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
  }, [linhas, jogosKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Colunas do legado saem do config hardcoded da irmã; do dinâmico, do banco.
  const colunasFinais = useMemo(() => {
    if (!legacyTabela) return colunas
    return COLUNAS_LEGADO[legacyTabela]?.columns || []
  }, [legacyTabela, colunas])

  const acharPeriferico = useCallback(jogo => (jogo?.id ? porJogo.get(jogo.id) || null : null), [porJogo])

  return {
    colunas: colunasFinais,
    acharPeriferico,
    temPeriferico: linhas.length > 0 && colunasFinais.length > 0,
  }
}
