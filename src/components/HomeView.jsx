import { useState, useMemo, useEffect, useCallback } from 'react'
import { useHomeData } from '../hooks/useHomeData'
import { getEscudoUrl } from '../lib/escudos'
import { selecionarProximaRodada } from '../lib/proximaRodada'
import { resumoDoJogo } from '../lib/resumoJogo'
import ProximaRodada from './ProximaRodada'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS  = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB']

function cleanComp(label) {
  if (!label) return ''
  const s = String(label)
  if (/paulist[aã]/i.test(s) && /fem/i.test(s)) return 'Paulistão F'
  // Expand 2-digit year suffix: "26" → "2026"
  return s.replace(/\s+(\d{2})$/, (_, yr) => ` 20${yr}`).trim()
}

function ShieldSm({ name, accentColor }) {
  const url = getEscudoUrl(name)
  return url
    ? <img src={url} className="hv-shield-sm" alt="" />
    : <span className="hv-shield-sm-fb" style={{ background: (accentColor || '#999') + '50' }} />
}

function statusColor(s) {
  const v = (s || '').toLowerCase()
  if (v.includes('confirm') || v.includes('reserv')) return '#4ade80'
  if (v.includes('andamento'))  return '#60a5fa'
  if (v.includes('cancel'))     return '#f87171'
  if (v.includes('aguard'))     return '#c084fc'
  return '#fbbf24'
}

function formatDateKey(key) {
  if (!key) return ''
  const [y, mo, d] = key.split('-').map(Number)
  return `${String(d).padStart(2,'0')}/${String(mo+1).padStart(2,'0')}/${y}`
}

function countdownLabel(ts) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const days = Math.floor((ts - today) / (1000 * 60 * 60 * 24))
  if (days < 0) return null
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Amanhã'
  return `Em ${days} dias`
}

function formatNextTs(ts) {
  const d = new Date(ts)
  const dia = DIAS[d.getDay()]
  const dayStr = dia[0] + dia.slice(1).toLowerCase()
  return `${dayStr} ${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`
}

export default function HomeView({ competitions, onCompSelect }) {
  // "Hoje" como estado que acompanha a virada do dia — memoizar uma vez
  // deixaria KPIs, célula HOJE e próximos jogos presos no dia da montagem.
  const [today, setToday] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
  })
  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date()
      setToday(prev => (prev.day === d.getDate() && prev.month === d.getMonth() && prev.year === d.getFullYear())
        ? prev
        : { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() })
    }, 60000)
    return () => clearInterval(t)
  }, [])

  const [viewMonth,      setViewMonth]      = useState({ year: today.year, month: today.month })
  const [activeFilters,  setActiveFilters]  = useState(new Set(['all']))
  const [selectedKey,    setSelectedKey]    = useState(null)
  const [calKey,         setCalKey]         = useState(0)
  const [calDir,         setCalDir]         = useState(null)
  const [spotlightIdx,   setSpotlightIdx]   = useState(0)
  const [spotlightDir,   setSpotlightDir]   = useState(null)
  const [spotlightKey,   setSpotlightKey]   = useState(0)
  const [showUpcoming,   setShowUpcoming]   = useState(true)
  const [viewMode,       setViewMode]       = useState('split')
  const [mounted,       setMounted]       = useState(false)

  const { matchesByDate, totalsByComp, loading } = useHomeData(competitions)

  // Todos os jogos numa lista só, com a data já como Date — é o que a regra da
  // próxima rodada e a contagem de pendências precisam.
  const todosOsJogos = useMemo(() => {
    const out = []
    for (const [key, arr] of matchesByDate) {
      const [y, m, dd] = key.split('-').map(Number)
      if ([y, m, dd].some(n => Number.isNaN(n))) continue
      const d = new Date(y, m, dd)
      for (const jogo of arr) out.push({ ...jogo, d, comp: jogo.competitionId, rod: String(jogo.rod || '') })
    }
    return out
  }, [matchesByDate])

  const selecaoProxima = useMemo(() => selecionarProximaRodada(todosOsJogos), [todosOsJogos])

  // Jogos por vir que não têm NADA escalado. Antes isto contava "escala
  // incompleta", o que era enganoso: a maioria das colunas do grupo é
  // opcional, então quase todo jogo parecia incompleto. "Nada escalado" é
  // afirmação segura — e é o que realmente pede ação.
  const aEscalar = useMemo(() => {
    const h = new Date()
    const hoje0 = new Date(h.getFullYear(), h.getMonth(), h.getDate())
    return todosOsJogos.filter(j => j.d >= hoje0 && resumoDoJogo(j).semEscala).length
  }, [todosOsJogos])

  useEffect(() => { const t = setTimeout(() => setMounted(true), 40); return () => clearTimeout(t) }, [])

  function changeMonth(delta) {
    setCalDir(delta > 0 ? 'left' : 'right')
    setCalKey(k => k + 1)
    setSelectedKey(null)
    setViewMonth(v => {
      let m = v.month + delta, y = v.year
      if (m < 0)  { m = 11; y-- }
      if (m > 11) { m = 0;  y++ }
      return { year: y, month: m }
    })
  }

  function goToday() {
    setCalDir(null); setCalKey(k => k + 1)
    setViewMonth({ year: today.year, month: today.month })
    setSelectedKey(null)
  }

  function toggleFilter(id) {
    setSelectedKey(null)
    setActiveFilters(prev => {
      if (id === 'all') return new Set(['all'])
      const next = new Set(prev)
      next.delete('all')
      if (next.has(id)) { next.delete(id); if (!next.size) return new Set(['all']) }
      else next.add(id)
      return next
    })
  }

  const passFilter = useCallback(m =>
    activeFilters.has('all') || activeFilters.has(m.competitionId),
  [activeFilters])

  const todayTs = useMemo(
    () => new Date(today.year, today.month, today.day).getTime(),
    [today]
  )

  const kpi = useMemo(() => {
    let total = 0, done = 0, pending = 0
    for (const [key, matches] of matchesByDate.entries()) {
      const [y, mo, d] = key.split('-').map(Number)
      if (y !== viewMonth.year || mo !== viewMonth.month) continue
      const filtered = matches.filter(passFilter)
      total += filtered.length
      const ts = new Date(y, mo, d).getTime()
      if (ts < todayTs) done += filtered.length
      else pending += filtered.length
    }
    return { total, done, pending }
  }, [matchesByDate, passFilter, viewMonth, todayTs])

  const doneByComp = useMemo(() => {
    const result = {}
    for (const [key, matches] of matchesByDate.entries()) {
      const [y, mo, d] = key.split('-').map(Number)
      if (new Date(y, mo, d).getTime() >= todayTs) continue
      for (const m of matches) {
        result[m.competitionId] = (result[m.competitionId] || 0) + 1
      }
    }
    return result
  }, [matchesByDate, todayTs])

  const calCells = useMemo(() => {
    const { year, month } = viewMonth
    const first   = new Date(year, month, 1).getDay()
    const total   = new Date(year, month + 1, 0).getDate()
    const prevEnd = new Date(year, month, 0).getDate()
    const cells   = []
    for (let i = first - 1; i >= 0; i--)
      cells.push({ day: prevEnd - i, current: false, dateKey: null })
    for (let d = 1; d <= total; d++)
      cells.push({ day: d, current: true, dateKey: `${year}-${month}-${d}` })
    while (cells.length % 7 !== 0)
      cells.push({ day: cells.length - first - total + 1, current: false, dateKey: null })
    return cells
  }, [viewMonth])

  const selectedMatches = useMemo(() => {
    if (!selectedKey) return []
    return (matchesByDate.get(selectedKey) || []).filter(passFilter)
  }, [selectedKey, matchesByDate, passFilter])

  const upcoming = useMemo(() => {
    const list = []
    for (const [key, matches] of matchesByDate.entries()) {
      const [y, mo, d] = key.split('-').map(Number)
      const ts = new Date(y, mo, d).getTime()
      if (ts < todayTs) continue
      list.push(...matches.filter(passFilter).map(m => ({ ...m, ts })))
    }
    return list
      .sort((a, b) => a.ts !== b.ts ? a.ts - b.ts : (a.hora_brt || '').localeCompare(b.hora_brt || ''))
  }, [matchesByDate, passFilter, todayTs])

  const nextByComp = useMemo(() => {
    const result = {}
    for (const [key, matches] of matchesByDate.entries()) {
      const [y, mo, d] = key.split('-').map(Number)
      const ts = new Date(y, mo, d).getTime()
      if (ts < todayTs) continue
      for (const m of matches) {
        if (!result[m.competitionId] || ts < result[m.competitionId].ts)
          result[m.competitionId] = { ...m, ts }
      }
    }
    return result
  }, [matchesByDate, todayTs])

  // Agrupa todos os jogos do próximo dia num spotlight unificado
  const spotlightTs    = upcoming[0]?.ts ?? null
  const spotlightGames = spotlightTs != null ? upcoming.filter(m => m.ts === spotlightTs) : []
  const restGames      = spotlightTs != null ? upcoming.filter(m => m.ts !== spotlightTs).slice(0, 8) : []
  const cdLabel        = spotlightTs != null ? countdownLabel(spotlightTs) : null
  const isToday        = cdLabel === 'Hoje'

  // Reseta índice quando o grupo de jogos mudar
  useEffect(() => { setSpotlightIdx(0) }, [spotlightTs])

  const safeIdx = Math.min(spotlightIdx, Math.max(0, spotlightGames.length - 1))
  const currentGame = spotlightGames[safeIdx] ?? null

  function navigateSpotlight(dir) {
    const next = safeIdx + dir
    if (next < 0 || next >= spotlightGames.length) return
    setSpotlightDir(dir > 0 ? 'right' : 'left')
    setSpotlightKey(k => k + 1)
    setSpotlightIdx(next)
  }

  return (
    <div className={`hv-root${mounted ? ' hv-mounted' : ''}`}>
      <div className="hv-bg" />

      {/* Faixa fina de números. O título "Host Broadcast" e o relógio subiram
          para o cabeçalho — ocupavam uma faixa inteira para dizer pouco. */}
      {!loading && (
        <div className="hv-kpi hv-kpi-fina hv-enter" style={{ '--i': 0 }}>
          {/* Primeiro o número que PEDE AÇÃO: "4 realizados" fala do passado,
              "escala incompleta" é o que faz alguém abrir o Portal. */}
          <div className="hv-kpi-item">
            <span className={`hv-kpi-value${aEscalar > 0 ? ' hv-kpi-pend' : ' hv-kpi-done'}`}>{aEscalar}</span>
            <span className="hv-kpi-label">{aEscalar === 1 ? 'jogo sem escala' : 'jogos sem escala'}</span>
          </div>
          <div className="hv-kpi-sep" />
          <div className="hv-kpi-item">
            <span className="hv-kpi-value">{kpi.total}</span>
            <span className="hv-kpi-label">jogos em {MESES[viewMonth.month]}</span>
          </div>
          <div className="hv-kpi-sep" />
          <div className="hv-kpi-item">
            <span className="hv-kpi-value hv-kpi-done">{kpi.done}</span>
            <span className="hv-kpi-label">realizados</span>
          </div>
          {spotlightGames.length > 0 && cdLabel && (
            <>
              <div className="hv-kpi-sep" />
              <div className="hv-kpi-item">
                <span className="hv-kpi-value" style={{ color: spotlightGames[0].accentColor }}>
                  {cdLabel}
                </span>
                <span className="hv-kpi-label">próximo{spotlightGames.length > 1 ? ` · ${spotlightGames.length} jogos` : ' jogo'}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Próxima rodada, com a escala aberta ── */}
      {!loading && (
        <div className="hv-enter" style={{ '--i': 1 }}>
          <ProximaRodada selecao={selecaoProxima} onAbrir={j => onCompSelect(j.competitionId)} />
        </div>
      )}

      {/* ── Competition cards ── */}
      <div className="hv-navgrid hv-enter" style={{ '--i': 2 }}>
        {competitions.map((comp, idx) => {
          const total = totalsByComp[comp.id] ?? 0
          const done  = doneByComp[comp.id]   ?? 0
          const pct   = total > 0 ? Math.round((done / total) * 100) : 0
          const next  = nextByComp[comp.id]
          return (
            <button
              key={comp.id}
              className="hv-navcard hv-enter"
              style={{ '--ac': comp.accentColor, '--i': idx + 3 }}
              onClick={() => onCompSelect(comp.id)}
            >
              {/* Cabeçalho colorido */}
              <div
                className="hv-navcard-header"
                style={{
                  backgroundColor: comp.accentColor,
                  backgroundImage: 'linear-gradient(150deg, rgba(255,255,255,.22) 0%, transparent 55%, rgba(0,0,0,.18) 100%)'
                }}
              >
                <span className="hv-navcard-htitle">{cleanComp(comp.label)}</span>
                {!loading && total > 0 && (
                  <span className="hv-navcard-hcount">{done}/{total}</span>
                )}
              </div>

              {/* Corpo */}
              <div className="hv-navcard-body">
                {!loading && total > 0 && (
                  <div className="hv-navcard-prog-wrap">
                    <div className="hv-navcard-prog-track">
                      <div className="hv-navcard-prog-fill" style={{ width: `${pct}%`, background: comp.accentColor }} />
                    </div>
                    <span className="hv-navcard-prog-label">{done} de {total} jogos realizados</span>
                  </div>
                )}
              </div>

              {/* Rodapé CTA */}
              <div className="hv-navcard-footer">
                <span className="hv-navcard-footer-label" style={{ color: comp.accentColor }}>
                  Acessar campeonato
                </span>
                <svg viewBox="0 0 16 16" fill="none" width="13" height="13" style={{ color: comp.accentColor }}>
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Split: Calendar (left) + Panel (right) ── */}
      <div className={`hv-split hv-enter${viewMode === 'full' ? ' hv-split--full' : ''}`} style={{ '--i': 3 }}>

        {/* Left: Calendar */}
        <div className="hv-cal-wrap">
          <div className="hv-cal-head">
            <button className="hv-cal-nav" onClick={() => changeMonth(-1)}>
              <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="hv-cal-title">
              <span className="hv-cal-mname">{MESES[viewMonth.month]}</span>
              <span className="hv-cal-year">{viewMonth.year}</span>
            </div>
            <button className="hv-cal-nav" onClick={() => changeMonth(1)}>
              <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button className="hv-cal-today" onClick={goToday}>Hoje</button>

            <div className="hv-view-toggle">
              <button
                className={`hv-view-btn${viewMode === 'split' ? ' hv-view-btn-on' : ''}`}
                onClick={() => setViewMode('split')}
                title="Visão dividida"
              >
                <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                  <rect x="1" y="2" width="6" height="12" rx="1.5" fill="currentColor" opacity=".9"/>
                  <rect x="9" y="2" width="6" height="12" rx="1.5" fill="currentColor" opacity=".9"/>
                </svg>
              </button>
              <button
                className={`hv-view-btn${viewMode === 'full' ? ' hv-view-btn-on' : ''}`}
                onClick={() => setViewMode('full')}
                title="Calendário completo"
              >
                <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                  <rect x="1" y="2" width="14" height="12" rx="1.5" fill="currentColor" opacity=".9"/>
                </svg>
              </button>
            </div>

            <div className="hv-cal-chips">
              <button
                className={`hv-chip${activeFilters.has('all') ? ' hv-chip-on' : ''}`}
                onClick={() => toggleFilter('all')}
              >Todos</button>
              {competitions.map(comp => {
                const on = activeFilters.has(comp.id) && !activeFilters.has('all')
                return (
                  <button
                    key={comp.id}
                    className={`hv-chip${on ? ' hv-chip-on' : ''}`}
                    style={on ? { background: comp.accentColor, borderColor: comp.accentColor, color: '#fff' } : {}}
                    onClick={() => toggleFilter(comp.id)}
                  >
                    {cleanComp(comp.label)}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="hv-cal-days">
            {DIAS.map(d => <div key={d} className="hv-cal-dname">{d}</div>)}
          </div>

          <div key={calKey} className={`hv-cal-grid${calDir ? ` hv-cal-${calDir}` : ''}`}>
            {calCells.map((cell, i) => {
              if (!cell.current) return (
                <div key={i} className="hv-cell hv-cell-out">{cell.day}</div>
              )

              const raw     = matchesByDate.get(cell.dateKey) || []
              const matches = raw.filter(passFilter)
              const isTodayCell = cell.day === today.day && viewMonth.month === today.month && viewMonth.year === today.year
              const isSel   = cell.dateKey === selectedKey
              const hasMat  = matches.length > 0
              const [cy, cmo, cd] = cell.dateKey.split('-').map(Number)
              const isPast  = !isTodayCell && new Date(cy, cmo, cd).getTime() < todayTs

              return (
                <div
                  key={i}
                  className={[
                    'hv-cell',
                    hasMat      ? 'hv-cell-has'   : '',
                    isTodayCell ? 'hv-cell-today' : '',
                    isSel       ? 'hv-cell-sel'   : '',
                    isPast      ? 'hv-cell-past'  : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => cell.dateKey && setSelectedKey(isSel ? null : cell.dateKey)}
                >
                  <div className="hv-cell-num">{cell.day}</div>
                  {hasMat && (
                    <div className="hv-cell-games">
                      {matches.slice(0, 3).map((m, gi) => {
                        const s1 = getEscudoUrl(m.mandante)
                        const s2 = getEscudoUrl(m.visitante)
                        return (
                          <div
                            key={gi}
                            className="hv-cell-game"
                            title={`${m.mandante} × ${m.visitante} · ${m.status}`}
                            style={{
                              background: `linear-gradient(90deg, ${m.accentColor}30 0%, ${m.accentColor}10 40%, ${m.accentColor}00 100%)`
                            }}
                          >
                            <div className="hv-cell-shields">
                              {s1
                                ? <img src={s1} className="hv-cell-shield" alt={m.mandante} />
                                : <div className="hv-shield-fb" style={{ background: m.accentColor + '60' }} />
                              }
                              <span className="hv-cell-x">×</span>
                              {s2
                                ? <img src={s2} className="hv-cell-shield" alt={m.visitante} />
                                : <div className="hv-shield-fb" style={{ background: m.accentColor + '60' }} />
                              }
                            </div>
                          </div>
                        )
                      })}
                      {matches.length > 3 && (
                        <div className="hv-cell-more">+{matches.length - 3}</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Context Panel */}
        <div className="hv-panel">
          {selectedKey && selectedMatches.length > 0 ? (
            <div className="hv-panel-inner hv-panel-anim" key={selectedKey}>
              <div className="hv-detail-bar">
                <span className="hv-detail-date">{formatDateKey(selectedKey)}</span>
                <span className="hv-detail-count">
                  {selectedMatches.length} {selectedMatches.length === 1 ? 'jogo' : 'jogos'}
                </span>
                <button className="hv-detail-close" onClick={() => setSelectedKey(null)}>
                  <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
              <div className="hv-panel-cards">
                {selectedMatches.map((m, i) => (
                  <div
                    key={i}
                    className="hv-card"
                    style={{
                      '--c': m.accentColor,
                      background: `linear-gradient(145deg, #ffffff 60%, ${m.accentColor}0b 100%)`
                    }}
                    onClick={() => onCompSelect(m.competitionId)}
                  >
                    <div className="hv-card-comp">
                      <span className="hv-card-comp-dot" style={{ background: m.accentColor }} />
                      {cleanComp(m.competitionLabel)}
                    </div>
                    <div className="hv-card-match">
                      <ShieldSm name={m.mandante} accentColor={m.accentColor} />
                      <span className="hv-card-team">{m.mandante}</span>
                      <span className="hv-card-vs">×</span>
                      <ShieldSm name={m.visitante} accentColor={m.accentColor} />
                      <span className="hv-card-team">{m.visitante}</span>
                    </div>
                    <div className="hv-card-meta">
                      {m.hora_brt && <span className="hv-card-time">{m.hora_brt}</span>}
                      {m.rod      && <span>Rod. {m.rod}</span>}
                      {m.detentor && <span className="hv-card-detentor">{m.detentor}</span>}
                    </div>
                    <div className="hv-card-status" style={{ color: statusColor(m.status) }}>
                      <span className="hv-card-sdot" style={{ background: statusColor(m.status) }} />
                      {m.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="hv-panel-inner hv-panel-anim" key="default">
              {currentGame ? (
                <div
                  className="hv-spotlight"
                  style={{
                    '--c': currentGame.accentColor,
                    background: `linear-gradient(160deg, #ffffff 50%, ${currentGame.accentColor}10 100%)`
                  }}
                >
                  {/* Header: badge + navegação */}
                  <div className="hv-spotlight-header">
                    <div
                      className={`hv-spotlight-badge${isToday ? ' hv-spotlight-badge-live' : ''}`}
                      style={{ background: currentGame.accentColor + '18', color: currentGame.accentColor }}
                    >
                      {isToday ? '● AO VIVO EM BREVE' : '◉ PRÓXIMO JOGO'}
                    </div>
                    <span className="hv-spotlight-comp">{cleanComp(currentGame.competitionLabel)}</span>
                    {spotlightGames.length > 1 && (
                      <div className="hv-sp-nav">
                        <button
                          className="hv-sp-nav-btn"
                          disabled={safeIdx === 0}
                          onClick={() => navigateSpotlight(-1)}
                        >
                          <svg viewBox="0 0 16 16" fill="none" width="12" height="12">
                            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        <span className="hv-sp-nav-count">{safeIdx + 1}/{spotlightGames.length}</span>
                        <button
                          className="hv-sp-nav-btn"
                          disabled={safeIdx === spotlightGames.length - 1}
                          onClick={() => navigateSpotlight(1)}
                        >
                          <svg viewBox="0 0 16 16" fill="none" width="12" height="12">
                            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Conteúdo do jogo com transição direcional */}
                  <div
                    key={spotlightKey}
                    className={`hv-sp-slide${spotlightDir === 'right' ? ' hv-sp-slide-right' : spotlightDir === 'left' ? ' hv-sp-slide-left' : ''}`}
                  >
                    <div className="hv-spotlight-teams">
                      <div className="hv-spotlight-team">
                        {getEscudoUrl(currentGame.mandante)
                          ? <img src={getEscudoUrl(currentGame.mandante)} className="hv-spotlight-shield" alt={currentGame.mandante} />
                          : <div className="hv-spotlight-shield-fb" style={{ background: currentGame.accentColor + '28' }} />
                        }
                        <span className="hv-spotlight-tname">{currentGame.mandante}</span>
                      </div>
                      <span className="hv-spotlight-vs">×</span>
                      <div className="hv-spotlight-team">
                        {getEscudoUrl(currentGame.visitante)
                          ? <img src={getEscudoUrl(currentGame.visitante)} className="hv-spotlight-shield" alt={currentGame.visitante} />
                          : <div className="hv-spotlight-shield-fb" style={{ background: currentGame.accentColor + '28' }} />
                        }
                        <span className="hv-spotlight-tname">{currentGame.visitante}</span>
                      </div>
                    </div>

                    <div className="hv-spotlight-chips">
                      {currentGame.rawDate  && <span className="hv-sp-chip">{currentGame.rawDate}</span>}
                      {currentGame.hora_brt && <span className="hv-sp-chip hv-sp-chip-em">{currentGame.hora_brt} BRT</span>}
                      {currentGame.rod      && <span className="hv-sp-chip">Rod. {currentGame.rod}</span>}
                      {currentGame.detentor && <span className="hv-sp-chip">{currentGame.detentor}</span>}
                    </div>

                    <div className="hv-spotlight-status" style={{ color: statusColor(currentGame.status) }}>
                      <span className="hv-spotlight-sdot" style={{ background: statusColor(currentGame.status) }} />
                      {currentGame.status || 'Pendente'}
                    </div>
                  </div>

                  {/* Dots indicadores */}
                  {spotlightGames.length > 1 && (
                    <div className="hv-sp-dots">
                      {spotlightGames.map((_, i) => (
                        <button
                          key={i}
                          className={`hv-sp-dot${i === safeIdx ? ' hv-sp-dot-on' : ''}`}
                          style={i === safeIdx ? { background: currentGame.accentColor } : {}}
                          onClick={() => {
                            const dir = i > safeIdx ? 1 : -1
                            setSpotlightDir(dir > 0 ? 'right' : 'left')
                            setSpotlightKey(k => k + 1)
                            setSpotlightIdx(i)
                          }}
                        />
                      ))}
                    </div>
                  )}

                  <button
                    className="hv-spotlight-cta"
                    style={{ background: currentGame.accentColor, borderColor: currentGame.accentColor }}
                    onClick={() => onCompSelect(currentGame.competitionId)}
                  >
                    Ver campeonato
                    <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
                      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              ) : (
                !loading && (
                  <div className="hv-empty">
                    <div className="hv-empty-dot" />
                    <div className="hv-empty-text">Sem jogos futuros</div>
                  </div>
                )
              )}

              {restGames.length > 0 && (
                <div className="hv-panel-upcoming">
                  <div className="hv-up-header">
                    <span className="hv-sec-label">Próximos Jogos</span>
                    <button className="hv-up-toggle" onClick={() => setShowUpcoming(v => !v)}>
                      {showUpcoming ? 'Ocultar' : `Ver ${restGames.length}`}
                    </button>
                  </div>
                  {showUpcoming && (
                    <div className="hv-upcoming-list">
                      {restGames.map((m, i) => (
                        <div
                          key={i}
                          className="hv-up-row"
                          onClick={() => onCompSelect(m.competitionId)}
                        >
                          <span className="hv-up-dot" style={{ background: m.accentColor }} />
                          <span className="hv-up-teams">
                            {m.mandante} × {m.visitante}
                          </span>
                          <span className="hv-up-date">
                            {new Date(m.ts).getDate()} {MESES[new Date(m.ts).getMonth()].slice(0,3)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
