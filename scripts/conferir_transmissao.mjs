// ─── CONFERE A ABA TRANSMISSÃO SEM ABRIR O NAVEGADOR ─────────────────────────
// Faz o MESMO casamento que a tela faz — com as funções de verdade do app —
// contra os dados reais, e imprime a tabela. O build compila igual se o
// casamento estiver errado; só olhando o resultado dá para saber.
//
//   node --import ./scripts/resolver_ext.mjs scripts/conferir_transmissao.mjs [slug]

import { readFileSync } from 'node:fs'
import { FUNCOES_ESCALA, naoTemFuncao, semEscala, acharEscala,
         criarIndiceEscala, escalaCampeonatosDe } from '../src/lib/escalaLink.js'
import { compararPorData } from '../src/lib/datas.js'

const BASE = 'https://buubjnddzsadzcumrvdt.supabase.co'
const KEY = (readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .find(l => /^SUPABASE_SERVICE_KEY=/.test(l)) || '').split('=').slice(1).join('=').trim()
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }
const api = async c => {
  const r = await fetch(`${BASE}/rest/v1/${c}`, { headers: H })
  const t = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${c} :: ${t.slice(0, 200)}`)
  return t ? JSON.parse(t) : null
}

const TABELA = {
  brasileirao: 'brasileirao_jogos', 'paulistao-fem': 'paulistao_feminino_jogos',
}
const slug = process.argv[2] || 'brasileirao'

const [comp] = await api(`competitions?slug=eq.${slug}&select=id,label,escala_camps`)
if (!comp) { console.error(`nao achei o campeonato "${slug}"`); process.exit(1) }

let jogos
if (TABELA[slug]) jogos = await api(`${TABELA[slug]}?select=*`)
else {
  const ev = await api(`competition_events?select=id,data&competition_id=eq.${comp.id}`)
  jogos = ev.map(e => ({ id: e.id, ...(e.data || {}) }))
}

const camps = escalaCampeonatosDe(comp.label, comp.escala_camps)
const lista = camps.map(c => `"${c}"`).join(',')
const eg = await api(`escala_geral?campeonato=in.(${lista})&select=*`)
const indice = criarIndiceEscala(eg)

console.log(`\n${comp.label} — casando com escala_geral de: ${camps.join(' · ')}`)
console.log(`${jogos.length} jogos · ${eg.length} linhas de escala\n`)

const linhas = jogos.filter(j => j.mandante && j.visitante).sort(compararPorData)
let semNada = 0, buracos = 0
const larg = 22
console.log(['DATA'.padEnd(8), 'JOGO'.padEnd(34), ...FUNCOES_ESCALA.map(f => f.label.slice(0, larg).padEnd(larg))].join(''))
for (const j of linhas.slice(0, 14)) {
  const achado = acharEscala(j, indice)
  const e = achado?.escala
  if (!e) semNada++
  const cels = FUNCOES_ESCALA.map(f => {
    const v = e?.[f.key]
    if (naoTemFuncao(v)) return 'nao tem'.padEnd(larg)
    const t = String(v || '').trim()
    if (!t) { buracos++; return '— VAZIO —'.padEnd(larg) }
    return t.slice(0, larg - 1).padEnd(larg)
  })
  const rot = e && semEscala(e) ? ['nao escala equipe da casa'.padEnd(larg * 5)] : cels
  console.log([String(j.data || '').padEnd(8), `${j.mandante} x ${j.visitante}`.slice(0, 33).padEnd(34), ...rot].join(''))
}

// e a conta sobre o campeonato inteiro
let totalBuracos = 0, semEsc = 0
for (const j of linhas) {
  const e = acharEscala(j, indice)?.escala
  if (!e) { semEsc++; continue }
  if (semEscala(e)) continue
  totalBuracos += FUNCOES_ESCALA.filter(f => !naoTemFuncao(e[f.key]) && !String(e[f.key] || '').trim()).length
}
console.log(`\n(mostrando 14 de ${linhas.length})`)
console.log(`no campeonato inteiro: ${totalBuracos} casas em branco · ${semEsc} jogos sem NENHUMA linha de escala casada`)
