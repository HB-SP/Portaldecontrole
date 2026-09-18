// ─── FERIADOS NACIONAIS PARA O CONTROLE DE FOLGAS ────────────────────────────
// Cada feriado soma 1 folga de direito no dia em que cai, igual a um sábado ou
// domingo. Sem esta lista a conta sai por baixo — a equipe trabalharia o
// feriado sem ganhar a folga correspondente.
//
// Só os feriados NACIONAIS entram aqui. Ponto facultativo, feriado municipal
// de São Paulo (25/01) e os dias que a empresa decidir são cadastrados na
// própria tela, porque isso é decisão da equipe, não regra de calendário.
//
// Carnaval, Sexta-feira Santa e Corpus Christi mudam de data todo ano: são
// contados a partir da Páscoa, que é calculada (algoritmo de Meeus/Butcher).
//
// Uso:
//   node scripts/feriados_folgas.mjs            # simulação
//   node scripts/feriados_folgas.mjs --gravar

import { readFileSync } from 'node:fs'

const BASE = 'https://buubjnddzsadzcumrvdt.supabase.co'
const KEY = (readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .find(l => /^SUPABASE_SERVICE_KEY=/.test(l)) || '').split('=').slice(1).join('=').trim()
if (!KEY) { console.error('Sem SUPABASE_SERVICE_KEY em .env.local'); process.exit(1) }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

const ANOS = [2024, 2025, 2026, 2027]

const FIXOS = [
  ['01-01', 'Confraternização Universal'],
  ['04-21', 'Tiradentes'],
  ['05-01', 'Dia do Trabalho'],
  ['09-07', 'Independência do Brasil'],
  ['10-12', 'Nossa Senhora Aparecida'],
  ['11-02', 'Finados'],
  ['11-15', 'Proclamação da República'],
  ['11-20', 'Consciência Negra'],   // nacional desde 2024
  ['12-25', 'Natal'],
]

// Páscoa pelo algoritmo de Meeus/Butcher (calendário gregoriano).
function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100
  const d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(ano, mes - 1, dia)
}
const maisDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const feriados = []
for (const ano of ANOS) {
  for (const [md, nome] of FIXOS) feriados.push({ dia: `${ano}-${md}`, nome })
  const p = pascoa(ano)
  feriados.push({ dia: iso(maisDias(p, -48)), nome: 'Carnaval' })
  feriados.push({ dia: iso(maisDias(p, -47)), nome: 'Carnaval' })
  feriados.push({ dia: iso(maisDias(p, -2)),  nome: 'Sexta-feira Santa' })
  feriados.push({ dia: iso(maisDias(p, 60)),  nome: 'Corpus Christi' })
}
feriados.sort((a, b) => a.dia.localeCompare(b.dia))

const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
console.log(`${feriados.length} feriados nacionais, ${ANOS[0]} a ${ANOS[ANOS.length - 1]}\n`)
for (const ano of ANOS) {
  const doAno = feriados.filter(f => f.dia.startsWith(String(ano)))
  // Feriado que cai em fim de semana NÃO soma folga duas vezes: o dia já conta
  // como fim de semana. A tela precisa saber disso — por isso ele aparece aqui.
  const emFds = doAno.filter(f => {
    const [a, m, d] = f.dia.split('-').map(Number)
    const dow = new Date(a, m - 1, d).getDay()
    return dow === 0 || dow === 6
  })
  console.log(`  ${ano}: ${doAno.length} feriados · ${emFds.length} caem em fim de semana (não dobram a folga)`)
  if (ano === 2026) {
    doAno.forEach(f => {
      const [a, m, d] = f.dia.split('-').map(Number)
      console.log(`      ${f.dia}  ${SEMANA[new Date(a, m - 1, d).getDay()].padEnd(8)} ${f.nome}`)
    })
  }
}

if (!process.argv.includes('--gravar')) {
  console.log('\nSIMULAÇÃO — nada gravado. Rode com --gravar para valer.')
  process.exit(0)
}

const r = await fetch(`${BASE}/rest/v1/folgas_feriados`, {
  method: 'POST',
  headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify(feriados),
})
if (!r.ok) { console.error(await r.text()); process.exit(1) }

const conf = await (await fetch(`${BASE}/rest/v1/folgas_feriados?select=dia&order=dia`, { headers: H })).json()
console.log(`\ngravados · o banco tem ${conf.length} feriados (de ${conf[0]?.dia} a ${conf[conf.length - 1]?.dia})`)
