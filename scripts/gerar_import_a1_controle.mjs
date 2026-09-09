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

const PAI = 'paulistao-a1'
const FILHO = 'paulistao-a1-periferico'

const DIAS = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo']
const STATUS = ['Confirmado', 'Reservado', 'Pendente', 'Cancelado', 'Em andamento', 'Aguardando', 'Alteração']
const SN = ['Sim', 'Não']
const PADROES = ['B1', 'B2', 'B2 +', 'B3', 'FeedB']
const DETENTORES = ['HBO MAX', 'HBO/TNT', 'YTCazeTV/Record/HBO', 'Todos']

// [indiceNoCSV, chave, rotulo, tipo, opcoes, largura, grupo, fixa, corDeStatus]
// MAPEADO POR INDICE, nao por nome: a planilha repete cinco cabecalhos
// (Reserva, Status, Transponder, Uplink, Downlink) nos dois blocos de satelite.
const COLS = [
  [0, 'rod', 'Rod', 'text', [], 50, 'Jogo', true, false],
  [2, 'data', 'Data', 'text', [], 62, 'Jogo', true, false],
  [4, 'mandante', 'Mandante', 'text', [], 120, 'Jogo', true, false],
  [6, 'visitante', 'Visitante', 'text', [], 120, 'Jogo', true, false],
  [1, 'dia', 'Dia', 'select', DIAS, 100, 'Jogo', false, false],
  [3, 'hora_brt', 'Hora BRT', 'text', [], 72, 'Jogo', false, false],
  [7, 'estadio', 'Estádio', 'text', [], 150, 'Jogo', false, false],
  [8, 'cidade', 'Cidade', 'text', [], 120, 'Jogo', false, false],
  [9, 'padrao', 'Padrão', 'select', PADROES, 72, 'Jogo', false, false],
  [10, 'detentor', 'Detentor', 'select', DETENTORES, 165, 'Jogo', false, false],
  [32, 'status', 'Status', 'select', STATUS, 110, 'Jogo', false, true],

  [11, 'um', 'UM', 'text', [], 130, 'Equipe Técnica', false, false],
  [12, 'nome_numero', 'Nome/N°', 'text', [], 110, 'Equipe Técnica', false, false],
  [13, 'sng', 'SNG', 'text', [], 110, 'Equipe Técnica', false, false],
  [14, 'camera_by', 'Camera By', 'simnao', SN, 95, 'Equipe Técnica', false, false],
  [15, 'gerador', 'Gerador', 'text', [], 110, 'Equipe Técnica', false, false],
  [16, 'um_virtual', 'UM Virtual', 'simnao', SN, 98, 'Equipe Técnica', false, false],
  [17, 'supervisor_um_host', 'Supervisor UM/Host', 'text', [], 200, 'Equipe Técnica', false, false],
  [18, 'liveu', 'LiveU', 'text', [], 100, 'Equipe Técnica', false, false],
  [19, 'sup_virtual', 'Sup. Virtual', 'text', [], 200, 'Equipe Técnica', false, false],
  [20, 'dtv', 'DTV', 'text', [], 130, 'Equipe Técnica', false, false],
  [21, 'op_vmix', 'Op. Vmix', 'text', [], 155, 'Equipe Técnica', false, false],
  [22, 'op_audio', 'Op. Áudio', 'text', [], 140, 'Equipe Técnica', false, false],
  [23, 'teleporto', 'Teleporto', 'text', [], 100, 'Equipe Técnica', false, false],
  [49, 'um_by', 'UM By', 'simnao', SN, 88, 'Equipe Técnica', false, false],

  [24, 'service_start_gmt', 'Service Start (GMT)', 'text', [], 125, 'Horários', false, false],
  [25, 'abertura_brt', 'Abertura (BRT)', 'text', [], 115, 'Horários', false, false],
  [26, 'service_end_gmt', 'Service End (GMT)', 'text', [], 125, 'Horários', false, false],
  [27, 'fechamento_brt', 'Fechamento (BRT)', 'text', [], 125, 'Horários', false, false],
  [28, 'total_horas', 'Total de horas', 'text', [], 105, 'Horários', false, false],

  [30, 'satelite', 'Satélite', 'text', [], 95, 'Satélite', false, false],
  [29, 'banda', 'Banda', 'text', [], 80, 'Satélite', false, false],
  [31, 'reserva', 'Reserva', 'text', [], 95, 'Satélite', false, false],
  [33, 'transponder', 'Transponder', 'text', [], 170, 'Satélite', false, false],
  [34, 'uplink', 'Uplink', 'text', [], 110, 'Satélite', false, false],
  [35, 'downlink', 'Downlink', 'text', [], 110, 'Satélite', false, false],

  [36, 'satelite_feedb', 'Satélite FEED B', 'text', [], 115, 'FEED B', false, false],
  [37, 'reserva_feedb', 'Reserva FEED B', 'text', [], 115, 'FEED B', false, false],
  [38, 'status_feedb', 'Status FEED B', 'select', STATUS, 115, 'FEED B', false, false],
  [39, 'transponder_feedb', 'Transponder FEED B', 'text', [], 170, 'FEED B', false, false],
  [40, 'uplink_feedb', 'Uplink FEED B', 'text', [], 120, 'FEED B', false, false],
  [41, 'downlink_feedb', 'Downlink FEED B', 'text', [], 120, 'FEED B', false, false],

  [42, 'aspecto', 'Aspecto', 'text', [], 80, 'Técnico', false, false],
  [43, 'compressao', 'Compressão', 'text', [], 105, 'Técnico', false, false],
  [44, 'transmissao', 'Transmissão', 'text', [], 105, 'Técnico', false, false],
  [45, 'modulacao', 'Modulação', 'text', [], 135, 'Técnico', false, false],
  [46, 'sr', 'SR', 'text', [], 70, 'Técnico', false, false],
  [47, 'fec', 'FEC', 'text', [], 65, 'Técnico', false, false],
  [48, 'biss_code', 'BISS Code', 'text', [], 135, 'Técnico', false, false],
]

// Mesmo fornecedor com grafias diferentes na planilha
const APELIDO = { 'multvideo.': 'Multvideo' }
function limpar(v) {
  const s = String(v ?? '').trim()
  if (!s || s === '#VALUE!' || s === '-') return ''
  return APELIDO[s.toLowerCase()] || s
}

const rows = parseCSV(readFileSync(process.argv[2], 'utf8').replace(/^﻿/, ''))
const brutos = rows.slice(1).filter(r => r.some(c => String(c).trim()))
const jogos = brutos.filter(r => String(r[4] ?? '').trim() && String(r[6] ?? '').trim())

const aspas = s => String(s).split("'").join("''")
const L = []

L.push('-- ============================================================')
L.push('-- Paulistao A1 26 - parte OPERACIONAL (Controle) + reorganizacao')
L.push('-- Gerado de: Planilha de controle - Paulistao A1 26')
L.push(`-- ${jogos.length} jogos - ${COLS.length} colunas`)
L.push('--')
L.push('-- O A1 fica com DUAS abas, como o Brasileirao:')
L.push('--   Controle   = esta planilha operacional (nova)')
L.push('--   Periferico = os 74 jogos de perifericos importados em 09/09,')
L.push('--                que saem do Controle para uma secao propria')
L.push('--')
L.push('-- NAO toca em Brasileirao nem Paulistao Feminino.')
L.push('-- Rodar de novo nao duplica nada.')
L.push('-- ============================================================')
L.push('')
L.push('BEGIN;')
L.push('')
L.push('-- ── 1) A secao Periferico (filha do Paulistao A1) ────────────────────')
L.push('INSERT INTO competitions (slug, label, accent_color, accent_bg, template_key, section_kind, sort_order, parent_competition_id)')
L.push(`SELECT '${FILHO}', 'Periférico A1 26', '#B91C1C', '#1a0606', 'dynamic', 'periferico', 31, p.id`)
L.push(`FROM competitions p WHERE p.slug = '${PAI}'`)
L.push(`  AND NOT EXISTS (SELECT 1 FROM competitions WHERE slug = '${FILHO}');`)
L.push('')
L.push('-- ── 2) Move as 37 colunas de periferico do Controle para a secao nova ─')
L.push('--    (as de identidade do jogo vao junto: cada secao tem as suas,')
L.push('--     igual ao Brasileirao, onde as duas tabelas repetem rod/data/times)')
L.push(`UPDATE competition_columns SET competition_id = (SELECT id FROM competitions WHERE slug = '${FILHO}')`)
L.push(`WHERE competition_id = (SELECT id FROM competitions WHERE slug = '${PAI}')`)
L.push("  AND key IN ('rod','data','mandante','visitante','dia','hora_brt','estadio','cidade',")
L.push("             'padrao','detentor','credenciamento','drone','fornecedor_drone','minidrone',")
L.push("             'fornecedor_minidrone','dslr','fornecedor_dslr','qtde_dslr','golcam',")
L.push("             'fornecedor_golcam','earcam','fornecedor_earcam','ultracam','fornecedor_ultracam',")
L.push("             'grua','fornecedor_grua','carrinho','fornecedor_carrinho','klover',")
L.push("             'fornecedor_klover','micros_especiais','fornecedor_micros','internet_led',")
L.push("             'fornecedor_internet_led','assinatura_craque','cadeirao','fornecedor_cadeirao');")
L.push('')
L.push('-- ── 3) Move os 74 jogos de periferico para a secao nova ──────────────')
L.push(`UPDATE competition_events SET competition_id = (SELECT id FROM competitions WHERE slug = '${FILHO}')`)
L.push(`WHERE competition_id = (SELECT id FROM competitions WHERE slug = '${PAI}');`)
L.push('')
L.push('-- ── 4) fornecedor_micros -> fornecedor_micros_especiais ──────────────')
L.push('--    A tela de perifericos descobre o fornecedor pela convencao')
L.push('--    fornecedor_<chave>; com o nome curto, o par de "Micros Especiais"')
L.push('--    nao era encontrado. Renomeia a coluna E a chave dentro do JSONB.')
L.push('UPDATE competition_columns SET key = \'fornecedor_micros_especiais\'')
L.push(`WHERE competition_id = (SELECT id FROM competitions WHERE slug = '${FILHO}')`)
L.push("  AND key = 'fornecedor_micros';")
L.push('')
L.push('UPDATE competition_events')
L.push("SET data = (data - 'fornecedor_micros')")
L.push("           || jsonb_build_object('fornecedor_micros_especiais', data->>'fornecedor_micros')")
L.push(`WHERE competition_id = (SELECT id FROM competitions WHERE slug = '${FILHO}')`)
L.push("  AND data ? 'fornecedor_micros';")
L.push('')
L.push('-- ── 5) As colunas do Controle (operacional) ──────────────────────────')
L.push('INSERT INTO competition_columns (competition_id, key, label, type, options, width, col_group, sticky, status_color, sort_order)')
L.push('SELECT c.id, v.key, v.label, v.type, v.options::jsonb, v.width, v.col_group, v.sticky, v.status_color, v.sort_order')
L.push('FROM competitions c, (VALUES')
L.push(COLS.map(([, k, lab, tipo, ops, w, g, fix, sc], i) =>
  `  ('${aspas(k)}', '${aspas(lab)}', '${tipo}', '${aspas(JSON.stringify(ops))}', ${w}, '${aspas(g)}', ${fix}, ${sc}, ${(i + 1) * 10})`
).join(',\n'))
L.push(') AS v(key, label, type, options, width, col_group, sticky, status_color, sort_order)')
L.push(`WHERE c.slug = '${PAI}'`)
L.push('ON CONFLICT (competition_id, key) DO NOTHING;')
L.push('')
L.push(`-- ── 6) Os ${jogos.length} jogos do Controle ─────────────────────────────────────`)
L.push('--    status vai na COLUNA status (nao no JSONB): useCompetitionEvents')
L.push('--    trata \'status\' como campo de primeiro nivel.')
L.push('INSERT INTO competition_events (competition_id, data, status)')
L.push('SELECT c.id, v.data::jsonb, NULLIF(v.status, \'\')')
L.push('FROM competitions c, (VALUES')
L.push(jogos.map(r => {
  const d = {}
  let st = ''
  for (const [idx, k] of COLS) {
    const v = limpar(r[idx])
    if (!v) continue
    if (k === 'status') st = v
    else d[k] = v
  }
  return `  ('${aspas(JSON.stringify(d))}', '${aspas(st)}')`
}).join(',\n'))
L.push(') AS v(data, status)')
L.push(`WHERE c.slug = '${PAI}'`)
L.push(`  AND NOT EXISTS (SELECT 1 FROM competition_events e WHERE e.competition_id = c.id);`)
L.push('')
L.push('COMMIT;')
L.push('')
L.push('-- ── Conferencia ──────────────────────────────────────────────────────')
L.push(`-- Esperado: Controle = ${jogos.length} jogos / ${COLS.length} colunas`)
L.push('--           Periferico = 74 jogos / 37 colunas')
L.push('SELECT c.label, c.section_kind,')
L.push('       (SELECT count(*) FROM competition_events e WHERE e.competition_id = c.id) AS jogos,')
L.push('       (SELECT count(*) FROM competition_columns k WHERE k.competition_id = c.id) AS colunas')
L.push(`FROM competitions c WHERE c.slug IN ('${PAI}', '${FILHO}') ORDER BY c.sort_order;`)
L.push('')
L.push('-- Nenhum resultado aqui = a renomeacao do fornecedor de micros terminou')
L.push("SELECT count(*) AS sobrou_fornecedor_micros FROM competition_events")
L.push("WHERE data ? 'fornecedor_micros';")

writeFileSync(process.argv[3], L.join('\n'), 'utf8')

// Relatorio
const trocas = {}
jogos.forEach(r => COLS.forEach(([idx]) => {
  const o = String(r[idx] ?? '').trim(); const n = limpar(o)
  if (o && n !== o) { const k = `"${o}" -> "${n}"`; trocas[k] = (trocas[k] || 0) + 1 }
}))
console.log(`jogos: ${jogos.length} | linhas descartadas: ${brutos.length - jogos.length} | colunas: ${COLS.length}`)
console.log('normalizacoes:')
Object.entries(trocas).forEach(([k, n]) => console.log('  ', k, 'x' + n))
const vazias = COLS.filter(([idx]) => jogos.every(r => !limpar(r[idx])))
console.log('colunas 100% vazias na planilha:', vazias.length ? vazias.map(c => c[2]).join(', ') : 'nenhuma')
