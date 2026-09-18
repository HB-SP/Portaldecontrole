// ─── CONTROLE DE FOLGAS E PRESENÇA ───────────────────────────────────────────
// A grade do mês no formato que a equipe já lê: um dia por linha, uma pessoa
// por coluna, a célula diz onde a pessoa está. Sinal Inter e Operações na mesma
// tabela, com filtro de time — antes eram duas planilhas separadas com a mesma
// forma.
//
// O que a planilha não fazia e é o ponto da tela: como o time trabalha fim de
// semana, cada sábado, domingo e feriado gera uma folga de direito. O número
// "a tirar" no cabeçalho de cada pessoa mostra quantas ela ainda tem para tirar
// — a conta vive em lib/folgas.js.

import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useFolgas } from '../hooks/useFolgas'
import {
  MESES, SEMANA_CURTA, iso, diasNoMes, hojeIso, ehFimDeSemana,
  saldoDoMes, saldoDoAno,
} from '../lib/folgas'

const CHAVE_TIME = 'folgas_time'

// Onde desenhar o menu de um dia. Ele fica preso à TELA (position: fixed), e não
// à célula, porque a célula corta o que passa da borda — era por isso que o menu
// abria e não aparecia. Se não couber para baixo, abre para cima; se não couber
// à direita, encosta pela direita.
const ALTURA_MENU = 340
function posicaoDoMenu(caixa) {
  if (!caixa) return { position: 'fixed', left: 0, top: 0 }
  const paraCima = caixa.bottom + ALTURA_MENU > window.innerHeight && caixa.top > ALTURA_MENU
  const esquerda = Math.min(caixa.left, window.innerWidth - 210)
  return paraCima
    ? { position: 'fixed', left: Math.max(8, esquerda), bottom: window.innerHeight - caixa.top + 2, top: 'auto' }
    : { position: 'fixed', left: Math.max(8, esquerda), top: caixa.bottom + 2 }
}

// ── COR NA GRADE ─────────────────────────────────────────────────────────────
// A cor vive na LETRA, não no fundo: célula pintada vira uma coluna de blocos e
// o olho vai para o formato em vez do conteúdo.
//
// E só a AUSÊNCIA é colorida. O dia a dia — escritório, Casablanca, home,
// externa — é preto, porque é o normal: se o normal tem cor, a exceção deixa de
// ter. Decisões da equipe em 18/09/2026.
const AUSENCIA = new Set(['folga', 'ferias', 'atestado'])

function estiloCelula(cat) {
  if (!cat) return undefined
  if (!AUSENCIA.has(cat.id)) return { color: 'var(--text)' }
  return { color: cat.cor, fontWeight: cat.conta_folga ? 700 : 600 }
}

// ── Menu de um dia ───────────────────────────────────────────────────────────
// Clicou na célula, escolheu, acabou. Preencher um dia tinha virado um
// formulário — escolher a categoria, preencher, apertar Salvar — e são 31 dias
// vezes 17 pessoas. Agora a escolha JÁ GRAVA.
//
// O descritivo continua ali, mas num segundo passo, para quem quer: ele é a
// exceção, não o caminho principal.
function MenuDia({ atual, categorias, onSalvar, onFechar, ancora, quantos = 1 }) {
  // 'lista' = escolher a categoria. 'texto' = escrever o descritivo daquela.
  const [modo, setModo] = useState('lista')
  const [cat, setCat] = useState(atual?.categoria_id || '')
  const [detalhe, setDetalhe] = useState(atual?.detalhe || '')
  const [camp, setCamp] = useState(atual?.campeonato || '')
  const ref = useRef(null)

  useEffect(() => {
    const fora = e => { if (ref.current && e.target.isConnected && !ref.current.contains(e.target)) onFechar() }
    const esc = e => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [onFechar])

  const def = categorias.find(c => c.id === cat)

  // "Outro" não diz nada sem o texto, então ele é o único que não grava direto.
  const escolher = c => {
    if (c.exige_detalhe) { setCat(c.id); setDetalhe(atual?.categoria_id === c.id ? (atual.detalhe || '') : ''); setModo('texto'); return }
    onSalvar({ categoria_id: c.id, detalhe: atual?.categoria_id === c.id ? (atual.detalhe || null) : null, campeonato: null })
  }

  if (modo === 'texto') {
    const falta = def?.exige_detalhe && !detalhe.trim()
    return (
      <div className="flg-menu" ref={ref} style={ancora} onMouseDown={e => e.stopPropagation()}>
        <div className="flg-menu-topo">
          <button className="flg-menu-voltar" onClick={() => setModo('lista')}>‹</button>
          <span>{def?.nome || 'Descritivo'}</span>
        </div>
        {def?.presets?.length > 0 && (
          <div className="flg-menu-presets">
            {def.presets.map(x => (
              <button key={x} className={`flg-preset${detalhe === x ? ' is-on' : ''}`} onClick={() => setDetalhe(x)}>{x}</button>
            ))}
          </div>
        )}
        {def?.campeonatos?.length > 0 && (
          <select className="flg-menu-campo" value={camp} onChange={e => setCamp(e.target.value)}>
            <option value="">Campeonato (opcional)</option>
            {def.campeonatos.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <input
          className="flg-menu-campo" autoFocus
          placeholder={def?.dica_detalhe || 'o que será feito no dia'}
          value={detalhe} onChange={e => setDetalhe(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !falta) onSalvar({ categoria_id: cat, detalhe: detalhe.trim() || null, campeonato: camp || null })
          }}
        />
        <button
          className="flg-menu-ok" disabled={falta}
          onClick={() => onSalvar({ categoria_id: cat, detalhe: detalhe.trim() || null, campeonato: camp || null })}
        >{falta ? 'Falta o descritivo' : 'Salvar'}</button>
      </div>
    )
  }

  return (
    <div className="flg-menu" ref={ref} style={ancora} onMouseDown={e => e.stopPropagation()}>
      {quantos > 1 && <div className="flg-menu-quantos">{quantos} dias marcados</div>}
      {categorias.map(c => (
        <button
          key={c.id}
          className={`flg-menu-item${atual?.categoria_id === c.id ? ' is-on' : ''}`}
          onClick={() => escolher(c)}
        >
          <span className="flg-menu-cor" style={{ background: c.cor }} />
          {c.nome}
        </button>
      ))}
      <div className="flg-menu-sep" />
      {atual && (
        <button className="flg-menu-item flg-menu-acao" onClick={() => { setCat(atual.categoria_id); setModo('texto') }}>
          ✎ {atual.detalhe ? 'Mudar o descritivo' : 'Acrescentar descritivo'}
        </button>
      )}
      {atual && (
        <button className="flg-menu-item flg-menu-apagar" onClick={() => onSalvar(null)}>Apagar o dia</button>
      )}
    </div>
  )
}

// ── O número que importa ─────────────────────────────────────────────────────
// "-3" não diz sozinho se é bom ou ruim, e "deve 3" dizia o contrário do que
// acontece: quem tem folga acumulada não deve nada — a folga é DELA, ainda por
// tirar. "3 a tirar" é o termo que a própria planilha da equipe usa.
function emPalavras(n) {
  if (n < 0) return `${-n} a tirar`
  if (n > 0) return `${n} adiantada${n > 1 ? 's' : ''}`
  return 'em dia'
}
const corDoSaldo = n => (n < 0 ? 'var(--red)' : n > 0 ? 'var(--lm-green-dim)' : 'var(--text-dim)')

function ATirar({ n, titulo }) {
  return <span className="flg-atirar" style={{ color: corDoSaldo(n) }} title={titulo}>{emPalavras(n)}</span>
}

// Para QUEM o dia em branco já vale como dia trabalhado, e portanto a coluna
// pela metade não é ressalva nenhuma.
//
// Exceção por pessoa, não regra do sistema: a equipe disse em 18/09/2026 que os
// dias em branco do Gui Soria são dias trabalhados, e corrigiu em seguida que
// isso vale só para ele.
const BRANCO_E_TRABALHO = new Set(['gui soria'])
const semRessalva = nome => BRANCO_E_TRABALHO.has(
  String(nome || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
)

// ── O placar de cada pessoa ──────────────────────────────────────────────────
// O número grande responde a pergunta do dia a dia: QUANTAS FOLGAS AINDA
// PRECISO AGENDAR para essa pessoa. Ele desconta as que já estão marcadas no
// calendário, mesmo que sejam de um mês à frente — sem isso, marcar uma folga
// não mexia em nada e a tela não servia para planejar (equipe, 18/09/2026).
//
// A linha de baixo mostra quantas já têm data. As duas juntas reconstroem o
// saldo bruto, que é o número que a planilha antiga guardava:
//
//     a agendar  +  já marcadas  =  saldo devido hoje
//
function Placar({ mes, ano }) {
  const devidas = -ano.aTirar                    // o saldo de hoje, como a planilha conta
  const aAgendar = devidas - (ano.marcadas || 0) // o que ainda não tem data

  const palavra = aAgendar > 0 ? `${aAgendar} a agendar`
    : aAgendar < 0 ? `${-aAgendar} adiantada${aAgendar < -1 ? 's' : ''}`
    : 'em dia'

  const explicacao = ano.desde === null
    ? 'Sem nenhum dia preenchido neste ano'
    : `Deve ${devidas} folga${devidas === 1 ? '' : 's'} até hoje` +
      (ano.marcadas ? `, e ${ano.marcadas} já ${ano.marcadas === 1 ? 'está marcada' : 'estão marcadas'} no calendário` : '') +
      `. Tirou ${ano.usadas} de ${ano.direito} a que teve direito.`

  // A linha de baixo acompanha o MÊS que está na tela: quantas folgas a pessoa
  // tem marcadas nele. Serve para qualquer mês — passado, corrente ou futuro —
  // ao contrário de um saldo mensal, que num mês que nem começou dava "em dia"
  // e afirmava uma coisa que não aconteceu.
  //
  // Soma as duas pontas porque a conta do saldo para em hoje: no mês corrente,
  // parte das folgas já passou e parte ainda vem.
  const noMes = (mes.usadas || 0) + (mes.marcadas || 0)

  return (
    <div className="flg-placar">
      <div className="flg-placar-total" style={{ color: corDoSaldo(-aAgendar) }} title={explicacao}>
        {ano.desde === null ? '—' : palavra}
      </div>
      <div className="flg-placar-mes" title={`Folgas marcadas neste mês: ${noMes}`}>
        {noMes ? `${noMes} folga${noMes === 1 ? '' : 's'} no mês` : 'sem folga no mês'}
      </div>
    </div>
  )
}

export default function FolgasView({ podeEditar = false }) {
  const hoje = hojeIso()
  const [ano, setAno] = useState(() => Number(hoje.slice(0, 4)))
  const [mes, setMes] = useState(() => new Date().getMonth())
  const { times, pessoas, categorias, feriados, ajustes, dias, minhaPessoaId, loading, erro, salvarDia, salvarVarios, desfazer, podeDesfazer } = useFolgas(ano)

  const [fTime, setFTime] = useState(() => {
    try { return localStorage.getItem(CHAVE_TIME) || '' } catch { return '' }
  })
  const trocarTime = v => { setFTime(v); try { localStorage.setItem(CHAVE_TIME, v) } catch { /* sem storage */ } }

  const [editando, setEditando] = useState(null)      // { pessoaId, dia } — menu aberto
  // Arrastar para baixo repete o dia, como numa planilha. O ref guarda o
  // arrasto em curso porque os eventos de mouse chegam mais rápido do que o
  // React re-renderiza; o estado é só para desenhar a faixa.
  const arrastoRef = useRef(null)
  const [arrasto, setArrasto] = useState(null)
  const [selecao, setSelecao] = useState(null)        // { pessoaId, dias: [] }
  const [aba, setAba] = useState('grade')             // grade | resumo
  // Linha em destaque, como numa planilha: clicar no dia acende a linha toda,
  // para acompanhar um dia inteiro sem perder a conta de qual coluna é quem.
  const [linhaFoco, setLinhaFoco] = useState(null)

  const feriadosSet = useMemo(() => new Map(feriados.map(f => [f.dia, f.nome])), [feriados])
  const feriadosChaves = useMemo(() => new Set(feriados.map(f => f.dia)), [feriados])
  const catPorId = useMemo(() => new Map(categorias.map(c => [c.id, c])), [categorias])
  // As arquivadas seguem sendo LIDAS (para a grade mostrar o nome certo em quem
  // já está marcado com elas), mas saem da lista de escolher.
  const oferecidas = useMemo(() => categorias.filter(c => !c.arquivada), [categorias])
  const ehFolga = id => !!catPorId.get(id)?.conta_folga
  // Dia de atestado não gera folga de direito: quem está afastado não trabalhou
  // aquele fim de semana (equipe, 18/09/2026). Férias NÃO entra aqui — medido
  // contra o saldo das planilhas, incluir férias piorava justamente as colunas
  // bem preenchidas (Anny, Pardal, Lucas).
  const suspende = id => id === 'atestado'

  const visiveis = useMemo(
    () => pessoas.filter(p => !fTime || p.time_id === fTime),
    [pessoas, fTime]
  )

  // Os dias de UMA pessoa, já com o que a conta precisa saber de cada dia.
  const diasDe = useMemo(() => {
    const por = new Map()
    for (const p of pessoas) por.set(p.id, new Map())
    for (const [chave, linha] of dias) {
      const [pid] = chave.split('|')
      const m = por.get(pid)
      if (!m) continue
      const c = catPorId.get(linha.categoria_id)
      m.set(linha.dia, { ...linha, eh_deslocamento: !!c?.eh_deslocamento })
    }
    return por
  }, [dias, pessoas, catPorId])

  const saldos = useMemo(() => {
    const m = new Map()
    for (const p of visiveis) {
      const meus = diasDe.get(p.id) || new Map()
      const meusAjustes = ajustes.filter(a => a.pessoa_id === p.id)
      m.set(p.id, {
        mes: saldoDoMes({ dias: meus, feriados: feriadosChaves, ehFolga, suspende, ajustes: meusAjustes, ano, mes, hoje }),
        ano: saldoDoAno({ dias: meus, feriados: feriadosChaves, ehFolga, suspende, ajustes: meusAjustes, ano, hoje }),
      })
    }
    return m
  }, [visiveis, diasDe, ajustes, feriadosChaves, ano, mes, hoje, catPorId])

  // O Resumo é a lista de quem cobrar e de quem pode folgar na próxima rodada,
  // então ele vem de quem tem MAIS folga a tirar para quem tem menos — a grade
  // é que segue a ordem de leitura da equipe.
  const porMaisDevendo = useMemo(
    () => [...visiveis].sort((a, b) => (saldos.get(a.id)?.ano.aTirar ?? 0) - (saldos.get(b.id)?.ano.aTirar ?? 0)),
    [visiveis, saldos]
  )

  const total = diasNoMes(ano, mes)
  const listaDias = useMemo(() => Array.from({ length: total }, (_, i) => i + 1), [total])

  const andarMes = n => {
    const d = new Date(ano, mes + n, 1)
    setAno(d.getFullYear()); setMes(d.getMonth())
  }

  // ── O GESTO É UM SÓ: pressionar, arrastar, soltar ──────────────────────────
  // Vale nos dois modos, e é o que a equipe pediu — antes o arrasto só existia
  // no preenchimento, e marcar vários dias exigia clicar em cada um.
  //
  //   soltou no mesmo lugar  -> clique: abre o menu, ou marca/desmarca o dia
  //   soltou mais adiante    -> faixa: repete o valor, ou marca a faixa inteira
  //
  // O arrasto vive num ref porque os eventos de mouse chegam mais rápido do que
  // o React re-renderiza; o estado serve só para desenhar a faixa.
  const todosOsDias = useMemo(
    () => Array.from({ length: diasNoMes(ano, mes) }, (_, i) => iso(ano, mes, i + 1)),
    [ano, mes]
  )

  function aoPressionar(pessoaId, diaIso, e) {
    if (!podeEditar || e.button !== 0) return
    // A seleção é de UMA pessoa: começar noutra coluna no meio do caminho
    // misturaria dias de gente diferente no mesmo lote.
    if (selecao?.pessoaId && selecao.pessoaId !== pessoaId) return
    arrastoRef.current = {
      pessoaId, de: diaIso, ate: diaIso, moveu: false, shift: e.shiftKey,
      // Onde a célula está na tela. O menu não pode nascer dentro dela: a
      // célula corta o que passa da borda (para truncar texto longo) e a grade
      // também. Ele nasce preso ao body, nesta posição.
      caixa: e.currentTarget.getBoundingClientRect(),
    }
    setArrasto({ ...arrastoRef.current })
  }

  // onMouseOver, e não onMouseEnter: o "enter" só dispara ao cruzar a borda do
  // próprio <td>, e com o botão pressionado isso falha em alguns casos. O
  // "over" dispara também vindo de dentro de um filho, e a função é idempotente
  // — repetir no mesmo dia não faz nada.
  function aoEntrar(pessoaId, diaIso) {
    const a = arrastoRef.current
    if (!a || a.pessoaId !== pessoaId || a.ate === diaIso) return
    a.ate = diaIso
    a.moveu = true
    setArrasto({ ...a })
  }

  useEffect(() => {
    const soltar = async () => {
      const a = arrastoRef.current
      arrastoRef.current = null
      setArrasto(null)
      if (!a) return
      const [x, y] = [a.de, a.ate].sort()
      const faixa = todosOsDias.filter(k => k >= x && k <= y)

      if (selecao) {
        setSelecao(atual => {
          if (a.moveu) return { pessoaId: a.pessoaId, dias: [...new Set([...atual.dias, ...faixa])] }
          // Shift estende do último marcado até aqui — o gesto de planilha.
          if (a.shift && atual.dias.length) {
            const ultimo = atual.dias[atual.dias.length - 1]
            const [i, f] = [ultimo, a.de].sort()
            return { pessoaId: a.pessoaId, dias: [...new Set([...atual.dias, ...todosOsDias.filter(k => k >= i && k <= f)])] }
          }
          return {
            pessoaId: a.pessoaId,
            dias: atual.dias.includes(a.de) ? atual.dias.filter(k => k !== a.de) : [...atual.dias, a.de],
          }
        })
        return
      }

      if (!a.moveu) { setEditando({ pessoaId: a.pessoaId, dia: a.de, caixa: a.caixa }); return }

      // O valor de partida é lido AGORA, do estado atual, e não guardado lá no
      // mousedown: guardado, ele podia chegar aqui vazio e o preenchimento caía
      // no caminho de APAGAR — que em dias vazios não muda nada na tela e
      // parecia que o arrasto não tinha funcionado.
      const partida = dias.get(`${a.pessoaId}|${a.de}`)

      // Partiu de um dia vazio: não há o que repetir. Em vez de apagar a faixa
      // em silêncio, abre o menu UMA vez e aplica a todos os dias marcados —
      // que é o preenchimento que a tela devia ter desde o começo.
      if (!partida) { setEditando({ pessoaId: a.pessoaId, dia: a.de, caixa: a.caixa, faixa }); return }

      const alvo = faixa.filter(k => k !== a.de)
      if (!alvo.length) return
      const falha = await salvarVarios(a.pessoaId, alvo, {
        categoria_id: partida.categoria_id, detalhe: partida.detalhe, campeonato: partida.campeonato,
      })
      if (falha) alert('Não deu para preencher: ' + falha)
    }
    document.addEventListener('mouseup', soltar)
    return () => document.removeEventListener('mouseup', soltar)
  }, [todosOsDias, salvarVarios, selecao, dias])

  // Ctrl+Z desfaz a última mudança. Dentro de um campo de texto o atalho
  // continua sendo o do navegador — sequestrá-lo ali tiraria o desfazer de
  // quem está escrevendo o descritivo.
  useEffect(() => {
    const tecla = e => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || String(e.key).toLowerCase() !== 'z') return
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) return
      e.preventDefault()
      desfazer().then(falha => { if (falha) alert('Não deu para desfazer: ' + falha) })
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [desfazer])

  // O menu é preso à tela, então rolar a grade o deixaria solto no ar.
  useEffect(() => {
    if (!editando) return
    const fechar = () => setEditando(null)
    window.addEventListener('scroll', fechar, true)
    window.addEventListener('resize', fechar)
    return () => { window.removeEventListener('scroll', fechar, true); window.removeEventListener('resize', fechar) }
  }, [editando])

  // Está dentro da faixa que o arrasto vai pegar?
  const naFaixa = (pessoaId, diaIso) => {
    if (!arrasto || arrasto.pessoaId !== pessoaId || !arrasto.moveu) return false
    const [x, y] = [arrasto.de, arrasto.ate].sort()
    return diaIso >= x && diaIso <= y
  }

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div className="skeleton-cell" style={{ width: 220, height: 20, margin: '0 auto 16px' }} />
        <div className="skeleton-cell" style={{ width: 320, height: 14, margin: '0 auto' }} />
      </div>
    )
  }

  return (
    <div className="flg">
      <div className="flg-barra">
        <div className="flg-mes">
          <button className="flg-seta" onClick={() => andarMes(-1)} title="Mês anterior">‹</button>
          <span className="flg-mes-nome">{MESES[mes]} <strong>{ano}</strong></span>
          <button className="flg-seta" onClick={() => andarMes(1)} title="Próximo mês">›</button>
        </div>

        <select className="flg-sel" value={fTime} onChange={e => trocarTime(e.target.value)}>
          <option value="">Todos os times ({pessoas.length})</option>
          {times.map(t => (
            <option key={t.id} value={t.id}>
              {t.nome} ({pessoas.filter(p => p.time_id === t.id).length})
            </option>
          ))}
        </select>

        <div className="flg-abas">
          <button className={`flg-aba${aba === 'grade' ? ' is-on' : ''}`} onClick={() => setAba('grade')}>Grade</button>
          <button className={`flg-aba${aba === 'resumo' ? ' is-on' : ''}`} onClick={() => setAba('resumo')}>Resumo</button>
        </div>

        <div style={{ flex: 1 }} />

        {podeEditar && aba === 'grade' && (
          <button
            className={`flg-btn${selecao ? ' is-on' : ''}`}
            onClick={() => { setSelecao(selecao ? null : { pessoaId: null, dias: [] }); setEditando(null) }}
          >
            {selecao ? 'Sair da seleção' : 'Marcar vários dias'}
          </button>
        )}

        {podeEditar && podeDesfazer && (
          <button
            className="flg-btn" title="Desfazer a última mudança (Ctrl+Z)"
            onClick={() => desfazer().then(falha => { if (falha) alert('Não deu para desfazer: ' + falha) })}
          >↶ Desfazer</button>
        )}

        {podeEditar && aba === 'grade' && !selecao && (
          <span className="flg-dica">clique para escolher · arraste para baixo para repetir · Ctrl+Z desfaz</span>
        )}
      </div>

      {erro && <div className="flg-erro">Parte dos dados não carregou — {erro}</div>}

      {selecao && (
        <div className="flg-selbarra">
          <strong>{selecao.dias.length}</strong> {selecao.dias.length === 1 ? 'dia marcado' : 'dias marcados'}
          {selecao.pessoaId && <> · {pessoas.find(p => p.id === selecao.pessoaId)?.nome}</>}
          <span className="flg-selbarra-dica">clique ou arraste sobre os dias · shift para um intervalo</span>
          <div style={{ flex: 1 }} />
          {oferecidas.map(c => (
            <button
              key={c.id} className="flg-cat" style={{ borderColor: c.cor, color: c.cor }}
              disabled={!selecao.dias.length}
              onClick={async () => {
                const falha = await salvarVarios(selecao.pessoaId, selecao.dias, { categoria_id: c.id })
                if (falha) alert('Não deu para salvar: ' + falha)
                else setSelecao({ pessoaId: null, dias: [] })
              }}
            >{c.nome}</button>
          ))}
          <button
            className="flg-cat" disabled={!selecao.dias.length}
            onClick={async () => {
              const falha = await salvarVarios(selecao.pessoaId, selecao.dias, null)
              if (falha) alert('Não deu para apagar: ' + falha)
              else setSelecao({ pessoaId: null, dias: [] })
            }}
          >Apagar</button>
        </div>
      )}

      {editando && createPortal(
        <MenuDia
          atual={dias.get(`${editando.pessoaId}|${editando.dia}`)}
          categorias={oferecidas}
          quantos={editando.faixa?.length || 1}
          ancora={posicaoDoMenu(editando.caixa)}
          onFechar={() => setEditando(null)}
          onSalvar={async v => {
            const { pessoaId, dia, faixa } = editando
            setEditando(null)
            const falha = faixa?.length > 1
              ? await salvarVarios(pessoaId, faixa, v)
              : await salvarDia(pessoaId, dia, v)
            if (falha) alert('Não deu para salvar: ' + falha)
          }}
        />,
        document.body
      )}

      {aba === 'grade' ? (
        <div className="flg-wrap">
          <table className="flg-tab">
            <thead>
              <tr>
                <th className="flg-fix flg-th-dia">Dia</th>
                {visiveis.map(p => {
                  const s = saldos.get(p.id)
                  return (
                    <th key={p.id} className={`flg-th-pessoa${p.id === minhaPessoaId ? ' flg-eu' : ''}`}>
                      <div className="flg-th-nome">{p.nome}</div>
                      {s && <Placar mes={s.mes} ano={s.ano} nome={p.nome} />}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {listaDias.map(d => {
                const diaIso = iso(ano, mes, d)
                const fds = ehFimDeSemana(ano, mes, d)
                const feriado = feriadosSet.get(diaIso)
                const ehHoje = diaIso === hoje
                return (
                  <tr key={d} className={`flg-linha${fds || feriado ? ' flg-linha-descanso' : ''}${ehHoje ? ' flg-linha-hoje' : ''}${linhaFoco === diaIso ? ' flg-linha-foco' : ''}`}>
                    <td
                      className="flg-fix flg-td-dia"
                      title={`${feriado ? feriado + ' · ' : ''}clique para destacar o dia inteiro`}
                      onClick={() => setLinhaFoco(f => (f === diaIso ? null : diaIso))}
                    >
                      <span className="flg-dia-num">{String(d).padStart(2, '0')}</span>
                      <span className="flg-dia-sem">{SEMANA_CURTA[new Date(ano, mes, d).getDay()]}</span>
                      {feriado && <span className="flg-dia-feriado">●</span>}
                    </td>
                    {visiveis.map(p => {
                      const reg = (diasDe.get(p.id) || new Map()).get(diaIso)
                      const c = reg ? catPorId.get(reg.categoria_id) : null
                      const marcado = selecao?.dias.includes(diaIso) && (!selecao.pessoaId || selecao.pessoaId === p.id)
                      // A célula diz O QUÊ, sempre igual e por extenso. O descritivo
                      // do dia não toma o lugar dela: vira uma marca, e o texto
                      // inteiro aparece ao passar o mouse. Antes o texto livre
                      // substituía a categoria, e a coluna do Sinal Inter virava
                      // um campo de anotação em vez de uma escala.
                      // Exceção: em "Outro" o nome da categoria não diz nada — ali o
                      // descritivo É a informação, e por isso ele aparece na célula.
                      const texto = !reg ? ''
                        : (c?.exige_detalhe && reg.detalhe) ? reg.detalhe
                        : (c?.nome || 'Categoria removida')
                      return (
                        <td
                          key={p.id}
                          className={`flg-cel${marcado || naFaixa(p.id, diaIso) ? ' flg-cel-marcada' : ''}${podeEditar ? ' flg-cel-edita' : ''}${p.id === minhaPessoaId ? ' flg-eu' : ''}`}
                          style={estiloCelula(c)}
                          title={reg ? `${c?.nome || 'Categoria removida'}${reg.campeonato ? ` · ${reg.campeonato}` : ''}${reg.detalhe ? `\n${reg.detalhe}` : ''}` : 'vazio'}
                          onMouseDown={e => aoPressionar(p.id, diaIso, e)}
                          onMouseOver={() => aoEntrar(p.id, diaIso)}
                        >
                          {texto}
                          {reg?.detalhe && !c?.exige_detalhe && <span className="flg-nota" title={reg.detalhe}>·</span>}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flg-wrap">
          <table className="flg-resumo">
            <thead>
              <tr>
                <th>Pessoa</th><th>Time</th>
                <th title="Quantas folgas a pessoa já deveria ter tirado, contando até hoje">De direito</th>
                <th>Usadas</th><th>Ajustes</th>
                <th title="Usadas menos as de direito. Negativo = ainda deve tirar">A tirar no mês</th>
                <th>Deslocamentos</th>
                <th title="Dias do ano sem nada preenchido. Contam como dia trabalhado — não tiram nem põem folga">Em branco</th>
                <th title="O mesmo cálculo, de 1º de janeiro até hoje — a lista vem ordenada por ele">A tirar no ano ↓</th>
                <th title="Folgas já marcadas para depois de hoje">Já marcadas</th>
                <th title="O que ainda não tem data: devidas menos as já marcadas">A agendar</th>
              </tr>
            </thead>
            <tbody>
              {porMaisDevendo.map(p => {
                const s = saldos.get(p.id)
                if (!s) return null
                return (
                  <tr key={p.id} className={p.id === minhaPessoaId ? 'flg-eu' : undefined}>
                    <td className="flg-resumo-nome"><span className="flg-ponto" style={{ background: p.cor }} />{p.nome}</td>
                    <td>{times.find(t => t.id === p.time_id)?.nome || '—'}</td>
                    <td>{s.mes.direito}</td>
                    <td>{s.mes.usadas}</td>
                    <td>{s.mes.ajuste || '—'}</td>
                    <td><ATirar n={s.mes.aTirar} /></td>
                    <td>{s.mes.deslocamentos || '—'}</td>
                    <td style={s.ano.emBranco > 20 && !semRessalva(p.nome) ? { color: 'var(--amber)', fontWeight: 700 } : { color: 'var(--text-dim)' }}>{s.ano.emBranco || '—'}</td>
                    <td><ATirar n={s.ano.aTirar} /></td>
                    <td>{s.ano.marcadas || '—'}</td>
                    <td><ATirar n={s.ano.aTirar + (s.ano.marcadas || 0)} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="flg-legenda">
            Cada sábado, domingo e feriado gera uma folga de direito. Feriado que cai em
            fim de semana não conta duas vezes. As folgas de direito contam só até hoje —
            um mês que ainda não chegou não gera dívida.
          </div>
        </div>
      )}
    </div>
  )
}
