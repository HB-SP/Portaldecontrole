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
import { useJogosDoTime } from '../hooks/useJogosDoTime'
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

// ── A FAIXA DO ANO ──────────────────────────────────────────────────────────
// Só AUSÊNCIA LONGA pinta a faixa. A folga do dia a dia ficou de fora de
// propósito: como todo mundo folga toda semana, ela pintava o ano inteiro de
// vermelho e escondia justamente o que se quer enxergar — quem está de férias
// quando (equipe, 21/09/2026). Do futuro entram só as folgas JÁ MARCADAS, que
// são as que ainda dá para remanejar.
const BLOCO_ANO = new Set(['ferias', 'atestado'])
const ddmm = chave => `${chave.slice(8)}/${chave.slice(5, 7)}`

// Dias seguidos da mesma categoria viram UM retângulo: 20 dias de férias são um
// bloco com a data escrita dentro, e não 20 risquinhos de 2px que ninguém lê.
function blocosDoAno(meus, diasDoAno) {
  const fora = []
  let atual = null
  diasDoAno.forEach((d, i) => {
    const cat = meus.get(d.chave)?.categoria_id
    const vale = BLOCO_ANO.has(cat) ? cat : null
    if (atual && (!vale || atual.cat !== vale)) { fora.push(atual); atual = null }
    if (!vale) return
    if (atual) { atual.fim = i; atual.ate = d.chave; atual.dias++ }
    else atual = { cat: vale, ini: i, fim: i, de: d.chave, ate: d.chave, dias: 1 }
  })
  if (atual) fora.push(atual)
  return fora
}

// O jogo escrito curto, para caber na coluna: "Mirassol × Botafogo" vira
// "MIR × BOT". Quando não é uma partida de dois lados — um plantão sobre
// vários jogos, um Media Day — vai o texto como está, e a coluna corta o que
// passar; o nome inteiro está no title.
const sigla = t => String(t || '').trim().split(/\s+/)[0].slice(0, 3).toUpperCase()

// O campeonato em sigla, do jeito que a casa JÁ escreve nos rótulos dos
// periféricos: "Brasileirão 26" vira BR26, "Paulistão Fem. 26" vira PF26.
// Sem isso a célula dizia só "MIR × BOT" e não dava para saber de que
// campeonato era o jogo (equipe, 21/09/2026).
// A ORDEM IMPORTA: a primeira que casar manda. "Paulistão A1 26" contém
// "paulist", então A1 tem de vir antes; "Host Broadcast" começa com "Br", então
// o Brasileirão exige um número depois do BR para não roubar o nome dele.
// Nada de \w no meio das palavras: \w não casa o "ã" de Paulistão.
const SIGLAS = [
  [/^mm\b/i, 'MM'],
  [/a1/i, 'A1'],
  [/copinha/i, 'COP'],
  [/s[ée]rie\s*b/i, 'SB'],
  [/fem|\bp?f\s*\d/i, 'PF'],
  [/brasileir|\bbr\s*\d/i, 'BR'],
  [/paulist/i, 'PAU'],
  [/media\s*day/i, 'MD'],
  [/host\s*broadcast/i, 'HB'],
]
function siglaCamp(label) {
  // "Periférico BR26" é o mesmo campeonato do "Brasileirão 26": a palavra
  // Periférico diz onde o dado mora, não que jogo é.
  const t = String(label || '').replace(/perif[ée]rico/i, '').trim()
  if (!t) return ''
  const ano = (t.match(/(\d{2})\s*$/) || [])[1] || ''
  const achou = SIGLAS.find(([re]) => re.test(t))
  // A1 já termina em número: sem o espaço sairia "A126", que ninguém lê.
  if (achou) return achou[1] + (/\d$/.test(achou[1]) ? ' ' : '') + ano
  // Campeonato que ainda não tem regra: as iniciais das palavras.
  const ini = t.replace(/\d+/g, ' ').trim().split(/\s+/)
    .map(x => x[0] || '').join('').toUpperCase().slice(0, 3)
  return ini + ano
}
function jogoCurto(confronto) {
  const lados = String(confronto || '').split(' × ')
  const partida = lados.length === 2 && lados.every(x => x.trim() && !/\sx\s/i.test(x))
  return partida ? `${sigla(lados[0])} × ${sigla(lados[1])}` : confronto
}

// A COR DE CADA DIA. A lógica é uma só: o dia normal quase não tem cor, o que
// foge do padrão tem cor suave, e a ausência tem peso. VERMELHO não aparece
// aqui — ficou reservado para problema de verdade, que é o jogo caindo num dia
// em que a pessoa não vai estar.
//
// Antes disto, folga era vermelha: uma semana comum deixava a grade piscando
// como se algo estivesse errado, quando era só gente tirando o que tem direito.
function estiloCelula(cat) {
  if (!cat) return undefined
  return { color: cat.cor, fontWeight: AUSENCIA.has(cat.id) ? 700 : 500 }
}

// ── Menu de um dia ───────────────────────────────────────────────────────────
// Clicou na célula, escolheu, acabou. Preencher um dia tinha virado um
// formulário — escolher a categoria, preencher, apertar Salvar — e são 31 dias
// vezes 17 pessoas. Agora a escolha JÁ GRAVA.
//
// O descritivo continua ali, mas num segundo passo, para quem quer: ele é a
// exceção, não o caminho principal.
// Categorias em que faz sentido dizer PARA QUE JOGO foi o dia. Tem gente do
// time que vai ao jogo sem ter função na escala dele — não é produtor nem
// cinegrafista, então não aparece em lugar nenhum da escala do jogo. Antes
// disso ela escrevia o confronto à mão, cada um de um jeito, e nada virava
// link. Externa, Monitoração e Casablanca, escolhidas pela equipe (21/09/2026).
const PEDE_JOGO = new Set(['externa', 'monitoracao', 'casablanca'])

// Os campos que apagam o jogo apontado. Escrever à mão depois de ter escolhido
// um jogo tem de LIMPAR a escolha, senão a célula continua mostrando o jogo
// antigo e ninguém entende por quê.
//
// Só são enviados quando o dia REALMENTE tinha um jogo: mandar a chave para
// uma coluna que o banco ainda não tem faz o PostgREST recusar a gravação
// inteira, e a grade pararia de salvar por causa de um campo que ninguém usou.
const SEM_JOGO = {
  jogo_comp_id: null, jogo_id: null, jogo_camp: null,
  jogo_data: null, jogo_mandante: null, jogo_visitante: null,
}

function MenuDia({ atual, categorias, onSalvar, onFechar, ancora, quantos = 1, jogos = [] }) {
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
  const limpaJogo = (atual?.jogo_mandante || atual?.jogo_comp_id) ? SEM_JOGO : {}

  // "Outro" não diz nada sem o texto, então ele é o único que não grava direto.
  const escolher = c => {
    if (c.exige_detalhe) { setCat(c.id); setDetalhe(atual?.categoria_id === c.id ? (atual.detalhe || '') : ''); setModo('texto'); return }
    onSalvar({ categoria_id: c.id, detalhe: atual?.categoria_id === c.id ? (atual.detalhe || null) : null, campeonato: null, ...limpaJogo })
  }

  if (modo === 'texto') {
    const falta = def?.exige_detalhe && !detalhe.trim()
    return (
      <div className="flg-menu" ref={ref} style={ancora} onMouseDown={e => e.stopPropagation()}>
        <div className="flg-menu-topo">
          <button className="flg-menu-voltar" onClick={() => setModo('lista')}>‹</button>
          <span>{def?.nome || 'Descritivo'}</span>
        </div>
        {/* Os jogos daquele dia. Um clique grava: não há o que digitar, e o
            confronto sai escrito igual em todo mundo. Só para um dia de cada
            vez — numa faixa de dias, um jogo só não serve para todos. */}
        {PEDE_JOGO.has(cat) && quantos === 1 && jogos.length > 0 && (
          <div className="flg-menu-jogos">
            <div className="flg-menu-rot">Jogos deste dia</div>
            {jogos.map((j, i) => {
              const posto = atual?.jogo_mandante === j.jogo.mandante && atual?.jogo_data === j.jogo.data
              return (
                <button
                  key={i}
                  className={`flg-menu-jogo${posto ? ' is-on' : ''}`}
                  onClick={() => onSalvar({
                    categoria_id: cat, detalhe: null, campeonato: j.compLabel,
                    jogo_comp_id: j.compId, jogo_id: j.jogo.id ? String(j.jogo.id) : null,
                    jogo_camp: j.compLabel, jogo_data: j.jogo.data,
                    jogo_mandante: j.jogo.mandante, jogo_visitante: j.jogo.visitante,
                  })}
                >
                  <span className="flg-menu-cor" style={{ background: j.cor }} />
                  <b className="flg-menu-jogo-camp">{siglaCamp(j.compLabel)}</b>
                  <span className="flg-menu-jogo-nome">{j.confronto}</span>
                  {j.hora && <span className="flg-menu-jogo-hora">{j.hora}</span>}
                </button>
              )
            })}
            <div className="flg-menu-rot">ou escrever à mão</div>
          </div>
        )}
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
            if (e.key === 'Enter' && !falta) onSalvar({ categoria_id: cat, detalhe: detalhe.trim() || null, campeonato: camp || null, ...limpaJogo })
          }}
        />
        <button
          className="flg-menu-ok" disabled={falta}
          onClick={() => onSalvar({ categoria_id: cat, detalhe: detalhe.trim() || null, campeonato: camp || null, ...limpaJogo })}
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

// A cor do saldo: vermelho quando ainda falta agendar, verde quando a pessoa
// tirou mais do que devia, cinza quando está em dia.
// Ter folga a agendar NÃO é problema: é direito acumulado, e sair em vermelho
// fazia a pessoa com mais folga a tirar parecer a mais em falta. Âmbar diz
// "tem coisa a resolver" sem dizer "alguém errou"; verde segue para quem está
// adiantado, e o vermelho saiu daqui de vez.
const corDoSaldo = n => (n < 0 ? 'var(--amber)' : n > 0 ? 'var(--lm-green-dim)' : 'var(--text-dim)')

// A ressalva de "coluna com muito dia em branco" saiu junto com a tabela do
// Resumo, e não faz falta: a visão do ano MOSTRA os buracos — a linha da pessoa
// fica vazada no trecho não preenchido. Um aviso em texto dizia o que agora se
// vê, e a exceção que o Gui Soria precisava deixou de ser necessária com ele.

// ── O placar de cada pessoa ──────────────────────────────────────────────────
// O número grande responde a pergunta do dia a dia: QUANTAS FOLGAS AINDA
// PRECISO AGENDAR para essa pessoa. Ele desconta as que já estão marcadas no
// calendário, mesmo que sejam de um mês à frente — sem isso, marcar uma folga
// não mexia em nada e a tela não servia para planejar (equipe, 18/09/2026).
//
// Só desconta as folgas marcadas em DIA ÚTIL. Folga marcada num sábado, num
// domingo ou num feriado não gasta nada: ela anula o dia, e o dia também não ia
// gerar folga (equipe, 21/09/2026). As duas pontas reconstroem o saldo bruto,
// que é o número que a planilha antiga guardava:
//
//     a agendar  +  já marcadas em dia útil  =  saldo devido hoje
//
function Placar({ mes, ano }) {
  const devidas = -ano.aTirar                          // o saldo de hoje, como a planilha conta
  const aAgendar = devidas - (ano.marcadasGastam || 0) // o que ainda não tem data

  const palavra = aAgendar > 0 ? `${aAgendar} a agendar`
    : aAgendar < 0 ? `${-aAgendar} adiantada${aAgendar < -1 ? 's' : ''}`
    : 'em dia'

  const explicacao = ano.desde === null
    ? 'Sem nenhum dia preenchido neste ano'
    : `Deve ${devidas} folga${devidas === 1 ? '' : 's'} até hoje` +
      (ano.marcadasGastam ? `, e ${ano.marcadasGastam} já ${ano.marcadasGastam === 1 ? 'está marcada' : 'estão marcadas'} no calendário` : '') +
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

export default function FolgasView({ podeEditar = false, competitions = [], onAbrirJogo }) {
  const hoje = hojeIso()
  const [ano, setAno] = useState(() => Number(hoje.slice(0, 4)))
  const [mes, setMes] = useState(() => new Date().getMonth())
  const { times, pessoas, categorias, feriados, ajustes, dias, minhaPessoaId, loading, erro, salvarDia, salvarVarios, desfazer, podeDesfazer } = useFolgas(ano)

  // Os jogos em que o time está escalado. Vêm de outra escala, preenchida por
  // outra gente: aqui são só LIDOS.
  const { jogosPorDia, jogosDoDia } = useJogosDoTime(pessoas, competitions, ano)

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
  // Para abrir a grade já no dia de hoje: com 31 linhas, entrar no dia 1 e ter
  // de procurar é trabalho que a tela pode poupar.
  const wrapRef = useRef(null)
  const hojeRef = useRef(null)

  const feriadosSet = useMemo(() => new Map(feriados.map(f => [f.dia, f.nome])), [feriados])
  const feriadosChaves = useMemo(() => new Set(feriados.map(f => f.dia)), [feriados])
  const catPorId = useMemo(() => new Map(categorias.map(c => [c.id, c])), [categorias])
  // As arquivadas seguem sendo LIDAS (para a grade mostrar o nome certo em quem
  // já está marcado com elas), mas saem da lista de escolher.
  const oferecidas = useMemo(() => categorias.filter(c => !c.arquivada), [categorias])
  const ehFolga = id => !!catPorId.get(id)?.conta_folga

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
        mes: saldoDoMes({ dias: meus, feriados: feriadosChaves, ehFolga, ajustes: meusAjustes, ano, mes, hoje }),
        ano: saldoDoAno({ dias: meus, feriados: feriadosChaves, ehFolga, ajustes: meusAjustes, ano, hoje }),
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

  // Os dias do ano inteiro, em ordem — a régua da visão do ano.
  const diasDoAno = useMemo(() => {
    const fora = []
    for (let m = 0; m < 12; m++) {
      for (let d = 1; d <= diasNoMes(ano, m); d++) fora.push({ chave: iso(ano, m, d), mes: m, dia: d })
    }
    return fora
  }, [ano])

  // Onde o dia de hoje cai na faixa, em % do ano: é a linha que separa o que já
  // aconteceu do que ainda vem. Fora do ano que está na tela, não existe.
  const hojePct = useMemo(() => {
    const i = diasDoAno.findIndex(d => d.chave === hoje)
    return i < 0 ? null : ((i + 0.5) / diasDoAno.length) * 100
  }, [diasDoAno, hoje])

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

  // Abre a grade no dia de hoje, quando o mês na tela é o mês corrente.
  useEffect(() => {
    if (loading || aba !== 'grade') return
    const wrap = wrapRef.current, linha = hojeRef.current
    if (!wrap || !linha) return
    // Um terço da altura, e não o topo: dá para ver alguns dias de trás.
    wrap.scrollTop = Math.max(0, linha.offsetTop - wrap.clientHeight / 3)
  }, [loading, aba, ano, mes])

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
          <button className={`flg-aba${aba === 'resumo' ? ' is-on' : ''}`} onClick={() => setAba('resumo')}>Ano</button>
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
          jogos={jogosDoDia.get(editando.dia) || []}
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
        <div className="flg-wrap" ref={wrapRef}>
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
                  <tr key={d} ref={ehHoje ? hojeRef : null}
                    className={`flg-linha${fds || feriado ? ' flg-linha-descanso' : ''}${ehHoje ? ' flg-linha-hoje' : ''}${linhaFoco === diaIso ? ' flg-linha-foco' : ''}`}>
                    <td
                      className="flg-fix flg-td-dia"
                      title={`${feriado ? feriado + ' · ' : ''}clique para destacar o dia inteiro`}
                      onClick={() => setLinhaFoco(f => (f === diaIso ? null : diaIso))}
                    >
                      <span className="flg-dia-num">{String(d).padStart(2, '0')}</span>
                      <span className="flg-dia-sem">{SEMANA_CURTA[new Date(ano, mes, d).getDay()]}</span>
                      {feriado && <span className="flg-dia-feriado">●</span>}
                      {ehHoje && <span className="flg-dia-hoje">hoje</span>}
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
                      // A sigla, não o nome: "VO" no lugar de "Vila Olímpia".
                      // A célula divide espaço com o jogo, e o nome inteiro
                      // continua no passar do mouse e na legenda.
                      const texto = !reg ? ''
                        : (c?.exige_detalhe && reg.detalhe) ? reg.detalhe
                        : (c?.curto || c?.nome || 'Categoria removida')
                      // A ordem de trabalho é: escala o jogo, depois preenche
                      // folga/home. Então dia com jogo JÁ ESTÁ DITO — a célula
                      // mostra o jogo em vez de ficar vazia pedindo o que já se
                      // sabe. Marcar por cima continua possível: quem escolhe
                      // uma categoria manda, e o jogo volta a ser só a marca.
                      const jogos = jogosPorDia.get(`${p.id}|${diaIso}`) || []
                      // Jogo APONTADO à mão: quem foi ao jogo sem ter função na
                      // escala dele escolheu a partida no menu. Na célula não há
                      // diferença nenhuma entre isso e o jogo lido da escala —
                      // quem olha a grade não precisa saber por qual porta a
                      // pessoa entrou.
                      const posto = reg?.jogo_mandante ? {
                        compId: reg.jogo_comp_id,
                        compLabel: reg.jogo_camp,
                        confronto: [reg.jogo_mandante, reg.jogo_visitante].filter(Boolean).join(' × '),
                        jogo: { data: reg.jogo_data, mandante: reg.jogo_mandante, visitante: reg.jogo_visitante, id: reg.jogo_id },
                      } : null
                      // DIA DE TRABALHO COM JOGO: o jogo é o que diz mais.
                      // "Externa" sozinho não conta onde a pessoa esteve; "BR26
                      // - MIR × BOT" conta (equipe, 21/09/2026). Vale para o
                      // jogo apontado à mão e para o lido da escala.
                      //
                      // AUSÊNCIA é o contrário: se o dia é folga, férias ou
                      // atestado, quem manda é a ausência, e o jogo vira a marca
                      // ao lado — que ali serve de aviso, porque alguém está
                      // escalado num dia em que não vai estar.
                      const ehTrabalho = !!c && !AUSENCIA.has(c.id)
                      const noTexto = posto ? [posto] : (!reg || ehTrabalho) ? jogos : []
                      const soMarca = noTexto.length ? [] : jogos
                      return (
                        <td
                          key={p.id}
                          className={`flg-cel${marcado || naFaixa(p.id, diaIso) ? ' flg-cel-marcada' : ''}${podeEditar ? ' flg-cel-edita' : ''}${p.id === minhaPessoaId ? ' flg-eu' : ''}`}
                          style={estiloCelula(c)}
                          title={reg ? `${c?.nome || 'Categoria removida'}${reg.campeonato ? ` · ${reg.campeonato}` : ''}${reg.detalhe ? `\n${reg.detalhe}` : ''}` : 'vazio'}
                          onMouseDown={e => aoPressionar(p.id, diaIso, e)}
                          onMouseOver={() => aoEntrar(p.id, diaIso)}
                        >
                          {!noTexto.length && texto}
                          {noTexto.map((j, i) => (
                            <button
                              key={i}
                              className={`flg-dejogo${j.compId ? '' : ' flg-dejogo-sem'}`}
                              style={{ color: c?.cor || j.cor }}
                              title={`${c?.nome ? c.nome + ' · ' : ''}${j.compLabel || ''} · ${j.confronto}${j.funcao ? '\n' + j.funcao : ''}${j.compId ? ' — clique para abrir o jogo' : ' — este jogo não tem ficha no Portal'}`}
                              onMouseDown={e => e.stopPropagation()}
                              onClick={e => { e.stopPropagation(); if (j.compId) onAbrirJogo?.(j.compId, j.jogo) }}
                            ><span className="flg-dejogo-camp">{siglaCamp(j.compLabel)}</span>
                              {' - '}{jogoCurto(j.confronto)}</button>
                          ))}
                          {reg?.detalhe && !c?.exige_detalhe && <span className="flg-nota" title={reg.detalhe}>·</span>}

                          {soMarca.map((j, i) => {
                            // ESTE é o conflito, e o único lugar da grade onde o
                            // vermelho aparece: a pessoa está escalada num jogo
                            // num dia em que ela não vai estar — folga, férias
                            // ou atestado. Fora daqui, vermelho não significa
                            // nada nesta tela.
                            const bate = reg && AUSENCIA.has(c?.id)
                            const cor = bate ? 'var(--red)' : j.cor
                            return (
                              <button
                                key={i} className={`flg-jogo${j.compId ? '' : ' flg-jogo-sem'}${bate ? ' flg-jogo-conflito' : ''}`}
                                title={`${bate ? `CONFLITO: escalado em ${c?.nome?.toLowerCase()}\n` : ''}${j.compLabel} · ${j.confronto}\n${j.funcao}${j.compId ? ' — clique para abrir o jogo' : ' — este jogo não tem ficha no Portal'}`}
                                onMouseDown={e => e.stopPropagation()}
                                onClick={e => { e.stopPropagation(); if (j.compId) onAbrirJogo?.(j.compId, j.jogo) }}
                                style={j.compId || bate ? { background: cor } : { borderColor: cor }}
                              />
                            )
                          })}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* A sigla precisa de onde ser lida. Nasce das próprias categorias,
              então uma categoria nova aparece aqui sozinha — e na mesma cor que
              a grade usa, que é o que faz a legenda servir para alguma coisa. */}
          <div className="flg-chaves">
            {oferecidas.map(c => (
              <span key={c.id} className="flg-chave" title={c.nome}>
                <b style={{ color: c.cor, fontWeight: AUSENCIA.has(c.id) ? 700 : 500 }}>{c.curto || c.nome}</b>
                {c.nome}
              </span>
            ))}
            <span className="flg-chave">
              <b className="flg-chave-conflito" />conflito: escalado num dia de ausência
            </span>
          </div>
        </div>
      ) : (
        <div className="flg-wrap flg-ano-wrap">
          <div className="flg-ano-cab">
            <span className="flg-ano-nome" />
            <span className="flg-ano-num" title="Folgas devidas que ainda não têm data marcada">a agendar</span>
            <span className="flg-ano-num" title="Dias de férias no ano">férias</span>
            <div className="flg-ano-barra">
              <div className="flg-ano-meses">
                {MESES.map((m, i) => (
                  <span key={i} className="flg-ano-mes" style={{ flexGrow: diasNoMes(ano, i) }}>{m.slice(0, 3)}</span>
                ))}
              </div>
              {hojePct !== null && <span className="flg-ano-hoje-rot" style={{ left: `${hojePct}%` }}>hoje</span>}
            </div>
          </div>

          {porMaisDevendo.map(p => {
            const sal = saldos.get(p.id)
            if (!sal) return null
            const meus = diasDe.get(p.id) || new Map()
            const aAgendar = -sal.ano.aTirar - (sal.ano.marcadasGastam || 0)
            const blocos = blocosDoAno(meus, diasDoAno)
            const ferias = blocos.filter(b => b.cat === 'ferias').reduce((s, b) => s + b.dias, 0)
            const folgasVindo = diasDoAno.flatMap((d, i) =>
              d.chave > hoje && ehFolga(meus.get(d.chave)?.categoria_id) ? [{ ...d, i }] : [])
            return (
              <div key={p.id} className={`flg-ano-linha${p.id === minhaPessoaId ? ' flg-eu' : ''}`}>
                <span className="flg-ano-nome" title={times.find(t => t.id === p.time_id)?.nome || ''}>
                  <span className="flg-ponto" style={{ background: p.cor }} />{p.nome}
                </span>
                <span className="flg-ano-num" style={{ color: corDoSaldo(-aAgendar), fontWeight: 800 }}>
                  {aAgendar > 0 ? aAgendar : aAgendar < 0 ? `+${-aAgendar}` : '—'}
                </span>
                <span className="flg-ano-num">{ferias || '—'}</span>

                <div className="flg-ano-barra">
                  <div className="flg-ano-meses">
                    {MESES.map((m, i) => (
                      <span key={i} className="flg-ano-mes" style={{ flexGrow: diasNoMes(ano, i) }} />
                    ))}
                  </div>

                  {/* Folga que ainda vem: um fio fino, só para dizer que já tem data. */}
                  {folgasVindo.map(d => (
                    <i
                      key={d.chave}
                      className="flg-ano-folga"
                      style={{ left: `${(d.i / diasDoAno.length) * 100}%` }}
                      title={`Folga marcada em ${ddmm(d.chave)}`}
                    />
                  ))}

                  {blocos.map(b => {
                    const cat = catPorId.get(b.cat)
                    const larg = (b.dias / diasDoAno.length) * 100
                    return (
                      <span
                        key={b.de}
                        className="flg-ano-bloco"
                        style={{
                          left: `${(b.ini / diasDoAno.length) * 100}%`,
                          width: `${larg}%`,
                          background: cat?.cor || 'var(--text-muted)',
                          opacity: b.ate < hoje ? 0.55 : 1,
                        }}
                        title={`${cat?.nome || b.cat} · ${ddmm(b.de)} a ${ddmm(b.ate)} · ${b.dias} dia${b.dias === 1 ? '' : 's'}`}
                      >{larg >= 3.4 ? ddmm(b.de) : ''}</span>
                    )
                  })}

                  {hojePct !== null && <span className="flg-ano-hoje" style={{ left: `${hojePct}%` }} />}
                </div>
              </div>
            )
          })}

          <div className="flg-legenda">
            A faixa mostra só quem fica fora vários dias seguidos:{' '}
            <b style={{ color: '#7C3AED' }}>férias</b> e <b style={{ color: '#B45309' }}>atestado</b>, cada
            período num bloco, com a data de início escrita dentro quando cabe. Os fios{' '}
            <b style={{ color: 'var(--red)' }}>vermelhos</b> são folgas já marcadas daqui pra frente. A linha
            escura é hoje, e o que está à esquerda dela já aconteceu. A ordem vai de quem tem mais folga a
            agendar para quem tem menos.
          </div>
        </div>
      )}
    </div>
  )
}
