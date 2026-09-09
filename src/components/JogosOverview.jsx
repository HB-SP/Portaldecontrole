import { useState, useMemo } from 'react'
import { useTableData } from '../hooks/useTableData'
import { useCompetitionEvents } from '../hooks/useCompetitionEvents'
import { useEscalaGeral } from '../hooks/useEscalaGeral'
import { usePerifericoIrmao } from '../hooks/usePerifericoIrmao'
import { getEscudoUrl } from '../lib/escudos'
import { getStatusClass } from '../config/tables'
import { FUNCOES_ESCALA, naoTemFuncao, semEscala, acharEscala } from '../lib/escalaLink'
import GameModal from './GameModal'

const GRUPO_ESCALA = 'Escala Geral'
// Quando a config traz um grupo 'Pessoal', as funções da Escala Geral entram
// DENTRO dele em vez de virar um painel próprio — foi o pedido: um bloco só
// com todas as pessoas (Coordenador, Produtor, Supervisor, DTV, Vmix, Áudio).
// Sem esse grupo (Brasileirão, Paulistão Fem.) nada muda: o painel separado
// continua como antes.
const GRUPO_PESSOAL = 'Pessoal'
const GRUPO_PERIF = 'Periférico'

// As linhas de função da Escala Geral, sem o painel em volta — para servirem
// tanto ao painel próprio quanto ao topo do bloco Pessoal.
function EscalaLinhas({ escalaInfo, confirmacoes }) {
  const eg = escalaInfo?.escala
  const mudo = eg && semEscala(eg)
  if (!eg) {
    return (
      <div className="overview-row empty">
        <span className="overview-row-label">Vínculo</span>
        <span className="overview-row-value"><span className="overview-field-empty">sem jogo correspondente na Escala Geral</span></span>
      </div>
    )
  }
  return (
    <>
            {FUNCOES_ESCALA.map(fn => {
              const v = eg[fn.key]
              const off = naoTemFuncao(v)
              const vazio = !off && (!v || !String(v).trim())
              const conf = confirmacoes?.get(`${eg.id}|${fn.label}`)
              return (
                <div key={fn.key} className={`overview-row${vazio ? ' empty' : ''}`}>
                  <span className="overview-row-label">{fn.label}</span>
                  <span className="overview-row-value">
                    {off ? <span className="overview-field-empty">não terá</span>
                      : vazio ? <span className="overview-field-empty">{mudo ? '—' : 'a definir'}</span>
                      : (<>
                          {String(v)}
                          {conf && (
                            <span className={`eg-conf ${conf.status === 'confirmado' ? 'eg-conf-ok' : 'eg-conf-nao'}`}
                              title={conf.status === 'confirmado' ? 'Presença confirmada' : `Recusou${conf.obs ? ` ("${conf.obs}")` : ''}`}>
                              {' '}{conf.status === 'confirmado' ? '✓' : '✗'}
                            </span>
                          )}
                        </>)}
                  </span>
                </div>
              )
            })}
            {eg.obs && (
              <div className="overview-row">
                <span className="overview-row-label">Obs</span>
                <span className="overview-row-value" style={{ fontStyle: 'italic' }}>{eg.obs}</span>
              </div>
            )}
            {mudo && (
              <div className="overview-row empty">
                <span className="overview-row-label">Escala</span>
                <span className="overview-row-value"><span className="overview-field-empty">sem equipe escalada (YT)</span></span>
              </div>
            )}
            {escalaInfo.dataDivergente && (
              <div className="overview-row">
                <span className="overview-row-label">⚠ Data</span>
                <span className="overview-row-value" style={{ color: '#B45309' }}>
                  na Escala Geral consta {eg.data}
                </span>
              </div>
            )}
    </>
  )
}

// Contagem "preenchidas/ativas" das funções da Escala Geral
function contaEscala(escalaInfo) {
  const eg = escalaInfo?.escala
  if (!eg || semEscala(eg)) return null
  const ativas = FUNCOES_ESCALA.filter(fn => !naoTemFuncao(eg[fn.key]))
  const cheias = ativas.filter(fn => eg[fn.key] && String(eg[fn.key]).trim())
  return { total: ativas.length, filled: cheias.length }
}

// Painel próprio da Escala Geral — usado quando a config NÃO tem grupo 'Pessoal'
function EscalaCol({ escalaInfo, confirmacoes, accentColor }) {
  const c = contaEscala(escalaInfo)
  return (
    <div className="overview-col">
      <div className="overview-col-head">
        <span className="overview-col-label">{GRUPO_ESCALA}</span>
        {c && (
          <span className="overview-col-count" style={{ color: c.filled > 0 ? accentColor : undefined }}>
            {c.filled}/{c.total}
          </span>
        )}
      </div>
      <div className="overview-col-body">
        <EscalaLinhas escalaInfo={escalaInfo} confirmacoes={confirmacoes} />
      </div>
    </div>
  )
}

const HUB_FIELDS = new Set(['eu', 'rod', 'dia', 'data', 'hora_brt', 'mandante', 'visitante', 'cidade', 'padrao', 'detentor', 'estadio', 'hub_jogo_id'])

function uniqueGroups(columns) {
  const seen = new Set()
  const result = []
  for (const c of columns) {
    if (c.group && !seen.has(c.group)) { seen.add(c.group); result.push(c.group) }
  }
  return result
}

function rodadaOf(row) {
  return parseInt(row.eu) || parseInt(row.rod) || null
}

function fieldDisplay(col, value) {
  if (value === null || value === undefined || value === '') return null
  if (col.type === 'simnao') return value
  if (col.type === 'url' && value) return value
  return String(value)
}

// Coluna só-leitura com os periféricos do mesmo jogo — os dados vivem na seção
// irmã (linhas próprias), por isso vêm do usePerifericoIrmao. Edição continua
// na aba Periférico.
function PerifCol({ perifRow, perifColunas, accentColor }) {
  const cols = (perifColunas || []).filter(c => !HUB_FIELDS.has(c.key))
  const cheias = perifRow
    ? cols.filter(c => { const v = perifRow[c.key]; return v !== null && v !== undefined && String(v).trim() !== '' }).length
    : 0
  return (
    <div className="overview-col">
      <div className="overview-col-head">
        <span className="overview-col-label">{GRUPO_PERIF}</span>
        {perifRow && (
          <span className="overview-col-count" style={{ color: cheias > 0 ? accentColor : undefined }}>
            {cheias}/{cols.length}
          </span>
        )}
      </div>
      <div className="overview-col-body">
        {!perifRow ? (
          <div className="overview-row empty">
            <span className="overview-row-label">Vínculo</span>
            <span className="overview-row-value"><span className="overview-field-empty">sem linha correspondente na aba Periférico</span></span>
          </div>
        ) : cols.map(col => {
          const display = fieldDisplay(col, perifRow[col.key])
          return (
            <div key={col.key} className={`overview-row${display === null ? ' empty' : ''}`}>
              <span className="overview-row-label">{col.label}</span>
              <span className="overview-row-value">
                {display === null ? <span className="overview-field-empty">—</span> : display}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function GameCard({ row, config, onEdit, accentColor, defaultOpen, temEscala, escalaInfo, confirmacoes,
  perifRow, perifColunas, temPeriferico }) {
  const [open, setOpen] = useState(!!defaultOpen)
  const [hiddenGroups, setHiddenGroups] = useState(() => new Set())

  const groups = useMemo(() => uniqueGroups(config.columns), [config.columns])
  // Com grupo 'Pessoal' na config, as funções da Escala Geral entram nele; sem
  // ele, seguem como painel próprio.
  const escalaNoPessoal = temEscala && groups.includes(GRUPO_PESSOAL)
  const escalaSeparada = temEscala && !escalaNoPessoal

  const fillByGroup = useMemo(() => {
    const map = {}
    for (const c of config.columns) {
      if (HUB_FIELDS.has(c.key)) continue
      if (!c.group) continue
      if (!map[c.group]) map[c.group] = { total: 0, filled: 0 }
      map[c.group].total++
      const v = row[c.key]
      if (v !== null && v !== undefined && String(v).trim() !== '') map[c.group].filled++
    }
    return map
  }, [row, config.columns])

  const rod = rodadaOf(row)
  const homeUrl = getEscudoUrl(row.mandante)
  const awayUrl = getEscudoUrl(row.visitante)
  const statusClass = row.status ? getStatusClass(row.status) : 'status-default'

  function toggleGroup(g) {
    setHiddenGroups(prev => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g); else next.add(g)
      return next
    })
  }

  return (
    <div className={`overview-card${open ? ' open' : ''}`} style={{ '--accent': accentColor }}>
      {/* div (não button): o ✎ interno é um button e button dentro de button é
          HTML inválido — navegadores podem normalizar a árvore e quebrar o clique */}
      <div
        role="button"
        tabIndex={0}
        className="overview-head"
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o) } }}
      >
        {rod && <span className="overview-rod" style={{ background: accentColor }}>R{rod}</span>}

        <div className="overview-teams">
          {homeUrl && <img className="overview-logo" src={homeUrl} alt={row.mandante} />}
          <span className="overview-team-name">{row.mandante || '—'}</span>
          <span className="overview-vs">×</span>
          <span className="overview-team-name">{row.visitante || '—'}</span>
          {awayUrl && <img className="overview-logo" src={awayUrl} alt={row.visitante} />}
        </div>

        <div className="overview-meta">
          {row.data && <span className="overview-date">{row.data}</span>}
          {row.hora_brt && <span className="overview-hour">{row.hora_brt}</span>}
          {row.padrao && <span className="overview-tag">{row.padrao}</span>}
          {row.detentor && <span className="overview-detentor">{row.detentor}</span>}
        </div>

        {row.status && (
          <span className={`status-badge ${statusClass} overview-status`}>{row.status}</span>
        )}

        <button
          type="button"
          className="overview-edit"
          onClick={e => { e.stopPropagation(); onEdit(row) }}
          title="Editar"
        >✎</button>

        <span className="overview-arrow">{open ? '▴' : '▾'}</span>
      </div>

      {open && (
        <>
          <div className="overview-group-tabs" onClick={e => e.stopPropagation()}>
            {escalaSeparada && (() => {
              const isHidden = hiddenGroups.has(GRUPO_ESCALA)
              const c = contaEscala(escalaInfo)
              return (
                <button
                  type="button"
                  className={`overview-tab-toggle${isHidden ? ' hidden' : ' active'}`}
                  onClick={() => toggleGroup(GRUPO_ESCALA)}
                  title={isHidden ? 'Mostrar' : 'Esconder'}
                  style={!isHidden ? { borderColor: accentColor, color: accentColor } : {}}
                >
                  <span>{GRUPO_ESCALA}</span>
                  <span className="tab-toggle-count">
                    {c ? (<><span className="filled">{c.filled}</span>/<span>{c.total}</span></>) : '—'}
                  </span>
                </button>
              )
            })()}
            {groups.map(group => {
              const cols = config.columns.filter(c => c.group === group && !HUB_FIELDS.has(c.key))
              if (!cols.length) return null
              const isHidden = hiddenGroups.has(group)
              let fill = fillByGroup[group] || { total: 0, filled: 0 }
              // As funções da Escala Geral contam junto no Pessoal
              if (group === GRUPO_PESSOAL && escalaNoPessoal) {
                const c = contaEscala(escalaInfo)
                if (c) fill = { total: fill.total + c.total, filled: fill.filled + c.filled }
              }
              return (
                <button
                  key={group}
                  type="button"
                  className={`overview-tab-toggle${isHidden ? ' hidden' : ' active'}`}
                  onClick={() => toggleGroup(group)}
                  title={isHidden ? 'Mostrar' : 'Esconder'}
                  style={!isHidden ? { borderColor: accentColor, color: accentColor } : {}}
                >
                  <span>{group}</span>
                  <span className="tab-toggle-count">
                    <span className="filled">{fill.filled}</span>/<span>{fill.total}</span>
                  </span>
                </button>
              )
            })}
            {temPeriferico && (() => {
              const isHidden = hiddenGroups.has(GRUPO_PERIF)
              const cols = (perifColunas || []).filter(c => !HUB_FIELDS.has(c.key))
              const cheias = perifRow
                ? cols.filter(c => { const v = perifRow[c.key]; return v !== null && v !== undefined && String(v).trim() !== '' }).length
                : 0
              return (
                <button
                  type="button"
                  className={`overview-tab-toggle${isHidden ? ' hidden' : ' active'}`}
                  onClick={() => toggleGroup(GRUPO_PERIF)}
                  title={isHidden ? 'Mostrar' : 'Esconder'}
                  style={!isHidden ? { borderColor: accentColor, color: accentColor } : {}}
                >
                  <span>{GRUPO_PERIF}</span>
                  <span className="tab-toggle-count">
                    {perifRow ? (<><span className="filled">{cheias}</span>/<span>{cols.length}</span></>) : '—'}
                  </span>
                </button>
              )
            })()}
          </div>

          <div className="overview-body" onClick={e => e.stopPropagation()}>
            {escalaSeparada && !hiddenGroups.has(GRUPO_ESCALA) && (
              <EscalaCol escalaInfo={escalaInfo} confirmacoes={confirmacoes} accentColor={accentColor} />
            )}
            {groups.map(group => {
              const cols = config.columns.filter(c => c.group === group && !HUB_FIELDS.has(c.key))
              if (!cols.length) return null
              if (hiddenGroups.has(group)) return null
              let fill = fillByGroup[group] || { total: 0, filled: 0 }
              const comEscala = group === GRUPO_PESSOAL && escalaNoPessoal
              if (comEscala) {
                const c = contaEscala(escalaInfo)
                if (c) fill = { total: fill.total + c.total, filled: fill.filled + c.filled }
              }
              return (
                <div key={group} className="overview-col">
                  <div className="overview-col-head">
                    <span className="overview-col-label">{group}</span>
                    <span className="overview-col-count" style={{ color: fill.filled > 0 ? accentColor : undefined }}>
                      {fill.filled}/{fill.total}
                    </span>
                  </div>
                  <div className="overview-col-body">
                    {comEscala && <EscalaLinhas escalaInfo={escalaInfo} confirmacoes={confirmacoes} />}
                    {cols.map(col => {
                      const display = fieldDisplay(col, row[col.key])
                      const empty = !display
                      return (
                        <div key={col.key} className={`overview-row${empty ? ' empty' : ''}`}>
                          <span className="overview-row-label">{col.label}</span>
                          <span className="overview-row-value">
                            {empty ? <span className="overview-field-empty">—</span> :
                              col.type === 'url' ? (
                                <a href={display} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: accentColor }}>Abrir</a>
                              ) : col.statusColor ? (
                                <span className={`status-badge ${getStatusClass(display)}`}>{display}</span>
                              ) : col.type === 'simnao' ? (
                                <span className={`overview-simnao ${display === 'Sim' ? 'sim' : 'nao'}`}>{display}</span>
                              ) : display}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {temPeriferico && !hiddenGroups.has(GRUPO_PERIF) && (
              <PerifCol perifRow={perifRow} perifColunas={perifColunas} accentColor={accentColor} />
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function JogosOverview({ config, accentColor }) {
  const legacy = useTableData(config.isLegacy ? config.tableName : null)
  const dynamic = useCompetitionEvents(config.isLegacy ? null : config.competitionId)
  const { data, loading, addRow, updateRow } = config.isLegacy ? legacy : dynamic
  const { indice: indiceEscala, confirmacoes, temEscala } = useEscalaGeral(config.label, config.escalaCamps)
  // Periféricos do mesmo jogo, buscados na seção irmã (linhas próprias)
  const { colunas: perifColunas, acharPeriferico, temPeriferico } = usePerifericoIrmao(config)
  const [search, setSearch] = useState('')
  const [filtroRod, setFiltroRod] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [modal, setModal] = useState(null)

  const filtered = useMemo(() => {
    let r = data.filter(row => row.mandante && row.visitante)
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(x => (x.mandante || '').toLowerCase().includes(q) || (x.visitante || '').toLowerCase().includes(q))
    }
    if (filtroRod) {
      r = r.filter(x => String(rodadaOf(x) || '') === filtroRod)
    }
    if (filtroStatus) {
      r = r.filter(x => x.status === filtroStatus)
    }
    return r.sort((a, b) => (rodadaOf(a) || 0) - (rodadaOf(b) || 0))
  }, [data, search, filtroRod, filtroStatus])

  const rodadasDisponiveis = useMemo(() => {
    const set = new Set()
    data.forEach(row => { const r = rodadaOf(row); if (r) set.add(r) })
    return Array.from(set).sort((a, b) => a - b)
  }, [data])

  const statusDisponiveis = useMemo(() => {
    const set = new Set()
    data.forEach(row => { if (row.status) set.add(row.status) })
    return Array.from(set)
  }, [data])

  async function handleSave(formData) {
    if (modal?.mode === 'edit') await updateRow(modal.row.id, formData)
    else await addRow(formData)
  }

  return (
    <div className="overview-page">
      <div className="overview-toolbar">
        <input
          type="text"
          className="form-input"
          placeholder="Buscar mandante / visitante..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, maxWidth: 320 }}
        />
        <select className="form-select" value={filtroRod} onChange={e => setFiltroRod(e.target.value)} style={{ width: 130 }}>
          <option value="">Todas rodadas</option>
          {rodadasDisponiveis.map(r => <option key={r} value={r}>R{r}</option>)}
        </select>
        <select className="form-select" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ width: 160 }}>
          <option value="">Todos status</option>
          {statusDisponiveis.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="overview-count">{filtered.length} {filtered.length === 1 ? 'jogo' : 'jogos'}</span>
      </div>

      {loading ? (
        <div className="overview-loading">
          {[0,1,2].map(i => <div key={i} className="skeleton-cell" style={{ width: '100%', height: 64, marginBottom: 8, borderRadius: 10 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: 60 }}>
          <p style={{ fontWeight: 700 }}>Nenhum jogo encontrado</p>
        </div>
      ) : (
        <div className="overview-list">
          {filtered.map(row => (
            <GameCard
              key={row.id}
              row={row}
              config={config}
              accentColor={accentColor}
              temEscala={temEscala}
              escalaInfo={acharEscala(row, indiceEscala)}
              confirmacoes={confirmacoes}
              temPeriferico={temPeriferico}
              perifColunas={perifColunas}
              perifRow={acharPeriferico(row)}
              onEdit={r => setModal({ mode: 'edit', row: r })}
            />
          ))}
        </div>
      )}

      {modal && (
        <GameModal
          mode={modal.mode}
          row={modal.row}
          config={config}
          accentColor={accentColor}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
