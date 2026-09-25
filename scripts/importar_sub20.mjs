// ─── IMPORTA O PAULISTÃO SUB 20 ──────────────────────────────────────────────
// Mesmo formato dinâmico do Paulistão A1 e da Copinha (competitions /
// competition_columns / competition_events).
//
// A DIFERENÇA QUE IMPORTA: aqui entra JOGO SEM TIMES.
//
// Os outros importadores só aceitam linha com mandante e visitante preenchidos
// — e está certo para campeonato de tabela fechada, onde linha sem time é lixo
// de planilha. O Sub 20 é mata-mata: a planilha já tem as 12 datas reservadas
// até a final, com satélite, transponder e reserva, mas só duas sabem quem
// joga. As outras dez dizem só a fase — OF, QF, SM, F.
//
// Jogar essas dez fora seria jogar fora o planejamento: o campeonato tem 12
// jogos previstos e a equipe precisa ver isso, não "2 jogos" (equipe,
// 25/09/2026). Entra linha que tenha DATA — é a data que reserva o satélite e
// aloca gente, com ou sem adversário definido.
//
// A produção (produtor, coordenador) não vem daqui: já está na escala_geral,
// em linhas de "PS20", ligadas por `escala_camps`.
//
// Uso:
//   node scripts/importar_sub20.mjs            # simulação
//   node scripts/importar_sub20.mjs --gravar

import { readFileSync } from 'node:fs'

const BASE = 'https://buubjnddzsadzcumrvdt.supabase.co'
const KEY = (readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .find(l => /^SUPABASE_SERVICE_KEY=/.test(l)) || '').split('=').slice(1).join('=').trim()
if (!KEY) { console.error('Sem SUPABASE_SERVICE_KEY em .env.local'); process.exit(1) }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

const api = async (caminho, opcoes = {}) => {
  const r = await fetch(`${BASE}/rest/v1/${caminho}`, { ...opcoes, headers: { ...H, ...(opcoes.headers || {}) } })
  const t = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${caminho} :: ${t.slice(0, 300)}`)
  return t ? JSON.parse(t) : null
}

const ARQUIVO = 'C:/Users/ajanguas/Downloads/Planilha de controle  - Paulistão Sub20 26.csv'
const GRAVAR = process.argv.includes('--gravar')

function lerCsv(caminho) {
  const texto = readFileSync(caminho, 'utf8')
  const linhas = []
  let campo = '', linha = [], dentro = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (dentro) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') dentro = false
      else campo += c
    } else if (c === '"') dentro = true
    else if (c === ',') { linha.push(campo); campo = '' }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = '' }
    else if (c !== '\r') campo += c
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha) }
  return linhas
}

const limpar = v => String(v ?? '').replace(/\s+/g, ' ').trim().replace(/^-+$/, '')

const chaveDe = rotulo => limpar(rotulo).toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)

const SLUG = 'paulistao-sub20'
const LABEL = 'Paulistão Sub 20 26'
// Azul-marinho da família Paulistão, um tom à parte do A1 para não virarem o
// mesmo campeonato de relance. A logo troca isto depois, se vier.
const COR = '#3A4BA0'
const COR_BG = '#0a0f26'
const ORDEM = 50
const GRUPOS = [[0, 11, 'Jogo'], [12, 19, 'Equipe Técnica'], [20, 40, 'Transmissão']]

const linhas = lerCsv(ARQUIVO)
const cab = linhas[0].map(limpar)
const iM = cab.findIndex(c => /^mandante/i.test(c))
const iV = cab.findIndex(c => /^visitante/i.test(c))
const iD = cab.findIndex(c => /^data/i.test(c))
const iR = cab.findIndex(c => /^rod/i.test(c))

// Coluna sem nome é separador da planilha (o "x" entre os times): não vira dado.
const colunas = cab.map((rotulo, idx) => ({ idx, rotulo }))
  .filter(c => c.rotulo && c.idx !== iM + 1)

// AQUI a regra: basta ter data. As linhas totalmente em branco da planilha
// (aquelas de só vírgulas, que separam visualmente) caem fora sozinhas.
const jogos = linhas.slice(1).filter(l => /^\d{1,2}\/\d{1,2}/.test(limpar(l[iD])))
const comTimes = jogos.filter(l => limpar(l[iM]) && limpar(l[iV]))

const grupoDe = idx => (GRUPOS.find(([de, ate]) => idx >= de && idx <= ate) || [])[2] || 'Técnico'
const usadas = new Set()
const defs = colunas.map((c, ordem) => {
  let chave = chaveDe(c.rotulo) || `col_${c.idx}`
  while (usadas.has(chave)) chave += '_2'
  usadas.add(chave)
  return {
    key: chave, label: c.rotulo, type: 'text', options: [],
    width: Math.min(220, Math.max(70, c.rotulo.length * 9 + 30)),
    col_group: grupoDe(c.idx), sticky: [iD, iM, iV].includes(c.idx),
    status_color: /^status$/i.test(c.rotulo), sort_order: (ordem + 1) * 10,
    _idx: c.idx,
  }
})

const eventos = jogos.map(l => {
  const d = {}
  defs.forEach(def => { const v = limpar(l[def._idx]); if (v) d[def.key] = v })
  return d
})

console.log(`\n── ${LABEL} ──`)
console.log(`   ${defs.length} colunas · ${jogos.length} jogos previstos, ${comTimes.length} com os times já definidos`)
console.log(`   grupos: ${[...new Set(defs.map(d => d.col_group))].join(' · ')}`)
console.log('\n   os jogos:')
for (const l of jogos) {
  const m = limpar(l[iM]), v = limpar(l[iV])
  console.log(`     ${limpar(l[iD]).padEnd(6)} ${limpar(l[iR]).padEnd(8)} ${m && v ? `${m} × ${v}` : '— a definir —'}`)
}

const vazias = defs.filter(d => eventos.every(e => !e[d.key]))
if (vazias.length) console.log(`\n   ${vazias.length} colunas vazias, fora: ${vazias.map(d => d.label).join(', ')}`)
const usar = defs.filter(d => !vazias.includes(d))

if (!GRAVAR) { console.log('\n(simulação — passe --gravar)'); process.exit(0) }

const [comp] = await api('competitions?on_conflict=slug', {
  method: 'POST',
  headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify([{
    slug: SLUG, label: LABEL, accent_color: COR, accent_bg: COR_BG,
    template_key: 'dynamic', section_kind: 'controle', sort_order: ORDEM,
    archived: false, escala_camps: ['PS20'],
  }]),
})

await api(`competition_columns?competition_id=eq.${comp.id}`, { method: 'DELETE' })
await api('competition_columns', {
  method: 'POST', headers: { Prefer: 'return=minimal' },
  body: JSON.stringify(usar.map(({ _idx, ...d }) => ({ ...d, competition_id: comp.id }))),
})

await api(`competition_events?competition_id=eq.${comp.id}`, { method: 'DELETE' })
await api('competition_events', {
  method: 'POST', headers: { Prefer: 'return=minimal' },
  body: JSON.stringify(eventos.map(d => ({ competition_id: comp.id, data: d }))),
})

console.log(`\ngravado: ${LABEL} — ${usar.length} colunas, ${eventos.length} jogos`)
