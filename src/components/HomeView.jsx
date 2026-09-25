import { useState, useMemo, useEffect, useCallback } from 'react'
import { useHomeData } from '../hooks/useHomeData'
import { getEscudoUrl } from '../lib/escudos'
import { listarRodadas, indiceDaProxima, jogosVisiveis } from '../lib/proximaRodada'
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

// countdownLabel e formatNextTs saíram junto com o destaque da lateral: só
// ele usava. A data do jogo agora vem formatada no próprio card.

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

  // Rodadas em ordem, para as setas navegarem até a 29, a 30... sem sair da
  // tela inicial. `rodadaIdx` null = seguindo o padrão (a próxima rodada);
  // assim a tela volta sozinha ao destaque quando o dia vira.
  const rodadas = useMemo(() => listarRodadas(todosOsJogos), [todosOsJogos])
  const idxDestaque = useMemo(() => indiceDaProxima(rodadas), [rodadas])
  const [rodadaIdx, setRodadaIdx] = useState(null)
  const idxAtual = rodadaIdx ?? idxDestaque
  const rodadaAtual = idxAtual >= 0 ? rodadas[idxAtual] : null
  const ehDestaque = idxAtual === idxDestaque
  const jogosDaRodada = useMemo(
    () => jogosVisiveis(rodadaAtual, { ehDestaque }),
    [rodadaAtual, ehDestaque],
  )


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

  // A lateral mostra o que vem DEPOIS da rodada em destaque: os jogos que já
  // estão nos cards do topo saem daqui, senão a tela diria a mesma coisa duas
  // vezes.
  const idsNoDestaque = useMemo(
    () => new Set(jogosDaRodada.map(j => `${j.dateKey}|${j.mandante}|${j.visitante}`)),
    [jogosDaRodada],
  )
  const restGames = useMemo(
    () => upcoming.filter(m => !idsNoDestaque.has(`${m.dateKey}|${m.mandante}|${m.visitante}`)).slice(0, 10),
    [upcoming, idsNoDestaque],
  )

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


  return (
    <div className={`hv-root${mounted ? ' hv-mounted' : ''}`}>
      <div className="hv-bg" />

      {/* ── Próxima rodada, e logo abaixo a sequência dela ──
          Uma coisa só, em dois níveis: os jogos que vêm agora em detalhe, com
          escala, e a lista do que vem depois logo embaixo, fina e sem moldura.
          Lado a lado e com borda própria, viravam dois blocos disputando o
          mesmo espaço — "vários blocos colocados sem critério" (equipe,
          25/09/2026). Em degrau, a leitura desce sozinha do maior para o
          menor. */}
      {!loading && (
        <div className="hv-enter" style={{ '--i': 1 }}>
          <ProximaRodada
            rodada={rodadaAtual}
            jogos={jogosDaRodada}
            ehDestaque={ehDestaque}
            podeVoltar={idxAtual > 0}
            podeAvancar={idxAtual >= 0 && idxAtual < rodadas.length - 1}
            onVoltar={() => setRodadaIdx(Math.max(0, idxAtual - 1))}
            onAvancar={() => setRodadaIdx(Math.min(rodadas.length - 1, idxAtual + 1))}
            onVoltarAoDestaque={() => setRodadaIdx(null)}
            // Leva o jogo junto: o "Ficha →" cai no card dele, nao so no campeonato
            onAbrirFicha={j => onCompSelect(j.competitionId, { data: j.rawDate, mandante: j.mandante, visitante: j.visitante, padrao: j.padrao, rod: j.rod })}
          />

          {restGames.length > 0 && (
            <div className="hv-sequencia">
              <button
                className="hv-seq-titulo"
                onClick={() => setShowUpcoming(v => !v)}
                title={showUpcoming ? 'Esconder' : 'Mostrar'}
              >
                <span className={`hv-seq-seta${showUpcoming ? ' aberta' : ''}`}>›</span>
                depois desta rodada
                <span className="hv-seq-n">{restGames.length}</span>
              </button>
              {showUpcoming && (
                <div className="hv-seq-lista">
                  {restGames.map((m, i) => (
                    <button key={i} className="hv-seq-jogo" onClick={() => onCompSelect(m.competitionId)}>
                      <span className="hv-seq-data">
                        {new Date(m.ts).getDate()} {MESES[new Date(m.ts).getMonth()].slice(0, 3).toLowerCase()}
                      </span>
                      <span className="hv-seq-times">{m.mandante} × {m.visitante}</span>
                      <span className="hv-seq-cor" style={{ background: m.accentColor }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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
              {/* A contagem do mês pertence AQUI, e não a uma faixa solta no
                  topo: ela fala do mês, e o mês é este calendário. Ao lado do
                  nome ela vira legenda do que está logo abaixo; sozinha lá em
                  cima, era um bloco a mais sem dono (equipe, 25/09/2026). */}
              {kpi.total > 0 && (
                <span className="hv-cal-conta">
                  {kpi.total} {kpi.total === 1 ? 'jogo' : 'jogos'}
                  {kpi.done > 0 && `, ${kpi.done} realizado${kpi.done === 1 ? '' : 's'}`}
                </span>
              )}
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
              {/* Sem dia escolhido, o painel não tem o que dizer — e é melhor
                  assim: a lista "Depois desta rodada" subiu para junto dos
                  cards da rodada, onde ela conversa com o resto. Aqui embaixo
                  ficou o calendário, e o painel só responde ao clique. */}
              <div className="hv-empty">
                <div className="hv-empty-dot" />
                <div className="hv-empty-text">Clique num dia para ver os jogos</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
