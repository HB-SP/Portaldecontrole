// ─── RODADA EM DESTAQUE — o topo da tela inicial ─────────────────────────────
// A queixa que originou esta tela: o Portal mostrava um calendário (um índice
// de ONDE a informação está) enquanto a planilha mostra a própria informação.
// Por isso a escala vive aqui, e não atrás de uma navegação.
//
// Com a escala real preenchida os cards passaram de 15 linhas, e o usuário
// pediu para recolher. O meio-termo: recolhido continua dizendo o essencial
// numa linha (quem coordena, qual UM, quantos escalados) — quem bate o olho
// ainda leva informação, não só um título. A seta abre o resto, e a escolha
// fica guardada: quem prefere tudo aberto abre uma vez e pronto.
//
// Transmissão fica de fora de propósito — importante, mas não é o que se olha
// ao abrir.

import { useState, useEffect } from 'react'
import { getEscudoUrl } from '../lib/escudos'
import { resumoDoJogo } from '../lib/resumoJogo'

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const CHAVE_ABERTO = 'home_cards_abertos'

function Escudo({ nome }) {
  const url = getEscudoUrl(nome)
  return url
    ? <img className="pr-escudo" src={url} alt="" loading="lazy" />
    : <span className="pr-escudo pr-escudo-fb">{(nome || '?').slice(0, 1)}</span>
}

function Bloco({ bloco }) {
  return (
    <div className="pr-bloco">
      <div className="pr-bloco-head">
        <span className="pr-bloco-titulo">{bloco.titulo}</span>
      </div>
      {bloco.itens.length === 0 ? (
        <div className="pr-linha pr-linha-nada">
          <span className="pr-linha-valor">nada escalado ainda</span>
        </div>
      ) : bloco.itens.map(i => (
        <div key={i.label} className="pr-linha">
          <span className="pr-linha-label">{i.label}</span>
          <span className="pr-linha-valor">{i.valor}</span>
        </div>
      ))}
    </div>
  )
}

// A linha que o card recolhido mostra: os dois primeiros nomes de Pessoal e o
// primeiro de Operações. Sem isso o card fechado seria só um título, e a tela
// voltaria a ser um índice — exatamente o que motivou a mudança.
function resumoCurto(resumo) {
  const pega = chave => resumo.blocos.find(b => b.chave === chave)?.itens || []
  const partes = [...pega('pessoal').slice(0, 2), ...pega('operacoes').slice(0, 1)]
  return partes.map(i => i.valor).join(' · ')
}

function Card({ jogo, aberto, onAlternar, onAbrirFicha }) {
  const { row, d, accentColor, competitionLabel } = jogo
  const resumo = resumoDoJogo(jogo)
  const blocos = resumo.blocos.filter(b => !b.vazio)
  const data = `${DIAS_SEMANA[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')} ${MESES_CURTO[d.getMonth()]}`
  const curto = resumoCurto(resumo)

  return (
    <article className={`pr-card${aberto ? ' is-aberto' : ''}`} style={{ '--ac': accentColor }}>
      <header className="pr-card-top">
        <span className="pr-rodada">Rodada {jogo.rod || '—'}</span>
        <span className="pr-data">{data}</span>
      </header>

      <div className="pr-confronto">
        <div className="pr-time">
          <Escudo nome={row.mandante} />
          <span className="pr-time-nome">{row.mandante}</span>
        </div>
        <div className="pr-hora">
          <span className="pr-hora-valor">{row.hora_brt || '--:--'}</span>
          <span className="pr-hora-vs">vs</span>
        </div>
        <div className="pr-time">
          <Escudo nome={row.visitante} />
          <span className="pr-time-nome">{row.visitante}</span>
        </div>
      </div>

      <div className="pr-meta">
        {[row.estadio, row.cidade].filter(Boolean).join(' · ') || '—'}
        {row.detentor && <span className="pr-detentor">{row.detentor}</span>}
      </div>

      {/* Fechado: uma linha com o essencial. Aberto: a escala inteira. */}
      {aberto ? (
        <div className="pr-blocos">
          {blocos.map(b => <Bloco key={b.chave} bloco={b} />)}
        </div>
      ) : (
        <div className="pr-resumo-curto">
          {curto || <span className="pr-resumo-vazio">nada escalado ainda</span>}
        </div>
      )}

      <footer className="pr-card-foot">
        <button type="button" className="pr-toggle" onClick={onAlternar}
          aria-expanded={aberto}
          title={aberto ? 'Recolher a escala' : 'Ver a escala deste jogo'}>
          <span className={`pr-seta${aberto ? ' is-aberta' : ''}`}>›</span>
          {aberto ? 'Recolher' : `Ver escala · ${resumo.escalados === 0 ? 'sem escala' : `${resumo.escalados} escalados`}`}
        </button>
        <button type="button" className="pr-ficha" onClick={() => onAbrirFicha?.(jogo)}
          title={`Abrir ${competitionLabel}`}>
          Ficha →
        </button>
      </footer>
    </article>
  )
}

export default function ProximaRodada({
  rodada, jogos, ehDestaque, podeVoltar, podeAvancar, onVoltar, onAvancar, onVoltarAoDestaque, onAbrirFicha,
}) {
  // Aberto/fechado é preferência da pessoa, não do jogo: quem gosta de ver
  // tudo abre uma vez e continua assim.
  const [abertos, setAbertos] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(CHAVE_ABERTO) || '[]')) } catch { return new Set() }
  })
  useEffect(() => {
    try { localStorage.setItem(CHAVE_ABERTO, JSON.stringify([...abertos])) } catch { /* sem storage */ }
  }, [abertos])

  const alternar = id => setAbertos(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const idDo = j => String(j.row?.id ?? `${j.rawDate}-${j.row?.mandante}`)

  if (!rodada || !jogos?.length) {
    return (
      <section className="pr-wrap">
        <div className="pr-vazio">
          <div className="pr-vazio-titulo">Jogos ainda não divulgados</div>
          <div className="pr-vazio-desc">
            Assim que a próxima rodada entrar no Portal, ela aparece aqui com a escala.
          </div>
        </div>
      </section>
    )
  }

  const sobra = rodada.jogos.length - jogos.length
  return (
    <section className="pr-wrap">
      <div className="pr-head">
        <h2 className="pr-titulo">{ehDestaque ? 'Próxima rodada' : 'Rodada'}</h2>
        <div className="pr-nav">
          <button type="button" className="pr-nav-btn" disabled={!podeVoltar}
            onClick={onVoltar} title="Rodada anterior">‹</button>
          <span className="pr-nav-atual" style={{ '--ac': rodada.accentColor }}>
            {rodada.compLabel} · rodada {rodada.rod}
          </span>
          <button type="button" className="pr-nav-btn" disabled={!podeAvancar}
            onClick={onAvancar} title="Próxima rodada">›</button>
        </div>
        {!ehDestaque && (
          <button type="button" className="pr-nav-voltar" onClick={onVoltarAoDestaque}>
            voltar para a próxima
          </button>
        )}
        {sobra > 0 && <span className="pr-sub">+{sobra} {sobra === 1 ? 'jogo' : 'jogos'} nesta rodada</span>}
      </div>

      <div className="pr-cards">
        {jogos.map(j => {
          const id = idDo(j)
          return (
            <Card key={id} jogo={j} aberto={abertos.has(id)}
              onAlternar={() => alternar(id)} onAbrirFicha={onAbrirFicha} />
          )
        })}
      </div>
    </section>
  )
}
