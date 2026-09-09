// ─── APLICA OS JOGOS DO CONTROLE DO PAULISTAO A1 ─────────────────────────────
// Le as fatias SQL ja conferidas contra o CSV, extrai os jogos e grava via
// PostgREST com a chave de servico. Idempotente: so grava jogo que ainda nao
// existe (mesmo rod + data + mandante + visitante).
//
// A chave vem de .env.local (ignorado pelo Git) — nunca de argumento de linha
// de comando, que fica visivel na lista de processos.
//
// Uso: node scripts/aplicar_import_a1.mjs [--conferir]

import { readFileSync } from 'node:fs'

const URL = 'https://buubjnddzsadzcumrvdt.supabase.co'
const SLUG = 'paulistao-a1'
const FATIAS = [
  'supabase_paulistao_a1_jogos_1de3.sql',
  'supabase_paulistao_a1_jogos_2de3.sql',
  'supabase_paulistao_a1_jogos_3de3.sql',
]

function chave() {
  const env = readFileSync('.env.local', 'utf8')
  const m = env.split(/\r?\n/).find(l => /^SUPABASE_SERVICE_KEY=/.test(l))
  const k = m ? m.split('=').slice(1).join('=').trim() : ''
  if (!k) { console.error('Sem SUPABASE_SERVICE_KEY em .env.local'); process.exit(1) }
  return k
}
const KEY = chave()
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

async function api(caminho, opcoes = {}) {
  const r = await fetch(`${URL}/rest/v1/${caminho}`, { ...opcoes, headers: { ...H, ...(opcoes.headers || {}) } })
  const texto = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${caminho} :: ${texto.slice(0, 300)}`)
  return texto ? JSON.parse(texto) : null
}

// Extrai (data, status) das fatias — as mesmas linhas que passaram pelo
// round-trip contra o CSV.
function lerJogos() {
  const out = []
  for (const f of FATIAS) {
    for (const linha of readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = linha.match(/^ {2}\('(\{.*\})',\s*'([^']*(?:''[^']*)*)'\),?$/)
      if (!m) continue
      out.push({
        data: JSON.parse(m[1].split("''").join("'")),
        status: m[2].split("''").join("'") || null,
      })
    }
  }
  return out
}

const identidade = d => [d.rod, d.data, d.mandante, d.visitante].join('|')

async function main() {
  const comps = await api(`competitions?slug=eq.${SLUG}&select=id,label`)
  if (!comps?.length) { console.error(`campeonato ${SLUG} nao encontrado`); process.exit(1) }
  const { id: compId, label } = comps[0]
  console.log(`campeonato: ${label} (${compId})`)

  const jogos = lerJogos()
  console.log(`jogos nas fatias: ${jogos.length}`)

  const existentes = await api(`competition_events?competition_id=eq.${compId}&select=data`)
  const jaTem = new Set((existentes || []).map(e => identidade(e.data || {})))
  console.log(`jogos ja no banco: ${jaTem.size}`)

  const faltando = jogos.filter(j => !jaTem.has(identidade(j.data)))
  console.log(`a gravar: ${faltando.length}`)

  if (process.argv.includes('--conferir')) { console.log('(modo conferir — nada gravado)'); return }
  if (faltando.length === 0) { console.log('nada a fazer'); return }

  // Em lotes de 25, como as fatias
  for (let i = 0; i < faltando.length; i += 25) {
    const lote = faltando.slice(i, i + 25).map(j => ({
      competition_id: compId, data: j.data, status: j.status,
    }))
    await api('competition_events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(lote),
    })
    console.log(`  gravado lote ${Math.floor(i / 25) + 1}: ${lote.length} jogos`)
  }

  const depois = await api(`competition_events?competition_id=eq.${compId}&select=id`)
  console.log(`\njogos no Controle agora: ${depois.length}`)
}

main().catch(e => { console.error('FALHOU:', e.message); process.exit(1) })
