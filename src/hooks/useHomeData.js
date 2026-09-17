import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { MOCK_DATA } from '../data/mockData'
import { PAR_PERIFERICO } from '../config/tables'
import { criarIndiceEscala, acharEscala, escalaCampeonatosDe } from '../lib/escalaLink'
import { parearPerifericos } from '../lib/parearPeriferico'

function parseDate(str) {
  if (!str) return null
  const s = String(str).trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return { year: +m[1], month: +m[2] - 1, day: +m[3] }
  m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
  if (m) {
    const day = +m[1], month = +m[2] - 1
    const yrRaw = m[3] ? +m[3] : new Date().getFullYear()
    return { day, month, year: yrRaw < 100 ? 2000 + yrRaw : yrRaw }
  }
  return null
}

function toDateKey(d) {
  return `${d.year}-${d.month}-${d.day}`
}

// Portal é a matriz da agenda (2026-08): lê direto das tabelas operacionais,
// que agora carregam jogo + escala completos (sem passar pelo app_state do Hub).
//
// Desde 09/2026 a tela inicial mostra a escala DENTRO do card do jogo, então
// aqui não basta mais devolver "time, hora e status": cada jogo sai com a
// linha completa do Controle, a linha irmã de Periféricos e a linha da Escala
// Geral já casadas. É o mesmo trabalho que a Visão Geral faz por campeonato,
// só que para todos de uma vez.
export async function carregarCompeticao(comp) {
  const secaoControle = comp.sections?.find(s => !s.isOverview && s.config?.sectionKind !== 'periferico')
  const secaoPerif = comp.sections?.find(s => s.config?.sectionKind === 'periferico')
  const cfg = secaoControle?.config
  if (!cfg) return null

  // ── jogos do Controle ──
  let jogos = []
  if (!isConfigured) {
    jogos = (MOCK_DATA[cfg.tableName] || []).map((r, i) => ({ id: r.id ?? `mock-${i}`, ...r }))
  } else if (cfg.tableName) {
    const { data } = await supabase.from(cfg.tableName).select('*')
    jogos = data || []
  } else if (cfg.competitionId) {
    const { data } = await supabase.from('competition_events').select('id, data, status').eq('competition_id', cfg.competitionId)
    jogos = (data || []).map(e => ({ ...(e.data && typeof e.data === 'object' ? e.data : {}), id: e.id, status: e.status }))
  }

  // ── periféricos da seção irmã ──
  let perifLinhas = []
  const cfgPerif = secaoPerif?.config
  if (isConfigured && cfgPerif) {
    if (cfgPerif.tableName) {
      const { data } = await supabase.from(cfgPerif.tableName).select('*')
      perifLinhas = data || []
    } else if (cfgPerif.competitionId) {
      const { data } = await supabase.from('competition_events').select('id, data').eq('competition_id', cfgPerif.competitionId)
      perifLinhas = (data || []).map(e => ({ ...(e.data && typeof e.data === 'object' ? e.data : {}), id: e.id }))
    }
  } else if (!isConfigured && cfg.tableName) {
    const par = PAR_PERIFERICO[cfg.tableName]
    perifLinhas = par ? (MOCK_DATA[par.tabela] || []) : []
  }

  // ── escala de produção (planilha de planejamento) ──
  let escalaLinhas = []
  if (isConfigured) {
    const camps = escalaCampeonatosDe(cfg.label, cfg.escalaCamps)
    if (camps.length) {
      const { data } = await supabase.from('escala_geral').select('*').in('campeonato', camps)
      escalaLinhas = data || []
    }
  }

  const porPerif = parearPerifericos(jogos, perifLinhas)
  const idxEscala = criarIndiceEscala(escalaLinhas)

  return { comp, cfg, cfgPerif, jogos, porPerif, idxEscala }
}

export function useHomeData(competitions) {
  const [matchesByDate, setMatchesByDate] = useState(new Map())
  const [totalsByComp, setTotalsByComp]   = useState({})
  const [loading, setLoading] = useState(false)
  // Guarda de ordem: loads concorrentes (competitions mudou no meio) não podem
  // deixar o calendário com o resultado do load mais antigo.
  const loadSeq = useRef(0)

  const load = useCallback(async () => {
    if (!competitions.length) return
    const seq = ++loadSeq.current
    setLoading(true)

    const allMatches = []
    const totals = {}

    await Promise.all(competitions.map(async (comp) => {
      try {
        const res = await carregarCompeticao(comp)
        if (!res) return
        const { cfg, cfgPerif, jogos, porPerif, idxEscala } = res

        const seen = new Set()
        const valid = jogos.filter(r => {
          if (!r.mandante || !r.visitante || !r.data) return false
          const key = `${r.mandante}|${r.visitante}|${r.data}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        totals[comp.id] = valid.length

        for (const row of valid) {
          const d = parseDate(row.data)
          if (!d) continue
          allMatches.push({
            competitionId:    comp.id,
            competitionLabel: comp.label,
            accentColor:      comp.accentColor,
            dateKey:  toDateKey(d),
            rawDate:  row.data,
            hora_brt: row.hora_brt || '',
            mandante: row.mandante,
            visitante: row.visitante,
            estadio:  row.estadio || '',
            cidade:   row.cidade || '',
            padrao:   row.padrao || '',
            status:   row.status || 'Pendente',
            detentor: row.detentor || '',
            rod:      row.rod || row.eu || '',
            // ── o que a tela inicial precisa para montar o resumo da escala ──
            row,
            perif:  porPerif.get(row.id) || null,
            escala: acharEscala(row, idxEscala)?.escala || null,
            config: cfg,
            perifConfig: cfgPerif || null,
          })
        }
      } catch (e) {
        console.warn(`[useHomeData] ${comp.label}:`, e.message)
      }
    }))

    if (seq !== loadSeq.current) return

    const map = new Map()
    for (const m of allMatches) {
      if (!map.has(m.dateKey)) map.set(m.dateKey, [])
      map.get(m.dateKey).push(m)
    }

    setMatchesByDate(map)
    setTotalsByComp(totals)
    setLoading(false)
  }, [competitions])

  useEffect(() => { load() }, [load])

  return { matchesByDate, totalsByComp, loading, reload: load }
}
