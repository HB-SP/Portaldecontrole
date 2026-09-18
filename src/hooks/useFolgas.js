// ─── DADOS DO CONTROLE DE FOLGAS ─────────────────────────────────────────────
// Carrega times, pessoas, categorias, feriados, ajustes e os dias do ANO
// escolhido. Os dias são recarregados quando o ano muda; o resto é pequeno e
// vem uma vez só.
//
// Tudo com realtime ligado: duas pessoas preenchendo ao mesmo tempo precisam
// ver uma a outra, que é o ponto de sair da planilha compartilhada.

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isConfigured } from '../lib/supabase'

const TABELAS = ['folgas_times', 'folgas_pessoas', 'folgas_categorias', 'folgas_feriados', 'folgas_ajustes']

export function useFolgas(ano) {
  const [times, setTimes] = useState([])
  const [pessoas, setPessoas] = useState([])
  const [categorias, setCategorias] = useState([])
  const [feriados, setFeriados] = useState([])
  const [ajustes, setAjustes] = useState([])
  const [dias, setDias] = useState(new Map())   // 'pessoaId|aaaa-mm-dd' -> linha
  const [loading, setLoading] = useState(isConfigured)
  const [erro, setErro] = useState(null)
  const seqDias = useRef(0)

  // ── o que não depende do ano ──
  const carregarBase = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return }
    const [t, p, c, f, a] = await Promise.all([
      supabase.from('folgas_times').select('*').order('ordem'),
      supabase.from('folgas_pessoas').select('*').eq('ativo', true).order('ordem'),
      supabase.from('folgas_categorias').select('*').eq('arquivada', false).order('ordem'),
      supabase.from('folgas_feriados').select('*').order('dia'),
      supabase.from('folgas_ajustes').select('*').order('vale_de'),
    ])
    const falha = t.error || p.error || c.error || f.error || a.error
    if (falha) { setErro(falha.message); setLoading(false); return }
    setTimes(t.data || []); setPessoas(p.data || []); setCategorias(c.data || [])
    setFeriados(f.data || []); setAjustes(a.data || [])
    setErro(null)
  }, [])

  // ── os dias do ano ──
  // Um ano inteiro de 18 pessoas são ~6.500 linhas; o PostgREST devolve no
  // máximo 1.000 por vez, então a leitura é paginada. A ordem TEM de ser única
  // (pessoa_id + dia, que é a chave primária) — ordenar só por dia faz o offset
  // pular linhas quando há empate, e some dado sem erro nenhum.
  const carregarDias = useCallback(async () => {
    if (!isConfigured || !ano) return
    const seq = ++seqDias.current
    const todas = []
    for (let de = 0; de < 40000; de += 1000) {
      const { data, error } = await supabase
        .from('folgas_dias')
        .select('*')
        .gte('dia', `${ano}-01-01`).lte('dia', `${ano}-12-31`)
        .order('pessoa_id').order('dia')
        .range(de, de + 999)
      if (error) { setErro(error.message); return }
      todas.push(...(data || []))
      if ((data || []).length < 1000) break
    }
    if (seq !== seqDias.current) return   // chegou um load mais novo
    setDias(new Map(todas.map(l => [`${l.pessoa_id}|${l.dia}`, l])))
    setLoading(false)
  }, [ano])

  useEffect(() => { carregarBase() }, [carregarBase])
  useEffect(() => { carregarDias() }, [carregarDias])

  useEffect(() => {
    if (!isConfigured) return
    const canal = supabase.channel('folgas_rt')
    TABELAS.forEach(t => canal.on('postgres_changes', { event: '*', schema: 'public', table: t }, carregarBase))
    canal.on('postgres_changes', { event: '*', schema: 'public', table: 'folgas_dias' }, carregarDias)
    canal.subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [carregarBase, carregarDias])

  // ── gravar um dia ──
  // Categoria vazia = apagar o dia. Devolve null se deu certo, ou a mensagem.
  const salvarDia = useCallback(async (pessoaId, dia, valor) => {
    const chave = `${pessoaId}|${dia}`
    const antes = dias.get(chave)
    const apagar = !valor?.categoria_id

    setDias(prev => {
      const m = new Map(prev)
      if (apagar) m.delete(chave)
      else m.set(chave, { ...(antes || {}), pessoa_id: pessoaId, dia, ...valor })
      return m
    })

    if (!isConfigured) return null
    const { data: sessao } = await supabase.auth.getUser()
    const quem = sessao?.user?.id || null
    const { error } = apagar
      ? await supabase.from('folgas_dias').delete().eq('pessoa_id', pessoaId).eq('dia', dia)
      : await supabase.from('folgas_dias').upsert({
          pessoa_id: pessoaId, dia,
          categoria_id: valor.categoria_id,
          detalhe: valor.detalhe || null,
          campeonato: valor.campeonato || null,
          updated_at: new Date().toISOString(), updated_by: quem,
        }, { onConflict: 'pessoa_id,dia' })

    if (error) {
      // Desfaz: deixar na tela um dia que o banco recusou é pior que não ter
      // salvo, porque esconde que ainda falta preencher.
      setDias(prev => {
        const m = new Map(prev)
        if (antes) m.set(chave, antes); else m.delete(chave)
        return m
      })
      return error.message
    }
    return null
  }, [dias])

  // Grava vários dias de uma pessoa de uma vez (a seleção múltipla).
  const salvarVarios = useCallback(async (pessoaId, listaDias, valor) => {
    if (!listaDias.length) return null
    if (!valor?.categoria_id) {
      setDias(prev => { const m = new Map(prev); listaDias.forEach(d => m.delete(`${pessoaId}|${d}`)); return m })
      if (!isConfigured) return null
      const { error } = await supabase.from('folgas_dias').delete().eq('pessoa_id', pessoaId).in('dia', listaDias)
      if (error) { carregarDias(); return error.message }
      return null
    }
    const { data: sessao } = await supabase.auth.getUser()
    const quem = sessao?.user?.id || null
    const linhas = listaDias.map(dia => ({
      pessoa_id: pessoaId, dia,
      categoria_id: valor.categoria_id,
      detalhe: valor.detalhe || null,
      campeonato: valor.campeonato || null,
      updated_at: new Date().toISOString(), updated_by: quem,
    }))
    setDias(prev => { const m = new Map(prev); linhas.forEach(l => m.set(`${pessoaId}|${l.dia}`, l)); return m })
    if (!isConfigured) return null
    const { error } = await supabase.from('folgas_dias').upsert(linhas, { onConflict: 'pessoa_id,dia' })
    if (error) { carregarDias(); return error.message }
    return null
  }, [carregarDias])

  // Qual linha de folgas_pessoas sou EU. Serve para destacar a minha coluna:
  // uma das perguntas que a tela responde é "quanto eu ainda tenho a tirar".
  const [minhaPessoaId, setMinhaPessoaId] = useState(null)
  useEffect(() => {
    let cancelado = false
    if (!isConfigured) return
    supabase.auth.getUser().then(({ data }) => {
      const uid = data?.user?.id
      if (cancelado || !uid) return
      setMinhaPessoaId(pessoas.find(p => p.profile_id === uid)?.id || null)
    })
    return () => { cancelado = true }
  }, [pessoas])

  return {
    times, pessoas, categorias, feriados, ajustes, dias, minhaPessoaId,
    loading, erro,
    salvarDia, salvarVarios,
    recarregar: () => { carregarBase(); carregarDias() },
  }
}
