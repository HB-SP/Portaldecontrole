// ─── TRANSMISSÃO ─────────────────────────────────────────────────────────────
// Quem está em cada jogo, e só isso: coordenador de UM, produtor de UM,
// produtor de campo, produção executiva e monitoração.
//
// As outras abas do campeonato respondem outras perguntas. O Controle e o
// Periférico têm 40 a 52 colunas por jogo, quase todas técnicas — achar quem
// vai ao jogo ali é garimpo. A Visão Geral mostra a escala, mas um jogo de
// cada vez, dentro do cartão. A Escalar é para PREENCHER.
//
// Aqui é para LER a escala do campeonato inteiro de uma vez: a rodada na
// vertical, as funções na horizontal. É a pergunta "quem está no Brasileirão
// em outubro" respondida numa tela só (equipe, 25/09/2026).
//
// Não se edita aqui — para isso existe a Escalar, e duas telas gravando a
// mesma coisa é como se criam os dois jeitos de fazer que divergem.

import { useMemo, useState } from 'react'
import { useTableData } from '../hooks/useTableData'
import { useCompetitionEvents } from '../hooks/useCompetitionEvents'
import { useEscalaGeral } from '../hooks/useEscalaGeral'
import { useHubFornecedores } from '../hooks/useHubFornecedores'
import { acharCadastro, whatsappDe, ehTelefone } from '../config/funcoesFornecedor'
import { FUNCOES_ESCALA, naoTemFuncao, semEscala, acharEscala } from '../lib/escalaLink'
import { parseData, compararPorData } from '../lib/datas'

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

function rotuloData(bruta) {
  const d = parseData(bruta)
  if (!d) return String(bruta || '—')
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${SEMANA[d.getDay()]}`
}

const rodadaDe = r => String(r.rod || r.eu || '').trim()

// A convenção "Fulano / Ciclano" é a da planilha e a do resto do portal.
const partesDe = v => String(v || '').split('/').map(x => x.trim()).filter(Boolean)

// O telefone não é gente: quando ainda está escrito na célula, sai em cinza,
// sem virar etiqueta de pessoa.
function Pessoas({ valor, fornecedores }) {
  if (naoTemFuncao(valor)) {
    return <span className="tx-nao" title="Este jogo não tem esta função">não tem</span>
  }
  const partes = partesDe(valor)
  if (!partes.length) return <span className="tx-vazio">—</span>
  return partes.map((nome, i) => {
    if (ehTelefone(nome)) return <span key={i} className="tx-tel">{nome}</span>
    const zap = whatsappDe(acharCadastro(nome, fornecedores)?.telefone)
    return (
      <span key={i} className="tx-pessoa">
        {nome}
        {zap && (
          <a className="tx-zap" href={zap} target="_blank" rel="noreferrer"
             title={`Falar com ${nome} no WhatsApp`}>✆</a>
        )}
      </span>
    )
  })
}

export default function TransmissaoView({ config, accentColor }) {
  const legacy = useTableData(config.isLegacy ? config.tableName : null)
  const dynamic = useCompetitionEvents(config.isLegacy ? null : config.competitionId)
  const { data, loading } = config.isLegacy ? legacy : dynamic
  const { indice: indiceEscala } = useEscalaGeral(config.label, config.escalaCamps)
  const { fornecedores } = useHubFornecedores()

  const [busca, setBusca] = useState('')
  const [soFalta, setSoFalta] = useState(false)

  // Uma linha por jogo, com a escala já casada.
  const linhas = useMemo(() => {
    return data
      .filter(r => r.mandante && r.visitante)
      .map(r => {
        const achado = acharEscala(r, indiceEscala)
        const eg = achado?.escala || null
        return { jogo: r, eg, semEscalaAqui: eg ? semEscala(eg) : false }
      })
      .sort((a, b) => compararPorData(a.jogo, b.jogo))
  }, [data, indiceEscala])

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return linhas.filter(l => {
      if (termo) {
        const alvo = `${l.jogo.mandante} ${l.jogo.visitante} ${rodadaDe(l.jogo)} ${
          FUNCOES_ESCALA.map(f => l.eg?.[f.key] || '').join(' ')}`.toLowerCase()
        if (!alvo.includes(termo)) return false
      }
      if (soFalta) {
        const falta = FUNCOES_ESCALA.some(f => {
          const v = l.eg?.[f.key]
          return !naoTemFuncao(v) && !String(v || '').trim()
        })
        if (!falta) return false
      }
      return true
    })
  }, [linhas, busca, soFalta])

  // Quantas casas de escala ainda estão em branco, entre as que estão na tela.
  const buracos = useMemo(() => visiveis.reduce((tot, l) => tot + FUNCOES_ESCALA.filter(f => {
    const v = l.eg?.[f.key]
    return !naoTemFuncao(v) && !String(v || '').trim()
  }).length, 0), [visiveis])

  return (
    <div className="tx-page">
      <div className="tx-barra">
        <input
          className="form-input" placeholder="Buscar time ou pessoa…"
          value={busca} onChange={e => setBusca(e.target.value)}
          style={{ flex: 1, maxWidth: 320 }}
        />
        <label className="tx-check">
          <input type="checkbox" checked={soFalta} onChange={e => setSoFalta(e.target.checked)} />
          só jogos com casa em branco
        </label>
        <span className="tx-contagem">
          {visiveis.length} {visiveis.length === 1 ? 'jogo' : 'jogos'}
          {buracos > 0 && <> · <strong>{buracos}</strong> em branco</>}
        </span>
      </div>

      {loading ? (
        <div className="tx-carregando">Carregando…</div>
      ) : !visiveis.length ? (
        <div className="tx-vazia">
          {busca || soFalta ? 'Nenhum jogo com esses filtros.' : 'Este campeonato ainda não tem jogos.'}
        </div>
      ) : (
        <div className="tx-wrap">
          <table className="tx-tab" style={{ '--ac': accentColor }}>
            <thead>
              <tr>
                <th className="tx-fix tx-fix-1">Rod.</th>
                <th className="tx-fix tx-fix-2">Data</th>
                <th className="tx-fix tx-fix-3">Jogo</th>
                {FUNCOES_ESCALA.map(f => <th key={f.key}>{f.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l, i) => (
                <tr key={l.jogo.id ?? i}>
                  <td className="tx-fix tx-fix-1 tx-rod">{rodadaDe(l.jogo) || '—'}</td>
                  <td className="tx-fix tx-fix-2 tx-data">{rotuloData(l.jogo.data)}</td>
                  <td className="tx-fix tx-fix-3 tx-jogo">
                    <span className="tx-time">{l.jogo.mandante}</span>
                    <span className="tx-x">×</span>
                    <span className="tx-time">{l.jogo.visitante}</span>
                  </td>
                  {/* Jogo que não escala equipe da casa (YT Paulistão) não tem
                      buraco nenhum: ele não deveria ter escala mesmo. Dizer
                      isso é diferente de mostrar cinco traços. */}
                  {l.semEscalaAqui ? (
                    <td className="tx-sem" colSpan={FUNCOES_ESCALA.length}>
                      não escala equipe da casa
                    </td>
                  ) : FUNCOES_ESCALA.map(f => {
                    const v = l.eg?.[f.key]
                    const vazia = !naoTemFuncao(v) && !String(v || '').trim()
                    return (
                      <td key={f.key} className={`tx-cel${vazia ? ' tx-cel-vazia' : ''}`}>
                        <Pessoas valor={v} fornecedores={fornecedores} />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
