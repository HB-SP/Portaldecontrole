// ─── TELEFONE DIGITADO JUNTO DO NOME ─────────────────────────────────────────
// SÓ LEITURA. Levanta onde há telefone digitado junto do nome na célula, e se
// esse número já existe no cadastro da pessoa.
//
// Uso: node --import ./scripts/resolver_ext.mjs scripts/conferir_telefones.mjs
import { readFileSync } from 'node:fs'
import { ehTelefone } from '../src/config/funcoesFornecedor.js'

const URL = 'https://buubjnddzsadzcumrvdt.supabase.co'
const KEY = (readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .find(l => /^SUPABASE_SERVICE_KEY=/.test(l)) || '').split('=').slice(1).join('=').trim()
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }
const api = async c => {
  const r = await fetch(`${URL}/rest/v1/${c}`, { headers: H })
  const t = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${c} :: ${t.slice(0, 200)}`)
  return t ? JSON.parse(t) : null
}

const [linha] = await api('app_state?key=eq.fornecedores&select=value')
const fornecedores = Array.isArray(linha?.value) ? linha.value : []
const comTel = fornecedores.filter(f => String(f.telefone || '').trim())
console.log(`BASE: ${fornecedores.length} cadastrados, ${comTel.length} com telefone preenchido`)

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const soDigitos = s => String(s || '').replace(/\D/g, '')
const porNome = new Map(fornecedores.map(f => [norm(f.apelido), f]))

// ── onde estão as células com telefone ──
const fontes = []
for (const [rotulo, caminho, campos] of [
  ['Brasileirão · Controle', 'brasileirao_jogos', ['supervisores_1', 'supervisores_2', 'dtv', 'op_vmix', 'op_audio', 'um', 'sng_premiere', 'sng_host', 'gerador', 'liveu_1', 'liveu_2']],
  ['Paulistão F · Controle', 'paulistao_feminino_jogos', ['supervisor_um_host', 'dtv', 'op_vmix', 'um', 'sng', 'gerador', 'refcam']],
  ['Escala Geral', 'escala_geral', ['coordenador_um', 'produtor_um', 'produtor_campo', 'monitoracao']],
]) {
  const rows = await api(`${caminho}?select=id,${campos.join(',')}`)
  fontes.push({ rotulo, tabela: caminho, jsonb: false, rows, campos })
}
// dinâmicos (A1): tudo dentro do JSONB
const comps = await api('competitions?archived=eq.false&select=id,slug,label,template_key')
const cols = await api('competition_columns?select=competition_id,key,type,col_group')
for (const c of comps.filter(x => !x.template_key?.startsWith('legacy_'))) {
  const campos = cols.filter(k => k.competition_id === c.id && k.type !== 'simnao').map(k => k.key)
  const rows = (await api(`competition_events?competition_id=eq.${c.id}&select=id,data`))
    .map(e => ({ id: e.id, ...(e.data || {}) }))
  fontes.push({ rotulo: `${c.label} (dinâmico)`, tabela: 'competition_events', jsonb: true, compId: c.id, rows, campos })
}

const achados = []
for (const f of fontes) {
  for (const row of f.rows) {
    for (const campo of f.campos) {
      const v = String(row[campo] ?? '').trim()
      if (!v || !v.includes('/')) continue
      const partes = v.split('/').map(x => x.trim()).filter(Boolean)
      const tels = partes.filter(ehTelefone)
      if (!tels.length) continue
      achados.push({ fonte: f.rotulo, tabela: f.tabela, jsonb: f.jsonb, compId: f.compId, id: row.id, campo, valor: v, nomes: partes.filter(x => !ehTelefone(x)), tels })
    }
  }
}

console.log(`\nCÉLULAS com telefone junto do nome: ${achados.length}`)
const porFonte = {}
achados.forEach(a => { porFonte[a.fonte] = (porFonte[a.fonte] || 0) + 1 })
Object.entries(porFonte).forEach(([k, n]) => console.log(`  ${String(n).padStart(4)}  ${k}`))

// ── por pessoa: o número já está no cadastro dela? ──
const porPessoa = new Map()
for (const a of achados) {
  for (const nome of a.nomes) {
    const k = norm(nome)
    if (!porPessoa.has(k)) porPessoa.set(k, { nome, tels: new Set(), celulas: 0 })
    const p = porPessoa.get(k)
    p.celulas++
    a.tels.forEach(t => p.tels.add(t))
  }
}

console.log(`\n${porPessoa.size} pessoas com telefone digitado nas células:\n`)
console.log(`  ${'PESSOA'.padEnd(28)} ${'CÉL'.padEnd(4)} ${'CADASTRADA'.padEnd(11)} ${'TEL NO CADASTRO'.padEnd(18)} TELEFONE(S) NA CÉLULA`)
let semCadastro = 0, semTelNoCadastro = 0, divergente = 0
for (const p of [...porPessoa.values()].sort((a, b) => b.celulas - a.celulas)) {
  const f = porNome.get(norm(p.nome))
  const telBase = String(f?.telefone || '').trim()
  const tels = [...p.tels]
  const igual = telBase && tels.some(t => soDigitos(t).endsWith(soDigitos(telBase).slice(-8)))
  if (!f) semCadastro++
  else if (!telBase) semTelNoCadastro++
  else if (!igual) divergente++
  const marca = !f ? 'não' : (!telBase ? 'sim (vazio)' : (igual ? 'sim (=)' : 'sim (≠)'))
  console.log(`  ${p.nome.slice(0, 28).padEnd(28)} ${String(p.celulas).padEnd(4)} ${(f ? 'sim' : 'NÃO').padEnd(11)} ${(telBase || '—').padEnd(18)} ${tels.join(' · ')}   ${marca}`)
}
console.log(`\nresumo: ${semCadastro} não cadastradas · ${semTelNoCadastro} cadastradas sem telefone · ${divergente} com telefone diferente do da célula`)
console.log(`\n(nenhuma alteração foi feita — isto é só leitura)`)
