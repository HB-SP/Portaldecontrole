// ─── ADICIONA OS JOGOS DAS RODADAS 28, 29 E 30 DO BRASILEIRÃO ────────────────
// Fonte: print da planilha enviado em 14/09/2026.
//
// Faz o MESMO que a tela faz quando alguém cria um jogo (ver
// replicarParaPerifericos em TablePage): grava nas TRÊS tabelas —
// brasileirao_jogos, perifericos_brasileirao e escala_geral. Só o Controle
// deixaria o jogo sem linha na aba Periférico e sem escala.
//
// Também corrige duas falhas nos jogos da rodada 27, que já existiam:
// estádio vazio no Chapecoense × Internacional e data em formato diferente
// ("12/09/2026" onde todo o resto usa "12/09").
//
// Idempotente: nada entra se já houver jogo com a mesma data + mesmos times.
//
// Uso: node scripts/adicionar_jogos_br_r28_r30.mjs [--conferir]

import { readFileSync } from 'node:fs'

const URL = 'https://buubjnddzsadzcumrvdt.supabase.co'
const CAMPEONATO = 'Brasileirão 26'
const KEY = (readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .find(l => /^SUPABASE_SERVICE_KEY=/.test(l)) || '').split('=').slice(1).join('=').trim()
if (!KEY) { console.error('Sem SUPABASE_SERVICE_KEY em .env.local'); process.exit(1) }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

async function api(caminho, opcoes = {}) {
  const r = await fetch(`${URL}/rest/v1/${caminho}`, { ...opcoes, headers: { ...H, ...(opcoes.headers || {}) } })
  const t = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${caminho} :: ${t.slice(0, 300)}`)
  return t ? JSON.parse(t) : null
}

// `dia` já normalizado para o formato das 54 linhas existentes (Sábado,
// Domingo, Quarta) — o print traz "sábado", "domingo", "quarta-feira".
const JOGOS = [
  { eu: '28', dia: 'Sábado',  data: '19/09', hora_brt: '17:00', mandante: 'Mirassol',      visitante: 'Botafogo',    estadio: 'Campos Maia',   cidade: 'Mirassol',       padrao: 'B2', detentor: 'CazeTV/Record' },
  { eu: '28', dia: 'Sábado',  data: '19/09', hora_brt: '20:30', mandante: 'Vasco',         visitante: 'Coritiba',    estadio: 'São Januário',  cidade: 'Rio de Janeiro', padrao: 'B2', detentor: 'AmazonPrime' },
  { eu: '29', dia: 'Quarta',  data: '07/10', hora_brt: '19:30', mandante: 'Internacional', visitante: 'Corinthians', estadio: 'Beira Rio',     cidade: 'Porto Alegre',   padrao: 'B1', detentor: 'CazeTV/Record' },
  { eu: '29', dia: 'Quarta',  data: '07/10', hora_brt: '20:30', mandante: 'Botafogo',      visitante: 'Vasco',       estadio: 'Nilton Santos', cidade: 'Rio de Janeiro', padrao: 'B2', detentor: 'AmazonPrime' },
  { eu: '30', dia: 'Sábado',  data: '10/10', hora_brt: '17:00', mandante: 'Vasco',         visitante: 'Remo',        estadio: 'São Januário',  cidade: 'Rio de Janeiro', padrao: 'B2', detentor: 'CazeTV/Record' },
  { eu: '30', dia: 'Domingo', data: '11/10', hora_brt: '19:30', mandante: 'Coritiba',      visitante: 'Botafogo',    estadio: 'Couto Pereira', cidade: 'Curitiba',       padrao: 'B2', detentor: 'AmazonPrime' },
]

// Correções nos jogos que já existem (rodada 27)
const CORRIGIR = [
  { data: '12/09', mandante: 'Chapecoense', visitante: 'Internacional',       campo: 'estadio', valor: 'Arena Condá' },
  { data: '12/09', mandante: 'Botafogo',    visitante: 'Red Bull Bragantino', campo: 'data',    valor: '12/09' },
]

const CAMPOS_JOGO = ['dia', 'data', 'hora_brt', 'mandante', 'visitante', 'estadio', 'cidade', 'padrao', 'detentor']

const norm = s => String(s || '').trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
// Ignora o ano: a base mistura "12/09" e "12/09/2026"
const ddmm = d => { const m = String(d || '').trim().match(/^(\d{1,2})\/(\d{1,2})/); return m ? `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}` : '' }
const chave = r => `${ddmm(r.data)}|${norm(r.mandante)}|${norm(r.visitante)}`

const conferir = process.argv.includes('--conferir')
const agora = () => new Date().toISOString()

const br = await api('brasileirao_jogos?select=*')
const pf = await api('perifericos_brasileirao?select=*')
const eg = await api(`escala_geral?campeonato=eq.${encodeURIComponent(CAMPEONATO)}&select=*`)
const temBr = new Set(br.map(chave)), temPf = new Set(pf.map(chave)), temEg = new Set(eg.map(chave))
console.log(`base: Controle ${br.length} | Periférico ${pf.length} | Escala Geral ${eg.length}\n`)

const novosBr = JOGOS.filter(j => !temBr.has(chave(j)))
const novosPf = JOGOS.filter(j => !temPf.has(chave(j)))
const novosEg = JOGOS.filter(j => !temEg.has(chave(j)))
console.log(`a inserir — Controle: ${novosBr.length} | Periférico: ${novosPf.length} | Escala Geral: ${novosEg.length}`)
novosBr.forEach(j => console.log(`   R${j.eu} ${j.data} ${j.hora_brt}  ${j.mandante} x ${j.visitante}  (${j.estadio}, ${j.detentor})`))

console.log('\na corrigir na rodada 27:')
const correcoes = []
for (const c of CORRIGIR) {
  const alvo = br.find(r => chave(r) === chave(c))
  if (!alvo) { console.log(`   NAO ACHEI: ${c.mandante} x ${c.visitante}`); continue }
  const atual = String(alvo[c.campo] || '')
  if (atual === c.valor) { console.log(`   ja certo: ${c.mandante} x ${c.visitante} · ${c.campo}`); continue }
  console.log(`   ${c.mandante} x ${c.visitante} · ${c.campo}: "${atual}" -> "${c.valor}"`)
  correcoes.push({ id: alvo.id, campo: c.campo, valor: c.valor })
}

if (conferir) { console.log('\n(modo conferir — nada gravado)'); process.exit(0) }

if (novosBr.length) {
  await api('brasileirao_jogos', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(novosBr.map(j => ({ ...j, updated_at: agora() }))),
  })
  console.log(`\ngravado no Controle: ${novosBr.length}`)
}

if (novosPf.length) {
  // A irmã de periféricos recebe a identidade do jogo; o equipamento fica vazio
  // para a equipe preencher, igual ao que a tela faz.
  await api('perifericos_brasileirao', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(novosPf.map(j => {
      const o = { rod: j.eu, updated_at: agora() }
      CAMPOS_JOGO.forEach(c => { o[c] = j[c] })
      return o
    })),
  })
  console.log(`gravado no Periférico: ${novosPf.length}`)
}

if (novosEg.length) {
  await api('escala_geral', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(novosEg.map(j => ({
      campeonato: CAMPEONATO,
      fase_rodada: `Rodada ${j.eu}`,
      dia: j.dia, data: j.data, horario: j.hora_brt,
      cidade: j.cidade, estadio: j.estadio,
      mandante: j.mandante, visitante: j.visitante,
      transmissao: j.detentor,
      updated_at: agora(),
    }))),
  })
  console.log(`gravado na Escala Geral: ${novosEg.length}`)
}

for (const c of correcoes) {
  await api(`brasileirao_jogos?id=eq.${c.id}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ [c.campo]: c.valor, updated_at: agora() }),
  })
}
if (correcoes.length) console.log(`corrigido na rodada 27: ${correcoes.length}`)

const br2 = await api('brasileirao_jogos?select=id')
const pf2 = await api('perifericos_brasileirao?select=id')
const eg2 = await api(`escala_geral?campeonato=eq.${encodeURIComponent(CAMPEONATO)}&select=id`)
console.log(`\nagora: Controle ${br2.length} | Periférico ${pf2.length} | Escala Geral ${eg2.length}`)
