// ─── JUNTA JOGOS DUPLICADOS ──────────────────────────────────────────────────
// A importação de 24/09/2026 casava o jogo por data + mandante + visitante
// EXATOS. Só que a planilha escreve "Vasco da Gama x Clube do Remo" onde o
// banco tem "Vasco x Remo", e às vezes a data anda um dia. Resultado: 10 jogos
// entraram de novo, como se fossem outros.
//
// Aqui eles voltam a ser um só, e o critério protege quem já estava:
//
//   · a linha ANTIGA fica, sempre. Ela é quem tem o id que a escala, o Hub e o
//     histórico já apontam; trocar o id por causa de um nome escrito diferente
//     seria quebrar ligação para arrumar grafia.
//   · o que a linha nova tem A MAIS é copiado para ela. Nada se perde: a
//     planilha trouxe 25 campos que faltavam no Coritiba x Botafogo.
//   · campo que as duas têm, com valores diferentes, NÃO é tocado — o que está
//     no Portal foi editado por alguém, e a planilha é uma foto do passado.
//
// Uso:
//   node scripts/juntar_duplicados.mjs <tabela>
//   node scripts/juntar_duplicados.mjs <tabela> --gravar

import { readFileSync } from 'node:fs'
import pg from 'pg'
import { normalizarTime } from '../src/lib/escalaLink.js'

const url = (readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .find(l => l.startsWith('DATABASE_URL=')) || '').slice(13)
const GRAVAR = process.argv.includes('--gravar')
const tabela = process.argv.slice(2).find(a => !a.startsWith('--'))
if (!tabela) { console.error('Uso: node scripts/juntar_duplicados.mjs <tabela> [--gravar]'); process.exit(1) }

const IGNORAR = new Set(['id', 'created_at', 'updated_at'])
const cheio = v => v !== null && v !== undefined && String(v).trim() !== ''

// Dois jogos são o mesmo quando os times batem (com apelido) e a data está a no
// máximo um dia de distância — planilhas divergem na data do mesmo jogo.
const diaDe = d => {
  const m = String(d || '').match(/^(\d{1,2})\/(\d{1,2})/)
  return m ? Number(m[2]) * 31 + Number(m[1]) : null
}
const mesmoJogo = (a, b) => {
  if (normalizarTime(a.mandante) !== normalizarTime(b.mandante)) return false
  if (normalizarTime(a.visitante) !== normalizarTime(b.visitante)) return false
  const x = diaDe(a.data), y = diaDe(b.data)
  return x !== null && y !== null && Math.abs(x - y) <= 1
}

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await c.connect()

const cols = (await c.query(
  'SELECT column_name FROM information_schema.columns WHERE table_name = $1', [tabela]
)).rows.map(r => r.column_name).filter(k => !IGNORAR.has(k))

const linhas = (await c.query(`SELECT * FROM ${tabela} ORDER BY created_at`)).rows

const pares = []
const usados = new Set()
for (let i = 0; i < linhas.length; i++) {
  if (usados.has(linhas[i].id)) continue
  const iguais = linhas.filter((x, j) => j > i && !usados.has(x.id) && mesmoJogo(linhas[i], x))
  if (!iguais.length) continue
  iguais.forEach(x => usados.add(x.id))
  pares.push({ fica: linhas[i], saem: iguais })
}

console.log(`\n══ ${tabela} — ${linhas.length} linhas · ${pares.length} jogos duplicados ══`)
let totalCopiados = 0
const planos = []
for (const { fica, saem } of pares) {
  const copiar = {}
  const conflitos = []
  for (const nova of saem) {
    for (const k of cols) {
      if (cheio(fica[k]) || cheio(copiar[k])) {
        if (cheio(nova[k]) && cheio(fica[k]) && String(nova[k]).trim() !== String(fica[k]).trim()) {
          conflitos.push(k)
        }
        continue
      }
      if (cheio(nova[k])) copiar[k] = nova[k]
    }
  }
  totalCopiados += Object.keys(copiar).length
  planos.push({ fica, saem, copiar })
  console.log(`\n   FICA  ${String(fica.data).padEnd(12)} ${fica.mandante} x ${fica.visitante}`)
  saem.forEach(s => console.log(`   sai   ${String(s.data).padEnd(12)} ${s.mandante} x ${s.visitante}`))
  if (Object.keys(copiar).length) console.log(`   copia ${Object.keys(copiar).length} campos: ${Object.keys(copiar).slice(0, 8).join(', ')}${Object.keys(copiar).length > 8 ? '...' : ''}`)
  if (conflitos.length) console.log(`   mantém o do Portal em ${conflitos.length} campos que divergem: ${[...new Set(conflitos)].slice(0, 6).join(', ')}`)
}

console.log(`\n   ${pares.length} a juntar · ${totalCopiados} campos a preencher`)
if (!GRAVAR) { console.log('\n(simulação — passe --gravar)'); await c.end(); process.exit(0) }

for (const { fica, saem, copiar } of planos) {
  if (Object.keys(copiar).length) {
    const sets = Object.keys(copiar).map((k, i) => `${k} = $${i + 1}`).join(', ')
    await c.query(`UPDATE ${tabela} SET ${sets} WHERE id = $${Object.keys(copiar).length + 1}`,
      [...Object.values(copiar), fica.id])
  }
  for (const s of saem) await c.query(`DELETE FROM ${tabela} WHERE id = $1`, [s.id])
}
console.log(`\njuntados. ${tabela} agora tem ${(await c.query(`SELECT count(*) n FROM ${tabela}`)).rows[0].n} linhas.`)
await c.end()
