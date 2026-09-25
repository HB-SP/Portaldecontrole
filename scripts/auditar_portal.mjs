// ─── VARRE O PORTAL ATRÁS DO QUE NÃO ESTÁ REDONDO ────────────────────────────
// Não conserta nada. Só olha os dados de todos os ângulos que já deram
// problema alguma vez e imprime o que encontra, para a equipe decidir.
//
//   node scripts/auditar_portal.mjs

import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = readFileSync('.env.local', 'utf8').split(/\r?\n/)
const v = k => { const l = env.find(x => x.startsWith(k + '=')); return l ? l.slice(k.length + 1).trim() : '' }
const c = new pg.Client({ connectionString: v('DATABASE_URL'), ssl: { rejectUnauthorized: false } })
await c.connect()

const achados = []
const secao = t => console.log(`\n\n━━ ${t} ${'━'.repeat(Math.max(0, 62 - t.length))}`)
const q = async sql => (await c.query(sql)).rows

// ── 1. nome de gente escrito de mais de um jeito ────────────────────────────
secao('GENTE ESCRITA DE MAIS DE UM JEITO')
const FUNCOES = ['coordenador_um', 'produtor_um', 'produtor_campo', 'producao_executiva', 'monitoracao']
const nomes = new Map()   // primeiro nome -> Set de grafias
for (const f of FUNCOES) {
  for (const r of await q(`select distinct ${f} as v from escala_geral where nullif(btrim(${f}),'') is not null`)) {
    for (const parte of String(r.v).split('/').map(x => x.trim()).filter(Boolean)) {
      if (/^\+?\d[\d\s()-]{7,}$/.test(parte)) continue          // telefone
      if (/^n[aã]o$/i.test(parte)) continue
      const chave = parte.split(/\s+/)[0].toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
      if (!nomes.has(chave)) nomes.set(chave, new Set())
      nomes.get(chave).add(parte)
    }
  }
}
let n1 = 0
for (const [chave, set] of [...nomes].sort()) {
  if (set.size < 2) continue
  n1++
  console.log(`  ${chave.padEnd(14)} ${[...set].join('  |  ')}`)
}
console.log(n1 ? `\n  ${n1} primeiros nomes com mais de uma grafia` : '  nada')
if (n1) achados.push(`${n1} nomes de gente escritos de mais de um jeito na escala`)

// ── 2. campeonatos da escala sem campeonato no portal ───────────────────────
secao('CAMPEONATOS QUE SÓ EXISTEM NA ESCALA')
const camps = await q(`
  select eg.campeonato, count(*)::int as jogos,
         min(eg.data) as primeira, max(eg.data) as ultima
  from escala_geral eg
  where not exists (
    select 1 from competitions c
    where c.label = eg.campeonato
       or eg.campeonato = any(coalesce(c.escala_camps, array[]::text[])))
  group by 1 order by 2 desc`)
for (const r of camps) console.log(`  ${String(r.campeonato).padEnd(20)} ${String(r.jogos).padStart(3)} jogos`)
console.log(camps.length ? '' : '  nada')
if (camps.length) achados.push(`${camps.length} campeonatos aparecem na escala e não existem como campeonato`)

// ── 3. detentor / transmissão escritos de mais de um jeito ──────────────────
secao('DETENTOR ESCRITO DE MAIS DE UM JEITO')
const det = await q(`
  select 'escala_geral.transmissao' as onde, transmissao as valor, count(*)::int as n
    from escala_geral where nullif(btrim(transmissao),'') is not null group by 1,2
  union all
  select 'brasileirao_jogos.detentor', detentor, count(*)::int from brasileirao_jogos
    where nullif(btrim(detentor),'') is not null group by 1,2
  union all
  select 'paulistao_feminino.detentor', detentor, count(*)::int from paulistao_feminino_jogos
    where nullif(btrim(detentor),'') is not null group by 1,2
  order by 1, 3 desc`)
for (const r of det) console.log(`  ${r.onde.padEnd(28)} ${String(r.valor).padEnd(34)} ${r.n}`)

// ── 4. buracos de escala, por função e por campeonato ──────────────────────
secao('CASAS DE ESCALA EM BRANCO')
for (const f of FUNCOES) {
  const r = await q(`
    select campeonato, count(*)::int as n from escala_geral
    where nullif(btrim(${f}),'') is null group by 1 having count(*) > 2 order by 2 desc limit 4`)
  if (r.length) console.log(`  ${f.padEnd(20)} ${r.map(x => `${x.campeonato}: ${x.n}`).join(' · ')}`)
}

// ── 5. jogo repetido ────────────────────────────────────────────────────────
secao('JOGO REPETIDO NA ESCALA')
const dup = await q(`
  select campeonato, data, mandante, visitante, count(*)::int as n
  from escala_geral
  where nullif(btrim(mandante),'') is not null
  group by 1,2,3,4 having count(*) > 1 order by 5 desc limit 15`)
for (const r of dup) console.log(`  ${r.campeonato} · ${r.data} · ${r.mandante} x ${r.visitante} — ${r.n}x`)
console.log(dup.length ? '' : '  nada')
if (dup.length) achados.push(`${dup.length} jogos repetidos na escala`)

// ── 6. escala sem jogo correspondente e vice-versa ─────────────────────────
secao('ESCALA PUBLICADA X RASCUNHO')
const pub = await q(`
  select campeonato,
         count(*) filter (where escala_publicada)::int as publicada,
         count(*) filter (where not escala_publicada)::int as rascunho
  from escala_geral group by 1 order by 3 desc`)
for (const r of pub) {
  console.log(`  ${String(r.campeonato).padEnd(20)} publicada ${String(r.publicada).padStart(3)} · rascunho ${String(r.rascunho).padStart(3)}`)
}

// ── 7. campeonatos sem logo ────────────────────────────────────────────────
secao('CAMPEONATO SEM LOGO')
const semLogo = await q(`select label, slug from competitions where logo_url is null order by sort_order`)
for (const r of semLogo) console.log(`  ${r.label} (${r.slug})`)
console.log(semLogo.length ? '' : '  nenhum — todos têm')
if (semLogo.length) achados.push(`${semLogo.length} campeonatos sem logo`)

// ── 8. data sem ano em campeonato que atravessa o ano ──────────────────────
secao('DATA SEM ANO')
const semAno = await q(`
  select campeonato, count(*)::int as n from escala_geral
  where data ~ '^[0-9]{1,2}/[0-9]{1,2}$' group by 1 order by 2 desc`)
for (const r of semAno) console.log(`  ${String(r.campeonato).padEnd(20)} ${r.n} jogos`)
if (semAno.length) achados.push('datas sem ano na escala — viram jogo do ano errado na virada')

console.log(`\n\n━━ RESUMO ${'━'.repeat(62)}`)
if (!achados.length) console.log('  nada a apontar')
for (const a of achados) console.log(`  · ${a}`)
await c.end()
