import { useState, useEffect, useCallback } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import {
  BRASILEIRAO_CONFIG,
  PERIFERICO_BR_CONFIG,
  PAULISTAO_FEM_CONFIG,
  PERIFERICO_PF_CONFIG,
} from '../config/tables'

// Mapa template_key -> config legado em src/config/tables.js
const LEGACY_CONFIGS = {
  legacy_brasileirao: BRASILEIRAO_CONFIG,
  legacy_periferico_br: PERIFERICO_BR_CONFIG,
  legacy_paulistao_fem: PAULISTAO_FEM_CONFIG,
  legacy_periferico_pf: PERIFERICO_PF_CONFIG,
}

// Fallback quando Supabase não está configurado: usa o array antigo hardcoded
const HARDCODED_FALLBACK = [
  {
    id: 'brasileirao',
    label: 'Brasileirão 26',
    accentColor: '#65B32E',
    sections: [
      { id: 'br-overview', label: 'Visão Geral', config: BRASILEIRAO_CONFIG, isOverview: true },
      { id: 'br-controle', label: 'Controle', config: BRASILEIRAO_CONFIG },
      { id: 'br-periferico', label: 'Periférico', config: PERIFERICO_BR_CONFIG },
      { id: 'br-dashboard', label: 'Calendário', config: BRASILEIRAO_CONFIG, isDashboard: true },
    ],
  },
  {
    id: 'paulistao-fem',
    label: 'Paulistão Fem. 26',
    accentColor: '#ec4899',
    sections: [
      { id: 'pf-overview', label: 'Visão Geral', config: PAULISTAO_FEM_CONFIG, isOverview: true },
      { id: 'pf-controle', label: 'Controle', config: PAULISTAO_FEM_CONFIG },
      { id: 'pf-periferico', label: 'Periférico', config: PERIFERICO_PF_CONFIG },
      { id: 'pf-dashboard', label: 'Calendário', config: PAULISTAO_FEM_CONFIG, isDashboard: true },
    ],
  },
]

function buildSectionsForCompetition(parent, children, columnsByCompId) {
  const sections = []
  const parentConfig = configForRow(parent, columnsByCompId)
  sections.push({ id: `${parent.slug}-overview`, label: 'Visão Geral', config: parentConfig, isOverview: true })
  sections.push({ id: `${parent.slug}-controle`, label: 'Controle', config: parentConfig })
  for (const child of children) {
    const childConfig = configForRow(child, columnsByCompId)
    sections.push({ id: `${child.slug}-${child.section_kind}`, label: capitalize(child.section_kind), config: childConfig })
  }
  // Calendário sempre por último
  sections.push({ id: `${parent.slug}-dashboard`, label: 'Calendário', config: parentConfig, isDashboard: true })
  return sections
}

function capitalize(s) {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Constrói o `config` que TablePage/Dashboard esperam, a partir de uma linha
// da tabela `competitions` + as colunas dela em `competition_columns`.
// Para legacy, reusa o config hardcoded (preserva sticky offsets, options etc.).
function configForRow(row, columnsByCompId) {
  const isLegacy = row.template_key && row.template_key.startsWith('legacy_')
  if (isLegacy && LEGACY_CONFIGS[row.template_key]) {
    const baseConfig = LEGACY_CONFIGS[row.template_key]
    return {
      ...baseConfig,
      id: row.slug,
      label: row.label,
      accentColor: row.accent_color,
      accentBg: row.accent_bg,
      competitionId: row.id,
      isLegacy: true,
      sectionKind: row.section_kind || null,
      escalaCamps: row.escala_camps || null,
      tableName: row.legacy_table || baseConfig.tableName,
    }
  }

  const cols = (columnsByCompId.get(row.id) || []).map(c => ({
    key: c.key,
    label: c.label,
    type: c.type,
    options: Array.isArray(c.options) ? c.options : [],
    optionsCategory: c.options_category || null,
    width: c.width,
    group: c.col_group || undefined,
    sticky: !!c.sticky,
    statusColor: !!c.status_color,
  }))

  let offset = 0
  for (const c of cols) {
    if (c.sticky) {
      c.stickyLeft = offset
      offset += c.width
    }
  }

  return {
    id: row.slug,
    label: row.label,
    accentColor: row.accent_color,
    accentBg: row.accent_bg,
    competitionId: row.id,
    isLegacy: false,
    sectionKind: row.section_kind || null,
    // Com quais nomes este campeonato aparece na escala_geral (ver lib/escalaLink)
    escalaCamps: row.escala_camps || null,
    columns: cols,
  }
}

export function useCompetitions() {
  const [loading, setLoading] = useState(isConfigured)
  const [error, setError] = useState(null)
  const [competitions, setCompetitions] = useState(isConfigured ? [] : HARDCODED_FALLBACK)

  const load = useCallback(async () => {
    if (!isConfigured) return
    setLoading(true)
    const [compRes, colsRes] = await Promise.all([
      supabase.from('competitions').select('*').eq('archived', false).order('sort_order'),
      supabase.from('competition_columns').select('*').order('sort_order'),
    ])
    const firstError = compRes.error || colsRes.error
    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    const rows = compRes.data || []
    const cols = colsRes.data || []
    const columnsByCompId = new Map()
    for (const c of cols) {
      if (!columnsByCompId.has(c.competition_id)) columnsByCompId.set(c.competition_id, [])
      columnsByCompId.get(c.competition_id).push(c)
    }

    // Agrupa: parents (sem parent_competition_id) + children (com parent)
    const parents = rows.filter(r => !r.parent_competition_id)
    const childrenByParent = new Map()
    for (const r of rows.filter(rr => rr.parent_competition_id)) {
      if (!childrenByParent.has(r.parent_competition_id)) childrenByParent.set(r.parent_competition_id, [])
      childrenByParent.get(r.parent_competition_id).push(r)
    }

    const list = parents.map(parent => {
      const children = childrenByParent.get(parent.id) || []
      return {
        id: parent.slug,
        competitionId: parent.id,
        label: parent.label,
        accentColor: parent.accent_color,
        accentBg: parent.accent_bg,
        sections: buildSectionsForCompetition(parent, children, columnsByCompId),
      }
    })

    setCompetitions(list)
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!isConfigured) return
    load()
    const channel = supabase
      .channel('competitions_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'competitions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'competition_columns' }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  return { competitions, loading, error, reload: load }
}
