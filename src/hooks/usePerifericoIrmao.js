import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { PAR_PERIFERICO, PERIFERICO_BR_CONFIG, PERIFERICO_PF_CONFIG } from '../config/tables'
import { normalizarTime } from '../lib/escalaLink'

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
// Também não há tolerância de ±1 dia: quando o Controle tem um jogo que a
// planilha de periféricos não tem (o Mirassol × Novorizontino aparece no
// Controle em 01/02 e 02/02, e nos periféricos só em 01/02), é melhor a tela
// dizer "sem linha correspondente" do que mostrar o equipamento de outro dia.
const ehFeedB = r => /feed\s*b/i.test(String(r?.padrao || '')) || /^fb$/i.test(String(r?.rod || '').trim())
const chaveJogo = r => [
  String(r?.data || '').trim(),
  normalizarTime(r?.mandante),
  normalizarTime(r?.visitante),
  ehFeedB(r) ? 'B' : 'A',
].join('|')

export function usePerifericoIrmao(config) {
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

  // Confronto repetido na mesma chave só pode acontecer se a planilha tiver
   // linha duplicada de verdade; nesse caso a primeira ganha e o aviso fica no
  // console, em vez de a tela escolher em silêncio.
  const indice = useMemo(() => {
    const m = new Map()
    for (const r of linhas) {
      if (!r?.mandante || !r?.visitante) continue
      const k = chaveJogo(r)
      if (m.has(k)) { console.warn('[periferico] duas linhas para o mesmo jogo:', k); continue }
      m.set(k, r)
    }
    return m
  }, [linhas])

  // Colunas do legado saem do config hardcoded da irmã; do dinâmico, do banco.
  const colunasFinais = useMemo(() => {
    if (!legacyTabela) return colunas
    return COLUNAS_LEGADO[legacyTabela]?.columns || []
  }, [legacyTabela, colunas])

  const acharPeriferico = useCallback(jogo => indice.get(chaveJogo(jogo)) || null, [indice])

  return {
    colunas: colunasFinais,
    acharPeriferico,
    temPeriferico: linhas.length > 0 && colunasFinais.length > 0,
  }
}
