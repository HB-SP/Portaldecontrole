// ─── CAMPEONATOS ─────────────────────────────────────────────────────────────
// A tela inicial mostra o que está correndo. Quando um campeonato acaba, ele
// sai de lá — mas NÃO É APAGADO NEM GUARDADO FORA: vira histórico, inteiro, e
// fica aqui para consulta (equipe, 24/09/2026).
//
// Quem decide que acabou é a equipe, nunca a data: jogo adiado existe, e um
// campeonato sumir sozinho da tela seria pior que um card a mais. Por isso o
// botão é explícito e a volta também.
//
// A comparação que a equipe usou foi a das abas ocultas de uma planilha: elas
// continuam ali embaixo, é só clicar.

import { useMemo, useState } from 'react'

// O ano sai do rótulo — "Copinha 26" é 2026 — e é por ele que o histórico se
// organiza. Sem ano no nome, cai em "sem ano", que é melhor que chutar.
function anoDoLabel(label) {
  const t = String(label || '')
  const m = t.match(/\b(20\d{2})\b/) || t.match(/(\d{2})\s*$/)
  if (!m) return null
  const n = Number(m[1])
  return n < 100 ? 2000 + n : n
}

function Cartao({ comp, onAbrir, onEncerrar, onReabrir, podeEditar }) {
  const [confirmando, setConfirmando] = useState(false)
  const secoes = (comp.sections || []).filter(s => !s.isOverview)

  return (
    <div className="cmp-card" style={{ '--ac': comp.accentColor }}>
      <button className="cmp-card-abrir" onClick={() => onAbrir(comp.id)}>
        <span className="cmp-card-cor" style={{ background: comp.accentColor }} />
        <span className="cmp-card-corpo">
          <span className="cmp-card-nome">{comp.label}</span>
          <span className="cmp-card-sub">
            {secoes.length} {secoes.length === 1 ? 'aba' : 'abas'}
          </span>
        </span>
      </button>

      {/* O botão marca um ESTADO, não dispara uma ação: o campeonato "está
          encerrado". A palavra é a da equipe (24/09/2026) e diz o que é — nada
          acontece com os dados, só a tela passa a tratá-lo como passado. */}
      {podeEditar && (comp.encerrado ? (
        <button className="cmp-acao" onClick={() => onReabrir(comp)} title="Volta para a tela inicial">
          reabrir
        </button>
      ) : confirmando ? (
        <span className="cmp-confirma">
          <button className="cmp-acao cmp-acao-sim" onClick={() => { setConfirmando(false); onEncerrar(comp) }}>
            confirmar
          </button>
          <button className="cmp-acao" onClick={() => setConfirmando(false)}>não</button>
        </span>
      ) : (
        <button className="cmp-acao" onClick={() => setConfirmando(true)} title="Sai da tela inicial e desce para o histórico">
          encerrado
        </button>
      ))}
    </div>
  )
}

export default function CampeonatosView({
  competitions = [], encerrados = [], podeEditar = false,
  onCompSelect, onMarcarEncerrado,
}) {
  const [erro, setErro] = useState('')

  // O histórico se agrupa por ano, do mais novo para o mais antigo: é como se
  // procura uma edição passada — "o Paulistão de 26" — e não pela ordem em que
  // os campeonatos foram criados.
  const porAno = useMemo(() => {
    const mapa = new Map()
    for (const c of encerrados) {
      const ano = anoDoLabel(c.label)
      const chave = ano || 'sem ano'
      if (!mapa.has(chave)) mapa.set(chave, [])
      mapa.get(chave).push(c)
    }
    return [...mapa.entries()].sort((a, b) => (b[0] === 'sem ano' ? -1 : a[0] === 'sem ano' ? 1 : b[0] - a[0]))
  }, [encerrados])

  const mexer = async (comp, encerrado) => {
    setErro('')
    const falha = await onMarcarEncerrado?.(comp.competitionId, encerrado)
    if (falha) setErro(falha)
  }

  return (
    <div className="cmp-wrap">
      <div className="cmp-intro">
        A tela inicial mostra os campeonatos que estão correndo. Ao encerrar um, ele sai de lá
        e desce para o histórico — com os jogos, os periféricos e a escala, tudo inteiro e
        aberto para consulta. Dá para reabrir quando quiser.
      </div>
      {erro && <div className="cmp-erro">Não deu para salvar: {erro}</div>}

      <div className="cmp-secao">
        <div className="cmp-secao-cab">
          Em andamento<span className="cmp-quantos">{competitions.length}</span>
        </div>
        {competitions.length ? (
          <div className="cmp-lista">
            {competitions.map(c => (
              <Cartao
                key={c.id} comp={c}
                podeEditar={podeEditar} onAbrir={onCompSelect}
                onEncerrar={x => mexer(x, true)} onReabrir={x => mexer(x, false)}
              />
            ))}
          </div>
        ) : (
          <div className="cmp-vazio">Nenhum campeonato em andamento.</div>
        )}
      </div>

      <div className="cmp-secao cmp-secao-hist">
        <div className="cmp-secao-cab">
          Histórico<span className="cmp-quantos">{encerrados.length}</span>
        </div>
        {encerrados.length ? porAno.map(([ano, lista]) => (
          <div key={ano} className="cmp-ano">
            <div className="cmp-ano-cab">{ano}</div>
            <div className="cmp-lista">
              {lista.map(c => (
                <Cartao
                  key={c.id} comp={c}
                  podeEditar={podeEditar} onAbrir={onCompSelect}
                  onEncerrar={x => mexer(x, true)} onReabrir={x => mexer(x, false)}
                />
              ))}
            </div>
          </div>
        )) : (
          <div className="cmp-vazio">Nada no histórico ainda.</div>
        )}
      </div>
    </div>
  )
}
