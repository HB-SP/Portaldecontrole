// ─── DADOS DA TELA "ESCALAR" ─────────────────────────────────────────────────
// Uma linha por jogo, TODOS os campeonatos juntos. É o mesmo carregamento que a
// tela inicial faz (jogo do Controle + linha irmã de Periféricos + linha da
// Escala Geral, já casadas), só que devolvido em lista plana em vez de agrupado
// por dia — aqui a tela é planilha, não calendário.
//
// A parte nova é a ESCRITA: quem preenche vê uma coluna só, mas por baixo o
// valor pode ir para três lugares diferentes (a tabela do Controle, a tabela de
// Periféricos ou a escala_geral). Quem decide é o `fonte` da coluna lógica
// (ver config/colunasEscalar.js).

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { carregarCompeticao } from './useHomeData'
import { acharEscala, escalaCampeonatosDe } from '../lib/escalaLink'
import { chaveDe } from '../config/colunasEscalar'
import { alvosDePublicacao } from '../lib/publicacao'

// Grava campos numa linha de seção (Controle ou Periférico), nos dois modelos:
// tabela física (legado) ou JSONB de competition_events (dinâmico).
async function gravarNaSecao(cfg, rowId, campos) {
  if (cfg.tableName) {
    const { error } = await supabase.from(cfg.tableName)
      .update({ ...campos, updated_at: new Date().toISOString() })
      .eq('id', rowId)
    if (error) throw error
    return
  }
  // No dinâmico o jogo inteiro é UM objeto JSONB: sem ler antes e mesclar, um
  // update de uma célula apagaria todas as outras do mesmo jogo.
  const { data: atual, error: erroLeitura } = await supabase
    .from('competition_events').select('data').eq('id', rowId).single()
  if (erroLeitura) throw erroLeitura
  const base = atual?.data && typeof atual.data === 'object' ? atual.data : {}
  const { error } = await supabase.from('competition_events')
    .update({ data: { ...base, ...campos }, updated_at: new Date().toISOString() })
    .eq('id', rowId)
  if (error) throw error
}

// Campos do jogo copiados ao criar uma linha irmã que ainda não existe.
const CAMPOS_JOGO = ['dia', 'data', 'hora_brt', 'mandante', 'visitante', 'estadio', 'cidade', 'padrao', 'detentor']

// Nem todo jogo tem linha em Periféricos ou na Escala Geral. Em vez de recusar a
// edição, a linha é criada na hora, com os dados da partida já preenchidos.
async function criarIrmaPeriferico(cfgPerif, row, campos) {
  const desc = { rod: row.rod || row.eu || '' }
  CAMPOS_JOGO.forEach(c => { if (row[c] != null) desc[c] = row[c] })
  Object.assign(desc, campos)
  if (row.hub_jogo_id) desc.hub_jogo_id = String(row.hub_jogo_id)

  if (cfgPerif.tableName) {
    const { data, error } = await supabase.from(cfgPerif.tableName)
      .insert([{ ...desc, updated_at: new Date().toISOString() }]).select().single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('competition_events')
    .insert([{ competition_id: cfgPerif.competitionId, data: desc, status: 'Pendente' }])
    .select().single()
  if (error) throw error
  return { ...(data.data || {}), id: data.id }
}

async function criarLinhaEscala(cfg, row, campos) {
  const camp = escalaCampeonatosDe(cfg.label, cfg.escalaCamps)[0]
  if (!camp) throw new Error('Campeonato sem nome na Escala Geral')
  const nova = {
    campeonato: camp,
    fase_rodada: row.rod || row.eu ? `Rodada ${row.rod || row.eu}` : '',
    dia: row.dia || '', data: row.data || '', horario: row.hora_brt || '',
    cidade: row.cidade || '', estadio: row.estadio || '',
    mandante: row.mandante || '', visitante: row.visitante || '',
    transmissao: row.detentor || '',
    ...campos,
    updated_at: new Date().toISOString(),
  }
  if (row.hub_jogo_id) nova.hub_jogo_id = String(row.hub_jogo_id)
  const { data, error } = await supabase.from('escala_geral').insert([nova]).select().single()
  if (error) throw error
  return data
}

export function useEscalarDados(competitions) {
  const [jogos, setJogos] = useState([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState(null)
  // Guarda de ordem: um load antigo não pode resolver depois do novo e reger a
  // tela com dados vencidos (mesma proteção do useHomeData).
  const loadSeq = useRef(0)

  const load = useCallback(async () => {
    if (!competitions?.length) { setJogos([]); return }
    const seq = ++loadSeq.current
    setLoading(true)
    const falhas = []

    const porComp = await Promise.all(competitions.map(async comp => {
      try {
        const res = await carregarCompeticao(comp)
        if (!res) return []
        const { cfg, cfgPerif, jogos: linhas, porPerif, idxEscala } = res
        return linhas
          .filter(r => r.mandante && r.visitante)
          .map(row => ({
            uid: `${comp.id}:${row.id}`,
            comp, cfg, cfgPerif, row,
            perif: porPerif.get(row.id) || null,
            escala: acharEscala(row, idxEscala)?.escala || null,
          }))
      } catch (e) {
        falhas.push(`${comp.label}: ${e.message}`)
        return []
      }
    }))

    if (seq !== loadSeq.current) return
    setJogos(porComp.flat())
    setErro(falhas.length ? falhas.join(' · ') : null)
    setLoading(false)
  }, [competitions])

  useEffect(() => { load() }, [load])

  // Troca o valor de UMA célula na cópia em memória, para a tela responder na
  // hora sem esperar o banco.
  const aplicarLocal = useCallback((uid, fonte, chave, valor, linhaNova) => {
    setJogos(prev => prev.map(j => {
      if (j.uid !== uid) return j
      if (fonte === 'escala')    return { ...j, escala: { ...(linhaNova || j.escala), [chave]: valor } }
      if (fonte === 'periferico') return { ...j, perif:  { ...(linhaNova || j.perif),  [chave]: valor } }
      return { ...j, row: { ...j.row, [chave]: valor } }
    }))
  }, [])

  // Grava uma célula. Devolve null se deu certo, ou a mensagem de erro.
  const salvar = useCallback(async (jogo, col, valor) => {
    const chave = chaveDe(col, jogo.comp.id)
    if (!chave) return 'Este campeonato não tem essa coluna'
    if (!isConfigured) { aplicarLocal(jogo.uid, col.fonte, chave, valor); return null }

    const antes = jogos.find(j => j.uid === jogo.uid)
    aplicarLocal(jogo.uid, col.fonte, chave, valor)
    try {
      if (col.fonte === 'escala') {
        if (jogo.escala?.id) {
          const { error } = await supabase.from('escala_geral')
            .update({ [chave]: valor, updated_at: new Date().toISOString() })
            .eq('id', jogo.escala.id)
          if (error) throw error
        } else {
          const nova = await criarLinhaEscala(jogo.cfg, jogo.row, { [chave]: valor })
          aplicarLocal(jogo.uid, 'escala', chave, valor, nova)
        }
      } else if (col.fonte === 'periferico') {
        if (!jogo.cfgPerif) throw new Error('Este campeonato não tem aba de Periféricos')
        if (jogo.perif?.id) await gravarNaSecao(jogo.cfgPerif, jogo.perif.id, { [chave]: valor })
        else {
          const nova = await criarIrmaPeriferico(jogo.cfgPerif, jogo.row, { [chave]: valor })
          aplicarLocal(jogo.uid, 'periferico', chave, valor, nova)
        }
      } else {
        await gravarNaSecao(jogo.cfg, jogo.row.id, { [chave]: valor })
      }
      return null
    } catch (e) {
      // Desfaz: deixar o valor na tela depois de o banco recusar é pior que
      // não ter salvo, porque some o aviso de que ainda falta preencher.
      if (antes) setJogos(prev => prev.map(j => (j.uid === jogo.uid ? antes : j)))
      return e.message || 'Falha ao salvar'
    }
  }, [jogos, aplicarLocal])

  // Publica (ou devolve a rascunho) a escala de um jogo inteiro.
  const publicar = useCallback(async (jogo, valor) => {
    const alvos = alvosDePublicacao(jogo)
    if (!alvos.length) return 'Este jogo ainda não tem escala para publicar'
    if (!isConfigured) return null

    const antes = jogos.find(j => j.uid === jogo.uid)
    alvos.forEach(a => aplicarLocal(jogo.uid, a.onde, 'escala_publicada', valor))
    try {
      // Uma tabela de cada vez: são tabelas diferentes, não dá para um update
      // só. Se uma falhar, desfaz TUDO na tela — meio publicado na tela e
      // inteiro no banco (ou o contrário) é pior que não ter publicado.
      for (const a of alvos) {
        const { error } = await supabase.from(a.tabela)
          .update({ escala_publicada: valor, updated_at: new Date().toISOString() })
          .eq('id', a.id)
        if (error) throw error
      }
      return null
    } catch (e) {
      if (antes) setJogos(prev => prev.map(j => (j.uid === jogo.uid ? antes : j)))
      return e.message || 'Falha ao publicar'
    }
  }, [jogos, aplicarLocal])

  return { jogos, loading, erro, salvar, publicar, reload: load }
}
