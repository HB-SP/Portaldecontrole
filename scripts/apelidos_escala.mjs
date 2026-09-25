// ─── OS APELIDOS QUE A ESCALA USA ────────────────────────────────────────────
// A ligação entre a escala dos jogos e a escala interna casa pessoa POR NOME, e
// só reconhece o que está declarado em `folgas_pessoas.nomes_escala`. Declarar
// é de propósito: existe gente diferente com o mesmo primeiro nome, e adivinhar
// mostraria na folga de um o jogo de outro.
//
// Só que a planilha é preenchida no dia a dia, e o apelido nasce lá sem avisar
// ninguém: "Gatti" onde estava "Bruno Gatti", "WJ" onde estava "Wilson Junior".
// Esses ficam de fora da ligação sem dar erro — o jogo simplesmente não aparece
// na grade da pessoa.
//
// Este script varre a escala e mostra os apelidos que PARECEM ser de quem já
// está ligado. Ele nunca grava sozinho: propõe, e alguém confirma.
//
// Uso:
//   node scripts/apelidos_escala.mjs           # mostra o que achou
//   node scripts/apelidos_escala.mjs --gravar

import { readFileSync } from 'node:fs'
import pg from 'pg'

const url = (readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .find(l => l.startsWith('DATABASE_URL=')) || '').slice(13)
const GRAVAR = process.argv.includes('--gravar')

// O canal vem grudado no nome — "Gatti (H)", "WJ - Record" — e diz onde, não
// quem. Sai antes de comparar.
const norm = s => String(s || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/\([^)]*\)/g, ' ')
  .replace(/\s+-\s+\S+/g, ' ')
  .replace(/\s+/g, ' ').trim()

const palavras = s => norm(s).split(' ').filter(x => x.length > 1)
const iniciais = s => palavras(s).map(x => x[0]).join('')

const FUNCOES = ['coordenador_um', 'produtor_um', 'produtor_campo', 'producao_executiva', 'monitoracao']

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await c.connect()

const pessoas = (await c.query(
  'SELECT id, nome, nomes_escala FROM folgas_pessoas WHERE ativo ORDER BY ordem'
)).rows
const ligadas = pessoas.filter(p => (p.nomes_escala || []).length)

// Quem aparece na escala, e quantas vezes.
const conta = new Map()
for (const r of (await c.query(`SELECT ${FUNCOES.join(', ')} FROM escala_geral`)).rows) {
  for (const k of FUNCOES) {
    String(r[k] || '').split(/[/+]/).map(norm)
      .filter(n => n && n !== 'nao' && n.length > 1)
      .forEach(n => conta.set(n, (conta.get(n) || 0) + 1))
  }
}

const declarados = new Map()
for (const p of ligadas) for (const a of p.nomes_escala) declarados.set(norm(a), p)

// Um nome solto é de alguém já ligado quando é a inicial dela ("WJ"), ou quando
// todas as suas palavras começam palavras do nome declarado ("Gui" ⊂ "Gui
// Soria"). Se DUAS pessoas casarem, ninguém leva: ambiguidade aqui é
// exatamente o caso que a declaração existe para evitar.
const propostas = []
for (const [nome, vezes] of [...conta.entries()].sort((a, b) => b[1] - a[1])) {
  if (declarados.has(nome)) continue
  const pa = palavras(nome)
  const donos = [...new Set([...declarados.entries()].filter(([a]) => {
    if (pa.length === 1 && pa[0].length <= 3 && pa[0] === iniciais(a)) return true
    const pb = palavras(a)
    const [curto, longo] = pa.length <= pb.length ? [pa, pb] : [pb, pa]
    return curto.length && curto.every(x => longo.some(y => x === y || y.startsWith(x)))
  }).map(([, p]) => p))]
  if (donos.length === 1) propostas.push({ nome, pessoa: donos[0], vezes })
  else if (donos.length > 1) propostas.push({ nome, vezes, ambiguo: donos.map(d => d.nome) })
}

const claras = propostas.filter(p => !p.ambiguo)
const duvidosas = propostas.filter(p => p.ambiguo)

console.log(`\n${claras.length} apelidos a declarar:`)
for (const p of claras) {
  console.log(`   "${p.nome}"`.padEnd(24) + `= ${p.pessoa.nome.padEnd(12)} ${p.vezes}x na escala`)
}
if (duvidosas.length) {
  console.log(`\n${duvidosas.length} AMBÍGUOS — mais de uma pessoa casa, então nenhum entra:`)
  for (const p of duvidosas) console.log(`   "${p.nome}" pode ser ${p.ambiguo.join(' ou ')}`)
}

if (!GRAVAR) { console.log('\n(simulação — passe --gravar)'); await c.end(); process.exit(0) }

for (const p of claras) {
  await c.query(
    'UPDATE folgas_pessoas SET nomes_escala = array_append(nomes_escala, $1) WHERE id = $2 AND NOT ($1 = ANY(nomes_escala))',
    [p.nome, p.pessoa.id]
  )
}
console.log(`\n${claras.length} declarados.`)
for (const p of (await c.query('SELECT nome, nomes_escala FROM folgas_pessoas WHERE ativo AND nomes_escala IS NOT NULL ORDER BY ordem')).rows) {
  console.log(`   ${p.nome.padEnd(12)} ${p.nomes_escala.join(' · ')}`)
}
await c.end()
