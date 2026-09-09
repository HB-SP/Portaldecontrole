import { useState, useMemo, useEffect, useRef } from 'react'
import { useTableData } from '../hooks/useTableData'
import { useCompetitionEvents } from '../hooks/useCompetitionEvents'
import PerifericoModal from './PerifericoModal'
import ConfirmDialog from './ConfirmDialog'
import { getEscudoUrl } from '../lib/escudos'
import { compararPorData, rodadaAtual } from '../lib/datas'
import { useHubFornecedores } from '../hooks/useHubFornecedores'
import FornecedorPicker from './FornecedorPicker'
import { equipamentosDaConfig, equipamentoOk } from '../config/equipamentos'

// ─── PERIFÉRICOS — mesma estrutura da visão Escala do Controle ───────────────
// Cards por jogo agrupados por rodada (abre na rodada atual), slots de
// equipamento editáveis no clique. Cada equipamento tem 3 estados:
//   Não → slot apagado · Sim sem fornecedor → pendência (âmbar) ·
//   Sim com fornecedor → preenchido.

// A lista de equipamentos agora vem de ../config/equipamentos: fixa para o
// legado (Brasileirão e Paulistão Fem., que têm essas colunas na tabela
// física) e derivada das colunas do campeonato quando ele é dinâmico.

function Escudo({ nome, size = 26 }) {
  const url = getEscudoUrl(nome)
  if (!url) return <span className="esc-escudo esc-escudo-fallback" style={{ width: size, height: size }}>{(nome || '?').slice(0, 1)}</span>
  return <img className="esc-escudo" src={url} alt={nome} style={{ width: size, height: size }} loading="lazy" />
}

// Slot de equipamento: Sim/Não + fornecedor (+ qtde no DSLR), tudo inline.
function SlotEquip({ row, eq, destaque, fornecedores, onSave }) {
  const [aberto, setAberto] = useState(false)
  const [forn, setForn] = useState('')
  const [qtde, setQtde] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (!aberto) return
    // isConnected: a sugestão clicada no FornecedorPicker some do DOM no
    // mousedown; sem o guard o clique era lido como externo e o popup fechava
    // antes do OK — o fornecedor escolhido nunca era salvo (mesmo fix do Controle).
    const fechar = e => { if (ref.current && e.target.isConnected && !ref.current.contains(e.target)) setAberto(false) }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [aberto])

  const ativo = row[eq.key] === 'Sim'
  const fornecedor = eq.fornecedor ? row[eq.fornecedor] : ''
  // Equipamento sem coluna de fornecedor (ex.: Assinatura Craque) fica pronto
  // só com o "Sim" — sem este guard ele viveria marcado como pendência.
  const pendente = ativo && !!eq.fornecedor && (!fornecedor || !String(fornecedor).trim())
  const abrir = () => { setForn(fornecedor || ''); setQtde(eq.qtde ? (row[eq.qtde] || '') : ''); setAberto(a => !a) }

  const salvarSim = () => {
    const payload = { [eq.key]: 'Sim' }
    if (eq.fornecedor) payload[eq.fornecedor] = forn.trim()
    if (eq.qtde) payload[eq.qtde] = qtde.trim()
    onSave(row.id, payload)
    setAberto(false)
  }
  const salvarNao = () => {
    const payload = { [eq.key]: 'Não' }
    if (eq.fornecedor) payload[eq.fornecedor] = ''
    if (eq.qtde) payload[eq.qtde] = ''
    onSave(row.id, payload)
    setAberto(false)
  }

  const classe = !ativo ? 'esc-slot-off' : pendente ? 'esc-slot-vazio' : ''
  const valor = !ativo ? 'Não' : pendente ? 'Definir fornecedor' : `${fornecedor}${eq.qtde && row[eq.qtde] ? ` ×${row[eq.qtde]}` : ''}`

  return (
    <div className={`esc-slot ${classe} ${destaque ? 'esc-slot-destaque' : ''}`} ref={ref}>
      <button className="esc-slot-btn" onClick={abrir} title={`${eq.label}: ${valor}`}>
        <span className="esc-slot-label">{eq.label}</span>
        <span className="esc-slot-valor">{valor}</span>
      </button>
      {aberto && (
        <div className="esc-slot-menu">
          <div className="esc-eq-toggle">
            <button className={ativo ? 'is-on' : ''} onClick={salvarSim}>Sim</button>
            <button className={!ativo ? 'is-on is-off' : ''} onClick={salvarNao}>Não</button>
          </div>
          <div className="esc-slot-livre">
            {eq.fornecedor && (
              <FornecedorPicker
                value={forn}
                onChange={setForn}
                colKey={eq.fornecedor}
                fornecedores={fornecedores}
                autoFocus compact
                onEnter={salvarSim}
              />
            )}
            {eq.qtde && (
              <input
                value={qtde}
                placeholder="Qt."
                style={{ flex: '0 0 44px' }}
                onChange={e => setQtde(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') salvarSim() }}
              />
            )}
            <button onClick={salvarSim}>OK</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PerifericosCards({ config, novoJogoPedido = false, onNovoJogoConsumido = () => {} }) {
  // Legacy lê da tabela própria; campeonato dinâmico lê de competition_events
  // (linhas achatadas pelo hook — mesmas chaves de equipamento, copiadas do
  // template no NewCompetitionDialog).
  const legacy = useTableData(config.isLegacy === false ? null : config.tableName)
  const dynamic = useCompetitionEvents(config.isLegacy === false ? config.competitionId : null)
  const { data, loading, error, addRow, updateRow, deleteRow } = config.isLegacy === false ? dynamic : legacy
  const { fornecedores: hubFornecedores } = useHubFornecedores()
  const accent = config.accentColor
  // Lista fixa no legado; derivada das colunas 'simnao' no campeonato dinâmico.
  const EQUIPAMENTOS = useMemo(() => equipamentosDaConfig(config), [config])

  const [busca, setBusca] = useState('')
  const [fRodada, setFRodada] = useState('')
  const [fEquip, setFEquip] = useState('')
  const [fFornecedor, setFFornecedor] = useState('')
  const [soPendencias, setSoPendencias] = useState(false)
  const [modal, setModal] = useState({ open: false, mode: 'add', row: null })
  const [confirmDelete, setConfirmDelete] = useState(null)

  const jogos = useMemo(() => (data || []).filter(r => r.mandante || r.visitante), [data])
  const rodadas = useMemo(() =>
    [...new Set(jogos.map(r => r.rod).filter(Boolean))].sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0)),
    [jogos])

  const fornecedores = useMemo(() => {
    const set = new Set()
    jogos.forEach(r => EQUIPAMENTOS.forEach(eq => { const v = eq.fornecedor ? r[eq.fornecedor] : null; if (v && String(v).trim()) set.add(String(v).trim()) }))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [jogos, EQUIPAMENTOS])

  const norm = s => String(s || '').toLowerCase()
  // Sem coluna de fornecedor não há o que pendenciar: o "Sim" já basta.
  const pendenteEm = (r, eq) => r[eq.key] === 'Sim' && !!eq.fornecedor
    && (!r[eq.fornecedor] || !String(r[eq.fornecedor]).trim())

  const filtrados = useMemo(() => jogos.filter(r => {
    if (busca && !(norm(r.mandante).includes(norm(busca)) || norm(r.visitante).includes(norm(busca)))) return false
    if (fRodada && String(r.rod) !== fRodada) return false
    if (fEquip && r[fEquip] !== 'Sim') return false
    if (fFornecedor && !EQUIPAMENTOS.some(eq => eq.fornecedor && norm(r[eq.fornecedor]).includes(norm(fFornecedor)))) return false
    if (soPendencias) {
      const alvo = fEquip ? EQUIPAMENTOS.filter(eq => eq.key === fEquip) : EQUIPAMENTOS
      if (!alvo.some(eq => pendenteEm(r, eq))) return false
    }
    return true
  }), [jogos, busca, fRodada, fEquip, fFornecedor, soPendencias, EQUIPAMENTOS])

  const porRodada = useMemo(() => {
    const map = new Map()
    filtrados.forEach(r => {
      const rod = r.rod || '—'
      if (!map.has(rod)) map.set(rod, [])
      map.get(rod).push(r)
    })
    map.forEach(lista => lista.sort(compararPorData))
    return [...map.entries()].sort((a, b) => (parseInt(a[0]) || 0) - (parseInt(b[0]) || 0))
  }, [filtrados])

  // Abre na rodada atual (igual ao Controle)
  const atual = useMemo(() => rodadaAtual(jogos, 'rod'), [jogos])
  const secRefs = useRef({})
  const jaRolou = useRef(false)
  const filtroAtivo = busca || fRodada || fEquip || fFornecedor || soPendencias
  useEffect(() => {
    if (jaRolou.current || !atual || jogos.length === 0 || filtroAtivo) return
    const el = secRefs.current[atual]
    if (!el) return
    jaRolou.current = true
    requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [atual, jogos.length]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveCampos(id, payload) {
    await updateRow(id, payload)
  }

  // Botão "Novo Jogo" do header aponta para cá; consumir o pedido evita
  // reabrir o modal ao navegar de volta para a aba.
  useEffect(() => {
    if (novoJogoPedido) { setModal({ open: true, mode: 'add', row: null }); onNovoJogoConsumido() }
  }, [novoJogoPedido]) // eslint-disable-line react-hooks/exhaustive-deps
  async function handleSave(formData) {
    if (modal.mode === 'add') {
      await addRow(formData)
    } else {
      // Só o diff do snapshot: a ficha aberta não pode sobrescrever edições
      // concorrentes feitas nos slots enquanto ela estava na tela.
      const patch = {}
      for (const [k, v] of Object.entries(formData)) {
        if (v !== modal.row[k]) patch[k] = v
      }
      if (Object.keys(patch).length > 0) await updateRow(modal.row.id, patch)
    }
  }

  const ativosDe = r => EQUIPAMENTOS.filter(eq => r[eq.key] === 'Sim')
  // equipamentoOk trata o caso sem coluna de fornecedor (só o "Sim" completa)
  const okDe = r => EQUIPAMENTOS.filter(eq => equipamentoOk(r, eq))

  const totAtivos = filtrados.reduce((s, r) => s + ativosDe(r).length, 0)
  const totOk = filtrados.reduce((s, r) => s + okDe(r).length, 0)

  const equipsVisiveis = fEquip ? EQUIPAMENTOS.filter(eq => eq.key === fEquip) : EQUIPAMENTOS

  if (error) {
    return <div style={{ padding: 60, textAlign: 'center' }}><p style={{ color: 'var(--danger)' }}>{error}</p></div>
  }
  if (loading) {
    return (
      <div className="esc-cards" style={{ marginTop: 16 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="esc-card skeleton-card" style={{ borderTopColor: accent }}>
            <div className="skeleton-cell" style={{ width: '60%', height: 18, marginBottom: 12 }} />
            <div className="skeleton-cell" style={{ width: '90%', height: 14, marginBottom: 8 }} />
            <div className="skeleton-cell" style={{ width: '70%', height: 12 }} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="esc-wrap">
      <div className="esc-toolbar">
        <input className="esc-busca" placeholder="🔍 Buscar time..." value={busca} onChange={e => setBusca(e.target.value)} />
        <select value={fRodada} onChange={e => setFRodada(e.target.value)}>
          <option value="">Todas rodadas</option>
          {rodadas.map(r => <option key={r} value={String(r)}>Rodada {r}</option>)}
        </select>
        <select value={fEquip} onChange={e => setFEquip(e.target.value)}>
          <option value="">Todos equipamentos</option>
          {EQUIPAMENTOS.map(eq => <option key={eq.key} value={eq.key}>{eq.label}</option>)}
        </select>
        <input className="esc-forn" list="perif-fornecedores" placeholder="Fornecedor..." value={fFornecedor} onChange={e => setFFornecedor(e.target.value)} />
        <datalist id="perif-fornecedores">
          {fornecedores.map(f => <option key={f} value={f} />)}
        </datalist>
        <button className={`esc-toggle-pend ${soPendencias ? 'is-on' : ''}`} onClick={() => setSoPendencias(p => !p)}>
          ⚠ Só pendências
        </button>
        {filtroAtivo && (
          <button className="esc-limpar" onClick={() => { setBusca(''); setFRodada(''); setFEquip(''); setFFornecedor(''); setSoPendencias(false) }}>
            Limpar ✕
          </button>
        )}
        <div className="esc-resumo">
          <strong>{filtrados.length}</strong> jogos ·{' '}
          <strong style={{ color: totAtivos && totOk === totAtivos ? 'var(--green, #16a34a)' : undefined }}>{totOk}/{totAtivos}</strong>{' '}equipamentos
        </div>
      </div>

      {porRodada.length === 0 && <div className="esc-vazio">Nenhum jogo com esses filtros.</div>}

      {porRodada.map(([rod, lista]) => {
        const tot = lista.reduce((s, r) => s + ativosDe(r).length, 0)
        const ok = lista.reduce((s, r) => s + okDe(r).length, 0)
        return (
          <section key={rod} className="esc-rodada" ref={el => { secRefs.current[rod] = el }}>
            <header className="esc-rodada-header">
              <span className="esc-rodada-num" style={{ color: accent }}>{rod}</span>
              <div>
                <p className="esc-rodada-titulo">
                  Rodada {rod}
                  {String(rod) === String(atual) && <span className="esc-rodada-atual" style={{ background: accent }}>ATUAL</span>}
                </p>
                <p className="esc-rodada-sub">{lista.length} {lista.length === 1 ? 'jogo' : 'jogos'} · {ok}/{tot} equipamentos com fornecedor</p>
              </div>
              <div className="esc-rodada-barra"><span style={{ width: `${tot ? (ok / tot) * 100 : 0}%`, background: accent }} /></div>
            </header>

            <div className="esc-cards">
              {lista.map(r => {
                const ativos = ativosDe(r).length
                const okCount = okDe(r).length
                const pct = ativos ? (okCount / ativos) * 100 : 0
                return (
                  <article key={r.id} className="esc-card" style={{ borderTopColor: accent }}>
                    <header className="esc-card-header">
                      <div className="esc-card-jogo">
                        <div className="esc-card-times">
                          <Escudo nome={r.mandante} />
                          <span className="esc-card-nome">{r.mandante}</span>
                          <span className="esc-card-x">×</span>
                          <span className="esc-card-nome">{r.visitante}</span>
                          <Escudo nome={r.visitante} />
                        </div>
                        <p className="esc-card-meta">
                          {[r.dia, r.data, r.hora_brt, r.estadio || r.cidade].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="esc-card-chips">
                        {r.padrao && <span className="esc-chip esc-chip-padrao">{r.padrao}</span>}
                        {r.detentor && <span className="esc-chip">{r.detentor}</span>}
                        {r.credenciamento && <span className="esc-chip" title="Credenciamento">🎫 {r.credenciamento}</span>}
                      </div>
                    </header>

                    <div className="esc-slots">
                      {equipsVisiveis.map(eq => (
                        <SlotEquip
                          key={eq.key}
                          row={r}
                          eq={eq}
                          destaque={!!fFornecedor && norm(r[eq.fornecedor]).includes(norm(fFornecedor))}
                          fornecedores={hubFornecedores}
                          onSave={handleSaveCampos}
                        />
                      ))}
                    </div>

                    <footer className="esc-card-footer">
                      <div className="esc-card-progresso">
                        <span style={{ width: `${pct}%`, background: pct === 100 && ativos ? 'var(--green, #16a34a)' : accent }} />
                      </div>
                      <span className="esc-card-contagem">{okCount}/{ativos || 0}</span>
                      <button
                        className={`eg-pub ${r.escala_publicada ? 'is-on' : ''}`}
                        title={r.escala_publicada
                          ? 'Escala publicada — visível nos links dos prestadores. Clique para voltar a rascunho.'
                          : 'Rascunho — invisível para os prestadores. Clique para publicar.'}
                        onClick={() => handleSaveCampos(r.id, { escala_publicada: !r.escala_publicada })}>
                        {r.escala_publicada ? '✓ Publicada' : 'Rascunho'}
                      </button>
                      <button className="esc-card-ficha" onClick={() => setModal({ open: true, mode: 'edit', row: r })}>Ficha completa →</button>
                      <button className="esc-card-ficha" title="Excluir" onClick={() => setConfirmDelete(r)}>🗑</button>
                    </footer>
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}

      {modal.open && (
        <PerifericoModal
          mode={modal.mode}
          row={modal.row}
          config={config}
          accentColor={accent}
          onClose={() => setModal({ open: false, mode: 'add', row: null })}
          onSave={handleSave}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`Excluir o registro de ${confirmDelete.mandante || ''} x ${confirmDelete.visitante || ''}?`}
          onConfirm={async () => { await deleteRow(confirmDelete.id); setConfirmDelete(null) }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
