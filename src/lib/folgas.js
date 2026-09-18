// ─── A CONTA DE FOLGAS ───────────────────────────────────────────────────────
// A regra que dá sentido à tela: o time trabalha fim de semana, então cada
// sábado, cada domingo e cada feriado GERA uma folga de direito. O número que
// interessa é quanto a pessoa ainda deve tirar.
//
//   a tirar = folgas usadas − folgas de direito − ajustes
//
// Negativo (vermelho) = ainda tem folga a tirar. Positivo (verde) = já tirou a
// mais do que precisava.
//
// Duas decisões que valem estar escritas:
//
// 1. O direito conta SÓ ATÉ HOJE. Um mês que ainda nem começou não gera folga
//    devida, senão todo mundo apareceria devendo o ano inteiro em janeiro.
//
// 2. Feriado que cai em fim de semana NÃO conta duas vezes. O dia já era de
//    descanso; somar de novo daria à pessoa uma folga que ela não ganhou.
//
// 3. Dia de ATESTADO não gera folga de direito. Quem está afastado não
//    trabalhou aquele fim de semana, então não há o que compensar — e não
//    estando de folga, também não consome as pendentes. A pessoa afastada fica
//    com o saldo parado, que é o comportamento que a equipe descreveu.

export const SEMANA_CURTA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const pad = n => String(n).padStart(2, '0')
export const iso = (ano, mes, dia) => `${ano}-${pad(mes + 1)}-${pad(dia)}`
export const diasNoMes = (ano, mes) => new Date(ano, mes + 1, 0).getDate()
export const hojeIso = () => { const d = new Date(); return iso(d.getFullYear(), d.getMonth(), d.getDate()) }

// Sábado ou domingo?
export const ehFimDeSemana = (ano, mes, dia) => {
  const d = new Date(ano, mes, dia).getDay()
  return d === 0 || d === 6
}

// Categorias que SUSPENDEM o direito. Quem está afastado não trabalhou aquele
// fim de semana, então não ganha a folga — e, não estando de folga, também não
// consome as pendentes. O saldo fica parado.
//
// Férias entra aqui junto com atestado, por decisão da equipe (18/09/2026):
// "ferias é quase igual o atestado. ela não te da direito de folga nos finais
// de semana e não conta tudo como folga tbm".
//
// Mora aqui, e não em cada tela, porque é REGRA: estava copiada na tela e em
// dois scripts, e com duas categorias isso divergiria na primeira mudança.
export const SUSPENDE_DIREITO = new Set(['atestado', 'ferias'])
export const suspendeDireito = id => SUSPENDE_DIREITO.has(id)

// Um dia gera folga de direito quando é fim de semana OU feriado — nunca os
// dois, ver a decisão 2 no topo.
export const geraFolga = (ano, mes, dia, feriados) =>
  ehFimDeSemana(ano, mes, dia) || feriados.has(iso(ano, mes, dia))

// ── Saldo de um período ──────────────────────────────────────────────────────
// `dias` é um Map de 'aaaa-mm-dd' -> { categoria_id, ... } da pessoa.
//
// O CORTE VALE PARA OS DOIS LADOS. Direito e folgas usadas param no mesmo dia,
// e isso não é detalhe: contar uma folga já marcada para o mês que vem, sem
// contar os fins de semana que ainda vão gerar direito, faz o saldo aparecer
// MENOR do que é — foi assim que a tela mostrou menos folga do que as planilhas
// (109 folgas do futuro entrando como já tiradas, 18/09/2026).
//
// `deslocamentos` fica de fora do corte de propósito: é informação do período
// ("quantas viagens tem este mês"), não parte do saldo.
// Primeiro dia que a pessoa aparece na grade. Ninguém acumula folga antes de
// entrar no time: sem isso, quem chegou em setembro nasce devendo o ano inteiro.
function primeiroRegistro(dias) {
  let menor = null
  for (const chave of dias.keys()) if (menor === null || chave < menor) menor = chave
  return menor
}

function contar(dias, feriados, ehFolga, suspende, deIso, ateIso, corte) {
  let direito = 0, usadas = 0, deslocamentos = 0, emBranco = 0, suspensos = 0, marcadas = 0
  const desde = primeiroRegistro(dias)
  const [a0, m0, d0] = deIso.split('-').map(Number)
  const inicio = new Date(a0, m0 - 1, d0)
  const [a1, m1, d1] = ateIso.split('-').map(Number)
  const fim = new Date(a1, m1 - 1, d1)
  for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
    const chave = iso(d.getFullYear(), d.getMonth(), d.getDate())
    const reg = dias.get(chave)
    if (reg?.eh_deslocamento) deslocamentos++
    // Folga JÁ MARCADA para depois de hoje. Não entra no saldo — o direito dos
    // fins de semana que ainda vêm também não entrou — mas é contada à parte:
    // é ela que diz quanto do saldo já tem data marcada.
    if (chave > corte) {
      if (reg && ehFolga(reg.categoria_id)) marcadas++
      continue
    }
    if (desde === null || chave < desde) continue

    // DIA QUE SUSPENDE O DIREITO. Quem está de atestado não trabalhou o fim de
    // semana, então não ganhou a folga correspondente. Sem isso a pessoa
    // afastada acumula folga parada — foi o que fez o saldo do Yuji dar 33 na
    // tela contra 6 na planilha (equipe, 18/09/2026).
    if (reg && suspende(reg.categoria_id)) { suspensos++; continue }

    if (geraFolga(d.getFullYear(), d.getMonth(), d.getDate(), feriados)) direito++
    if (reg && ehFolga(reg.categoria_id)) usadas++
    // DIA EM BRANCO É DIA TRABALHADO (equipe, 18/09/2026). Ele já entra certo
    // na conta sem precisar de nada: gera folga de direito, como todo dia, e não
    // consome nenhuma. A contagem aqui é só informação — quanto da grade está
    // preenchido — e não entra no saldo.
    if (!reg) emBranco++
  }
  return { direito, usadas, deslocamentos, emBranco, suspensos, marcadas, desde }
}

// Saldo do MÊS. `hoje` entra como parâmetro para o cálculo ser testável.
export function saldoDoMes({ dias, feriados, ehFolga, suspende = suspendeDireito, ajustes = [], ano, mes, hoje = hojeIso() }) {
  const ultimo = diasNoMes(ano, mes)
  const primeiroIso = iso(ano, mes, 1)
  const ultimoIso = iso(ano, mes, ultimo)
  // O direito para no dia de hoje: mês futuro ainda não gera nada.
  const limite = hoje < primeiroIso ? '0000-00-00' : (hoje < ultimoIso ? hoje : ultimoIso)
  const c = contar(dias, feriados, ehFolga, suspende, primeiroIso, ultimoIso, limite)
  const ajuste = ajustes.filter(a => a.vale_de <= ultimoIso).reduce((s, a) => s + (a.delta || 0), 0)
  return { ...c, ajuste, aTirar: c.usadas - c.direito - ajuste, futuro: hoje < primeiroIso }
}

// Saldo ACUMULADO do ano, do 1º de janeiro até hoje.
export function saldoDoAno({ dias, feriados, ehFolga, suspende = suspendeDireito, ajustes = [], ano, hoje = hojeIso() }) {
  const primeiroIso = iso(ano, 0, 1)
  const ultimoIso = iso(ano, 11, 31)
  const limite = hoje < primeiroIso ? '0000-00-00' : (hoje < ultimoIso ? hoje : ultimoIso)
  const c = contar(dias, feriados, ehFolga, suspende, primeiroIso, ultimoIso, limite)
  const ajuste = ajustes.filter(a => a.vale_de <= limite).reduce((s, a) => s + (a.delta || 0), 0)
  return { ...c, ajuste, aTirar: c.usadas - c.direito - ajuste }
}
