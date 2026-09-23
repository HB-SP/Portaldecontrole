// ─── IMPORTA A COPINHA 26 ────────────────────────────────────────────────────
// Duas planilhas viram o par de sempre: Controle + Periférico, no mesmo formato
// dinâmico do Paulistão A1 (competitions / competition_columns /
// competition_events). A produção — produtor e coordenador — NÃO vem daqui:
// ela já está na escala_geral, em 93 linhas de "Copinha 26", e é ligada pelo
// campo `escala_camps`.
//
// A COPINHA ENTRA COMO HISTÓRICO (equipe, 23/09/2026: "só histórico"). Ela
// acabou em janeiro, então as colunas não precisam das listas de opção que o
// A1 tem para escolher status e padrão enquanto o campeonato corre — tudo é
// texto, que é o que preserva o que a planilha diz sem inventar formato.
//
// UMA ARMADILHA NA PLANILHA DE PERIFÉRICOS: ela continua com o PAULISTÃO A1
// depois que a Copinha acaba. Dos 38 jogos, 12 são de fevereiro e 9 desses já
// estão no Periférico A1. Por isso só entram os de JANEIRO.
//
// Uso:
//   node scripts/importar_copinha.mjs            # simulação
//   node scripts/importar_copinha.mjs --gravar

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

const PASTA = 'C:/Users/ajanguas/Downloads'
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

// Espaço duplo, espaço no fim, "-" solto: lixo de digitação que não é dado.
const limpar = v => String(v ?? '').replace(/\s+/g, ' ').trim().replace(/^-+$/, '')

// A chave da coluna sai do cabeçalho: "Hora (BRT)" vira hora_brt.
const chaveDe = rotulo => limpar(rotulo).toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)

// ── o que cada planilha é ───────────────────────────────────────────────────
// `grupo` copia a ideia do Brasileirão: é o que a Visão Geral vira painel.
const PLANILHAS = [
  {
    slug: 'copinha', label: 'Copinha 26', kind: 'controle',
    arquivo: 'Planilha de controle  - Copinha 26 (1).csv',
    cor: '#0F766E', corBg: '#04201d', ordem: 40,
    escalaCamps: ['Copinha 26'],
    // até que índice cada grupo vai (o resto cai em Técnico)
    grupos: [[0, 11, 'Jogo'], [12, 16, 'Equipe Técnica'], [17, 23, 'Transmissão']],
    soJaneiro: false,
  },
  {
    slug: 'copinha-periferico', label: 'Periférico COP26', kind: 'periferico',
    arquivo: 'Planilha de controle  - Copinha 26 Periféricos.csv',
    cor: '#0F766E', corBg: '#04201d', ordem: 41,
    escalaCamps: null,
    grupos: [[0, 10, 'Jogo']],
    soJaneiro: true,   // fevereiro em diante é Paulistão A1, não Copinha
  },
]

const feito = []
for (const p of PLANILHAS) {
  const linhas = lerCsv(`${PASTA}/${p.arquivo}`)
  const cab = linhas[0].map(limpar)
  const iM = cab.findIndex(c => /^mandante/i.test(c))
  const iV = cab.findIndex(c => /^visitante/i.test(c))
  const iD = cab.findIndex(c => /^data/i.test(c))

  // Coluna sem nome no cabeçalho é separador da planilha (o "x" entre os
  // times, colunas de sobra no fim): não vira coluna de tabela.
  const colunas = cab.map((rotulo, idx) => ({ idx, rotulo }))
    .filter(c => c.rotulo && c.idx !== iM + 1)

  let jogos = linhas.slice(1).filter(l => limpar(l[iM]) && limpar(l[iV]))
  const antes = jogos.length
  if (p.soJaneiro) jogos = jogos.filter(l => /^\d{1,2}\/0?1$/.test(limpar(l[iD])))

  const grupoDe = idx => (p.grupos.find(([de, ate]) => idx >= de && idx <= ate) || [])[2] || 'Técnico'
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

  console.log(`\n── ${p.label} ──`)
  console.log(`   ${defs.length} colunas · ${jogos.length} jogos${p.soJaneiro ? ` (de ${antes}; fevereiro em diante é Paulistão)` : ''}`)
  console.log(`   grupos: ${[...new Set(defs.map(d => d.col_group))].join(' · ')}`)
  console.log(`   primeiro: ${limpar(jogos[0][iD])} ${limpar(jogos[0][iM])} x ${limpar(jogos[0][iV])}`)
  console.log(`   último:   ${limpar(jogos.at(-1)[iD])} ${limpar(jogos.at(-1)[iM])} x ${limpar(jogos.at(-1)[iV])}`)
  // COLUNA 100% VAZIA NÃO ENTRA. Numa aba de histórico, ela não guarda nada e
  // só empurra para a direita o que tem conteúdo — a Copinha usou drone e DSLR,
  // e as outras 17 colunas de periférico ficaram em branco o campeonato inteiro.
  // `--tudo` mantém a planilha como está, se um dia for preciso conferir o
  // formato original.
  const vazias = defs.filter(d => eventos.every(e => !e[d.key]))
  if (vazias.length) {
    console.log(`   ${vazias.length} colunas vazias${process.argv.includes('--tudo') ? ' (mantidas)' : ' — fora'}: ${vazias.map(d => d.label).join(', ')}`)
  }
  const usar = process.argv.includes('--tudo') ? defs : defs.filter(d => !vazias.includes(d))
  feito.push({ p, defs: usar, eventos })
}

if (!GRAVAR) { console.log('\n(simulação — passe --gravar)'); process.exit(0) }

for (const { p, defs, eventos } of feito) {
  const [comp] = await api('competitions?on_conflict=slug', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify([{
      slug: p.slug, label: p.label, accent_color: p.cor, accent_bg: p.corBg,
      template_key: 'dynamic', section_kind: p.kind, sort_order: p.ordem,
      archived: false, escala_camps: p.escalaCamps,
    }]),
  })

  await api(`competition_columns?competition_id=eq.${comp.id}`, { method: 'DELETE' })
  await api('competition_columns', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(defs.map(({ _idx, ...d }) => ({ ...d, competition_id: comp.id }))),
  })

  await api(`competition_events?competition_id=eq.${comp.id}`, { method: 'DELETE' })
  for (let i = 0; i < eventos.length; i += 100) {
    await api('competition_events', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(eventos.slice(i, i + 100).map(d => ({ competition_id: comp.id, data: d }))),
    })
  }
  console.log(`gravado: ${p.label} — ${defs.length} colunas, ${eventos.length} jogos`)
}

// O filho aponta para o pai: é assim que a tela mostra os dois lado a lado.
const todas = await api('competitions?select=id,slug')
const pai = todas.find(c => c.slug === 'copinha')
await api('competitions?slug=eq.copinha-periferico', {
  method: 'PATCH', headers: { Prefer: 'return=minimal' },
  body: JSON.stringify({ parent_competition_id: pai.id }),
})
console.log('\nPeriférico ligado ao Controle.')
