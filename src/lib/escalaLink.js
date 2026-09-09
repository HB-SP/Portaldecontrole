// ─── VÍNCULO CONTROLE × ESCALA GERAL ─────────────────────────────────────────
// As duas planilhas são de responsáveis diferentes e não têm ID em comum.
// O vínculo é inferido: data + mandante/visitante normalizados, com fallback
// de ±1 dia para quando as planilhas divergem na data do mesmo jogo.

import { parseData } from './datas'

export const FUNCOES_ESCALA = [
  { key: 'coordenador_um', label: 'Coordenador UM' },
  { key: 'produtor_um',    label: 'Produtor UM' },
  { key: 'produtor_campo', label: 'Produtor Campo' },
  { key: 'monitoracao',    label: 'Monitoração' },
]

// "Não" na coluna = o jogo não terá essa função (não é pendência)
export const naoTemFuncao = v => /^n[aã]o$/i.test(String(v || '').trim())

// Jogos "YT Paulistão" não escalam equipe Livemode
export const semEscala = r => /^yt\s*paulist/i.test(String(r?.transmissao || '').trim())

// Nomes de time divergem entre as planilhas ("Athletico PR" × "Athletico",
// "RB Bragantino" × "Red Bull Bragantino") — o alias resolve os conhecidos.
const TIME_ALIAS = {
  athleticopr: 'athletico',
  redbullbragantino: 'bragantino',
  rbbragantino: 'bragantino',
  // Paulistão A1: o Controle usa a sigla do clube, a planilha de
  // planejamento não. Sem estes dois, 15 dos 75 jogos do A1 não achavam a
  // escala — todos os que envolvem um destes times.
  ecnoroeste: 'noroeste',
  ecprimavera: 'primavera',
}

// Exportado para o pareamento Controle × Periférico (usePerifericoIrmao), que
// precisa da MESMA normalização e da mesma tabela de apelidos.
export function normalizarTime(s) { return normTime(s) }

function normTime(s) {
  const n = String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
  return TIME_ALIAS[n] || n
}

const normCamp = s => String(s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]/g, '')

// Campeonato do Portal → nomes usados na coluna `campeonato` da escala_geral.
// O Paulistão Fem aparece com DOIS nomes na planilha de planejamento.
// O banco foi padronizado em 12/08/2026 (BR26→Brasileirão 26, PFem 26→
// Paulistão F 26), mas os nomes antigos ficam como proteção caso uma
// reimportação da planilha os reintroduza.
//
// Este mapa é só o FALLBACK. A fonte preferida é competitions.escala_camps,
// que chega aqui via config.escalaCamps: sem isso, ligar um campeonato novo à
// Escala Geral exigia editar este arquivo e publicar o site — foi o que
// aconteceu com o Paulistão A1 26, cujos jogos estão na escala_geral como
// "Paulistão 26" e por isso não eram encontrados.
const CAMP_ALIAS = {
  brasileirao26: ['Brasileirão 26', 'BR26'],
  paulistaofem26: ['Paulistão F 26', 'PFem 26'],
}

export function escalaCampeonatosDe(label, camps) {
  // Nomes vindos do banco ganham do mapa fixo e do próprio label.
  const doBanco = (Array.isArray(camps) ? camps : []).filter(c => c && String(c).trim())
  if (doBanco.length) return doBanco
  if (!label) return []
  return CAMP_ALIAS[normCamp(label)] || [label]
}

function dataKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const timesKey = r => `${normTime(r.mandante)}|${normTime(r.visitante)}`

// Índice das linhas da escala_geral: exato (data+times) e por confronto (times)
export function criarIndiceEscala(rows) {
  const exato = new Map()
  const porTimes = new Map()
  for (const r of rows || []) {
    if (!r.mandante || !r.visitante) continue
    const tk = timesKey(r)
    const d = parseData(r.data)
    if (d) exato.set(`${dataKey(d)}|${tk}`, r)
    if (!porTimes.has(tk)) porTimes.set(tk, [])
    porTimes.get(tk).push({ d, r })
  }
  return { exato, porTimes }
}

// Acha a linha da escala para um jogo do Controle.
// Retorna { escala, dataDivergente } ou null quando não há vínculo.
export function acharEscala(jogo, indice) {
  if (!indice || !jogo?.mandante || !jogo?.visitante) return null
  const tk = timesKey(jogo)
  const d = parseData(jogo.data)
  if (d) {
    const hit = indice.exato.get(`${dataKey(d)}|${tk}`)
    if (hit) return { escala: hit, dataDivergente: false }
  }
  // Fallback: mesmo confronto com data a ±1 dia (planilhas divergem às vezes)
  const candidatos = indice.porTimes.get(tk) || []
  if (d) {
    const perto = candidatos.find(c => c.d && Math.abs(c.d - d) <= 86400000)
    if (perto) return { escala: perto.r, dataDivergente: true }
  }
  // Sem data de nenhum lado: só vincula se o confronto for único na escala
  if (!d && candidatos.length === 1) return { escala: candidatos[0].r, dataDivergente: false }
  return null
}
