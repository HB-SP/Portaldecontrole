// ─── UNIFORMIZA NOMES DE COLUNA ENTRE OS CAMPEONATOS ─────────────────────────
// A tela "Escalar" (uma tabela só, todos os campeonatos, colunas comuns) só
// funciona se a mesma coisa tiver o mesmo nome. Confirmado com a equipe em
// 16/09/2026:
//   - golcam (A1) e goalcam (Brasileirão, Paulistão F) são a mesma câmera
//   - supervisores_1 (Brasileirão) e supervisor_um_host são o mesmo papel
//   - o Paulistão F não deveria ter drone/DSLR/grua/minidrone no Controle,
//     porque já estão na aba Periférico
//
// Este script cuida da parte que vive no BANCO (campeonatos dinâmicos). O que
// vive no código (tables.js, legados) muda por commit.
//
// Uso: node scripts/uniformizar_colunas.mjs [--conferir]

import { readFileSync } from 'node:fs'

const URL = 'https://buubjnddzsadzcumrvdt.supabase.co'
const KEY = (readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .find(l => /^SUPABASE_SERVICE_KEY=/.test(l)) || '').split('=').slice(1).join('=').trim()
if (!KEY) { console.error('Sem SUPABASE_SERVICE_KEY em .env.local'); process.exit(1) }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

async function api(caminho, opcoes = {}) {
  const r = await fetch(`${URL}/rest/v1/${caminho}`, { ...opcoes, headers: { ...H, ...(opcoes.headers || {}) } })
  const t = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${caminho} :: ${t.slice(0, 300)}`)
  return t ? JSON.parse(t) : null
}

// [slug do campeonato, chave antiga, chave nova]
const RENOMEAR = [
  ['paulistao-a1-periferico', 'golcam', 'goalcam'],
  ['paulistao-a1-periferico', 'fornecedor_golcam', 'fornecedor_goalcam'],
]

const conferir = process.argv.includes('--conferir')
const cheio = v => v !== null && v !== undefined && String(v).trim() !== ''

for (const [slug, de, para] of RENOMEAR) {
  const [comp] = await api(`competitions?slug=eq.${slug}&select=id,label`)
  if (!comp) { console.log(`  ${slug}: campeonato não encontrado, pulando`); continue }

  const cols = await api(`competition_columns?competition_id=eq.${comp.id}&select=id,key,label`)
  const antiga = cols.find(c => c.key === de)
  const nova = cols.find(c => c.key === para)
  const eventos = await api(`competition_events?competition_id=eq.${comp.id}&select=id,data`)
  const comDado = eventos.filter(e => cheio(e.data?.[de]))

  console.log(`\n${comp.label} · ${de} -> ${para}`)
  console.log(`  coluna "${de}" existe: ${antiga ? 'sim' : 'não'} | "${para}" já existe: ${nova ? 'SIM (conflito)' : 'não'}`)
  console.log(`  jogos com dado em "${de}": ${comDado.length} de ${eventos.length}`)

  if (!antiga) { console.log('  nada a fazer'); continue }
  if (nova) { console.log('  PULANDO: a chave de destino já existe, renomear criaria duplicata'); continue }
  if (conferir) { console.log('  (modo conferir — nada gravado)'); continue }

  // 1) a coluna
  await api(`competition_columns?id=eq.${antiga.id}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ key: para }),
  })
  // 2) a chave dentro do JSONB de cada jogo que tem dado
  for (const e of comDado) {
    const d = { ...e.data }
    d[para] = d[de]
    delete d[de]
    await api(`competition_events?id=eq.${e.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ data: d }),
    })
  }
  console.log(`  renomeado: 1 coluna + ${comDado.length} jogos`)
}

if (!conferir) {
  console.log('\n── conferência ──')
  for (const [slug, de, para] of RENOMEAR) {
    const [comp] = await api(`competitions?slug=eq.${slug}&select=id`)
    if (!comp) continue
    const cols = await api(`competition_columns?competition_id=eq.${comp.id}&select=key`)
    const ev = await api(`competition_events?competition_id=eq.${comp.id}&select=data`)
    const sobrouCol = cols.some(c => c.key === de)
    const sobrouDado = ev.filter(e => cheio(e.data?.[de])).length
    const temNovo = ev.filter(e => cheio(e.data?.[para])).length
    console.log(`  ${para}: ${temNovo} jogos com dado | sobrou "${de}": coluna=${sobrouCol} dados=${sobrouDado}`)
  }
}
