// ─── OS JOGOS DE CADA PESSOA DO TIME ─────────────────────────────────────────
// A escala dos jogos e a escala interna do time são preenchidas em lugares
// diferentes, por pessoas diferentes. Quem está escalado num jogo de sábado não
// precisa marcar nada na grade de folgas: o jogo já está dito, e repetir é
// trabalho dobrado que sai errado na primeira vez que um dos dois muda.
//
// Então o jogo é LIDO, não copiado. A grade mostra o que já existe.
//
// O vínculo entre as duas escalas é DECLARADO, não adivinhado: na grade a
// pessoa é "Previde", na escala do jogo é "Matheus Previde", e existe gente
// diferente com primeiro nome igual (dois Flávios, dois Lucas, dois Rafaéis).
// Casar por semelhança mostraria na folga de alguém o jogo de outra pessoa.
// Por isso `folgas_pessoas.nomes_escala`.
//
// DUAS FONTES, e é preciso as duas:
//
//   1. `escala_geral` INTEIRA — é onde estão as 4 funções de produção, e ela
//      cobre campeonatos que o Portal nem tem como aba (Media Day, Copinha,
//      Série B). Ler só pelos campeonatos do Portal perdia tudo isso: a Laís,
//      por exemplo, só aparece em Media Day, e ficava com zero jogo.
//
//   2. As colunas de PESSOAL do Controle de cada campeonato — supervisor, DTV,
//      vMix, que não existem na escala_geral.
//
// Onde o campeonato da escala tem aba no Portal, a marca vira link para o jogo.
// Onde não tem, ela ainda aparece — só não clica, porque não há para onde ir.

import { useState, useEffect } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { carregarCompeticao } from './useHomeData'
import { FUNCOES_ESCALA, naoTemFuncao, acharEscala } from '../lib/escalaLink'
import { mesmoNome } from '../config/funcoesFornecedor'
import { parseData } from '../lib/datas'
import { iso } from '../lib/folgas'

const pessoalDaConfig = cfg => (cfg?.columns || []).filter(c => c.group === 'Pessoal')

// O ANO DO CAMPEONATO, tirado do rótulo: "Copinha 26" é 2026.
//
// A data dos jogos quase sempre vem sem ano — "15/01" — e quem completava era o
// ano da TELA. Resultado: virando para 2027, a Copinha e o Paulistão de 2026
// reapareciam inteiros em janeiro, como se fossem jogos novos (equipe,
// 23/09/2026). O campeonato sabe de que ano ele é; a tela não tem como saber.
//
// Sem ano no rótulo — "Media Day", "Host Broadcast" — não dá para afirmar nada,
// e aí o ano da tela segue valendo, como antes.
const anoDoCamp = label => {
  const t = String(label || '')
  const m = t.match(/\b(20\d{2})\b/) || t.match(/(\d{2})\s*$/)
  if (!m) return null
  const n = Number(m[1])
  return n < 100 ? 2000 + n : n
}
// "Fulano / Ciclano" e "Fulano / 11 99999-9999" — cada pedaço é candidato.
const pedacos = v => String(v || '').split('/').map(s => s.trim()).filter(Boolean)

export function useJogosDoTime(pessoas, competitions, ano) {
  // Map de 'pessoaId|aaaa-mm-dd' -> [{ compId, compLabel, cor, confronto, funcao, jogo }]
  const [jogosPorDia, setJogosPorDia] = useState(new Map())
  // Map de 'aaaa-mm-dd' -> os jogos daquele dia, de TODO MUNDO. Nasce da mesma
  // varredura, sem custo nenhum a mais, e é o que o menu oferece para escolher
  // quando alguém vai a um jogo sem ter função na escala dele.
  const [jogosDoDia, setJogosDoDia] = useState(new Map())

  useEffect(() => {
    const ligadas = (pessoas || []).filter(p => (p.nomes_escala || []).length)
    if (!isConfigured || !ano) { setJogosPorDia(new Map()); setJogosDoDia(new Map()); return }

    let cancelado = false
    ;(async () => {
      const mapa = new Map()
      const doDia = new Map()
      const vistos = new Set()   // pessoa|dia|confronto — a mesma partida nas duas fontes

      const guardar = (pessoaId, dia, item) => {
        const eco = `${pessoaId}|${dia}|${item.confronto}`
        if (vistos.has(eco)) return
        vistos.add(eco)
        const chave = `${pessoaId}|${dia}`
        if (!mapa.has(chave)) mapa.set(chave, [])
        mapa.get(chave).push(item)
      }

      const anota = ({ dia, confronto, escalados, comp, jogo, campeonato }) => {
        for (const p of ligadas) {
          const achou = escalados.find(e => p.nomes_escala.some(a => mesmoNome(a, e.nome)))
          if (!achou) continue
          guardar(p.id, dia, {
            compId: comp?.id || null,
            compLabel: comp?.label || campeonato || 'Escala Geral',
            cor: comp?.accentColor || '#8A8FA3',
            confronto, funcao: achou.funcao, jogo,
          })
        }
      }
      // `anoBase` completa a data quando ela vem sem ano. Depois disso o dia
      // ainda precisa cair no ano da tela para entrar na grade.
      const diaDe = (valor, anoBase) => {
        const d = parseData(valor, anoBase || ano)
        if (!d || d.getFullYear() !== Number(ano)) return null
        return iso(d.getFullYear(), d.getMonth(), d.getDate())
      }

      // ── 1. os jogos de cada campeonato, e a linha da escala de cada um ──
      // Percorrer os JOGOS (e não a escala) para achar o par usa o mesmo
      // casamento que a Visão Geral — com apelido de time e tolerância de um
      // dia. E dá o que faltava: a linha da grade passa a ser o jogo DE
      // VERDADE, com a data e o nome que o Controle tem, e é ele que abre ao
      // clicar.
      const jogoDaEscala = new Map()   // id da linha da escala -> { jogo, comp }
      await Promise.all((competitions || []).map(async comp => {
        try {
          const anoComp = anoDoCamp(comp.label)
          if (anoComp && anoComp !== Number(ano)) return   // campeonato de outro ano
          const res = await carregarCompeticao(comp)
          if (!res) return
          const colunas = pessoalDaConfig(res.cfg)
          for (const j of res.jogos) {
            if (!j.mandante || !j.visitante) continue
            const eg = acharEscala(j, res.idxEscala)?.escala
            if (eg?.id) jogoDaEscala.set(eg.id, { jogo: j, comp })

            const dia = diaDe(j.data, anoComp)
            if (!dia) continue
            const confronto = `${j.mandante} × ${j.visitante}`

            // O jogo entra na lista do dia mesmo que ninguém do time esteja
            // escalado nele: é justamente aí que alguém vai precisar apontar.
            if (!doDia.has(dia)) doDia.set(dia, [])
            doDia.get(dia).push({
              compId: comp.id, compLabel: comp.label, cor: comp.accentColor,
              confronto, jogo: j,
              hora: String(j.hora || j.horario || j.hora_jogo || '').trim(),
            })

            // as 4 funções de produção, da linha da escala casada com este jogo
            const escalados = []
            if (eg) {
              for (const fn of FUNCOES_ESCALA) {
                if (naoTemFuncao(eg[fn.key])) continue
                pedacos(eg[fn.key]).forEach(n => escalados.push({ nome: n, funcao: fn.label }))
              }
            }
            // e as colunas de Pessoal do Controle
            for (const col of colunas) {
              pedacos(j[col.key]).forEach(n => escalados.push({ nome: n, funcao: col.label }))
            }
            if (escalados.length) anota({ dia, confronto, escalados, comp, jogo: j })
          }
        } catch (e) {
          console.warn(`[useJogosDoTime] ${comp.label}:`, e.message)
        }
      }))

      // ── 2. o que sobrou na escala_geral ──
      // Linhas que nenhum jogo do Portal reclamou: campeonato sem aba (Media
      // Day, Copinha, Série B) e as linhas de COBERTURA, que não são partida
      // nenhuma — "Vas x Ctb" contra "Mir x Bota" é um plantão sobre quatro
      // jogos. Aparecem, porque é trabalho de verdade no dia, mas não abrem
      // jogo: não há um jogo só para abrir.
      const { data: eg } = await supabase.from('escala_geral').select('*')
      for (const r of eg || []) {
        if (!r.mandante || jogoDaEscala.has(r.id)) continue
        const anoLinha = anoDoCamp(r.campeonato)
        if (anoLinha && anoLinha !== Number(ano)) continue
        const dia = diaDe(r.data, anoLinha)
        if (!dia) continue
        const escalados = []
        for (const fn of FUNCOES_ESCALA) {
          if (naoTemFuncao(r[fn.key])) continue
          pedacos(r[fn.key]).forEach(n => escalados.push({ nome: n, funcao: fn.label }))
        }
        if (!escalados.length) continue
        const confronto = [r.mandante, r.visitante].map(x => String(x || '').trim()).filter(Boolean).join(' × ')
        anota({ dia, confronto, escalados, comp: null, jogo: r, campeonato: r.campeonato })
      }

      for (const lista of doDia.values()) lista.sort((a, b) => (a.hora || 'zz').localeCompare(b.hora || 'zz'))
      if (!cancelado) { setJogosPorDia(mapa); setJogosDoDia(doDia) }
    })()

    return () => { cancelado = true }
  }, [pessoas, competitions, ano])

  return { jogosPorDia, jogosDoDia }
}
