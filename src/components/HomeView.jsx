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
  const [viewMode,       setViewMode]       = useState('split')
  const [mounted,       setMounted]       = useState(false)

  const { matchesByDate, totalsByComp, previstosByComp, loading } = useHomeData(competitions)

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

  // O painel da direita só tem o que dizer com um dia escolhido E jogo nele.
  const painelTemAlgo = !!selectedKey && selectedMatches.length > 0

  // upcoming, idsNoDestaque, restGames e nextByComp saíram com a lista "depois
  // desta rodada". Eram quatro cálculos rodando a cada mudança de filtro para
  // alimentar um bloco que não existe mais.

  return (
    <div className={`hv-root${mounted ? ' hv-mounted' : ''}`}>
      <div className="hv-bg" />

      {/* ── Próxima rodada ──
          A lista "depois desta rodada" que ficava logo abaixo saiu. Com as
          setas da Próxima Rodada levando até a 30, a 31 e adiante, ela repetia
          em texto miúdo o que o bloco de cima já faz melhor — e enchia a tela
          (equipe, 25/09/2026). O que vem depois continua a um clique na seta,
          e por mês no calendário. */}
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
        </div>
      )}

      {/* ── Competition cards ── */}
      {/* ── Campeonatos ──
          A faixa colorida com o nome dentro saiu. Ela pintava um bloco inteiro
          para dizer o nome do campeonato, e a cor sozinha não identifica nada
          para quem não decorou qual é qual.
          Agora quem identifica é a LOGO, e o que a cor faz é um fio no alto —
          presença sem peso. A barra de progresso ficou, porque é ela que
          responde "como está o campeonato" de relance (equipe, 25/09/2026). */}
      <div className="hv-navgrid hv-enter" style={{ '--i': 2 }}>
        {competitions.map((comp, idx) => {
          // TRÊS NÚMEROS, e cada um responde uma pergunta diferente:
          //   previstos  quantos jogos o campeonato tem do começo ao fim
          //   total      quantos já se sabe QUEM joga
          //   done       quantos já aconteceram
          // Num mata-mata os três são diferentes: o Sub 20 tem 12 datas
          // reservadas, 2 com adversário definido, 2 realizados. Mostrar só
          // "2/2" diria que o campeonato acabou (equipe, 25/09/2026).
          const total     = totalsByComp[comp.id]     ?? 0
          const previstos = previstosByComp[comp.id]  ?? total
          const done      = doneByComp[comp.id]       ?? 0
          const aDefinir  = Math.max(0, previstos - total)
          // A barra mede contra o que o campeonato TEM, não contra o que já
          // foi marcado — senão ela encheria antes da hora e voltaria atrás a
          // cada novo confronto definido.
          const base      = previstos || 1
          const pctFeito  = Math.round((done / base) * 100)
          const pctSabido = Math.round((total / base) * 100)
          const nome  = cleanComp(comp.label)
          // Sem logo, as iniciais na cor do campeonato. Um buraco no lugar da
          // imagem seria pior que não ter imagem nenhuma.
          const sigla = nome.split(/\s+/).filter(x => /[A-Za-zÀ-ú]/.test(x))
            .map(x => x[0]).join('').slice(0, 2).toUpperCase()
          return (
            <button
              key={comp.id}
              className="hv-camp hv-enter"
              style={{
                // Duas cores, dois papeis: --ac ESCREVE (o "abrir", a borda) e
                // --acf PREENCHE (a barra, o fio). O verde-limao do
                // Brasileirao e o amarelo da Copinha sao otimos preenchendo e
                // ilegiveis escrevendo (equipe, 25/09/2026).
                '--ac': comp.accentColor,
                '--acf': comp.accentFill || comp.accentColor,
                // A borda usa a cor do campeonato em 25%: presente o bastante
                // para identificar, discreta o bastante para nao virar moldura.
                '--ac-borda': comp.accentColor + '40',
                '--i': idx + 3,
              }}
              onClick={() => onCompSelect(comp.id)}
            >
              <span className="hv-camp-fio" />

              <span className="hv-camp-topo">
                {comp.logoUrl
                  ? <img src={comp.logoUrl} className="hv-camp-logo" alt="" />
                  : <span className="hv-camp-logo hv-camp-sigla" style={{ color: comp.accentColor, borderColor: comp.accentColor + '40' }}>{sigla}</span>}
                {/* Só o nome. O "X por vir, Y a definir" saiu daqui: num
                    cartão que já tem logo, selo, barra e botão, uma frase a
                    mais é informação demais. Ela foi para dentro do
                    campeonato, na Visão Geral, que é onde a pessoa vai
                    justamente olhar o andamento (equipe, 25/09/2026).
                    A barra fica — ela conta a mesma coisa sem texto. */}
                <span className="hv-camp-nome">
                  <b>{nome}</b>
                </span>
                <span className="hv-camp-selo" style={{ color: comp.accentColor, background: comp.accentColor + '14' }}>
                  <i style={{ background: comp.accentColor }} />
                  em andamento
                </span>
              </span>

              {!loading && previstos > 0 && (
                <span className="hv-camp-prog">
                  {/* A barra tem DUAS camadas. A de trás, esmaecida, vai até
                      onde já se sabe quem joga; a da frente, cheia, até o que
                      já aconteceu. O que sobra do trilho é o que o campeonato
                      ainda vai sortear. Assim uma barra só conta a história
                      inteira sem virar três barras. */}
                  <span
                    className="hv-camp-trilho"
                    title={aDefinir > 0
                      ? `${previstos} jogos previstos · ${total} com os times definidos · ${done} realizados`
                      : `${previstos} jogos · ${done} realizados`}
                  >
                    <span className="hv-camp-sabido" style={{ width: `${pctSabido}%` }} />
                    <span className="hv-camp-fill" style={{ width: `${pctFeito}%` }} />
                  </span>
                  <span className="hv-camp-n">{done}<i>/{previstos}</i></span>
                </span>
              )}

              <span className="hv-camp-ir" style={{ color: comp.accentColor }}>
                abrir
                <svg viewBox="0 0 16 16" fill="none" width="12" height="12">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Split: Calendar (left) + Panel (right) ── */}
      {/* A COLUNA DA DIREITA SO EXISTE SE TIVER O QUE MOSTRAR.
          Sem dia escolhido — ou em dia sem jogo, como hoje — ela ficava ali
          ocupando 40% da tela para dizer "clique num dia". O calendario, que e
          o que a pessoa veio ver, ficava espremido em pouco mais da metade
          (equipe, 25/09/2026).
          O botao de largura continua valendo: ele diz o que acontece QUANDO um
          dia e escolhido. */}
      <div
        className={`hv-split hv-enter${viewMode === 'full' || !painelTemAlgo ? ' hv-split--full' : ''}`}
        style={{ '--i': 3 }}
      >

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
              {/* Esta parte quase nunca aparece: quando o painel não tem o que
                  dizer, a coluna inteira sai e o calendário ocupa a largura.
                  Ela fica de rede de segurança para o instante entre clicar
                  num dia e o painel ter conteúdo. O "clique num dia" que morava
                  aqui saiu junto — ninguém precisa de aviso para clicar numa
                  grade de dias. */}
              <div className="hv-empty">
                <div className="hv-empty-dot" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
