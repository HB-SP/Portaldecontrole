// ─── ESCALAR ─────────────────────────────────────────────────────────────────
// Um lugar só para preencher TODAS as categorias de um jogo. Antes era preciso
// passar por três telas: Controle e Periférico (abas do campeonato) e a Escala
// Geral (no menu). Aqui é uma planilha: linha por jogo, todos os campeonatos
// juntos, e você escolhe quais colunas quer ver — como as views do Airtable.
//
// A tela NÃO sabe em que tabela cada coluna mora. Ela pede o valor e manda
// salvar; quem resolve o destino é config/colunasEscalar.js + useEscalarDados.

import { useState, useMemo, useRef, useEffect } from 'react'
import { montarCatalogo, ehComumATodos, valorDe, ehDeFornecedor, pessoasDaColuna, funcaoSugerida, GRUPOS } from '../config/colunasEscalar'
import { estaCadastrado, ehTelefone, acharCadastro, whatsappDe } from '../config/funcoesFornecedor'
import { useHubFornecedores, cadastrarFornecedor } from '../hooks/useHubFornecedores'
import { useEscalarDados } from '../hooks/useEscalarDados'
import { BadgeCamp } from './campeonatoVisual'
import { parseData, compararPorData } from '../lib/datas'

const CHAVE_COLUNAS = 'escalar_colunas_v1'

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

function rotuloData(bruta) {
  const d = parseData(bruta)
  if (!d) return String(bruta || '—')
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${SEMANA[d.getDay()]}`
}

const rodadaDe = j => String(j.row.rod || j.row.eu || '').trim()

const BASE_VAZIA = { deFornecedor: false, fornecedores: [], pessoas: [], funcao: '' }

// ── DUAS PESSOAS NA MESMA CÉLULA ─────────────────────────────────────────────
// Há jogo com dois Produtores UM, dois de Campo, dois supervisores. A planilha
// sempre resolveu isso com "Fulano / Ciclano", e é essa a convenção do resto do
// portal: a Escala Geral escreve assim, e a checagem contra a base de
// fornecedores já parte o valor por "/" e confere cada nome. Aqui é a mesma
// coisa — não um formato novo.
const partesDe = v => String(v || '').split('/').map(x => x.trim()).filter(Boolean)
const juntar = partes => partes.filter(Boolean).join(' / ')

// Arruma o que foi digitado: tira espaço sobrando e barra solta no fim, para
// que "Fulano /" não vire um nome vazio gravado no banco.
const arrumar = v => juntar(partesDe(v))

// A lista de sugestões precisa casar com o TEXTO INTEIRO do campo, porque é
// assim que o navegador filtra. Então, quando já existe um primeiro nome, cada
// sugestão vira "primeiro / candidato" — sem isso o autocompletar morria no
// segundo nome, que é exatamente onde ele mais ajuda.
function sugestoesDaDupla(rascunho, pessoas) {
  const anteriores = String(rascunho || '').split('/').slice(0, -1).map(x => x.trim()).filter(Boolean)
  if (!anteriores.length) return pessoas.map(f => ({ ...f, texto: f.apelido }))
  const prefixo = anteriores.join(' / ')
  return pessoas
    .filter(f => !anteriores.includes(f.apelido))
    .map(f => ({ ...f, texto: `${prefixo} / ${f.apelido}` }))
}

// ── QUEM ESTÁ NA CÉLULA ──────────────────────────────────────────────────────
// O telefone NÃO fica na célula. Ele vive no cadastro da pessoa, e daqui sai o
// botão de WhatsApp — assim o contato continua a um clique sem que o número
// seja digitado (e redigitado, e errado) em cada jogo.
//
// Telefone que AINDA está escrito na célula aparece em cinza, sem virar
// etiqueta de pessoa: é dado antigo esperando para ser movido, não gente.
function Pessoas({ valor, fornecedores }) {
  const partes = partesDe(valor)
  if (!partes.length) return null
  return partes.map((nome, i) => {
    if (ehTelefone(nome)) return <span key={i} className="escalar-tel">{nome}</span>
    const cadastro = acharCadastro(nome, fornecedores)
    const zap = whatsappDe(cadastro?.telefone)
    const so = partes.length === 1
    return (
      <span key={i} className={so ? 'escalar-so' : 'escalar-pessoa'}>
        {nome}
        {zap && (
          <a
            className="escalar-zap" href={zap} target="_blank" rel="noreferrer"
            title={`Falar com ${nome} no WhatsApp`}
            onClick={e => e.stopPropagation()}
          >✆</a>
        )}
      </span>
    )
  })
}

// Nome preenchido que não existe na base de fornecedores/prestadores.
function foraDaBase(jogo, col, base) {
  if (!base?.deFornecedor) return false
  const v = valorDe(jogo, col)
  return !!v && !estaCadastrado(v, base.fornecedores)
}

// ── Uma célula ───────────────────────────────────────────────────────────────
// Fechada é só texto (a planilha tem que dar para bater o olho). Clicou, vira
// campo. Enter ou sair do campo salva; Esc desiste.
function Celula({ jogo, col, sugestoes, base, onSalvar }) {
  const valor = valorDe(jogo, col)
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState('')
  const [salvando, setSalvando] = useState(false)
  // Teclar Enter (ou escolher no select) fecha o campo, e fechar dispara o
  // onBlur — que gravaria de novo, com o valor de antes da escolha. Esta trava
  // faz a edição valer UMA vez só.
  const jaGravou = useRef(false)
  const campoRef = useRef(null)
  const idLista = `sug-${col.id}`

  if (valor === null) {
    return <td className="escalar-cel escalar-cel-na" title={`${jogo.comp.label} não tem "${col.label}"`} />
  }

  function abrir() {
    jaGravou.current = false
    setRascunho(valor)
    setEditando(true)
  }

  async function confirmar(bruto) {
    if (jaGravou.current) return
    jaGravou.current = true
    setEditando(false)
    // Uma célula de gente pode ter duas pessoas; grava no formato "A / B".
    const v = base.deFornecedor ? arrumar(bruto) : String(bruto || '').trim()
    if (v === valor) return
    setSalvando(true)
    const falha = await onSalvar(jogo, col, v)
    setSalvando(false)
    if (falha) { alert(`Não deu para salvar "${col.label}": ${falha}`); return }
    // Salvou. Se o nome não existe na base, oferece cadastrar na hora — é o
    // momento em que a pessoa sabe quem é; depois ninguém volta para arrumar.
    if (!base.deFornecedor || !v) return
    // Pergunta por nome, não pela célula: numa dupla, um pode estar cadastrado
    // e o outro não.
    for (const nome of partesDe(v)) {
      if (estaCadastrado(nome, base.fornecedores)) continue
      if (!confirm(`"${nome}" não está cadastrado. Cadastrar como ${base.funcao}?`)) continue
      try { await cadastrarFornecedor({ apelido: nome, funcao: base.funcao, tipo: 'Prestador' }) }
      catch (e) { alert('Não deu para cadastrar: ' + e.message) }
    }
  }

  // Nome preenchido que não existe na base de fornecedores/prestadores. É o
  // sinal de erro de digitação e de nome duplicado ("Marcos Paulo" x "Marcos
  // paulo"), que é justamente o que se quer evitar.
  const foraDaBase = base.deFornecedor && !!valor && !estaCadastrado(valor, base.fornecedores)

  if (!editando) {
    return (
      <td
        className={`escalar-cel${valor ? '' : ' escalar-cel-vazia'}${salvando ? ' escalar-cel-salvando' : ''}${foraDaBase ? ' escalar-cel-fora' : ''}`}
        onClick={abrir}
        title={foraDaBase ? `"${valor}" não está cadastrado — escolha da lista ou cadastre` : (valor || 'clique para preencher')}
      >
        {base.deFornecedor
          ? <Pessoas valor={valor} fornecedores={base.fornecedores} />
          : (valor || '')}
      </td>
    )
  }

  // Acrescenta um lugar para a próxima pessoa e devolve o foco ao campo.
  function maisUma() {
    // Célula vazia: não há primeira pessoa para vir antes da barra.
    setRascunho(r => (arrumar(r) ? `${arrumar(r)} / ` : r))
    requestAnimationFrame(() => campoRef.current?.focus())
  }

  const comum = {
    autoFocus: true,
    value: rascunho,
    className: 'escalar-input',
    onKeyDown: e => {
      if (e.key === 'Enter') { e.preventDefault(); confirmar(rascunho.trim()) }
      if (e.key === 'Escape') { e.preventDefault(); jaGravou.current = true; setEditando(false) }
    },
    onBlur: () => confirmar(rascunho.trim()),
  }

  return (
    <td className="escalar-cel escalar-cel-edit">
      {col.tipo === 'simnao' ? (
        <select {...comum} onChange={e => confirmar(e.target.value)}>
          <option value="">—</option>
          <option value="Sim">Sim</option>
          <option value="Não">Não</option>
        </select>
      ) : col.opcoes?.length ? (
        <select {...comum} onChange={e => confirmar(e.target.value)}>
          <option value="">—</option>
          {col.opcoes.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <div className="escalar-campo">
          <input {...comum} ref={campoRef} list={idLista} onChange={e => setRascunho(e.target.value)} />
          {base.deFornecedor && (
            <button
              type="button" className="escalar-mais" title="Acrescentar uma 2ª pessoa nesta célula"
              onMouseDown={e => { e.preventDefault(); maisUma() }}
            >＋</button>
          )}
          <datalist id={idLista}>
            {base.deFornecedor
              ? sugestoesDaDupla(rascunho, base.pessoas).map(f => (
                  <option key={`${f.id}-${f.apelido}`} value={f.texto} label={f.funcao || undefined} />
                ))
              : sugestoes.map(s => <option key={s} value={s} />)}
          </datalist>
        </div>
      )}
    </td>
  )
}

// ── Escolher quais colunas aparecem ──────────────────────────────────────────
function PainelColunas({ catalogo, visiveis, setVisiveis, competitions, onFechar }) {
  const ref = useRef(null)
  useEffect(() => {
    const fora = e => { if (ref.current && e.target.isConnected && !ref.current.contains(e.target)) onFechar() }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [onFechar])

  // Parte SEMPRE da lista que está na tela (`visiveis`), nunca do estado cru do
  // pai: enquanto ninguém escolheu nada, o estado é nulo e a tela mostra o
  // conjunto padrão — marcar uma coluna a partir do estado cru apagaria todas
  // as outras.
  const alternar = id => setVisiveis(visiveis.includes(id) ? visiveis.filter(x => x !== id) : [...visiveis, id])
  const marcarGrupo = (grupo, ligar) => {
    const doGrupo = catalogo.filter(c => c.grupo === grupo).map(c => c.id)
    setVisiveis(ligar ? [...new Set([...visiveis, ...doGrupo])] : visiveis.filter(x => !doGrupo.includes(x)))
  }

  return (
    <div className="escalar-painel" ref={ref}>
      <div className="escalar-painel-topo">
        <strong>Colunas</strong>
        <button className="escalar-link" onClick={() => setVisiveis(catalogo.filter(c => ehComumATodos(c, competitions)).map(c => c.id))}>
          só as comuns a todos
        </button>
      </div>
      {GRUPOS.map(grupo => {
        const doGrupo = catalogo.filter(c => c.grupo === grupo)
        if (!doGrupo.length) return null
        const todasOn = doGrupo.every(c => visiveis.includes(c.id))
        return (
          <div key={grupo} className="escalar-painel-grupo">
            <div className="escalar-painel-grupo-topo">
              <span>{grupo}</span>
              <button className="escalar-link" onClick={() => marcarGrupo(grupo, !todasOn)}>
                {todasOn ? 'limpar' : 'marcar todas'}
              </button>
            </div>
            {doGrupo.map(c => (
              <label key={c.id} className="escalar-painel-item">
                <input type="checkbox" checked={visiveis.includes(c.id)} onChange={() => alternar(c.id)} />
                <span>{c.label}</span>
                {!ehComumATodos(c, competitions) && <span className="escalar-painel-so">só em alguns</span>}
              </label>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── A tela ───────────────────────────────────────────────────────────────────
// `compFixa` = aberta de dentro de um campeonato: já entra filtrada nele e sem
// o seletor de campeonato.
export default function EscalarView({ competitions, compFixa = null }) {
  const { jogos, loading, erro, salvar } = useEscalarDados(competitions)
  const { fornecedores } = useHubFornecedores()

  const catalogo = useMemo(() => montarCatalogo(competitions), [competitions])

  const [visiveis, setVisiveisRaw] = useState(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_COLUNAS) || 'null')
      if (Array.isArray(salvo) && salvo.length) return salvo
    } catch { /* sem storage */ }
    return null   // null = ainda não escolhido; resolvido no useMemo abaixo
  })
  const setVisiveis = lista => {
    try { localStorage.setItem(CHAVE_COLUNAS, JSON.stringify(lista)) } catch { /* sem storage */ }
    setVisiveisRaw(lista)
  }

  // Padrão: as colunas que existem em TODOS os campeonatos. É o conjunto que
  // não deixa buraco na tela global.
  const colunasVisiveis = useMemo(() => {
    if (!visiveis) return catalogo.filter(c => ehComumATodos(c, competitions))
    return catalogo.filter(c => visiveis.includes(c.id))
  }, [catalogo, visiveis, competitions])

  // Por coluna: se ela se preenche com gente da base, quem pode preenchê-la e
  // com que função entra alguém cadastrado ali. Calculado uma vez para toda a
  // tabela — não por célula, que seriam milhares de vezes o mesmo trabalho.
  const basePorCol = useMemo(() => {
    const map = {}
    for (const col of colunasVisiveis) {
      const deFornecedor = ehDeFornecedor(col, competitions)
      map[col.id] = {
        deFornecedor, fornecedores,
        pessoas: deFornecedor ? pessoasDaColuna(col, competitions, fornecedores) : [],
        funcao: deFornecedor ? funcaoSugerida(col, competitions) : '',
      }
    }
    return map
  }, [colunasVisiveis, competitions, fornecedores])

  const [painelAberto, setPainelAberto] = useState(false)
  const [fCamp, setFCamp] = useState(compFixa || '')
  const [fRodada, setFRodada] = useState('')
  const [busca, setBusca] = useState('')
  const [soFalta, setSoFalta] = useState(false)
  const [soFora, setSoFora] = useState(false)

  useEffect(() => { if (compFixa) setFCamp(compFixa) }, [compFixa])

  const rodadas = useMemo(() => {
    const base = fCamp ? jogos.filter(j => j.comp.id === fCamp) : jogos
    const set = new Set(base.map(rodadaDe).filter(Boolean))
    return [...set].sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || a.localeCompare(b))
  }, [jogos, fCamp])

  // Sugestões de preenchimento: o que já foi digitado naquela coluna, em
  // qualquer jogo. É o autocompletar de nome de pessoa e de fornecedor.
  const sugestoesPorCol = useMemo(() => {
    const map = {}
    for (const col of colunasVisiveis) {
      if (col.tipo === 'simnao' || col.opcoes?.length) continue
      if (basePorCol[col.id]?.deFornecedor) continue   // esta lista vem da base, não do histórico
      const set = new Set()
      for (const j of jogos) {
        const v = valorDe(j, col)
        if (v) set.add(v)
      }
      map[col.id] = [...set].sort((a, b) => a.localeCompare(b)).slice(0, 200)
    }
    return map
  }, [jogos, colunasVisiveis, basePorCol])

  const linhas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return jogos
      .filter(j => {
        if (fCamp && j.comp.id !== fCamp) return false
        if (fRodada && rodadaDe(j) !== fRodada) return false
        if (termo) {
          const alvo = `${j.row.mandante} ${j.row.visitante} ${j.comp.label} ${j.row.estadio || ''} ${j.row.cidade || ''}`.toLowerCase()
          if (!alvo.includes(termo)) return false
        }
        if (soFalta) {
          const temBuraco = colunasVisiveis.some(c => valorDe(j, c) === '')
          if (!temBuraco) return false
        }
        if (soFora && !colunasVisiveis.some(c => foraDaBase(j, c, basePorCol[c.id]))) return false
        return true
      })
      .sort((a, b) => compararPorData(a.row, b.row))
  }, [jogos, fCamp, fRodada, busca, soFalta, soFora, colunasVisiveis, basePorCol])

  const quantasFaltam = useMemo(
    () => linhas.reduce((tot, j) => tot + colunasVisiveis.filter(c => valorDe(j, c) === '').length, 0),
    [linhas, colunasVisiveis]
  )

  const quantasFora = useMemo(
    () => linhas.reduce((tot, j) => tot + colunasVisiveis.filter(c => foraDaBase(j, c, basePorCol[c.id])).length, 0),
    [linhas, colunasVisiveis, basePorCol]
  )

  if (loading && !jogos.length) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div className="skeleton-cell" style={{ width: 220, height: 20, margin: '0 auto 16px' }} />
        <div className="skeleton-cell" style={{ width: 320, height: 14, margin: '0 auto' }} />
      </div>
    )
  }

  return (
    <div className="escalar">
      <div className="escalar-barra">
        {!compFixa && (
          <select className="escalar-sel" value={fCamp} onChange={e => { setFCamp(e.target.value); setFRodada('') }}>
            <option value="">Todos os campeonatos</option>
            {competitions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        )}
        <select className="escalar-sel" value={fRodada} onChange={e => setFRodada(e.target.value)}>
          <option value="">Todas as rodadas</option>
          {rodadas.map(r => <option key={r} value={r}>Rodada {r}</option>)}
        </select>
        <input
          className="escalar-busca" placeholder="Buscar time, estádio, cidade…"
          value={busca} onChange={e => setBusca(e.target.value)}
        />
        <label className="escalar-check">
          <input type="checkbox" checked={soFalta} onChange={e => setSoFalta(e.target.checked)} />
          só o que falta
        </label>
        <label className="escalar-check" title="Nomes preenchidos que não existem na base de fornecedores e prestadores">
          <input type="checkbox" checked={soFora} onChange={e => setSoFora(e.target.checked)} />
          só fora da base
        </label>
        <div className="escalar-espaco" />
        <span className="escalar-contagem">
          {linhas.length} {linhas.length === 1 ? 'jogo' : 'jogos'}
          {quantasFaltam > 0 && <> · <strong>{quantasFaltam}</strong> em branco</>}
          {quantasFora > 0 && <> · <strong className="escalar-fora-num">{quantasFora}</strong> fora da base</>}
        </span>
        <div className="escalar-painel-wrap">
          <button className="escalar-btn" onClick={() => setPainelAberto(a => !a)}>
            Colunas ({colunasVisiveis.length})
          </button>
          {painelAberto && (
            <PainelColunas
              catalogo={catalogo}
              visiveis={colunasVisiveis.map(c => c.id)}
              setVisiveis={setVisiveis}
              competitions={competitions}
              onFechar={() => setPainelAberto(false)}
            />
          )}
        </div>
      </div>

      {erro && <div className="escalar-erro">Parte dos dados não carregou — {erro}</div>}

      <div className="escalar-wrap">
        <table className="escalar-tab">
          <thead>
            <tr className="escalar-grupos">
              <th className="escalar-fix escalar-fix-1" rowSpan={2}>Camp.</th>
              <th className="escalar-fix escalar-fix-2" rowSpan={2}>Data</th>
              <th className="escalar-fix escalar-fix-3" rowSpan={2}>Jogo</th>
              <th rowSpan={2}>Rod.</th>
              {GRUPOS.map(g => {
                const n = colunasVisiveis.filter(c => c.grupo === g).length
                if (!n) return null
                return <th key={g} colSpan={n} className={`escalar-grupo escalar-grupo-${g.toLowerCase().replace(/[^a-z]/g, '')}`}>{g}</th>
              })}
            </tr>
            <tr>
              {colunasVisiveis.map(c => <th key={c.id} className="escalar-th-col">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {linhas.map(j => (
              <tr key={j.uid} className="escalar-linha" style={{ '--camp': j.comp.accentColor }}>
                <td className="escalar-fix escalar-fix-1 escalar-td-camp">
                  <BadgeCamp nome={j.comp.label} size={22} />
                </td>
                <td className="escalar-fix escalar-fix-2 escalar-td-data">{rotuloData(j.row.data)}</td>
                <td className="escalar-fix escalar-fix-3 escalar-td-jogo">
                  <span className="escalar-time">{j.row.mandante}</span>
                  <span className="escalar-x">×</span>
                  <span className="escalar-time">{j.row.visitante}</span>
                </td>
                <td className="escalar-td-rod">{rodadaDe(j) || '—'}</td>
                {colunasVisiveis.map(c => (
                  <Celula
                    key={c.id} jogo={j} col={c}
                    sugestoes={sugestoesPorCol[c.id] || []}
                    base={basePorCol[c.id] || BASE_VAZIA}
                    onSalvar={salvar}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!linhas.length && (
          <div className="escalar-vazio">
            {soFalta ? 'Nada em branco nas colunas que você está vendo.' : 'Nenhum jogo com esses filtros.'}
          </div>
        )}
      </div>
    </div>
  )
}
