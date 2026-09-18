// ─── LIGA A PESSOA DO TIME AO NOME DELA NA ESCALA DOS JOGOS ──────────────────
// Na grade de folgas a pessoa é "Previde"; na escala do jogo é "Matheus
// Previde". O vínculo é DECLARADO aqui, não adivinhado — casar por semelhança
// erraria feio:
//   · há dois Flávios, dois Lucas e dois Rafaéis nas escalas, e nenhum deles é
//     do time (equipe, 18/09/2026);
//   · "Wilson Junior" parece o Junior, mas é o WJ.
// Errar aqui significa mostrar na folga de alguém um jogo de outra pessoa.
//
// Quem não trabalha nos jogos fica sem vínculo e simplesmente não recebe jogo.
//
// Uso:
//   node scripts/ligar_nomes_escala.mjs            # simulação
//   node scripts/ligar_nomes_escala.mjs --gravar

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

// Pessoa do time -> como ela aparece nas escalas dos jogos.
// Confirmado com a equipe em 18/09/2026.
const VINCULO = {
  'WJ': ['Wilson Junior'],          // "Wilson Junior" é o WJ, não o Junior
  'Gatti': ['Bruno Gatti'],
  'Laís': ['Laís Amorim'],
  'Gui Soria': ['Gui Soria'],
  'Previde': ['Matheus Previde'],
  'Natan': ['Natan Raddatz'],
  'Ana Clara': ['Ana Clara'],
}

const gravar = process.argv.includes('--gravar')

let pessoas
try {
  pessoas = await api('folgas_pessoas?select=id,nome,nomes_escala,ativo&order=ordem')
} catch (e) {
  if (/nomes_escala/.test(e.message)) {
    console.error('O campo `nomes_escala` ainda não existe.')
    console.error('Rode antes, no SQL Editor do Supabase: supabase_folgas_nomes_escala.sql')
    process.exit(1)
  }
  throw e
}

console.log(`${'PESSOA'.padEnd(12)} ${'NA ESCALA DOS JOGOS'.padEnd(24)} O QUE FAZ`)
console.log('─'.repeat(62))
const plano = []
for (const p of pessoas.filter(x => x.ativo)) {
  const alvo = VINCULO[p.nome] || null
  const atual = p.nomes_escala || null
  const igual = JSON.stringify(atual) === JSON.stringify(alvo)
  plano.push({ id: p.id, nome: p.nome, alvo, igual })
  console.log(`${p.nome.padEnd(12)} ${(alvo ? alvo.join(', ') : '— não entra em jogo').padEnd(24)} ${igual ? 'já está' : 'ligar'}`)
}

const naoCitados = Object.keys(VINCULO).filter(n => !pessoas.some(p => p.nome === n))
if (naoCitados.length) console.log(`\n⚠ no vínculo mas não no time: ${naoCitados.join(', ')}`)

if (!gravar) {
  console.log('\nSIMULAÇÃO — nada gravado. Rode com --gravar para valer.')
} else {
  for (const x of plano.filter(y => !y.igual)) {
    await api(`folgas_pessoas?id=eq.${x.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ nomes_escala: x.alvo }),
    })
  }
  const depois = await api('folgas_pessoas?select=nome,nomes_escala&order=ordem')
  console.log('\nCOMO FICOU\n' + '─'.repeat(44))
  depois.forEach(p => console.log(`  ${p.nome.padEnd(12)} ${(p.nomes_escala || []).join(', ') || '—'}`))
}
