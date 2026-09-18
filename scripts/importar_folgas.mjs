// ─── IMPORTA AS DUAS PLANILHAS DE ESCALA DE TIME ─────────────────────────────
// "Planejamento HB LiveMode - Time Sinal Inter" e "ESCALA - Equipe HB OPERAÇÕES"
// viram uma coisa só: folgas_times / folgas_pessoas / folgas_categorias /
// folgas_dias.
//
// O ANO não está escrito em lugar nenhum das planilhas — só "dd/mm". Ele é
// inferido pela virada do mês, e a inferência foi PROVADA contra fatos
// datados antes de virar import:
//   · Sinal Inter começa em 05/2024: assim o "SORTEIO - Copinha 2026" cai em
//     25/11/2025 (quando o sorteio aconteceu), o Mundial de Clubes em
//     jun-jul/2025 e a Copa do Mundo em jun-jul/2026. Começando em 2025, o
//     sorteio cairia depois do próprio torneio.
//   · Operações é 2026: a planilha diz que 01/01 é quinta-feira, o que só vale
//     em 2026, e a Copa do Mundo cai em jun-jul.
//
// NADA se perde: o texto original que não casa com uma categoria conhecida vai
// inteiro para o campo `detalhe`, na categoria "Outro". Dá para reclassificar
// depois, na tela, sem voltar ao CSV.
//
// Uso:
//   node scripts/importar_folgas.mjs            # simulação, não grava
//   node scripts/importar_folgas.mjs --gravar   # grava
//   node scripts/importar_folgas.mjs --conferir # relê do banco e compara

import { readFileSync } from 'node:fs'

const BASE = 'https://buubjnddzsadzcumrvdt.supabase.co'
const KEY = (readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .find(l => /^SUPABASE_SERVICE_KEY=/.test(l)) || '').split('=').slice(1).join('=').trim()
if (!KEY) { console.error('Sem SUPABASE_SERVICE_KEY em .env.local'); process.exit(1) }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

async function api(caminho, opcoes = {}) {
  const r = await fetch(`${BASE}/rest/v1/${caminho}`, { ...opcoes, headers: { ...H, ...(opcoes.headers || {}) } })
  const t = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${caminho} :: ${t.slice(0, 400)}`)
  return t ? JSON.parse(t) : null
}

const PASTA = 'C:/Users/ajanguas/Downloads'
const gravar = process.argv.includes('--gravar')
const conferir = process.argv.includes('--conferir')

// ── CSV ──────────────────────────────────────────────────────────────────────
function lerCsv(caminho) {
  const texto = readFileSync(caminho, 'utf8')
  const linhas = []
  let campo = '', linha = [], dentro = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (dentro) {
      if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++ } else dentro = false }
      else campo += c
    } else if (c === '"') dentro = true
    else if (c === ',') { linha.push(campo); campo = '' }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = '' }
    else if (c !== '\r') campo += c
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha) }
  return linhas
}
const ehData = s => /^\d{1,2}\/\d{1,2}$/.test(String(s || '').trim())
const iso = (a, m, d) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

// ── as categorias ────────────────────────────────────────────────────────────
// "Escritório" (Operações) e "Vila Olímpia" (Sinal Inter) são o mesmo lugar
// chamado por dois nomes — viram uma categoria só, padronizada em "Vila
// Olímpia" (decisão da equipe, 18/09/2026). O id segue "escritorio" porque ele
// nunca aparece na tela e trocá-lo obrigaria a reescrever os dias que apontam
// para ele.
const CATEGORIAS = [
  { id: 'folga',        nome: 'Folga',        curto: 'FOLGA',     cor: '#DC2626', fixa: true, conta_folga: true, ordem: 1 },
  { id: 'ferias',       nome: 'Férias',       curto: 'FÉRIAS',    cor: '#7C3AED', ordem: 2 },
  { id: 'atestado',     nome: 'Atestado',     curto: 'ATESTADO',  cor: '#B45309', ordem: 3 },
  { id: 'home',         nome: 'Home',         curto: 'HOME',      cor: '#2563EB', fixa: true, ordem: 4,
    presets: ['Home', 'Home - MM', 'Home - monitoração'] },
  { id: 'escritorio',   nome: 'Vila Olímpia', curto: 'V. OLÍMPIA', cor: '#475569', ordem: 5 },
  { id: 'casablanca',   nome: 'Casablanca',   curto: 'CASABL.',   cor: '#64748B', ordem: 6, pede_detalhe: true },
  { id: 'livekasa',     nome: 'LiveKasa',     curto: 'LIVEKASA',  cor: '#78716C', ordem: 7, pede_detalhe: true },
  { id: 'sportheca',    nome: 'Sportheca',    curto: 'SPORTHECA', cor: '#57534E', ordem: 8, pede_detalhe: true },
  { id: 'monitoracao',  nome: 'Monitoração',  curto: 'MONIT.',    cor: '#0F766E', ordem: 9, pede_detalhe: true },
  { id: 'externa',      nome: 'Externa',      curto: 'EXTERNA',   cor: '#15803D', ordem: 10,
    pede_detalhe: true, dica_detalhe: 'Evento, cidade ou confronto',
    campeonatos: ['Brasileirão', 'Paulistão', 'Paulistão Feminino', 'Copinha'] },
  { id: 'deslocamento', nome: 'Deslocamento', curto: 'DESLOC.',   cor: '#0891B2', ordem: 11,
    eh_deslocamento: true, pede_detalhe: true, dica_detalhe: 'Cidade — dia de ida ou de volta' },
  { id: 'outro',        nome: 'Outro',        curto: '—',         cor: '#6B7280', ordem: 12,
    pede_detalhe: true, exige_detalhe: true, dica_detalhe: 'Descrição' },
]

// ── quem é quem ──────────────────────────────────────────────────────────────
const TIMES = [
  { id: 'sinal-inter', nome: 'Sinal Inter', cor: '#4C8DFF', ordem: 1 },
  { id: 'operacoes',   nome: 'Operações',   cor: '#65B32E', ordem: 2 },
]

const PLANILHAS = [
  {
    time: 'sinal-inter',
    arquivo: 'Planejamento HB LiveMode - Time Sinal Inter.csv',
    colunas: [2, 4, 6, 8, 10, 12, 14],
    anoInicial: 2024,
  },
  {
    time: 'operacoes',
    arquivo: 'ESCALA - Equipe HB OPERAÇÕES - ESCALA (1).csv',
    colunas: [3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23],
    anoInicial: 2026,
  },
]

const CORES_PESSOA = ['#4C8DFF', '#3ED598', '#F2B84B', '#B98CF2', '#E6483C', '#5B8DEF', '#6B7686',
  '#0891B2', '#B45309', '#7C3AED', '#0F766E']

// ── de texto livre para categoria ────────────────────────────────────────────
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ').trim()

// Ordem importa: a primeira regra que casar leva. `detalhe` guarda o texto
// original sempre que ele diz mais do que o nome da categoria.
const REGRAS = [
  // Uma pessoa cobrindo um jogo DE CASA ("by PAL x FER (home)") está em home,
  // não externa — por isso esta regra vem antes da de confronto.
  [/\(home\)|- lk$|home$/, 'home'],
  [/^ferias|^sugestao ferias/, 'ferias'],
  [/^folga/, 'folga'],
  [/^atestado|^licenca|^afastad/, 'atestado'],
  [/^home|^base\/home/, 'home'],
  [/escritorio|vila olimpia/, 'escritorio'],
  [/casablanca/, 'casablanca'],
  [/livekasa|liveksa|live kasa/, 'livekasa'],
  [/sportheca/, 'sportheca'],
  [/^monitoracao$/, 'monitoracao'],
  [/^externa/, 'externa'],
  [/^deslocamento|^viagem|^ida |^volta /, 'deslocamento'],
  // Um confronto é trabalho externo. A maior parte vem com o campeonato na
  // frente ("BR26 - COR x FLA", "P26 - PAL x SPFC", "PFem - SAN x PAL"), e é
  // desse prefixo que sai o campo `campeonato` — ver CAMPEONATO_PREFIXO.
  [/ x /, 'externa'],
  // Eventos e torneios com nome próprio.
  [/copa|copinha|mundial|nfl|summit|workshop|blackout|kickoff|final|premiac|sorteio|preparativos|fpf|plantao|teleporto|assuncao|rodada|quartas|semi/, 'externa'],
  // Cidade sozinha na célula = a pessoa está trabalhando fora. A lista vem dos
  // nomes que REALMENTE aparecem nas planilhas, não de um cadastro de cidades.
  [/^(rio de janeiro|rj|sao paulo - sp|paris|belo horizonte|bh|fortaleza|portugal|curitiba|novo horizonte|porto alegre|poa|chapeco|sao carlos|brasilia|recife|barueri|salvador|goiania|campinas|ribeirao preto|bragança paulista|braganca paulista|londres|madri|nova york)$/, 'externa'],
]

// Prefixo do campeonato no texto do jogo → nome do campeonato.
const CAMPEONATO_PREFIXO = [
  [/^pfem\b|^pf\d*\b|fem$|- fem\b/i, 'Paulistão Feminino'],
  [/^br\d*\b|^brasileirao/i, 'Brasileirão'],
  [/^copinha\b|copinha/i, 'Copinha'],
  [/^p\d+\b|^paulistao/i, 'Paulistão'],
]
function campeonatoDe(bruto) {
  const v = String(bruto || '').trim()
  for (const [re, nome] of CAMPEONATO_PREFIXO) if (re.test(v)) return nome
  return null
}

function classificar(bruto) {
  const v = norm(bruto)
  if (!v || v === '-' || v === '--') return null
  for (const [re, cat] of REGRAS) {
    if (!re.test(v)) continue
    // O detalhe só entra quando o texto diz mais que o nome da categoria.
    const cd = CATEGORIAS.find(c => c.id === cat)
    const soONome = norm(cd.nome) === v || norm(cd.curto) === v
    return {
      categoria_id: cat,
      detalhe: soONome ? null : String(bruto).trim(),
      campeonato: cat === 'externa' ? campeonatoDe(bruto) : null,
    }
  }
  return { categoria_id: 'outro', detalhe: String(bruto).trim() }
}

// ── lê as planilhas ──────────────────────────────────────────────────────────
function lerPlanilha(p) {
  const linhas = lerCsv(`${PASTA}/${p.arquivo}`)
  const pessoas = p.colunas.map((i, k) => ({ col: i, nome: (linhas[0][i] || '').trim(), ordem: k + 1 }))
    .filter(x => x.nome)
  let ano = p.anoInicial, mesAnterior = null
  const dias = []
  for (const l of linhas) {
    if (!ehData(l[0])) continue
    const [d, m] = l[0].trim().split('/').map(Number)
    if (mesAnterior !== null && m < mesAnterior) ano++
    mesAnterior = m
    for (const pes of pessoas) {
      const bruto = String(l[pes.col] ?? '').trim()
      if (!bruto) continue
      const c = classificar(bruto)
      if (c) dias.push({ pessoa: pes.nome, dia: iso(ano, m, d), bruto, ...c })
    }
  }
  return { pessoas, dias }
}

const lidas = PLANILHAS.map(p => ({ ...p, ...lerPlanilha(p) }))

// ── relatório da simulação ───────────────────────────────────────────────────
console.log('═'.repeat(76))
console.log('LEITURA DAS PLANILHAS')
console.log('═'.repeat(76))
for (const p of lidas) {
  const anos = new Map()
  p.dias.forEach(d => anos.set(d.dia.slice(0, 4), (anos.get(d.dia.slice(0, 4)) || 0) + 1))
  console.log(`\n${p.time} — ${p.pessoas.length} pessoas, ${p.dias.length} dias preenchidos`)
  console.log(`  pessoas: ${p.pessoas.map(x => x.nome).join(', ')}`)
  console.log(`  por ano: ${[...anos.entries()].sort().map(([a, n]) => `${a}=${n}`).join('  ')}`)
  const porCat = new Map()
  p.dias.forEach(d => porCat.set(d.categoria_id, (porCat.get(d.categoria_id) || 0) + 1))
  console.log('  por categoria:')
  for (const [c, n] of [...porCat.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(5)}  ${String(Math.round(n / p.dias.length * 100)).padStart(3)}%  ${c}`)
  }
  const outros = p.dias.filter(d => d.categoria_id === 'outro')
  if (outros.length) {
    const t = new Map()
    outros.forEach(d => t.set(d.bruto, (t.get(d.bruto) || 0) + 1))
    console.log(`  caíram em "Outro" (texto preservado): ${t.size} textos, ${outros.length} dias`)
    ;[...t.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
      .forEach(([v, n]) => console.log(`      ${String(n).padStart(4)}×  ${v}`))
  }
}

if (!gravar && !conferir) {
  console.log(`\n${'─'.repeat(76)}\nSIMULAÇÃO — nada foi gravado. Rode com --gravar para valer.`)
  process.exit(0)
}

// ── grava ────────────────────────────────────────────────────────────────────
if (gravar) {
  console.log(`\n${'═'.repeat(76)}\nGRAVANDO\n${'═'.repeat(76)}`)

  await api('folgas_times', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(TIMES),
  })
  console.log(`  times: ${TIMES.length}`)

  // O PostgREST recusa um lote em que os objetos não têm exatamente as mesmas
  // chaves ("All object keys must match"), então o que está omitido acima vira
  // o padrão aqui em vez de simplesmente faltar.
  const PADRAO_CATEGORIA = {
    curto: null, cor: null, time_id: null, fixa: false, conta_folga: false,
    eh_deslocamento: false, pede_detalhe: false, exige_detalhe: false,
    dica_detalhe: null, presets: null, campeonatos: null, ordem: 0, arquivada: false,
  }
  await api('folgas_categorias', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(CATEGORIAS.map(c => ({ ...PADRAO_CATEGORIA, ...c }))),
  })
  console.log(`  categorias: ${CATEGORIAS.length}`)

  // pessoas: liga ao login do Portal quando o nome bate
  const perfis = await api('portal_profiles?select=id,nome')
  const achaPerfil = nome => {
    const n = norm(nome)
    const p = perfis.find(x => norm(x.nome) === n || norm(x.nome).split(' ').includes(n))
    return p?.id || null
  }
  const jaTem = await api('folgas_pessoas?select=id,nome,time_id')
  for (const p of lidas) {
    const novas = p.pessoas
      .filter(x => !jaTem.some(j => j.time_id === p.time && norm(j.nome) === norm(x.nome)))
      .map(x => ({
        time_id: p.time, nome: x.nome, ordem: x.ordem,
        cor: CORES_PESSOA[(x.ordem - 1) % CORES_PESSOA.length],
        profile_id: achaPerfil(x.nome),
      }))
    if (novas.length) {
      await api('folgas_pessoas', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(novas) })
    }
    console.log(`  pessoas ${p.time}: ${novas.length} criadas (${p.pessoas.length - novas.length} já existiam)`)
  }

  const todas = await api('folgas_pessoas?select=id,nome,time_id,profile_id')
  const idDe = (time, nome) => todas.find(x => x.time_id === time && norm(x.nome) === norm(nome))?.id
  console.log(`  ligadas a um login do Portal: ${todas.filter(x => x.profile_id).map(x => x.nome).join(', ') || 'nenhuma'}`)

  let total = 0
  for (const p of lidas) {
    const linhas = p.dias.map(d => ({
      pessoa_id: idDe(p.time, d.pessoa), dia: d.dia,
      categoria_id: d.categoria_id, detalhe: d.detalhe, campeonato: d.campeonato || null,
    })).filter(x => x.pessoa_id)
    for (let i = 0; i < linhas.length; i += 500) {
      await api('folgas_dias', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(linhas.slice(i, i + 500)),
      })
    }
    total += linhas.length
    console.log(`  dias ${p.time}: ${linhas.length}`)
  }
  console.log(`  TOTAL de dias gravados: ${total}`)
}

// ── confere: relê do banco e compara com o CSV, célula a célula ──────────────
console.log(`\n${'═'.repeat(76)}\nCONFERÊNCIA (relendo do banco)\n${'═'.repeat(76)}`)
const pessoasBanco = await api('folgas_pessoas?select=id,nome,time_id')
let divergencias = 0, conferidas = 0
for (const p of lidas) {
  const doTime = pessoasBanco.filter(x => x.time_id === p.time)
  const ids = doTime.map(x => `"${x.id}"`).join(',')
  if (!ids) { console.log(`  ${p.time}: nenhuma pessoa no banco`); continue }
  const linhas = []
  // Ordenar só por dia não basta: com 11 pessoas no mesmo dia o empate faz a
  // ordem variar entre páginas, e o offset pula linhas. A ordem tem de ser
  // única — (pessoa_id, dia) é a própria chave primária.
  for (let i = 0; i < 20000; i += 1000) {
    const parte = await api(`folgas_dias?pessoa_id=in.(${ids})&select=pessoa_id,dia,categoria_id,detalhe,campeonato&order=pessoa_id,dia&offset=${i}&limit=1000`)
    linhas.push(...parte)
    if (parte.length < 1000) break
  }
  const mapa = new Map(linhas.map(l => [`${l.pessoa_id}|${l.dia}`, l]))
  const nomeDe = new Map(doTime.map(x => [x.id, x.nome]))
  void nomeDe
  const idDe = nome => doTime.find(x => norm(x.nome) === norm(nome))?.id
  for (const d of p.dias) {
    const k = `${idDe(d.pessoa)}|${d.dia}`
    const no = mapa.get(k)
    conferidas++
    if (!no) { divergencias++; if (divergencias <= 8) console.log(`  FALTA  ${p.time} ${d.pessoa} ${d.dia} = ${d.bruto}`); continue }
    if (no.categoria_id !== d.categoria_id || (no.detalhe || null) !== (d.detalhe || null)) {
      divergencias++
      if (divergencias <= 8) console.log(`  DIFERE ${p.time} ${d.pessoa} ${d.dia}: banco=${no.categoria_id}/${no.detalhe} csv=${d.categoria_id}/${d.detalhe}`)
    }
  }
  console.log(`  ${p.time}: ${linhas.length} dias no banco`)
}
console.log(`\n  ${conferidas} células conferidas · ${divergencias} divergências`)
