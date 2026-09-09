import { readFileSync, writeFileSync } from 'node:fs'

function parseCSV(t) {
  const rs = []; let r = [], c = '', q = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { c += '"'; i++ }
      else if (ch === '"') q = false
      else c += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { r.push(c); c = '' }
    else if (ch === '\r') { /* ignora */ }
    else if (ch === '\n') { r.push(c); rs.push(r); r = []; c = '' }
    else c += ch
  }
  if (c || r.length) { r.push(c); rs.push(r) }
  return rs
}

const SLUG = 'paulistao-a1'
const SN = ['Sim', 'Não', 'Aguardando OK']
const CRED = ['Enviado', 'Parcial', 'Pendente', 'Alteração']

// [chaveNoBanco, rotulo, cabecalhoNoCSV, tipo, opcoes, largura, grupo, fixa]
// As 4 primeiras sao "fixas" (sticky): ficam visiveis ao rolar para o lado.
// Precisam ser as PRIMEIRAS da lista — o offset e cumulativo (ver configForRow).
const COLS = [
  ['rod', 'Rod', 'Rod', 'text', [], 50, 'Jogo', true],
  ['data', 'Data', 'Data', 'text', [], 62, 'Jogo', true],
  ['mandante', 'Mandante', 'Mandante', 'text', [], 120, 'Jogo', true],
  ['visitante', 'Visitante', 'Visitante', 'text', [], 120, 'Jogo', true],
  ['dia', 'Dia', 'Dia', 'text', [], 88, 'Jogo', false],
  ['hora_brt', 'Hora BRT', 'Hora (BRT)', 'text', [], 72, 'Jogo', false],
  ['estadio', 'Estádio', 'Estádio', 'text', [], 150, 'Jogo', false],
  ['cidade', 'Cidade', 'Cidade', 'text', [], 120, 'Jogo', false],
  ['padrao', 'Padrão', 'Padrão', 'text', [], 62, 'Jogo', false],
  ['detentor', 'Detentor', 'Detentor', 'text', [], 150, 'Jogo', false],
  ['credenciamento', 'Credenciamento', 'Credenciamento', 'select', CRED, 115, 'Credenciamento', false],
  ['drone', 'Drone', 'Drone', 'select', SN, 78, 'Aéreo', false],
  ['fornecedor_drone', 'Forn. Drone', 'Fornecedor - Drone', 'text', [], 120, 'Aéreo', false],
  ['minidrone', 'MiniDrone', 'MiniDrone', 'select', SN, 88, 'Aéreo', false],
  ['fornecedor_minidrone', 'Forn. MiniDrone', 'Fornecedor - MiniDrone', 'text', [], 125, 'Aéreo', false],
  ['dslr', 'DSLR', 'DSLR', 'select', SN, 72, 'Câmeras', false],
  ['fornecedor_dslr', 'Forn. DSLR', 'Fornecedor - DSLR', 'text', [], 120, 'Câmeras', false],
  ['qtde_dslr', 'Qtde DSLR', 'Qtde. DSLR', 'text', [], 72, 'Câmeras', false],
  ['golcam', 'GolCam', 'GolCam', 'select', SN, 78, 'Câmeras', false],
  ['fornecedor_golcam', 'Forn. GolCam', 'Fornecedor GolCam', 'text', [], 120, 'Câmeras', false],
  ['earcam', 'EarCam', 'EarCam', 'select', SN, 78, 'Câmeras', false],
  ['fornecedor_earcam', 'Forn. EarCam', 'Fornecedor - EarCam', 'text', [], 120, 'Câmeras', false],
  ['ultracam', 'UltraCam', 'UltraCam', 'select', SN, 85, 'Câmeras', false],
  ['fornecedor_ultracam', 'Forn. UltraCam', 'Fornecedor UltraCam', 'text', [], 125, 'Câmeras', false],
  ['grua', 'Grua', 'Grua', 'select', SN, 72, 'Movimento', false],
  ['fornecedor_grua', 'Forn. Grua', 'Fornecedor - Grua', 'text', [], 120, 'Movimento', false],
  ['carrinho', 'Carrinho', 'Carrinho', 'select', SN, 82, 'Movimento', false],
  ['fornecedor_carrinho', 'Forn. Carrinho', 'Fornecedor - Carrinho', 'text', [], 125, 'Movimento', false],
  ['klover', 'Klover', 'Klover', 'select', SN, 72, 'Áudio', false],
  ['fornecedor_klover', 'Forn. Klover', 'Fornecedor Klover', 'text', [], 120, 'Áudio', false],
  ['micros_especiais', 'Micros Especiais', 'Micros Especiais', 'select', SN, 110, 'Áudio', false],
  ['fornecedor_micros', 'Forn. Micros', 'Fornecedor - Micros', 'text', [], 120, 'Áudio', false],
  ['internet_led', 'Internet LED', 'Internet LED', 'select', SN, 98, 'Extras', false],
  ['fornecedor_internet_led', 'Forn. Internet LED', 'Fornecedor - INTERNET LED', 'text', [], 135, 'Extras', false],
  ['assinatura_craque', 'Assinatura Craque', 'Assinatura Craque', 'select', SN, 120, 'Extras', false],
  ['cadeirao', 'Cadeirão', 'Cadeirão', 'select', SN, 82, 'Extras', false],
  ['fornecedor_cadeirao', 'Forn. Cadeirão', 'Fornecedor - Cadeirão', 'text', [], 125, 'Extras', false],
]

// Mesma empresa escrita de dois jeitos na planilha -> grafia mais usada
const APELIDO = { denadai: 'D Nadai', onesolve: 'OneSolve' }
function limpar(v) {
  const s = String(v ?? '').trim()
  if (!s || s === '#VALUE!' || s === '-') return ''
  return APELIDO[s.toLowerCase()] || s
}

const rows = parseCSV(readFileSync(process.argv[2], 'utf8').replace(/^﻿/, ''))
const H = rows[0].map(h => h.trim())
const brutos = rows.slice(1).filter(r => r.some(c => String(c).trim()))
const objs = brutos
  .map(r => { const o = {}; H.forEach((h, i) => { o[h] = (r[i] ?? '').trim() }); return o })
  .filter(o => o['Mandante'] && o['Visitante'])   // descarta a linha vazia do fim

const aspas = s => String(s).split("'").join("''")

const L = []
L.push('-- ============================================================')
L.push('-- Paulistao A1 26 - Perifericos (historico)')
L.push('-- Gerado de: Planilha de controle - Paulistao Perifericos A1 26')
L.push(`-- ${objs.length} jogos - ${COLS.length} colunas`)
L.push('--')
L.push('-- Cria o campeonato no Portal e carrega os jogos.')
L.push('-- NAO toca em Brasileirao, Paulistao Feminino, nem em nenhuma')
L.push('-- tabela que ja existe. Rodar de novo NAO duplica nada.')
L.push('-- ============================================================')
L.push('')
L.push('BEGIN;')
L.push('')
L.push('-- 1) O campeonato (nada acontece se o slug ja existir)')
L.push('INSERT INTO competitions (slug, label, accent_color, accent_bg, template_key, section_kind, sort_order)')
L.push(`SELECT '${SLUG}', 'Paulistão A1 26', '#DC2626', '#1a0606', 'dynamic', 'controle', 30`)
L.push(`WHERE NOT EXISTS (SELECT 1 FROM competitions WHERE slug = '${SLUG}');`)
L.push('')
L.push('-- 2) As colunas')
L.push('INSERT INTO competition_columns (competition_id, key, label, type, options, width, col_group, sticky, sort_order)')
L.push('SELECT c.id, v.key, v.label, v.type, v.options::jsonb, v.width, v.col_group, v.sticky, v.sort_order')
L.push('FROM competitions c, (VALUES')
L.push(COLS.map(([k, lab, , tipo, ops, w, g, fix], i) =>
  `  ('${aspas(k)}', '${aspas(lab)}', '${tipo}', '${aspas(JSON.stringify(ops))}', ${w}, '${aspas(g)}', ${fix}, ${(i + 1) * 10})`
).join(',\n'))
L.push(') AS v(key, label, type, options, width, col_group, sticky, sort_order)')
L.push(`WHERE c.slug = '${SLUG}'`)
L.push('ON CONFLICT (competition_id, key) DO NOTHING;')
L.push('')
L.push(`-- 3) Os ${objs.length} jogos (so entra se o campeonato ainda estiver vazio)`)
L.push('INSERT INTO competition_events (competition_id, data)')
L.push('SELECT c.id, v.data::jsonb')
L.push('FROM competitions c, (VALUES')
L.push(objs.map(o => {
  const d = {}
  for (const [k, , csvH] of COLS) { const v = limpar(o[csvH]); if (v) d[k] = v }
  return `  ('${aspas(JSON.stringify(d))}')`
}).join(',\n'))
L.push(') AS v(data)')
L.push(`WHERE c.slug = '${SLUG}'`)
L.push('  AND NOT EXISTS (SELECT 1 FROM competition_events e WHERE e.competition_id = c.id);')
L.push('')
L.push('COMMIT;')
L.push('')
L.push(`-- Conferencia: deve mostrar ${objs.length} jogos e ${COLS.length} colunas`)
L.push('SELECT c.label,')
L.push('       (SELECT count(*) FROM competition_events e WHERE e.competition_id = c.id) AS jogos,')
L.push('       (SELECT count(*) FROM competition_columns k WHERE k.competition_id = c.id) AS colunas')
L.push(`FROM competitions c WHERE c.slug = '${SLUG}';`)

writeFileSync(process.argv[3], L.join('\n'), 'utf8')

// Relatorio
const trocas = {}
COLS.filter(c => /^fornecedor/.test(c[0])).forEach(([, , csvH]) =>
  objs.forEach(o => {
    const orig = String(o[csvH] ?? '').trim()
    const novo = limpar(orig)
    if (orig && novo !== orig) { const k = `"${orig}" -> "${novo}"`; trocas[k] = (trocas[k] || 0) + 1 }
  }))
console.log('jogos gravados:', objs.length, '| linhas descartadas:', brutos.length - objs.length)
console.log('normalizacoes aplicadas:')
Object.entries(trocas).forEach(([k, n]) => console.log('  ', k, 'x' + n))
const vazias = objs.filter(o => !COLS.some(([k, , h]) => /^(drone|dslr|grua|golcam|internet_led)$/.test(k) && limpar(o[h])))
console.log('jogos sem nenhum periferico marcado:', vazias.length)
