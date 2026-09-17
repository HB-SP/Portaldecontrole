import { useState, useMemo, useEffect, useRef } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { parseData } from '../lib/datas'
import { FUNCOES_ESCALA as FUNCOES } from '../lib/escalaLink'
import { useHubFornecedores } from '../hooks/useHubFornecedores'
import FornecedorPicker from './FornecedorPicker'
import EscalaGeralLista from './EscalaGeralLista'
import { BadgeCamp, Escudo, estiloCampeonato } from './campeonatoVisual'
// "Não" gravado na coluna da função = o jogo NÃO terá essa função (não é
// pendência). Vazio = pendente. Qualquer outro texto = prestador definido.
const naoTem = v => /^n[aã]o$/i.test(String(v || '').trim())

// Ficha completa: por função, Sim/Não + prestador
function FichaFuncoes({ row, cor, fornecedores, onClose, onSave }) {
  const init = {}
  FUNCOES.forEach(fn => {
    const v = row[fn.key] || ''
    init[fn.key] = { tem: !naoTem(v), nome: naoTem(v) ? '' : v }
  })
  const [form, setForm] = useState(init)
  const [obs, setObs] = useState(row.obs || '')
  const set = (k, patch) => setForm(prev => ({ ...prev, [k]: { ...prev[k], ...patch } }))

  const salvar = async () => {
    // Grava só o que mudou em relação ao snapshot da abertura da ficha:
    // mandar as 4 funções inteiras sobrescreveria edição concorrente feita
    // (por outro usuário ou pelo realtime) enquanto a ficha estava aberta.
    const payload = {}
    const obsTrim = obs.trim()
    if (obsTrim !== String(row.obs || '')) payload.obs = obsTrim
    FUNCOES.forEach(fn => {
      const f = form[fn.key]
      const nome = f.tem ? f.nome.trim() : 'Não'
      if (nome !== String(row[fn.key] || '')) payload[fn.key] = nome
    })
    if (Object.keys(payload).length > 0) await onSave(payload)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-header-accent" style={{ background: cor }} />
            <div>
              <div className="modal-title">{row.mandante} × {row.visitante}</div>
              <div className="modal-subtitle">{[row.campeonato, row.data, row.horario].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        <div className="modal-body" style={{ padding: '16px 20px' }}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) salvar() }}>
          {FUNCOES.map(fn => {
            const f = form[fn.key]
            return (
              <div key={fn.key} className="eg-ficha-linha">
                <span className="eg-ficha-label">{fn.label}</span>
                <div className="esc-eq-toggle" style={{ padding: 0, flex: '0 0 110px' }}>
                  <button className={f.tem ? 'is-on' : ''} onClick={() => set(fn.key, { tem: true })}>Sim</button>
                  <button className={!f.tem ? 'is-on is-off' : ''} onClick={() => set(fn.key, { tem: false })}>Não</button>
                </div>
                {f.tem ? (<>
                  <FornecedorPicker value={f.nome} onChange={v => set(fn.key, { nome: v })}
                    colKey={fn.key} fornecedores={fornecedores}
                    placeholder="Prestador(es)... (use / para dois)" />
                </>) : (
                  <span className="eg-ficha-sem">sem esta função neste jogo</span>
                )}
              </div>
            )
          })}
          <div className="eg-ficha-linha" style={{ alignItems: 'flex-start' }}>
            <span className="eg-ficha-label" style={{ paddingTop: 8 }}>Observações</span>
            <textarea className="eg-ficha-input" rows={2} value={obs} placeholder="Anotações do jogo (ex: CazéTV em campo)..."
              style={{ resize: 'vertical' }} onChange={e => setObs(e.target.value)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className="esc-limpar" onClick={onClose}>Cancelar</button>
            <button className="view-switch-add" style={{ background: cor, marginLeft: 0 }} onClick={salvar}>Salvar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── ESCALA GERAL ─────────────────────────────────────────────────────────────
// Todos os campeonatos numa aba só, em ordem cronológica (abre no dia de hoje).
// Controla as 4 funções de UM/produção: Coordenador UM, Produtor UM,
// Produtor de Campo e Monitoração — edição inline no card, igual à visão
// Escala do Controle. Dados na tabela `escala_geral` (realtime ligado).

// Jogos "YT Paulistão" não têm equipe escalada pela Livemode — não contam como
// pendência nem entram nos contadores (os slots seguem editáveis, mas neutros).
const semEscala = r => /^yt\s*paulist/i.test(String(r?.transmissao || '').trim())

// estiloCampeonato, BadgeCamp e Escudo vivem em ./campeonatoVisual — a visão
// lista usa os mesmos, e duas cópias da tabela de cores divergiriam na
// primeira mudança.

// Slot de função com até DUAS pessoas ("Fulano / Ciclano"). O separador " / "
// é o mesmo da planilha original.
// `mudo`: slot vazio sem o alerta âmbar (jogos que não escalam equipe).
// `conf`: confirmação de presença vinda do link externo (✓ confirmado / ✗ recusado).
function SlotPessoa({ row, fn, fornecedores, destaque, mudo, conf, onSave }) {
  const [aberto, setAberto] = useState(false)
  const [nome1, setNome1] = useState('')
  const [nome2, setNome2] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (!aberto) return
    // e.target.isConnected: clicar numa sugestão do picker desmonta o menu de
    // sugestões no próprio mousedown — sem o guard, este listener via o alvo
    // já fora do DOM, tratava como clique externo e fechava o popup inteiro.
    const fechar = e => { if (ref.current && e.target.isConnected && !ref.current.contains(e.target)) setAberto(false) }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [aberto])

  const atual = row[fn.key]
  const desativado = naoTem(atual) // "Não" = jogo não terá esta função
  const vazio = !desativado && (!atual || !String(atual).trim())
  const abrir = () => {
    const partes = desativado ? [] : String(atual || '').split('/').map(s => s.trim())
    setNome1(partes[0] || '')
    setNome2(partes.slice(1).join(' / ') || '')
    setAberto(a => !a)
  }
  const montar = () => [nome1.trim(), nome2.trim()].filter(Boolean).join(' / ')
  const salvar = n => {
    onSave(row.id, { [fn.key]: n })
    setAberto(false)
  }
  const salvarForm = () => salvar(montar())
  // Sugestão clicada preenche o primeiro campo vazio (1ª pessoa, senão 2ª)

  const texto = desativado ? 'Não' : vazio ? (mudo ? '—' : 'Definir') : String(atual)
  const classe = desativado ? 'esc-slot-off' : vazio ? (mudo ? 'esc-slot-off' : 'esc-slot-vazio') : ''
  return (
    <div className={`esc-slot ${classe} ${destaque ? 'esc-slot-destaque' : ''}`} ref={ref}>
      <button className="esc-slot-btn" onClick={abrir}
        title={`${fn.label}: ${texto}${conf ? ` — ${conf.status === 'confirmado' ? 'presença confirmada' : 'recusou'}${conf.obs ? ` ("${conf.obs}")` : ''}` : ''}`}>
        <span className="esc-slot-label">
          {fn.label}
          {conf && !vazio && !desativado && (
            <span className={`eg-conf ${conf.status === 'confirmado' ? 'eg-conf-ok' : 'eg-conf-nao'}`}>
              {conf.status === 'confirmado' ? '✓' : '✗'}
            </span>
          )}
        </span>
        <span className="esc-slot-valor">{texto}</span>
      </button>
      {aberto && (
        <div className="esc-slot-menu esc-slot-menu-picker">
          <div className="esc-slot-livre" style={{ borderTop: 'none', marginTop: 0 }}>
            <FornecedorPicker value={nome1} onChange={setNome1} colKey={fn.key}
              fornecedores={fornecedores} placeholder="1ª pessoa..." autoFocus compact
              onEnter={salvarForm} />
          </div>
          <div className="esc-slot-livre" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
            <FornecedorPicker value={nome2} onChange={setNome2} colKey={fn.key}
              fornecedores={fornecedores} placeholder="2ª pessoa (opcional)" compact
              onEnter={salvarForm} />
          </div>
          <div className="esc-slot-livre" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
            <button style={{ flex: 1 }} onClick={salvarForm}>OK</button>
          </div>
          {!desativado && <button className="esc-slot-opcao" onClick={() => salvar('Não')}>🚫 Não terá esta função</button>}
          {(!vazio || desativado) && <button className="esc-slot-limpar" onClick={() => salvar('')}>Limpar slot</button>}
        </div>
      )}
    </div>
  )
}

export default function EscalaGeralView() {
  const { fornecedores: hubFornecedores } = useHubFornecedores()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(isConfigured)
  const [erro, setErro] = useState(null)

  const [busca, setBusca] = useState('')
  const [fCamp, setFCamp] = useState('')
  const [fFuncao, setFFuncao] = useState('')
  const [fPessoa, setFPessoa] = useState('')
  const [soPendencias, setSoPendencias] = useState(false)
  const [soFuturos, setSoFuturos] = useState(true)
  const [ficha, setFicha] = useState(null) // linha aberta na ficha completa
  const [legendaAberta, setLegendaAberta] = useState(false) // campeonatos ocultos por padrão

  // Cards (trabalhar um jogo) x Lista (enxergar todos). A escolha fica salva —
  // quem prefere a lista não quer reescolher a cada visita.
  const [visao, setVisaoRaw] = useState(() => {
    try { return localStorage.getItem('eg_visao') || 'cards' } catch { return 'cards' }
  })
  const setVisao = v => { setVisaoRaw(v); try { localStorage.setItem('eg_visao', v) } catch { /* sem storage */ } }

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return }
    let cancelado = false
    async function carregar() {
      const { data, error } = await supabase.from('escala_geral').select('*')
      if (cancelado) return
      if (error) setErro(error.message)
      else setRows(data || [])
      setLoading(false)
    }
    carregar()
    const canal = supabase
      .channel('escala_geral_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escala_geral' }, carregar)
      .subscribe()
    return () => { cancelado = true; supabase.removeChannel(canal) }
  }, [])

  async function salvar(id, payload) {
    // Otimista + persistência; realtime confirma na sequência.
    // Em erro, desfaz — senão o card fica dessincronizado do banco.
    const anterior = rows.find(r => r.id === id)
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...payload } : r)))
    const { error } = await supabase.from('escala_geral')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      alert('Falha ao salvar: ' + error.message)
      if (anterior) setRows(prev => prev.map(r => (r.id === id ? anterior : r)))
    }
  }

  // Confirmações de presença dos links externos → ✓/✗ nos slots, ao vivo
  const [confirmacoes, setConfirmacoes] = useState(new Map())
  useEffect(() => {
    if (!isConfigured) return
    let cancelado = false
    async function carregarConfs() {
      const { data } = await supabase.from('escala_confirmacoes')
        .select('jogo_ref, funcao, status, obs').eq('origem', 'escala_geral')
      if (cancelado || !data) return
      setConfirmacoes(new Map(data.map(c => [`${c.jogo_ref}|${c.funcao}`, c])))
    }
    carregarConfs()
    const canal = supabase
      .channel('escala_geral_confs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escala_confirmacoes' }, carregarConfs)
      .subscribe()
    return () => { cancelado = true; supabase.removeChannel(canal) }
  }, [])

  const norm = s => String(s || '').toLowerCase()
  const campeonatos = useMemo(() => [...new Set(rows.map(r => r.campeonato).filter(Boolean))].sort(), [rows])

  // Sugestões de nomes por função: valores com "/" (dupla na mesma célula) são
  // SEPARADOS em nomes individuais — a lista só tem pessoas, nunca duplas.
  const sugestoesPorFn = useMemo(() => {
    const map = {}
    FUNCOES.forEach(fn => {
      const set = new Set()
      rows.forEach(r => {
        const v = r[fn.key]
        if (!v || naoTem(v)) return
        String(v).split('/').map(s => s.trim()).filter(Boolean).forEach(p => set.add(p))
      })
      map[fn.key] = [...set].sort((a, b) => a.localeCompare(b))
    })
    return map
  }, [rows])

  const pessoas = useMemo(() => {
    const set = new Set()
    Object.values(sugestoesPorFn).forEach(lista => lista.forEach(p => set.add(p)))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [sugestoesPorFn])

  const hoje0 = useMemo(() => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), h.getDate()) }, [])

  const filtrados = useMemo(() => rows.filter(r => {
    if (fCamp && r.campeonato !== fCamp) return false
    if (busca && !(norm(r.mandante).includes(norm(busca)) || norm(r.visitante).includes(norm(busca)) || norm(r.cidade).includes(norm(busca)))) return false
    if (fPessoa && !FUNCOES.some(fn => !naoTem(r[fn.key]) && norm(r[fn.key]).includes(norm(fPessoa)))) return false
    if (soPendencias) {
      if (semEscala(r)) return false // YT Paulistão: não escala equipe, não é pendência
      const alvo = fFuncao ? FUNCOES.filter(fn => fn.key === fFuncao) : FUNCOES
      // Pendente = vazio; "Não" (função que o jogo não terá) não é pendência
      if (!alvo.some(fn => !naoTem(r[fn.key]) && (!r[fn.key] || !String(r[fn.key]).trim()))) return false
    }
    if (soFuturos) {
      const d = parseData(r.data)
      if (d && d < hoje0) return false
    }
    return true
  }), [rows, busca, fCamp, fPessoa, fFuncao, soPendencias, soFuturos, hoje0])

  // Agrupa por data, em ordem cronológica
  const porData = useMemo(() => {
    const map = new Map()
    filtrados.forEach(r => {
      const d = parseData(r.data)
      const k = d ? d.toISOString().slice(0, 10) : 'zz-sem-data'
      if (!map.has(k)) map.set(k, { label: r.data || 'Sem data', dia: r.dia || '', lista: [] })
      map.get(k).lista.push(r)
    })
    map.forEach(g => g.lista.sort((a, b) => String(a.horario).localeCompare(String(b.horario))))
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtrados])

  // Abre no primeiro dia >= hoje
  const secRefs = useRef({})
  const jaRolou = useRef(false)
  useEffect(() => {
    if (jaRolou.current || porData.length === 0 || !soFuturos) return
    const hojeK = hoje0.toISOString().slice(0, 10)
    const alvo = porData.find(([k]) => k >= hojeK)
    const el = alvo && secRefs.current[alvo[0]]
    if (!el) return
    jaRolou.current = true
    requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [porData.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const funcoesVisiveis = fFuncao ? FUNCOES.filter(fn => fn.key === fFuncao) : FUNCOES
  // Contadores: só funções ATIVAS (marcadas "Não" ficam fora do denominador)
  const ativasDe = r => FUNCOES.filter(fn => !naoTem(r[fn.key]))
  const okDe = r => ativasDe(r).filter(fn => r[fn.key] && String(r[fn.key]).trim())
  const comEscala = filtrados.filter(r => !semEscala(r))
  const totalSlots = comEscala.reduce((s, r) => s + ativasDe(r).length, 0)
  const slotsOk = comEscala.reduce((s, r) => s + okDe(r).length, 0)
  const filtroAtivo = busca || fCamp || fFuncao || fPessoa || soPendencias

  // Contagem por campeonato para a legenda (respeita "A partir de hoje").
  // ATENÇÃO: precisa vir ANTES dos returns condicionais abaixo — hook depois
  // de return condicional muda a contagem de hooks entre renders e crasha.
  const contagemCamp = useMemo(() => {
    const map = {}
    rows.forEach(r => {
      if (soFuturos) { const d = parseData(r.data); if (d && d < hoje0) return }
      map[r.campeonato] = (map[r.campeonato] || 0) + 1
    })
    return map
  }, [rows, soFuturos, hoje0])

  if (erro) {
    const semTabela = /escala_geral/.test(erro) || /does not exist|relation/.test(erro)
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <p style={{ fontWeight: 700, marginBottom: 8 }}>{semTabela ? 'Tabela escala_geral ainda não existe' : 'Erro ao carregar'}</p>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{semTabela ? 'Rode supabase_escala_geral.sql no SQL Editor do Supabase.' : erro}</p>
      </div>
    )
  }
  if (loading) return <div className="esc-vazio">Carregando escala geral...</div>

  return (
    <div className="esc-wrap">
      {/* Alternador de visão em linha própria e no topo: enfiado no fim da
          barra de filtros ele passava despercebido — foi o que aconteceu com o
          toggle Escala/Planilha do Controle, que ninguém achava. */}
      <div className="eg-visao-barra">
        <span className="eg-visao-rotulo">Visualização</span>
        <div className="eg-visao-switch">
          {[['lista', '▤', 'Lista', 'Uma linha por jogo — para bater o olho em muitos jogos de uma vez'],
            ['cards', '🗂', 'Cards', 'Um card por jogo — mais espaço para preencher a escala']].map(([v, icone, rotulo, dica]) => (
            <button key={v} className={`eg-visao-btn${visao === v ? ' is-active' : ''}`}
              title={dica} onClick={() => setVisao(v)}>
              <span className="eg-visao-icone">{icone}</span>{rotulo}
            </button>
          ))}
        </div>
        {visao === 'lista' && (
          <span className="eg-visao-dica">Clique no nome de alguém para ver só os jogos dessa pessoa</span>
        )}
      </div>

      {/* Campeonatos ocultos por padrão; o botão abre a legenda clicável */}
      <div className="eg-legend">
        <button className={`eg-legend-chip ${legendaAberta ? 'is-on' : ''}`} onClick={() => setLegendaAberta(a => !a)}>
          🏆 Campeonatos {legendaAberta ? '▴' : '▾'}
        </button>
        {/* Com filtro ativo, o chip do campeonato escolhido fica visível mesmo fechado */}
        {!legendaAberta && fCamp && (() => {
          const { cor } = estiloCampeonato(fCamp)
          return (
            <button className="eg-legend-chip is-on" style={{ background: `${cor}15`, borderColor: cor, color: cor }}
              onClick={() => setFCamp('')}>
              <BadgeCamp nome={fCamp} size={20} />
              <span className="eg-legend-nome">{fCamp}</span>
              <span>✕</span>
            </button>
          )
        })()}
        {legendaAberta && campeonatos
          .slice()
          .sort((a, b) => (contagemCamp[b] || 0) - (contagemCamp[a] || 0))
          .map(c => {
            const { cor } = estiloCampeonato(c)
            const ativo = fCamp === c
            return (
              <button key={c} className={`eg-legend-chip ${ativo ? 'is-on' : ''}`}
                style={ativo ? { background: `${cor}15`, borderColor: cor, color: cor } : undefined}
                onClick={() => setFCamp(ativo ? '' : c)}>
                <BadgeCamp nome={c} size={20} />
                <span className="eg-legend-nome">{c}</span>
                <span className="eg-legend-count">{contagemCamp[c] || 0}</span>
              </button>
            )
          })}
      </div>

      <div className="esc-toolbar">
        <input className="esc-busca" placeholder="🔍 Time ou cidade..." value={busca} onChange={e => setBusca(e.target.value)} />
        <select value={fFuncao} onChange={e => setFFuncao(e.target.value)}>
          <option value="">Todas funções</option>
          {FUNCOES.map(fn => <option key={fn.key} value={fn.key}>{fn.label}</option>)}
        </select>
        <input className="esc-forn" list="eg-pessoas" placeholder="Pessoa..." value={fPessoa} onChange={e => setFPessoa(e.target.value)} />
        <datalist id="eg-pessoas">
          {pessoas.map(p => <option key={p} value={p} />)}
        </datalist>
        <button className={`esc-toggle-pend ${soPendencias ? 'is-on' : ''}`} onClick={() => setSoPendencias(p => !p)}>
          ⚠ Só pendências
        </button>
        <button className={`esc-toggle-pend ${soFuturos ? 'is-on' : ''}`} style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: soFuturos ? 'var(--bg-surface2)' : 'transparent' }}
          onClick={() => setSoFuturos(p => !p)}>
          A partir de hoje
        </button>
        {filtroAtivo && (
          <button className="esc-limpar" onClick={() => { setBusca(''); setFCamp(''); setFFuncao(''); setFPessoa(''); setSoPendencias(false) }}>
            Limpar ✕
          </button>
        )}
        <div className="esc-resumo">
          <strong>{filtrados.length}</strong> jogos ·{' '}
          <strong style={{ color: totalSlots && slotsOk === totalSlots ? 'var(--green, #16a34a)' : undefined }}>{slotsOk}/{totalSlots}</strong>{' '}slots
        </div>
      </div>

      {visao === 'lista' ? (
        <EscalaGeralLista
          grupos={porData}
          funcoes={funcoesVisiveis}
          confirmacoes={confirmacoes}
          fPessoa={fPessoa}
          // Clicar no nome filtra por ele; clicar de novo no mesmo nome limpa.
          // O trim casa com o da célula, onde o nome já vem sem espaços — sem
          // ele, um nome digitado à mão no campo "Pessoa" não desligaria.
          onPessoa={p => setFPessoa(atual => (norm(atual).trim() === norm(p).trim() ? '' : p))}
          onFicha={setFicha}
          onPublicarDia={lista => lista.forEach(r => salvar(r.id, { escala_publicada: true }))}
          onTogglePub={r => salvar(r.id, { escala_publicada: !r.escala_publicada })}
        />
      ) : (<>

      {porData.length === 0 && <div className="esc-vazio">Nenhum jogo com esses filtros.</div>}

      {porData.map(([k, grupo]) => (
        <section key={k} className="esc-rodada" ref={el => { secRefs.current[k] = el }}>
          <header className="esc-rodada-header">
            <span className="esc-rodada-num" style={{ color: 'var(--text)', fontSize: 22, minWidth: 'auto' }}>{grupo.label}</span>
            <div>
              <p className="esc-rodada-titulo">{grupo.dia}</p>
              <p className="esc-rodada-sub">{grupo.lista.length} {grupo.lista.length === 1 ? 'jogo' : 'jogos'}</p>
            </div>
            {grupo.lista.some(r => !r.escala_publicada) && (
              <button className="eg-pub-lote" title="Publica a escala de todos os jogos deste dia — eles passam a aparecer nos links dos prestadores"
                onClick={() => grupo.lista.filter(r => !r.escala_publicada).forEach(r => salvar(r.id, { escala_publicada: true }))}>
                📢 Publicar dia
              </button>
            )}
          </header>

          <div className="esc-cards">
            {grupo.lista.map(r => {
              const { cor } = estiloCampeonato(r.campeonato)
              const mudo = semEscala(r)
              const ativas = ativasDe(r).length
              const preenchidos = okDe(r).length
              const pct = ativas ? (preenchidos / ativas) * 100 : 100
              return (
                <article key={r.id} className="esc-card eg-card" style={{ borderTopColor: cor, borderLeft: `4px solid ${cor}` }}>
                  <header className="esc-card-header">
                    <div className="esc-card-jogo">
                      <div className="esc-card-times">
                        <BadgeCamp nome={r.campeonato} />
                        <Escudo nome={r.mandante} />
                        <span className="esc-card-nome">{r.mandante}</span>
                        <span className="esc-card-x">×</span>
                        <span className="esc-card-nome">{r.visitante}</span>
                        <Escudo nome={r.visitante} />
                      </div>
                      <p className="esc-card-meta">
                        <span style={{ color: cor, fontWeight: 700 }}>{r.campeonato}</span>
                        {[r.horario, r.cidade, r.estadio, r.fase_rodada].filter(Boolean).length > 0 && ' · '}
                        {[r.horario, r.cidade, r.estadio, r.fase_rodada].filter(Boolean).join(' · ')}
                      </p>
                      {r.obs && <p className="esc-card-meta" style={{ fontStyle: 'italic' }}>📝 {r.obs}</p>}
                    </div>
                    <div className="esc-card-chips">
                      {mudo && <span className="esc-chip" title="Sem equipe escalada pela Livemode">Sem escala</span>}
                      {r.transmissao && <span className="esc-chip">{r.transmissao}</span>}
                    </div>
                  </header>

                  <div className="esc-slots" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                    {funcoesVisiveis.map(fn => (
                      <SlotPessoa
                        key={fn.key}
                        row={r}
                        fn={fn}
                        fornecedores={hubFornecedores}
                        destaque={!!fPessoa && norm(r[fn.key]).includes(norm(fPessoa))}
                        mudo={mudo}
                        conf={confirmacoes.get(`${r.id}|${fn.label}`)}
                        onSave={salvar}
                      />
                    ))}
                  </div>

                  <footer className="esc-card-footer">
                    {!mudo && (<>
                      <div className="esc-card-progresso">
                        <span style={{ width: `${pct}%`, background: pct === 100 ? 'var(--green, #16a34a)' : cor }} />
                      </div>
                      <span className="esc-card-contagem">{preenchidos}/{ativas}</span>
                    </>)}
                    {mudo && <span className="esc-card-contagem" style={{ flex: 1 }}>sem equipe escalada</span>}
                    <button
                      className={`eg-pub ${r.escala_publicada ? 'is-on' : ''}`}
                      title={r.escala_publicada
                        ? 'Escala publicada — visível nos links dos prestadores. Clique para voltar a rascunho.'
                        : 'Rascunho — invisível para os prestadores. Clique para publicar.'}
                      onClick={() => salvar(r.id, { escala_publicada: !r.escala_publicada })}>
                      {r.escala_publicada ? '✓ Publicada' : 'Rascunho'}
                    </button>
                    <button className="esc-card-ficha" onClick={() => setFicha(r)}>Ficha completa →</button>
                  </footer>
                </article>
              )
            })}
          </div>
        </section>
      ))}

      </>)}

      {ficha && (
        <FichaFuncoes
          row={ficha}
          fornecedores={hubFornecedores}
          cor={estiloCampeonato(ficha.campeonato).cor}
          onClose={() => setFicha(null)}
          onSave={async payload => { await salvar(ficha.id, payload) }}
        />
      )}
    </div>
  )
}
