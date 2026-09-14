// ─── PRÓXIMA RODADA — o destaque da tela inicial ─────────────────────────────
// O ponto desta tela, decidido com o usuário: a escala aparece AQUI, sem
// clique. A queixa que originou tudo foi que o Portal mostrava um calendário
// (um índice de onde a informação está) enquanto a planilha mostra a própria
// informação. Então o card traz Pessoal, Operações e Periféricos já abertos;
// o clique fica para a ficha completa, não para o básico.
//
// Transmissão fica de fora de propósito — importante, mas não é o que se olha
// ao abrir.

import { getEscudoUrl } from '../lib/escudos'
import { resumoDoJogo } from '../lib/resumoJogo'

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function Escudo({ nome }) {
  const url = getEscudoUrl(nome)
  return url
    ? <img className="pr-escudo" src={url} alt="" loading="lazy" />
    : <span className="pr-escudo pr-escudo-fb">{(nome || '?').slice(0, 1)}</span>
}

// Sem "X a definir": campo vazio não quer dizer pendência. A maioria das
// colunas do grupo é opcional — um jogo com um supervisor só não tem
// "Supervisores 2" faltando, ele simplesmente não usa. Tratar tudo como
// obrigatório inventava pendência que não existe, e o "a definir" ficava
// ambíguo entre "falta preencher" e "esse jogo não tem esse serviço".
// O que o card afirma agora é só o que é fato: o que está escalado.
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

function Card({ jogo, onAbrir }) {
  const { row, d, accentColor, competitionLabel } = jogo
  const resumo = resumoDoJogo(jogo)
  const blocos = resumo.blocos.filter(b => !b.vazio)
  const data = `${DIAS_SEMANA[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')} ${MESES_CURTO[d.getMonth()]}`

  return (
    <article className="pr-card" style={{ '--ac': accentColor }}
      onClick={() => onAbrir?.(jogo)} title="Abrir a ficha completa deste jogo">
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

      <div className="pr-blocos">
        {blocos.map(b => <Bloco key={b.chave} bloco={b} />)}
      </div>

      <footer className="pr-card-foot">
        <span className="pr-camp">{competitionLabel}</span>
        {/* Contagem do que está escalado — fato verificável, ao contrário de
            "quanto falta", que dependeria de saber quais serviços este jogo
            realmente usa. */}
        <span className="pr-selo">
          {resumo.escalados === 0 ? 'sem escala' : `${resumo.escalados} escalados`}
        </span>
      </footer>
    </article>
  )
}

export default function ProximaRodada({ selecao, onAbrir }) {
  if (!selecao || selecao.vazio || !selecao.cards.length) {
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

  const sobra = selecao.total - selecao.cards.length
  return (
    <section className="pr-wrap">
      <div className="pr-head">
        <h2 className="pr-titulo">Próxima rodada</h2>
        <span className="pr-sub">
          {selecao.comp} · rodada {selecao.rod}
          {sobra > 0 && ` · +${sobra} ${sobra === 1 ? 'jogo' : 'jogos'} na lista abaixo`}
        </span>
      </div>
      <div className="pr-cards">
        {selecao.cards.map(j => <Card key={j.row.id ?? `${j.rawDate}-${j.row.mandante}`} jogo={j} onAbrir={onAbrir} />)}
      </div>
    </section>
  )
}
