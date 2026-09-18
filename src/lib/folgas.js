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

// Um dia gera folga de direito quando é fim de semana OU feriado — nunca os
// dois, ver a decisão 2 no topo.
export const geraFolga = (ano, mes, dia, feriados) =>
  ehFimDeSemana(ano, mes, dia) || feriados.has(iso(ano, mes, dia))

// ── Saldo de um período ──────────────────────────────────────────────────────
// `dias` é um Map de 'aaaa-mm-dd' -> { categoria_id, ... } da pessoa.
// `ate` limita a contagem do DIREITO (o que ela já deveria ter tirado); as
// folgas usadas contam o período inteiro, porque uma folga tirada adiantado
// já foi tirada.
function contar(dias, feriados, ehFolga, deIso, ateIso, limiteDireito) {
  let direito = 0, usadas = 0, deslocamentos = 0, ausentes = 0
  const [a0, m0, d0] = deIso.split('-').map(Number)
  const inicio = new Date(a0, m0 - 1, d0)
  const [a1, m1, d1] = ateIso.split('-').map(Number)
  const fim = new Date(a1, m1 - 1, d1)
  for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
    const chave = iso(d.getFullYear(), d.getMonth(), d.getDate())
    if (chave <= limiteDireito && geraFolga(d.getFullYear(), d.getMonth(), d.getDate(), feriados)) direito++
    const reg = dias.get(chave)
    if (!reg) continue
    if (ehFolga(reg.categoria_id)) usadas++
    if (reg.eh_deslocamento) deslocamentos++
    if (reg.ausente) ausentes++
  }
  return { direito, usadas, deslocamentos, ausentes }
}

// Saldo do MÊS. `hoje` entra como parâmetro para o cálculo ser testável.
export function saldoDoMes({ dias, feriados, ehFolga, ajustes = [], ano, mes, hoje = hojeIso() }) {
  const ultimo = diasNoMes(ano, mes)
  const primeiroIso = iso(ano, mes, 1)
  const ultimoIso = iso(ano, mes, ultimo)
  // O direito para no dia de hoje: mês futuro ainda não gera nada.
  const limite = hoje < primeiroIso ? '0000-00-00' : (hoje < ultimoIso ? hoje : ultimoIso)
  const c = contar(dias, feriados, ehFolga, primeiroIso, ultimoIso, limite)
  const ajuste = ajustes.filter(a => a.vale_de <= ultimoIso).reduce((s, a) => s + (a.delta || 0), 0)
  return { ...c, ajuste, aTirar: c.usadas - c.direito - ajuste, futuro: hoje < primeiroIso }
}

// Saldo ACUMULADO do ano, do 1º de janeiro até hoje.
export function saldoDoAno({ dias, feriados, ehFolga, ajustes = [], ano, hoje = hojeIso() }) {
  const primeiroIso = iso(ano, 0, 1)
  const ultimoIso = iso(ano, 11, 31)
  const limite = hoje < primeiroIso ? '0000-00-00' : (hoje < ultimoIso ? hoje : ultimoIso)
  const c = contar(dias, feriados, ehFolga, primeiroIso, ultimoIso, limite)
  const ajuste = ajustes.filter(a => a.vale_de <= limite).reduce((s, a) => s + (a.delta || 0), 0)
  return { ...c, ajuste, aTirar: c.usadas - c.direito - ajuste }
}
