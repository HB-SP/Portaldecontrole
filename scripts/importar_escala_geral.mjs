// ─── IMPORTA "Planejamento HB LiveMode - Escala 2026" → escala_geral ────────
// O CSV tem cabeçalhos repetidos ("Supervisor 1", "$"...), então o mapeamento
// é POR ÍNDICE (ordem fixa da planilha). Linhas sem Campeonato+Mandante são
// lixo (legenda, subtotais de viagem, separadores) e são puladas.
//
// Reexecutável: casa linha existente por campeonato+data+mandante+visitante;
// match → atualiza SÓ as funções (valor vazio não apaga); sem match → INSERT.
//
// Uso: node scripts/importar_escala_geral.mjs <csv>            (dry-run)
//      node scripts/importar_escala_geral.mjs --aplicar <csv>

import { readFileSync } from 'fs'

const URL = process.env.SUPABASE_URL || 'https://buubjnddzsadzcumrvdt.supabase.co'
// A chave vem do .env.local, como nos outros scripts. Antes ela vinha de uma
// variavel de ambiente e, sem ela, caia na chave PUBLICA — que nao tem
// permissao de ler a escala_geral. O script recebia uma lista vazia, concluia
// que nenhum jogo existia e propunha reinserir os 300 (24/09/2026).
const KEY = (readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .find(l => /^SUPABASE_SERVICE_KEY=/.test(l)) || '').split('=').slice(1).join('=').trim()
if (!KEY) { console.error('Sem SUPABASE_SERVICE_KEY em .env.local'); process.exit(1) }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }


const APLICAR = process.argv.includes('--aplicar')
// So preenche campo vazio; nao troca valor que ja existe.
const SO_VAZIOS = process.argv.includes('--so-vazios')
const arquivo = process.argv.slice(2).find(a => !a.startsWith('--'))
if (!arquivo) { console.error('Passe o caminho do CSV.'); process.exit(1) }

// Índices fixos da planilha (cabeçalhos se repetem, nome não é confiável)
const IDX = {
  campeonato: 1, fase_rodada: 2, dia: 3, data: 4, horario: 5, cidade: 6,
  estadio: 7, mandante: 8, visitante: 9, transmissao: 10,
  coordenador_um: 16, coordenador_um_valor: 17,
  produtor_um: 18, produtor_um_valor: 19,
  produtor_campo: 20, producao_executiva: 21, monitoracao: 22,
}
const FUNCOES = ['coordenador_um', 'coordenador_um_valor', 'produtor_um', 'produtor_um_valor', 'produtor_campo', 'producao_executiva', 'monitoracao']

function parseCsv(texto) {
  const linhas = []
  let linha = [], campo = '', dentro = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (dentro) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') dentro = false
      else campo += c
    } else if (c === '"') dentro = true
    else if (c === ',') { linha.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      linha.push(campo); campo = ''
      linhas.push(linha); linha = []
    } else campo += c
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha) }
  return linhas
}

const norm = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')
const chave = r => [r.campeonato, r.data, r.mandante, r.visitante].map(norm).join('|')

// A planilha usa etiquetas variadas para o mesmo campeonato; o banco foi
// padronizado em 12/08/2026. Normaliza na entrada para casar com o existente
// em vez de duplicar (chave de match inclui o campeonato).
// ── APELIDO É A MESMA PESSOA ────────────────────────────────────────────────
// A planilha é preenchida no dia a dia e usa o nome curto; o banco foi
// carregado de uma versão com o nome inteiro. Daí 305 células em que os dois
// lados "discordam" dizendo a mesma coisa:
//
//   banco "Douglas Santana / Gui Soria"   planilha "Douglas / Gui"
//   banco "Leo Russo / Bruno Gatti"       planilha "Leo Russo / Gatti"
//   banco "Léo Sarti / Galindo"           planilha "Leo / Galindo"
//
// Aplicar isso encurtaria 305 nomes e quebraria a ligação com a escala interna,
// que casa pessoa POR NOME. Então o import passa a reconhecer: um nome curto é
// a mesma pessoa quando todas as suas palavras estão no nome longo.
//
// O que NÃO casa continua sendo divergência de verdade — "Não" contra "XSports
// e Record em campo" são coisas diferentes, e essa merece ser olhada.
// Um nome pode chegar de muitos jeitos: "WJ" e "Wilson Junior", "Ana" e "Ana
// Clara", "Radatz" e "Raddatz", "Marcello" e "Marcelo". Aqui NAO se trata de
// identificar quem e a pessoa - e so de decidir se os dois lados dizem a mesma
// coisa, para nao sobrescrever a toa. Por isso ser generoso e o lado SEGURO:
// na duvida, o banco fica como esta.
// O canal vem grudado no nome de dois jeitos — "Gatti (H)" e "WJ - Record" —
// e nos dois ele diz ONDE, não QUEM. Sai da comparação; no banco continua.
const semMarca = s => String(s || '')
  .replace(/\([^)]*\)/g, ' ')
  .replace(/\s+-\s+\S+/g, ' ')
const palavras = s => norm(semMarca(s)).split(/[\s.]+/).filter(x => x.length > 1)

// Duas palavras com uma letra de diferenca sao a mesma: Radatz/Raddatz.
function pertinho(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false
  if (a.length < 5) return false
  let i = 0, j = 0, erros = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++erros > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else { i++; j++ }
  }
  return erros + (a.length - i) + (b.length - j) <= 1
}

const iniciais = ps => ps.map(x => x[0]).join('')

function mesmaPessoa(a, b) {
  const pa = palavras(a), pb = palavras(b)
  if (!pa.length || !pb.length) return false
  const [curto, longo] = pa.length <= pb.length ? [pa, pb] : [pb, pa]
  // "WJ" contra "Wilson Junior"
  if (curto.length === 1 && curto[0].length <= 3 && curto[0] === iniciais(longo)) return true
  // cada palavra do curto tem de estar no longo: igual, como comeco, ou perto
  return curto.every(x => longo.some(y =>
    x === y || y.startsWith(x) || x.startsWith(y) || pertinho(x, y)))
}

// Uma celula pode ter varias pessoas, separadas por barra ou por mais. Ela e a
// mesma quando tem a mesma quantidade e cada uma casa com a da outra lista, em
// qualquer ordem - "A / B" e "B / A" sao a mesma dupla.
function mesmaGente(a, b) {
  const pedacos = v => String(v || '').split(/[/+]/).map(x => x.trim()).filter(Boolean)
  const A = pedacos(a), B = pedacos(b)
  if (!A.length || A.length !== B.length) return false
  const livres = [...B]
  return A.every(x => {
    const i = livres.findIndex(y => mesmaPessoa(x, y))
    if (i < 0) return false
    livres.splice(i, 1)
    return true
  })
}
// Campeonato que já virou histórico não é mais reimportado: o que está lá é o
// que aconteceu (equipe, 24/09/2026 — "não precisa mudar a escala da copinha").
const CONGELADOS = new Set(['copinha 26'])

const CAMP_PADRAO = {
  'br26': 'Brasileirão 26',
  'pfem 26': 'Paulistão F 26',
  'serie b': 'Série B 26',
}
const padronizaCamp = c => CAMP_PADRAO[norm(c)] || c

const linhas = parseCsv(readFileSync(arquivo, 'utf8'))
const registros = []
for (const l of linhas.slice(1)) {
  const reg = {}
  Object.entries(IDX).forEach(([col, i]) => { reg[col] = String(l[i] ?? '').trim() })
  reg.campeonato = padronizaCamp(reg.campeonato)
  if (!reg.campeonato || !reg.mandante) continue
  if (/legenda/i.test(l.join(','))) continue
  registros.push(reg)
}
console.log(`CSV: ${registros.length} jogos lidos`)

// Dedupe interno (última ocorrência vence)
const porChave = new Map()
registros.forEach(r => porChave.set(chave(r), r))
const finais = [...porChave.values()]
if (finais.length !== registros.length) console.log(`(${registros.length - finais.length} duplicatas internas resolvidas)`)

const existentes = await (await fetch(`${URL}/rest/v1/escala_geral?select=*`, { headers: H })).json()
if (!Array.isArray(existentes)) { console.error('Erro ao ler escala_geral — a tabela existe? Rode supabase_escala_geral.sql primeiro.\n', existentes); process.exit(1) }
const existPorChave = new Map(existentes.map(r => [chave(r), r]))

const updates = [], inserts = []
for (const reg of finais) {
  const atual = existPorChave.get(chave(reg))
  if (atual) {
    // DUAS COISAS DIFERENTES, e o `--so-vazios` separa as duas:
    //   preencher um campo que está VAZIO no banco é acrescentar
    //   trocar um valor que já existe é sobrescrever — e pode atropelar quem
    //   editou pela tela depois da última importação
    // "Coloque somente o que não temos" (equipe, 24/09/2026) é a primeira.
    const difs = CONGELADOS.has(norm(reg.campeonato)) ? [] : Object.entries(reg).filter(([k, v]) => {
      if (!FUNCOES.includes(k) || v === '') return false
      const noBanco = String(atual[k] ?? '').trim()
      if (noBanco === v) return false
      // Mesma gente escrita mais curto não é mudança.
      if (noBanco && mesmaGente(noBanco, v)) return false
      return SO_VAZIOS ? noBanco === '' : true
    })
    if (difs.length) updates.push({ id: atual.id, reg: Object.fromEntries(difs), nome: `${reg.campeonato} ${reg.data} ${reg.mandante} x ${reg.visitante}` })
  } else {
    inserts.push(reg)
  }
}

console.log(`\n═══ ${APLICAR ? 'APLICANDO' : 'DRY-RUN'} ═══`)
console.log(`→ ${inserts.length} inserts | ${updates.length} updates de funções`)
const porCamp = {}
inserts.forEach(r => { porCamp[r.campeonato] = (porCamp[r.campeonato] || 0) + 1 })
Object.entries(porCamp).forEach(([c, n]) => console.log(`   ${c}: ${n} jogos novos`))
updates.slice(0, Number((process.argv.find(a=>a.startsWith('--ver='))||'--ver=10').slice(6))).forEach(u => console.log(`   upd: ${u.nome} → ${Object.entries(u.reg).map(([k,v])=>k+': '+v).join(' | ')}`))

if (APLICAR) {
  const agora = new Date().toISOString()
  for (let i = 0; i < inserts.length; i += 100) {
    const lote = inserts.slice(i, i + 100).map(r => ({ ...r, updated_at: agora }))
    const r = await fetch(`${URL}/rest/v1/escala_geral`, {
      method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(lote),
    })
    if (!r.ok) { console.error(`Falha no lote ${i}: ${r.status} ${await r.text()}`); process.exit(1) }
    console.log(`   inseridos ${Math.min(i + 100, inserts.length)}/${inserts.length}`)
  }
  for (const u of updates) {
    const r = await fetch(`${URL}/rest/v1/escala_geral?id=eq.${u.id}`, {
      method: 'PATCH', headers: H, body: JSON.stringify({ ...u.reg, updated_at: agora }),
    })
    if (!r.ok) console.error(`Falha update ${u.nome}: ${r.status}`)
  }
  console.log('\nGravado.')
} else {
  console.log('\nNada gravado. Rode com --aplicar para gravar.')
}
