// ─── CONFERE O BALANÇO DE CADA CAMPEONATO ────────────────────────────────────
// Roda a MESMA conta que a Visão Geral faz, com o parseData de verdade do app,
// contra os dados reais do banco. O build não pega conta errada.
//
//   node --import ./scripts/resolver_ext.mjs scripts/conferir_balanco.mjs

import { readFileSync } from 'node:fs'
import { parseData } from '../src/lib/datas.js'

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

function balanco(linhas) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  let previstos = 0, definidos = 0, realizados = 0
  for (const row of linhas) {
    const d = parseData(row.data)
    if (!d) continue
    previstos++
    if (!row.mandante || !row.visitante) continue
    definidos++
    if (d < hoje) realizados++
  }
  return { previstos, definidos, realizados, porVir: definidos - realizados, aDefinir: previstos - definidos }
}

const comps = await api('competitions?select=id,slug,label,legacy_table,template_key&order=sort_order')
const TABELA = {
  brasileirao: 'brasileirao_jogos', 'periferico-br': 'perifericos_brasileirao',
  'paulistao-fem': 'paulistao_feminino_jogos', 'periferico-pf': 'perifericos_paulistao',
}

for (const c of comps) {
  let linhas
  const t = TABELA[c.slug]
  if (t) linhas = await api(`${t}?select=data,mandante,visitante`)
  else {
    const ev = await api(`competition_events?select=data&competition_id=eq.${c.id}`)
    linhas = ev.map(e => e.data || {})
  }
  const b = balanco(linhas)
  const frase = b.realizados === b.previstos && b.previstos
    ? 'temporada completa'
    : [`${b.previstos} no campeonato`,
       b.realizados > 0 && `${b.realizados} realizados`,
       b.porVir > 0 && `${b.porVir} por vir`,
       b.aDefinir > 0 && `${b.aDefinir} a definir`].filter(Boolean).join(' · ')
  console.log(`${c.label.padEnd(22)} ${frase}`)
}
