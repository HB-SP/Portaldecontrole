// Confere a tela Escalar SEM abrir o navegador: monta as competições do jeito
// que o useCompetitions monta, roda o catálogo de colunas de verdade e testa a
// leitura de célula (valorDe) contra os dados reais do banco.
import { readFileSync } from 'node:fs'
import { montarCatalogo, ehComumATodos, chaveDe, valorDe, GRUPOS } from '../src/config/colunasEscalar.js'
import {
  BRASILEIRAO_CONFIG, PERIFERICO_BR_CONFIG, PAULISTAO_FEM_CONFIG, PERIFERICO_PF_CONFIG, PAR_PERIFERICO,
} from '../src/config/tables.js'

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
  legacy_brasileirao: BRASILEIRAO_CONFIG,
  legacy_periferico_br: PERIFERICO_BR_CONFIG,
  legacy_paulistao_fem: PAULISTAO_FEM_CONFIG,
  legacy_periferico_pf: PERIFERICO_PF_CONFIG,
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

const competitions = parents.map(parent => {
  const cfgPai = configForRow(parent, colsByComp)
  const sections = [
    { id: `${parent.slug}-overview`, label: 'Visão Geral', config: cfgPai, isOverview: true },
    { id: `${parent.slug}-controle`, label: 'Controle', config: cfgPai },
    ...(filhos.get(parent.id) || []).map(f => ({
      id: `${f.slug}-${f.section_kind}`, label: f.section_kind, config: configForRow(f, colsByComp),
    })),
    { id: `${parent.slug}-escalar`, label: 'Escalar', config: cfgPai, isEscalar: true },
  ]
  return { id: parent.slug, competitionId: parent.id, label: parent.label, sections }
})

console.log('CAMPEONATOS:', competitions.map(c => `${c.label} (${c.sections.map(s => s.label).join(', ')})`).join('\n              '))

const catalogo = montarCatalogo(competitions)
const comuns = catalogo.filter(c => ehComumATodos(c, competitions))
console.log(`\nCATÁLOGO: ${catalogo.length} colunas · ${comuns.length} comuns a todos os ${competitions.length} campeonatos`)
for (const g of GRUPOS) {
  const doG = catalogo.filter(c => c.grupo === g)
  console.log(`\n── ${g} (${doG.length}) ──`)
  for (const c of doG) {
    const onde = competitions.filter(k => chaveDe(c, k.id)).map(k => k.label.replace(/\s+\d+$/, ''))
    console.log(`  ${c.label.padEnd(26)} ${c.fonte.padEnd(10)} ${c.tipo.padEnd(8)} ${onde.length === competitions.length ? 'TODOS' : onde.join(', ')}`)
  }
}

// ── as colunas PADRÃO (as comuns) sobre dados reais ──
console.log(`\nPADRÃO DA TELA (${comuns.length} colunas): ${comuns.map(c => c.label).join(' | ')}`)

// ── amostra de leitura real: um campeonato, 3 jogos ──
const alvo = competitions[0]
const secCtrl = alvo.sections.find(s => !s.isOverview && !s.isEscalar && s.config.sectionKind !== 'periferico')
const cfg = secCtrl.config
let jogos = []
if (cfg.tableName) jogos = await api(`${cfg.tableName}?select=*&limit=3`)
else jogos = (await api(`competition_events?competition_id=eq.${cfg.competitionId}&select=id,data&limit=3`))
  .map(e => ({ ...(e.data || {}), id: e.id }))

console.log(`\nAMOSTRA — ${alvo.label} (${cfg.tableName || 'dinâmico'}):`)
for (const row of jogos) {
  const jogo = { comp: alvo, cfg, row, perif: null, escala: null }
  const lidas = comuns.map(c => `${c.label}=${JSON.stringify(valorDe(jogo, c))}`)
  console.log(`  ${row.mandante} x ${row.visitante} (${row.data})`)
  console.log(`    ${lidas.join('  ')}`)
}
void PAR_PERIFERICO
