// ─── "ESCRITÓRIO" E "VILA OLÍMPIA" SÃO O MESMO LUGAR ─────────────────────────
// O Operações chamava de "Escritório" e o Sinal Inter de "Vila Olímpia". Na
// importação os dois já viraram UMA categoria, mas com o nome "Escritório". A
// equipe decidiu em 18/09/2026 padronizar em "Vila Olímpia".
//
// Duas coisas acontecem aqui:
//
// 1. A categoria muda de nome. O `id` continua 'escritorio' — ele nunca aparece
//    na tela, e trocá-lo obrigaria a reescrever os 982 dias que apontam para
//    ele, sem ganho nenhum.
//
// 2. Os 380 dias que guardam "Vila Olímpia" no campo DETALHE ficam com o
//    detalhe vazio. Esse texto entrou na importação porque, na época, ele dizia
//    mais que o nome da categoria ("Escritório"); com o nome novo ele passa a
//    repetir a própria coluna. Os que têm informação de verdade junto
//    ("Vila Olímpia + MM", "(tarde/noite)", "- Série B") ficam como estão.
//
// Uso:
//   node scripts/padronizar_vila_olimpia.mjs            # simulação
//   node scripts/padronizar_vila_olimpia.mjs --gravar

import { readFileSync } from 'node:fs'

const BASE = 'https://buubjnddzsadzcumrvdt.supabase.co'
const KEY = (readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .find(l => /^SUPABASE_SERVICE_KEY=/.test(l)) || '').split('=').slice(1).join('=').trim()
if (!KEY) { console.error('Sem SUPABASE_SERVICE_KEY em .env.local'); process.exit(1) }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const api = async (c, o = {}) => {
  const r = await fetch(`${BASE}/rest/v1/${c}`, { ...o, headers: { ...H, ...(o.headers || {}) } })
  const t = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${c} :: ${t.slice(0, 300)}`)
  return t ? JSON.parse(t) : null
}

const gravar = process.argv.includes('--gravar')
const NOME = 'Vila Olímpia'
const CURTO = 'V. OLÍMPIA'

// Detalhe que apenas repete o nome da categoria — nada a mais.
const soRepeteONome = d => /^vila\s*ol[íi]mpia$|^escrit[óo]rio$/i.test(String(d || '').trim())

const [cat] = await api('folgas_categorias?id=eq.escritorio&select=*')
if (!cat) { console.error('categoria "escritorio" não existe'); process.exit(1) }

const todas = []
for (let de = 0; de < 40000; de += 1000) {
  const p = await api(`folgas_dias?categoria_id=eq.escritorio&select=pessoa_id,dia,detalhe&order=pessoa_id,dia&offset=${de}&limit=1000`)
  todas.push(...p); if (p.length < 1000) break
}
const redundantes = todas.filter(d => soRepeteONome(d.detalhe))
const comInfo = todas.filter(d => d.detalhe && !soRepeteONome(d.detalhe))

console.log(`categoria:  "${cat.nome}" (${cat.curto})  ->  "${NOME}" (${CURTO})`)
console.log(`dias nesta categoria: ${todas.length}`)
console.log(`  ${redundantes.length} com detalhe que só repete o nome  -> detalhe limpo`)
console.log(`  ${comInfo.length} com informação de verdade            -> ficam como estão:`)
const t = new Map()
comInfo.forEach(d => t.set(d.detalhe, (t.get(d.detalhe) || 0) + 1))
;[...t.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`      ${String(n).padStart(3)}×  ${k}`))
console.log(`  ${todas.length - redundantes.length - comInfo.length} já sem detalhe`)

if (!gravar) {
  console.log('\nSIMULAÇÃO — nada gravado. Rode com --gravar para valer.')
} else {
  await api('folgas_categorias?id=eq.escritorio', {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ nome: NOME, curto: CURTO }),
  })
  console.log('\ncategoria renomeada')

  // Um PATCH por lote de dias, filtrando pelas duas grafias redundantes.
  for (const grafia of ['Vila Olímpia', 'Vila Olimpia', 'Escritório', 'Escritorio']) {
    await api(`folgas_dias?categoria_id=eq.escritorio&detalhe=eq.${encodeURIComponent(grafia)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ detalhe: null }),
    })
  }

  const depois = []
  for (let de = 0; de < 40000; de += 1000) {
    const p = await api(`folgas_dias?categoria_id=eq.escritorio&select=detalhe&order=pessoa_id,dia&offset=${de}&limit=1000`)
    depois.push(...p); if (p.length < 1000) break
  }
  const sobrou = depois.filter(d => soRepeteONome(d.detalhe)).length
  const [conf] = await api('folgas_categorias?id=eq.escritorio&select=nome,curto')
  console.log(`\nCONFERÊNCIA`)
  console.log(`  categoria agora: "${conf.nome}" (${conf.curto})`)
  console.log(`  dias com detalhe redundante sobrando: ${sobrou}`)
  console.log(`  dias com detalhe de verdade: ${depois.filter(d => d.detalhe).length}`)
}
