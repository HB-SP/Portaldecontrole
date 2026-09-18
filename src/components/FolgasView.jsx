// ─── CONTROLE DE FOLGAS E PRESENÇA ───────────────────────────────────────────
// A grade do mês no formato que a equipe já lê: um dia por linha, uma pessoa
// por coluna, a célula diz onde a pessoa está. Sinal Inter e Operações na mesma
// tabela, com filtro de time — antes eram duas planilhas separadas com a mesma
// forma.
//
// O que a planilha não fazia e é o ponto da tela: como o time trabalha fim de
// semana, cada sábado, domingo e feriado gera uma folga de direito. O número
// "a tirar" no cabeçalho de cada pessoa mostra quanto ela ainda deve — a conta
// vive em lib/folgas.js.

import { useState, useMemo, useRef, useEffect } from 'react'
import { useFolgas } from '../hooks/useFolgas'
import {
  MESES, SEMANA_CURTA, iso, diasNoMes, hojeIso, ehFimDeSemana,
  saldoDoMes, saldoDoAno,
} from '../lib/folgas'

const CHAVE_TIME = 'folgas_time'

// ── COR NA GRADE ─────────────────────────────────────────────────────────────
// A cor vive na LETRA, não no fundo: célula pintada vira uma coluna de blocos e
// o olho vai para o formato em vez do conteúdo.
//
// E só a AUSÊNCIA é colorida. O dia a dia — escritório, Casablanca, home,
// externa — é preto, porque é o normal: se o normal tem cor, a exceção deixa de
// ter. Decisões da equipe em 18/09/2026.
const AUSENCIA = new Set(['folga', 'ferias', 'atestado'])

function estiloCelula(cat) {
  if (!cat) return undefined
  if (!AUSENCIA.has(cat.id)) return { color: 'var(--text)' }
  return { color: cat.cor, fontWeight: cat.conta_folga ? 700 : 600 }
}

// ── Editor de um dia ─────────────────────────────────────────────────────────
// Abre onde a célula está, com os botões das categorias. Algumas pedem um
// detalhe (cidade, confronto, descrição) e "Outro" exige.
function Editor({ atual, categorias, onSalvar, onFechar }) {
  const [cat, setCat] = useState(atual?.categoria_id || '')
  const [detalhe, setDetalhe] = useState(atual?.detalhe || '')
  const [camp, setCamp] = useState(atual?.campeonato || '')
  const ref = useRef(null)

  useEffect(() => {
    const fora = e => { if (ref.current && e.target.isConnected && !ref.current.contains(e.target)) onFechar() }
    const esc = e => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [onFechar])

  const def = categorias.find(c => c.id === cat)
  const faltaDetalhe = def?.exige_detalhe && !detalhe.trim()

  const gravar = () => {
    if (faltaDetalhe) return
    onSalvar(cat ? { categoria_id: cat, detalhe: detalhe.trim() || null, campeonato: camp || null } : null)
  }

  return (
    <div className="flg-editor" ref={ref}>
      <div className="flg-editor-cats">
        {categorias.map(c => (
          <button
            key={c.id}
            className={`flg-cat${cat === c.id ? ' is-on' : ''}`}
            style={cat === c.id ? { background: c.cor, borderColor: c.cor, color: '#fff' } : { borderColor: c.cor, color: c.cor }}
            onClick={() => { setCat(c.id); if (c.id !== cat) { setDetalhe(''); setCamp('') } }}
          >
            {c.nome}
          </button>
        ))}
      </div>

      {def?.presets?.length > 0 && (
        <div className="flg-editor-presets">
          {def.presets.map(p => (
            <button key={p} className={`flg-preset${detalhe === p ? ' is-on' : ''}`} onClick={() => setDetalhe(p)}>{p}</button>
          ))}
        </div>
      )}

      {def?.campeonatos?.length > 0 && (
        <select className="flg-editor-campo" value={camp} onChange={e => setCamp(e.target.value)}>
          <option value="">Campeonato (opcional)</option>
          {def.campeonatos.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      {def?.pede_detalhe && (
        <input
          className="flg-editor-campo" autoFocus
          placeholder={def.dica_detalhe || 'Detalhe'}
          value={detalhe} onChange={e => setDetalhe(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') gravar() }}
        />
      )}

      <div className="flg-editor-pe">
        {atual && <button className="flg-editor-limpar" onClick={() => onSalvar(null)}>Apagar o dia</button>}
        <div style={{ flex: 1 }} />
        <button className="flg-editor-ok" disabled={faltaDetalhe} onClick={gravar}>
          {faltaDetalhe ? 'Falta o detalhe' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}

// ── O número que importa ─────────────────────────────────────────────────────
// "-3" não diz sozinho se é bom ou ruim, e "deve 3" dizia o contrário do que
// acontece: quem tem folga acumulada não deve nada — a folga é DELA, ainda por
// tirar. "3 a tirar" é o termo que a própria planilha da equipe usa.
function emPalavras(n) {
  if (n < 0) return `${-n} a tirar`
  if (n > 0) return `${n} adiantada${n > 1 ? 's' : ''}`
  return 'em dia'
}
const corDoSaldo = n => (n < 0 ? 'var(--red)' : n > 0 ? 'var(--lm-green-dim)' : 'var(--text-dim)')

function ATirar({ n, titulo }) {
  return <span className="flg-atirar" style={{ color: corDoSaldo(n) }} title={titulo}>{emPalavras(n)}</span>
}

// O cabeçalho de cada pessoa mostra os DOIS períodos, com hierarquia: o
// ACUMULADO manda, porque é o saldo de verdade — é dele que sai "quem está com
// folga atrasada" e "quanto eu ainda tenho". O mês fica embaixo, miúdo, dizendo
// o que este mês acrescentou.
//
// Os dois falam a MESMA língua ("3 a tirar"), de propósito: dois vocabulários
// no mesmo cabeçalho era parte da confusão.
function Placar({ mes, ano }) {
  return (
    <div className="flg-placar">
      <div
        className="flg-placar-total" style={{ color: corDoSaldo(ano.aTirar) }}
        title={`No ano, de 1º de janeiro até hoje: tirou ${ano.usadas} folgas de ${ano.direito} a que teve direito`}
      >
        {emPalavras(ano.aTirar)}
      </div>
      <div
        className="flg-placar-mes"
        title={`Só neste mês: tirou ${mes.usadas} folgas de ${mes.direito} a que teve direito`}
      >
        mês: {emPalavras(mes.aTirar)}
      </div>
    </div>
  )
}

export default function FolgasView({ podeEditar = false }) {
  const hoje = hojeIso()
  const [ano, setAno] = useState(() => Number(hoje.slice(0, 4)))
  const [mes, setMes] = useState(() => new Date().getMonth())
  const { times, pessoas, categorias, feriados, ajustes, dias, minhaPessoaId, loading, erro, salvarDia, salvarVarios } = useFolgas(ano)

  const [fTime, setFTime] = useState(() => {
    try { return localStorage.getItem(CHAVE_TIME) || '' } catch { return '' }
  })
  const trocarTime = v => { setFTime(v); try { localStorage.setItem(CHAVE_TIME, v) } catch { /* sem storage */ } }

  const [editando, setEditando] = useState(null)      // { pessoaId, dia }
  const [selecao, setSelecao] = useState(null)        // { pessoaId, dias: [] }
  const [aba, setAba] = useState('grade')             // grade | resumo

  const feriadosSet = useMemo(() => new Map(feriados.map(f => [f.dia, f.nome])), [feriados])
  const feriadosChaves = useMemo(() => new Set(feriados.map(f => f.dia)), [feriados])
  const catPorId = useMemo(() => new Map(categorias.map(c => [c.id, c])), [categorias])
  const ehFolga = id => !!catPorId.get(id)?.conta_folga

  const visiveis = useMemo(
    () => pessoas.filter(p => !fTime || p.time_id === fTime),
    [pessoas, fTime]
  )

  // Os dias de UMA pessoa, já com o que a conta precisa saber de cada dia.
  const diasDe = useMemo(() => {
    const por = new Map()
    for (const p of pessoas) por.set(p.id, new Map())
    for (const [chave, linha] of dias) {
      const [pid] = chave.split('|')
      const m = por.get(pid)
      if (!m) continue
      const c = catPorId.get(linha.categoria_id)
      m.set(linha.dia, { ...linha, eh_deslocamento: !!c?.eh_deslocamento })
    }
    return por
  }, [dias, pessoas, catPorId])

  const saldos = useMemo(() => {
    const m = new Map()
    for (const p of visiveis) {
      const meus = diasDe.get(p.id) || new Map()
      const meusAjustes = ajustes.filter(a => a.pessoa_id === p.id)
      m.set(p.id, {
        mes: saldoDoMes({ dias: meus, feriados: feriadosChaves, ehFolga, ajustes: meusAjustes, ano, mes, hoje }),
        ano: saldoDoAno({ dias: meus, feriados: feriadosChaves, ehFolga, ajustes: meusAjustes, ano, hoje }),
      })
    }
    return m
  }, [visiveis, diasDe, ajustes, feriadosChaves, ano, mes, hoje, catPorId])

  // O Resumo é a lista de quem cobrar e de quem pode folgar na próxima rodada,
  // então ele vem de quem tem MAIS folga a tirar para quem tem menos — a grade
  // é que segue a ordem de leitura da equipe.
  const porMaisDevendo = useMemo(
    () => [...visiveis].sort((a, b) => (saldos.get(a.id)?.ano.aTirar ?? 0) - (saldos.get(b.id)?.ano.aTirar ?? 0)),
    [visiveis, saldos]
  )

  const total = diasNoMes(ano, mes)
  const listaDias = useMemo(() => Array.from({ length: total }, (_, i) => i + 1), [total])

  const andarMes = n => {
    const d = new Date(ano, mes + n, 1)
    setAno(d.getFullYear()); setMes(d.getMonth())
  }

  // Clicar numa célula: no modo seleção, marca; senão abre o editor.
  function aoClicar(pessoaId, diaIso, e) {
    if (!podeEditar) return
    if (!selecao) { setEditando({ pessoaId, dia: diaIso }); return }
    if (selecao.pessoaId && selecao.pessoaId !== pessoaId) return   // seleção é de uma pessoa só
    setSelecao(s => {
      const jaTem = s.dias.includes(diaIso)
      // Shift extende do último marcado até aqui — é o gesto de planilha.
      if (e.shiftKey && s.dias.length) {
        const ultimo = s.dias[s.dias.length - 1]
        const [a, b] = [ultimo, diaIso].sort()
        const faixa = listaDias.map(d => iso(ano, mes, d)).filter(x => x >= a && x <= b)
        return { pessoaId, dias: [...new Set([...s.dias, ...faixa])] }
      }
      return { pessoaId, dias: jaTem ? s.dias.filter(x => x !== diaIso) : [...s.dias, diaIso] }
    })
  }

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div className="skeleton-cell" style={{ width: 220, height: 20, margin: '0 auto 16px' }} />
        <div className="skeleton-cell" style={{ width: 320, height: 14, margin: '0 auto' }} />
      </div>
    )
  }

  return (
    <div className="flg">
      <div className="flg-barra">
        <div className="flg-mes">
          <button className="flg-seta" onClick={() => andarMes(-1)} title="Mês anterior">‹</button>
          <span className="flg-mes-nome">{MESES[mes]} <strong>{ano}</strong></span>
          <button className="flg-seta" onClick={() => andarMes(1)} title="Próximo mês">›</button>
        </div>

        <select className="flg-sel" value={fTime} onChange={e => trocarTime(e.target.value)}>
          <option value="">Todos os times ({pessoas.length})</option>
          {times.map(t => (
            <option key={t.id} value={t.id}>
              {t.nome} ({pessoas.filter(p => p.time_id === t.id).length})
            </option>
          ))}
        </select>

        <div className="flg-abas">
          <button className={`flg-aba${aba === 'grade' ? ' is-on' : ''}`} onClick={() => setAba('grade')}>Grade</button>
          <button className={`flg-aba${aba === 'resumo' ? ' is-on' : ''}`} onClick={() => setAba('resumo')}>Resumo</button>
        </div>

        <div style={{ flex: 1 }} />

        {podeEditar && aba === 'grade' && (
          <button
            className={`flg-btn${selecao ? ' is-on' : ''}`}
            onClick={() => { setSelecao(selecao ? null : { pessoaId: null, dias: [] }); setEditando(null) }}
          >
            {selecao ? 'Sair da seleção' : 'Marcar vários dias'}
          </button>
        )}
      </div>

      {erro && <div className="flg-erro">Parte dos dados não carregou — {erro}</div>}

      {selecao && (
        <div className="flg-selbarra">
          <strong>{selecao.dias.length}</strong> {selecao.dias.length === 1 ? 'dia marcado' : 'dias marcados'}
          {selecao.pessoaId && <> · {pessoas.find(p => p.id === selecao.pessoaId)?.nome}</>}
          <span className="flg-selbarra-dica">clique nos dias · shift para um intervalo</span>
          <div style={{ flex: 1 }} />
          {categorias.map(c => (
            <button
              key={c.id} className="flg-cat" style={{ borderColor: c.cor, color: c.cor }}
              disabled={!selecao.dias.length}
              onClick={async () => {
                const falha = await salvarVarios(selecao.pessoaId, selecao.dias, { categoria_id: c.id })
                if (falha) alert('Não deu para salvar: ' + falha)
                else setSelecao({ pessoaId: null, dias: [] })
              }}
            >{c.nome}</button>
          ))}
          <button
            className="flg-cat" disabled={!selecao.dias.length}
            onClick={async () => {
              const falha = await salvarVarios(selecao.pessoaId, selecao.dias, null)
              if (falha) alert('Não deu para apagar: ' + falha)
              else setSelecao({ pessoaId: null, dias: [] })
            }}
          >Apagar</button>
        </div>
      )}

      {aba === 'grade' && (
        <div className="flg-legenda-cores">
          {categorias.map(c => (
            <span key={c.id} className="flg-chip" style={estiloCelula(c)}>{c.nome}</span>
          ))}
        </div>
      )}

      {aba === 'grade' ? (
        <div className="flg-wrap">
          <table className="flg-tab">
            <thead>
              <tr>
                <th className="flg-fix flg-th-dia">Dia</th>
                {visiveis.map(p => {
                  const s = saldos.get(p.id)
                  return (
                    <th key={p.id} className={`flg-th-pessoa${p.id === minhaPessoaId ? ' flg-eu' : ''}`}>
                      <div className="flg-th-nome">{p.nome}</div>
                      {s && <Placar mes={s.mes} ano={s.ano} />}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {listaDias.map(d => {
                const diaIso = iso(ano, mes, d)
                const fds = ehFimDeSemana(ano, mes, d)
                const feriado = feriadosSet.get(diaIso)
                const ehHoje = diaIso === hoje
                return (
                  <tr key={d} className={`flg-linha${fds || feriado ? ' flg-linha-descanso' : ''}${ehHoje ? ' flg-linha-hoje' : ''}`}>
                    <td className="flg-fix flg-td-dia">
                      <span className="flg-dia-num">{String(d).padStart(2, '0')}</span>
                      <span className="flg-dia-sem">{SEMANA_CURTA[new Date(ano, mes, d).getDay()]}</span>
                      {feriado && <span className="flg-dia-feriado" title={feriado}>●</span>}
                    </td>
                    {visiveis.map(p => {
                      const reg = (diasDe.get(p.id) || new Map()).get(diaIso)
                      const c = reg ? catPorId.get(reg.categoria_id) : null
                      const marcado = selecao?.dias.includes(diaIso) && (!selecao.pessoaId || selecao.pessoaId === p.id)
                      const texto = reg ? (reg.detalhe || c?.curto || c?.nome || '?') : ''
                      return (
                        <td
                          key={p.id}
                          className={`flg-cel${marcado ? ' flg-cel-marcada' : ''}${podeEditar ? ' flg-cel-edita' : ''}${p.id === minhaPessoaId ? ' flg-eu' : ''}`}
                          style={estiloCelula(c)}
                          title={reg ? `${c?.nome || 'Categoria removida'}${reg.detalhe ? ` — ${reg.detalhe}` : ''}${reg.campeonato ? ` (${reg.campeonato})` : ''}` : 'vazio'}
                          onClick={e => aoClicar(p.id, diaIso, e)}
                        >
                          {texto}
                          {editando && editando.pessoaId === p.id && editando.dia === diaIso && (
                            <Editor
                              atual={reg} categorias={categorias}
                              onFechar={() => setEditando(null)}
                              onSalvar={async v => {
                                setEditando(null)
                                const falha = await salvarDia(p.id, diaIso, v)
                                if (falha) alert('Não deu para salvar: ' + falha)
                              }}
                            />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flg-wrap">
          <table className="flg-resumo">
            <thead>
              <tr>
                <th>Pessoa</th><th>Time</th>
                <th title="Quantas folgas a pessoa já deveria ter tirado, contando até hoje">De direito</th>
                <th>Usadas</th><th>Ajustes</th>
                <th title="Usadas menos as de direito. Negativo = ainda deve tirar">A tirar no mês</th>
                <th>Deslocamentos</th>
                <th title="O mesmo cálculo, de 1º de janeiro até hoje — a lista vem ordenada por ele">A tirar no ano ↓</th>
              </tr>
            </thead>
            <tbody>
              {porMaisDevendo.map(p => {
                const s = saldos.get(p.id)
                if (!s) return null
                return (
                  <tr key={p.id} className={p.id === minhaPessoaId ? 'flg-eu' : undefined}>
                    <td className="flg-resumo-nome"><span className="flg-ponto" style={{ background: p.cor }} />{p.nome}</td>
                    <td>{times.find(t => t.id === p.time_id)?.nome || '—'}</td>
                    <td>{s.mes.direito}</td>
                    <td>{s.mes.usadas}</td>
                    <td>{s.mes.ajuste || '—'}</td>
                    <td><ATirar n={s.mes.aTirar} /></td>
                    <td>{s.mes.deslocamentos || '—'}</td>
                    <td><ATirar n={s.ano.aTirar} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="flg-legenda">
            Cada sábado, domingo e feriado gera uma folga de direito. Feriado que cai em
            fim de semana não conta duas vezes. As folgas de direito contam só até hoje —
            um mês que ainda não chegou não gera dívida.
          </div>
        </div>
      )}
    </div>
  )
}
