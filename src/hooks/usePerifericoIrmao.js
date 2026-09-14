import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { PAR_PERIFERICO, PERIFERICO_BR_CONFIG, PERIFERICO_PF_CONFIG } from '../config/tables'
import { parearPerifericos } from '../lib/parearPeriferico'

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
// O pareamento (e o porque de cada regra dele) vive em lib/parearPeriferico,
// compartilhado com a tela inicial.

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

  const jogosKey = (jogos || []).map(j => j?.id).join(',')
  const porJogo = useMemo(
    () => parearPerifericos(jogos, linhas),
    [linhas, jogosKey], // eslint-disable-line react-hooks/exhaustive-deps
  )

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
