// Por que o "de direito" da planilha muda de pessoa para pessoa no MESMO mês?
// Testa três hipóteses contra o gabarito da própria planilha:
//   A) só fim de semana conta (feriado não gera folga)
//   B) fim de semana + feriado (o que eu implementei)
//   C) fim de semana + feriado, MENOS os dias em que a pessoa estava de férias
//      ou atestado (quem está de férias não acumula folga)
import { readFileSync } from 'node:fs'

const BASE = 'https://buubjnddzsadzcumrvdt.supabase.co'
const KEY = (readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .find(l => /^SUPABASE_SERVICE_KEY=/.test(l)) || '').split('=').slice(1).join('=').trim()
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }
const api = async c => {
  const r = await fetch(`${BASE}/rest/v1/${c}`, { headers: H })
  if (!r.ok) throw new Error(`${r.status} ${c}`)
  return r.json()
}
const pad = n => String(n).padStart(2, '0')
const iso = (a, m, d) => `${a}-${pad(m)}-${pad(d)}`

// ── gabarito: só os fechamentos no formato completo (dois números por pessoa) ─
const CSV = 'C:/Users/ajanguas/Downloads/Planejamento HB LiveMode - Time Sinal Inter.csv'
const linhas = readFileSync(CSV, 'utf8').split(/\r?\n/).map(l => l.split(','))
const NOMES = [2, 4, 6, 8, 10, 12, 14].map(i => (linhas[0][i] || '').trim())
const ehData = s => /^\d{1,2}\/\d{1,2}$/.test(String(s || '').trim())

const gab = []
let ano = 2024, mesAnt = null, atual = null
for (const l of linhas) {
  if (ehData(l[0])) {
    const m = Number(l[0].trim().split('/')[1])
    if (mesAnt !== null && m < mesAnt) ano++
    mesAnt = m; atual = { ano, mes: m }
    continue
  }
  if (String(l[0] || '').trim().toUpperCase() !== 'FOLGA' || !atual) continue
  // Só vale de gabarito quando TODAS as 7 pessoas têm os dois números — é o
  // formato tardio da planilha. Os meses iniciais têm só um número e outro
  // significado.
  const completo = NOMES.every((_, k) =>
    String(l[1 + k * 2] ?? '').trim() !== '' && String(l[2 + k * 2] ?? '').trim() !== '')
  if (!completo) continue
  NOMES.forEach((nome, k) => gab.push({
    ...atual, pessoa: nome,
    direito: Number(l[1 + k * 2]), usadas: Number(l[2 + k * 2]),
  }))
}

const pessoas = await api('folgas_pessoas?select=id,nome&time_id=eq.sinal-inter')
const feriados = new Set((await api('folgas_feriados?select=dia')).map(f => f.dia))
const ids = pessoas.map(p => `"${p.id}"`).join(',')
const todas = []
for (let de = 0; de < 40000; de += 1000) {
  const p = await api(`folgas_dias?pessoa_id=in.(${ids})&select=pessoa_id,dia,categoria_id&order=pessoa_id,dia&offset=${de}&limit=1000`)
  todas.push(...p); if (p.length < 1000) break
}
const por = new Map(pessoas.map(p => [p.id, new Map()]))
todas.forEach(l => por.get(l.pessoa_id)?.set(l.dia, l.categoria_id))
const idDe = n => pessoas.find(p => p.nome === n)?.id

const contas = { A: 0, B: 0, C: 0 }
const erroMedio = { A: 0, B: 0, C: 0 }
let usadasOk = 0
for (const g of gab) {
  const pid = idDe(g.pessoa); if (!pid) continue
  const meus = por.get(pid)
  const dim = new Date(g.ano, g.mes, 0).getDate()
  let fds = 0, fer = 0, fdsSemFerias = 0, usadas = 0
  for (let d = 1; d <= dim; d++) {
    const k = iso(g.ano, g.mes, d)
    const dow = new Date(g.ano, g.mes - 1, d).getDay()
    const ehFds = dow === 0 || dow === 6
    const ehFer = feriados.has(k)
    const cat = meus.get(k)
    if (cat === 'folga') usadas++
    if (ehFds) fds++
    else if (ehFer) fer++
    if ((ehFds || ehFer) && cat !== 'ferias' && cat !== 'atestado') fdsSemFerias++
  }
  const calc = { A: fds, B: fds + fer, C: fdsSemFerias }
  for (const h of ['A', 'B', 'C']) {
    if (calc[h] === g.direito) contas[h]++
    erroMedio[h] += Math.abs(calc[h] - g.direito)
  }
  if (usadas === g.usadas) usadasOk++
}

console.log(`Gabarito no formato completo: ${gab.length} fechamentos (pessoa × mês)\n`)
console.log(`"usadas" (contagem de folgas): ${usadasOk} de ${gab.length} batem\n`)
console.log('"de direito" — qual hipótese explica a planilha:')
for (const [h, rot] of [
  ['A', 'só fim de semana'],
  ['B', 'fim de semana + feriado (o que implementei)'],
  ['C', 'fim de semana + feriado, menos férias/atestado'],
]) {
  console.log(`  ${h}) ${rot.padEnd(46)} ${String(contas[h]).padStart(3)}/${gab.length} exatos · erro médio ${(erroMedio[h] / gab.length).toFixed(2)}`)
}
