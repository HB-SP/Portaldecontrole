// ─── ORDEM E COMPOSIÇÃO DO TIME NO CONTROLE DE FOLGAS ────────────────────────
// A ordem pedida pela equipe (18/09/2026) NÃO segue o time: ela intercala Sinal
// Inter e Operações. É a ordem em que elas leem a grade, então é ela que manda
// — `ordem` passa a ser única entre todas as pessoas, não uma por time.
//
// Sair da grade NÃO apaga ninguém: a pessoa fica com ativo=false e todos os
// dias dela continuam no banco. Voltar é uma linha.
//
// Uso:
//   node scripts/ajustar_pessoas_folgas.mjs            # simulação
//   node scripts/ajustar_pessoas_folgas.mjs --gravar

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

// A ordem exata que a equipe pediu.
const ORDEM = [
  'WJ', 'Gatti', 'Flávio', 'Lucas', 'Belezinha', 'Junior', 'Laís', 'Gui Soria',
  'Previde', 'Anny', 'Natan', 'Ana Clara', 'Rafa', 'Pardal', 'Yuji', 'Leandro',
]
const ENTRAM = [{ nome: 'Suzana', time_id: 'operacoes' }]
const SAEM = ['Fernanda']

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
const CORES = ['#4C8DFF', '#3ED598', '#F2B84B', '#B98CF2', '#E6483C', '#5B8DEF', '#6B7686',
  '#0891B2', '#B45309', '#7C3AED', '#0F766E', '#DB2777', '#65B32E', '#EA580C', '#2563EB', '#475569', '#9333EA']

const atuais = await api('folgas_pessoas?select=id,nome,time_id,ordem,ativo&order=ordem')
const achar = nome => atuais.find(p => norm(p.nome) === norm(nome))

const plano = []
ORDEM.forEach((nome, i) => {
  const p = achar(nome)
  if (!p) { plano.push({ acao: 'NÃO ACHEI', nome, ordem: i + 1 }); return }
  plano.push({ acao: 'ordem', id: p.id, nome: p.nome, time_id: p.time_id, de: p.ordem, para: i + 1, cor: CORES[i % CORES.length] })
})

// Quem a lista não citou e não foi mandado sair: fica, no fim, e é apontado —
// tirar alguém da grade porque o nome não apareceu numa mensagem seria decidir
// por conta própria.
const naLista = new Set([...ORDEM, ...SAEM, ...ENTRAM.map(e => e.nome)].map(norm))
const esquecidos = atuais.filter(p => p.ativo && !naLista.has(norm(p.nome)))

let prox = ORDEM.length + 1
for (const e of ENTRAM) {
  const ja = achar(e.nome)
  plano.push(ja
    ? { acao: 'reativar', id: ja.id, nome: ja.nome, time_id: ja.time_id, para: prox, cor: CORES[(prox - 1) % CORES.length] }
    : { acao: 'CRIAR', nome: e.nome, time_id: e.time_id, para: prox, cor: CORES[(prox - 1) % CORES.length] })
  prox++
}
for (const e of esquecidos) {
  plano.push({ acao: 'fica (não citado)', id: e.id, nome: e.nome, time_id: e.time_id, de: e.ordem, para: prox, cor: CORES[(prox - 1) % CORES.length] })
  prox++
}
for (const nome of SAEM) {
  const p = achar(nome)
  if (p) plano.push({ acao: 'sai da grade', id: p.id, nome: p.nome, time_id: p.time_id })
  else plano.push({ acao: 'NÃO ACHEI (para sair)', nome })
}

console.log('PLANO\n' + '─'.repeat(64))
for (const x of plano) {
  console.log(`  ${String(x.para ?? '').padStart(2)}  ${String(x.nome).padEnd(12)} ${String(x.time_id || '').padEnd(12)} ${x.acao}${x.de !== undefined && x.de !== x.para ? ` (era ${x.de})` : ''}`)
}
const problemas = plano.filter(x => x.acao.startsWith('NÃO ACHEI'))
if (problemas.length) console.log(`\n⚠ ${problemas.length} nome(s) não encontrado(s) — confira a grafia.`)
if (esquecidos.length) {
  console.log(`\n⚠ ${esquecidos.length} pessoa(s) não estavam na lista e NÃO foram removidas: ${esquecidos.map(e => e.nome).join(', ')}`)
}

// Sem process.exit aqui: no Windows, sair com uma requisição ainda aberta
// derruba o Node com uma asserção do libuv, e o script parece ter falhado sem
// ter falhado.
if (!process.argv.includes('--gravar')) {
  console.log('\nSIMULAÇÃO — nada gravado. Rode com --gravar para valer.')
} else {

for (const x of plano) {
  if (x.acao === 'CRIAR') {
    await api('folgas_pessoas', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify([{ nome: x.nome, time_id: x.time_id, ordem: x.para, cor: x.cor, ativo: true }]),
    })
  } else if (x.acao === 'sai da grade') {
    await api(`folgas_pessoas?id=eq.${x.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ativo: false }),
    })
  } else if (x.id) {
    await api(`folgas_pessoas?id=eq.${x.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ ordem: x.para, cor: x.cor, ativo: true }),
    })
  }
}

const depois = await api('folgas_pessoas?select=nome,time_id,ordem,ativo&order=ordem')
console.log('\nCOMO FICOU\n' + '─'.repeat(64))
depois.filter(p => p.ativo).forEach(p => console.log(`  ${String(p.ordem).padStart(2)}  ${p.nome.padEnd(12)} ${p.time_id}`))
const fora = depois.filter(p => !p.ativo)
if (fora.length) console.log(`\n  fora da grade (dias preservados): ${fora.map(p => p.nome).join(', ')}`)

}
