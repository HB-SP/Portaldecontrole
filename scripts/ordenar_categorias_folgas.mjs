// ─── QUE OPÇÕES APARECEM, E EM QUE ORDEM ─────────────────────────────────────
// A ordem da lista é a ordem em que a equipe pensa: o dia a dia primeiro, a
// exceção depois. Férias e atestado foram para o fim porque quase nunca são o
// que se está preenchendo (equipe, 18/09/2026).
//
// ARQUIVAR não apaga. LiveKasa e Sportheca saem da lista de escolher, mas os
// dias que já estão marcados com elas continuam aparecendo na grade com o nome
// certo — são 269 e 237 dias de história. Desarquivar é uma linha.
//
// Uso:
//   node scripts/ordenar_categorias_folgas.mjs            # simulação
//   node scripts/ordenar_categorias_folgas.mjs --gravar

import { readFileSync } from 'node:fs'

const BASE = 'https://buubjnddzsadzcumrvdt.supabase.co'
const KEY = (readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .find(l => /^SUPABASE_SERVICE_KEY=/.test(l)) || '').split('=').slice(1).join('=').trim()
if (!KEY) { console.error('Sem SUPABASE_SERVICE_KEY em .env.local'); process.exit(1) }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const api = async (c, o = {}) => {
  const r = await fetch(`${BASE}/rest/v1/${c}`, { ...o, headers: { ...H, ...(o.headers || {}) } })
  const t = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${c} :: ${t.slice(0, 300)}`)
  return t ? JSON.parse(t) : null
}

// Na ordem em que devem aparecer.
const ORDEM = ['folga', 'home', 'escritorio', 'casablanca', 'monitoracao', 'externa',
  'deslocamento', 'ferias', 'atestado', 'outro']
// Saem da lista de escolher; a história fica.
const ARQUIVAR = ['livekasa', 'sportheca']

const gravar = process.argv.includes('--gravar')
const cats = await api('folgas_categorias?select=*&order=ordem')

const dias = []
for (let de = 0; de < 40000; de += 1000) {
  const p = await api(`folgas_dias?select=categoria_id&order=pessoa_id,dia&offset=${de}&limit=1000`)
  dias.push(...p); if (p.length < 1000) break
}
const quantos = id => dias.filter(d => d.categoria_id === id).length

console.log('COMO VAI FICAR A LISTA\n' + '─'.repeat(56))
ORDEM.forEach((id, i) => {
  const c = cats.find(x => x.id === id)
  if (!c) { console.log(`  ${String(i + 1).padStart(2)}  ${id}  ← NÃO EXISTE`); return }
  console.log(`  ${String(i + 1).padStart(2)}  ${c.nome.padEnd(14)} ${String(quantos(id)).padStart(5)} dias`)
})

console.log('\nFORA DA LISTA (história preservada)\n' + '─'.repeat(56))
for (const id of ARQUIVAR) {
  const c = cats.find(x => x.id === id)
  console.log(`      ${(c?.nome || id).padEnd(14)} ${String(quantos(id)).padStart(5)} dias continuam aparecendo na grade`)
}

const sobrando = cats.filter(c => !ORDEM.includes(c.id) && !ARQUIVAR.includes(c.id))
if (sobrando.length) {
  console.log(`\n⚠ categoria fora do plano, mantida como está: ${sobrando.map(c => c.nome).join(', ')}`)
}

if (!gravar) {
  console.log('\nSIMULAÇÃO — nada gravado. Rode com --gravar para valer.')
} else {
  for (let i = 0; i < ORDEM.length; i++) {
    if (!cats.find(c => c.id === ORDEM[i])) continue
    await api(`folgas_categorias?id=eq.${ORDEM[i]}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ ordem: i + 1, arquivada: false }),
    })
  }
  for (const id of ARQUIVAR) {
    await api(`folgas_categorias?id=eq.${id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ arquivada: true, ordem: 90 }),
    })
  }
  const depois = await api('folgas_categorias?select=nome,ordem,arquivada&order=ordem')
  console.log('\nCOMO FICOU\n' + '─'.repeat(56))
  depois.forEach(c => console.log(`  ${String(c.ordem).padStart(2)}  ${c.nome.padEnd(14)} ${c.arquivada ? '(fora da lista)' : ''}`))
}
