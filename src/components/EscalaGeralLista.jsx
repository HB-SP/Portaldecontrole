// ─── ESCALA GERAL · VISÃO LISTA ──────────────────────────────────────────────
// Uma linha por jogo, no formato da planilha antiga: dá para bater o olho num
// volume grande sem rolar. Os cards continuam disponíveis no alternador — eles
// são melhores para trabalhar UM jogo; esta lista é para enxergar TODOS.
//
// Todo nome de pessoa é clicável e vira filtro: um clique em "Marcos Paulo"
// deixa na tela só os jogos em que ele está escalado, em qualquer função e
// qualquer campeonato.

import { naoTemFuncao as naoTem, semEscala } from '../lib/escalaLink'
import { BadgeCamp, Escudo, estiloCampeonato } from './campeonatoVisual'

// Célula de uma função. Um valor pode trazer duas pessoas ("Fulano / Ciclano")
// — cada uma vira seu próprio chip clicável.
function CelulaFuncao({ row, fn, conf, fPessoa, onPessoa, mudo }) {
  const bruto = row[fn.key]
  const norm = s => String(s || '').toLowerCase().trim()

  if (naoTem(bruto)) {
    return <td className="eg-lst-fn eg-lst-fn-na" title={`Este jogo não terá ${fn.label}`}>não</td>
  }
  if (!bruto || !String(bruto).trim()) {
    return (
      <td className={`eg-lst-fn ${mudo ? 'eg-lst-fn-mudo' : 'eg-lst-fn-vazio'}`}
        title={mudo ? 'Sem equipe escalada pela Livemode' : `${fn.label} em aberto`}>
        {mudo ? '—' : '● a definir'}
      </td>
    )
  }

  const pessoas = String(bruto).split('/').map(s => s.trim()).filter(Boolean)

  return (
    <td className="eg-lst-fn">
      <span className="eg-lst-nomes">
        {pessoas.map((p, i) => (
          <button
            key={`${p}-${i}`}
            type="button"
            className={`eg-lst-nome${fPessoa && norm(p) === norm(fPessoa) ? ' is-filtrado' : ''}`}
            title={`Ver todos os jogos de ${p}`}
            onClick={e => { e.stopPropagation(); onPessoa(p) }}
          >
            {p}
          </button>
        ))}
        {conf && (
          <span className={`eg-lst-conf ${conf.status === 'confirmado' ? 'ok' : 'nao'}`}
            title={conf.status === 'confirmado'
              ? 'Presença confirmada pelo prestador'
              : `Marcou indisponível${conf.obs ? ` — "${conf.obs}"` : ''}`}>
            {conf.status === 'confirmado' ? '✓' : '✗'}
          </span>
        )}
      </span>
    </td>
  )
}

export default function EscalaGeralLista({
  grupos, funcoes, confirmacoes, fPessoa,
  onPessoa, onFicha, onPublicarDia, onTogglePub,
}) {
  if (grupos.length === 0) return <div className="esc-vazio">Nenhum jogo com esses filtros.</div>

  return (
    <div className="eg-lst-wrap">
      <table className="eg-lst">
        <thead>
          <tr>
            <th className="eg-lst-c-camp">Camp.</th>
            <th className="eg-lst-c-hora">Hora</th>
            <th className="eg-lst-c-jogo">Jogo</th>
            <th className="eg-lst-c-local">Local</th>
            {funcoes.map(fn => <th key={fn.key} className="eg-lst-c-fn">{fn.label}</th>)}
            <th className="eg-lst-c-prog" title="Funções preenchidas / funções que este jogo precisa">OK</th>
            <th className="eg-lst-c-pub">Link</th>
          </tr>
        </thead>

        {grupos.map(([chave, grupo]) => {
          const pendentesDePub = grupo.lista.filter(r => !r.escala_publicada)
          return (
            <tbody key={chave}>
              <tr className="eg-lst-dia">
                <td colSpan={6 + funcoes.length}>
                  <span className="eg-lst-dia-data">{grupo.label}</span>
                  {grupo.dia && <span className="eg-lst-dia-semana">{grupo.dia}</span>}
                  <span className="eg-lst-dia-qtd">
                    {grupo.lista.length} {grupo.lista.length === 1 ? 'jogo' : 'jogos'}
                  </span>
                  {pendentesDePub.length > 0 && (
                    <button className="eg-lst-dia-pub"
                      title="Publica a escala de todos os jogos deste dia — eles passam a aparecer nos links dos prestadores"
                      onClick={() => onPublicarDia(pendentesDePub)}>
                      📢 Publicar dia
                    </button>
                  )}
                </td>
              </tr>

              {grupo.lista.map(r => {
                const { cor } = estiloCampeonato(r.campeonato)
                const mudo = semEscala(r)
                const ativas = funcoes.filter(fn => !naoTem(r[fn.key]))
                const ok = ativas.filter(fn => r[fn.key] && String(r[fn.key]).trim())
                const completo = ativas.length > 0 && ok.length === ativas.length
                return (
                  <tr key={r.id} className="eg-lst-linha" style={{ '--camp': cor }}
                    onClick={() => onFicha(r)} title="Abrir a ficha completa deste jogo">
                    <td className="eg-lst-camp"><BadgeCamp nome={r.campeonato} size={22} /></td>
                    <td className="eg-lst-hora">{r.horario || '—'}</td>
                    <td className="eg-lst-jogo">
                      <Escudo nome={r.mandante} size={20} />
                      <span className="eg-lst-time">{r.mandante}</span>
                      <span className="eg-lst-x">×</span>
                      <span className="eg-lst-time">{r.visitante}</span>
                      <Escudo nome={r.visitante} size={20} />
                      {r.obs && <span className="eg-lst-obs" title={r.obs}>📝</span>}
                    </td>
                    <td className="eg-lst-local" title={[r.cidade, r.estadio, r.fase_rodada].filter(Boolean).join(' · ')}>
                      {[r.cidade, r.estadio].filter(Boolean).join(' · ') || '—'}
                    </td>

                    {funcoes.map(fn => (
                      <CelulaFuncao
                        key={fn.key}
                        row={r}
                        fn={fn}
                        mudo={mudo}
                        conf={confirmacoes.get(`${r.id}|${fn.label}`)}
                        fPessoa={fPessoa}
                        onPessoa={onPessoa}
                      />
                    ))}

                    <td className={`eg-lst-prog${completo ? ' is-ok' : ''}`}>
                      {mudo ? '—' : `${ok.length}/${ativas.length}`}
                    </td>
                    <td className="eg-lst-pub">
                      <button
                        className={`eg-lst-pub-btn${r.escala_publicada ? ' is-on' : ''}`}
                        title={r.escala_publicada
                          ? 'Escala publicada — visível no link do prestador. Clique para voltar a rascunho.'
                          : 'Rascunho — invisível para os prestadores. Clique para publicar.'}
                        onClick={e => { e.stopPropagation(); onTogglePub(r) }}>
                        {r.escala_publicada ? '✓' : '○'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          )
        })}
      </table>
    </div>
  )
}
