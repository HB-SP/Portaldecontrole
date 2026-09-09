import { useState, useEffect, useMemo } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { escalaCampeonatosDe, criarIndiceEscala } from '../lib/escalaLink'

// Escala Geral filtrada para os campeonatos equivalentes ao do Portal, com
// realtime — edições feitas na aba Escala Geral aparecem na Visão Geral ao vivo.
// Só leitura: a Visão Geral nunca escreve na escala_geral.
// `escalaCamps` vem de competitions.escala_camps (config.escalaCamps) e diz com
// quais nomes este campeonato aparece na escala_geral. Sem ele, cai no mapa
// fixo do escalaLink.
export function useEscalaGeral(label, escalaCamps) {
  const [rows, setRows] = useState([])
  const [confirmacoes, setConfirmacoes] = useState(() => new Map())

  const campsDep = (Array.isArray(escalaCamps) ? escalaCamps : []).join('|')
  const camps = useMemo(
    () => escalaCampeonatosDe(label, escalaCamps),
    [label, campsDep], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const campsKey = camps.join('|')

  useEffect(() => {
    if (!isConfigured || camps.length === 0) return
    let cancelado = false
    async function carregar() {
      const { data, error } = await supabase.from('escala_geral').select('*').in('campeonato', camps)
      if (cancelado) return
      if (error) console.warn('[escala-geral] falha ao carregar:', error.message)
      else setRows(data || [])
    }
    carregar()
    const canal = supabase
      .channel(`eg_overview_${campsKey.replace(/[^a-zA-Z0-9]/g, '_')}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escala_geral' }, carregar)
      .subscribe()
    return () => { cancelado = true; supabase.removeChannel(canal) }
  }, [campsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Confirmações de presença dos links externos → ✓/✗ nos nomes
  useEffect(() => {
    if (!isConfigured) return
    let cancelado = false
    async function carregar() {
      const { data } = await supabase.from('escala_confirmacoes')
        .select('jogo_ref, funcao, status, obs').eq('origem', 'escala_geral')
      if (cancelado || !data) return
      setConfirmacoes(new Map(data.map(c => [`${c.jogo_ref}|${c.funcao}`, c])))
    }
    carregar()
    const canal = supabase
      .channel(`eg_overview_confs_${campsKey.replace(/[^a-zA-Z0-9]/g, '_')}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escala_confirmacoes' }, carregar)
      .subscribe()
    return () => { cancelado = true; supabase.removeChannel(canal) }
  }, [campsKey])

  const indice = useMemo(() => criarIndiceEscala(rows), [rows])
  return { indice, confirmacoes, temEscala: rows.length > 0 }
}
