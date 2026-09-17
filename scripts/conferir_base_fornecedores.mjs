// ─── A ESCALAR × A BASE DE FORNECEDORES ──────────────────────────────────────
// Responde, sem abrir o navegador:
//   1. quais colunas da tela Escalar se preenchem com gente cadastrada;
//   2. quantos nomes a lista oferece em cada uma;
//   3. quantos valores JÁ preenchidos estão fora da base — que é a dívida de
//      digitação livre que a tela passa a mostrar em âmbar.
//
// Uso: node --import ./scripts/resolver_ext.mjs scripts/conferir_base_fornecedores.mjs

import { readFileSync } from 'node:fs'
import { montarCatalogo, ehDeFornecedor, pessoasDaColuna, funcaoSugerida, chaveDe, GRUPOS } from '../src/config/colunasEscalar.js'
import { estaCadastrado, getColumnPredicate } from '../src/config/funcoesFornecedor.js'
import {
  BRASILEIRAO_CONFIG, PERIFERICO_BR_CONFIG, PAULISTAO_FEM_CONFIG, PERIFERICO_PF_CONFIG,
} from '../src/config/tables.js'
import { parearPerifericos } from '../src/lib/parearPeriferico.js'
import { criarIndiceEscala, acharEscala, escalaCampeonatosDe } from '../src/lib/escalaLink.js'

const URL = 'https://buubjnddzsadzcumrvdt.supabase.co'
const KEY = (readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .find(l => /^SUPABASE_SERVICE_KEY=/.test(l)) || '').split('=').slice(1).join('=').trim()
if (!KEY) { console.error('Sem SUPABASE_SERVICE_KEY em .env.local'); process.exit(1) }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }
const api = async c => {
  const r = await fetch(`${URL}/rest/v1/${c}`, { headers: H })
  const t = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${c} :: ${t.slice(0, 200)}`)
  return t ? JSON.parse(t) : null
}

const LEGACY = {
  legacy_brasileirao: BRASILEIRAO_CONFIG, legacy_periferico_br: PERIFERICO_BR_CONFIG,
  legacy_paulistao_fem: PAULISTAO_FEM_CONFIG, legacy_periferico_pf: PERIFERICO_PF_CONFIG,
}

function configForRow(row, colsByComp) {
  if (row.template_key?.startsWith('legacy_') && LEGACY[row.template_key]) {
    const base = LEGACY[row.template_key]
    return { ...base, id: row.slug, label: row.label, competitionId: row.id, isLegacy: true,
      sectionKind: row.section_kind || null, escalaCamps: row.escala_camps || null,
      tableName: row.legacy_table || base.tableName }
  }
  const cols = (colsByComp.get(row.id) || []).map(c => ({
    key: c.key, label: c.label, type: c.type,
    options: Array.isArray(c.options) ? c.options : [],
    width: c.width, group: c.col_group || undefined,
  }))
  return { id: row.slug, label: row.label, competitionId: row.id, isLegacy: false,
    sectionKind: row.section_kind || null, escalaCamps: row.escala_camps || null, columns: cols }
}

const rows = await api('competitions?archived=eq.false&select=*&order=sort_order')
const cols = await api('competition_columns?select=*&order=sort_order')
const colsByComp = new Map()
for (const c of cols) {
  if (!colsByComp.has(c.competition_id)) colsByComp.set(c.competition_id, [])
  colsByComp.get(c.competition_id).push(c)
}
const parents = rows.filter(r => !r.parent_competition_id)
const filhos = new Map()
for (const r of rows.filter(x => x.parent_competition_id)) {
  if (!filhos.has(r.parent_competition_id)) filhos.set(r.parent_competition_id, [])
  filhos.get(r.parent_competition_id).push(r)
}

const competitions = parents.map(parent => ({
  id: parent.slug, competitionId: parent.id, label: parent.label,
  sections: [
    { id: `${parent.slug}-overview`, label: 'Visão Geral', config: configForRow(parent, colsByComp), isOverview: true },
    { id: `${parent.slug}-controle`, label: 'Controle', config: configForRow(parent, colsByComp) },
    ...(filhos.get(parent.id) || []).map(f => ({
      id: `${f.slug}-${f.section_kind}`, label: f.section_kind, config: configForRow(f, colsByComp),
    })),
    { id: `${parent.slug}-escalar`, label: 'Escalar', config: configForRow(parent, colsByComp), isEscalar: true },
  ],
}))

const [linhaForn] = await api('app_state?key=eq.fornecedores&select=value')
const fornecedores = Array.isArray(linhaForn?.value) ? linhaForn.value : []
console.log(`BASE: ${fornecedores.length} fornecedores/prestadores cadastrados\n`)

// ── carrega os jogos de verdade, como a tela carrega ──
async function linhasDe(cfg) {
  if (!cfg) return []
  if (cfg.tableName) return await api(`${cfg.tableName}?select=*`)
  return (await api(`competition_events?competition_id=eq.${cfg.competitionId}&select=id,data`))
    .map(e => ({ ...(e.data || {}), id: e.id }))
}

const jogos = []
for (const comp of competitions) {
  const secCtrl = comp.sections.find(s => !s.isOverview && !s.isEscalar && s.config.sectionKind !== 'periferico')
  const secPerif = comp.sections.find(s => s.config.sectionKind === 'periferico')
  const linhas = await linhasDe(secCtrl?.config)
  const perifLinhas = await linhasDe(secPerif?.config)
  const camps = escalaCampeonatosDe(secCtrl.config.label, secCtrl.config.escalaCamps)
  const escalaLinhas = camps.length
    ? await api(`escala_geral?campeonato=in.(${camps.map(c => `"${c}"`).join(',')})&select=*`) : []
  const porPerif = parearPerifericos(linhas, perifLinhas)
  const idx = criarIndiceEscala(escalaLinhas)
  for (const row of linhas.filter(r => r.mandante && r.visitante)) {
    jogos.push({ comp, row, perif: porPerif.get(row.id) || null, escala: acharEscala(row, idx)?.escala || null })
  }
}
console.log(`JOGOS carregados: ${jogos.length}\n`)

const catalogo = montarCatalogo(competitions)
const leValor = (jogo, col) => {
  const chave = chaveDe(col, jogo.comp.id)
  if (!chave) return null
  const linha = col.fonte === 'escala' ? jogo.escala : col.fonte === 'periferico' ? jogo.perif : jogo.row
  const v = linha?.[chave]
  return v == null ? '' : String(v)
}

let totalFora = 0
const naoCadastrados = new Map()
for (const g of GRUPOS) {
  const doG = catalogo.filter(c => c.grupo === g)
  if (!doG.length) continue
  console.log(`\n══ ${g} ══`)
  console.log(`  ${'COLUNA'.padEnd(24)} ${'DA BASE?'.padEnd(22)} ${'SUGERE+RESTO'.padEnd(13)} ${'PREENCH.'.padEnd(9)} FORA DA BASE`)
  for (const col of doG) {
    const deForn = ehDeFornecedor(col, competitions)
    const pessoas = deForn ? pessoasDaColuna(col, competitions, fornecedores) : []
    // Quantos a lista PRIORIZA (os que têm a função da coluna). O resto da base
    // vem depois, para que nada fique inalcançável.
    const preds = (col.fonte === 'escala' ? [col.id] : competitions.map(c => chaveDe(col, c.id)).filter(Boolean))
      .map(k => getColumnPredicate(k)).filter(Boolean)
    const daFuncao = preds.length ? fornecedores.filter(f => f.apelido && preds.some(pr => pr(f))).length : 0
    let cheios = 0, fora = 0
    for (const j of jogos) {
      const v = leValor(j, col)
      if (!v) continue
      cheios++
      if (deForn && !estaCadastrado(v, fornecedores)) {
        fora++; totalFora++
        naoCadastrados.set(v, (naoCadastrados.get(v) || 0) + 1)
      }
    }
    const oferta = deForn ? `${daFuncao}+${pessoas.length - daFuncao}` : '—'
    console.log(`  ${col.label.padEnd(24)} ${(deForn ? `sim (${funcaoSugerida(col, competitions)})` : 'não').padEnd(22)} ${oferta.padEnd(13)} ${String(cheios).padEnd(9)} ${fora || ''}`)
  }
}

console.log(`\n── ${totalFora} células preenchidas com nome fora da base (${naoCadastrados.size} nomes distintos) ──`)
;[...naoCadastrados.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)
  .forEach(([nome, n]) => console.log(`  ${String(n).padStart(4)}×  ${nome}`))
