// ─── NOME DA CATEGORIA × DESCRITIVO DO DIA ───────────────────────────────────
// Desde que a célula passou a mostrar sempre a CATEGORIA, o descritivo que
// apenas repete o nome dela virou ruído: some da célula, vira uma marca "·" e
// não diz nada a mais quando você passa o mouse.
//
// Este script faz as duas coisas que isso pede, por categoria:
//   · acerta o nome que a equipe usa;
//   · limpa o descritivo que só repete esse nome, preservando o que traz
//     informação de verdade ("Home - RJ", "Viagem RJ", "Vila Olímpia + MM").
//
// Decisões da equipe em 18/09/2026:
//   "Escritório" e "Vila Olímpia" são o mesmo lugar -> Vila Olímpia
//   "o home não precisa de descritivo se for só home-office"
//   "o viagem pode continuar como viagem"            -> Deslocamento vira Viagem
//
// Rodar de novo não estraga nada.
//
// Uso:
//   node scripts/padronizar_categorias_folgas.mjs            # simulação
//   node scripts/padronizar_categorias_folgas.mjs --gravar

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

// `id` nunca muda: ele não aparece na tela, e trocá-lo obrigaria a reescrever
// todos os dias que apontam para ele.
// `repete` = descritivo que só diz o nome da categoria, e por isso pode sair.
const PLANO = [
  {
    id: 'escritorio', nome: 'Vila Olímpia', curto: 'VILA OLÍMPIA',
    repete: /^(vila\s*ol[íi]mpia|escrit[óo]rio)$/i,
  },
  {
    id: 'home', nome: 'Home', curto: 'HOME',
    // 'Home' sai da lista de atalhos: home puro não precisa de descritivo, e
    // deixar o atalho ali era convidar a redundância de volta.
    presets: ['Home - MM', 'Home - monitoração'],
    repete: /^(home|home[\s-]*office)$/i,
  },
  {
    id: 'deslocamento', nome: 'Viagem', curto: 'VIAGEM',
    repete: /^(viagem|deslocamento)$/i,
  },
]

const gravar = process.argv.includes('--gravar')

for (const alvo of PLANO) {
  const [cat] = await api(`folgas_categorias?id=eq.${alvo.id}&select=*`)
  if (!cat) { console.log(`\n${alvo.id}: categoria não existe, pulando`); continue }

  const dias = []
  for (let de = 0; de < 40000; de += 1000) {
    const p = await api(`folgas_dias?categoria_id=eq.${alvo.id}&select=detalhe&order=pessoa_id,dia&offset=${de}&limit=1000`)
    dias.push(...p); if (p.length < 1000) break
  }
  const redundantes = dias.filter(d => alvo.repete.test(String(d.detalhe || '').trim()))
  const comInfo = dias.filter(d => d.detalhe && !alvo.repete.test(String(d.detalhe).trim()))

  console.log(`\n══ ${cat.nome} ══`)
  if (cat.nome !== alvo.nome || cat.curto !== alvo.curto) {
    console.log(`  nome: "${cat.nome}" (${cat.curto}) -> "${alvo.nome}" (${alvo.curto})`)
  } else {
    console.log(`  nome: já é "${alvo.nome}"`)
  }
  if (alvo.presets) {
    console.log(`  atalhos: ${JSON.stringify(cat.presets)} -> ${JSON.stringify(alvo.presets)}`)
  }
  console.log(`  ${dias.length} dias · ${redundantes.length} com descritivo que só repete o nome -> limpar`)
  if (comInfo.length) {
    const t = new Map()
    comInfo.forEach(d => t.set(d.detalhe, (t.get(d.detalhe) || 0) + 1))
    console.log(`  ${comInfo.length} com informação de verdade, que ficam:`)
    ;[...t.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
      .forEach(([k, n]) => console.log(`      ${String(n).padStart(3)}×  ${k}`))
    if (t.size > 6) console.log(`      ... e mais ${t.size - 6} textos`)
  }

  if (!gravar) continue

  const patch = { nome: alvo.nome, curto: alvo.curto }
  if (alvo.presets) patch.presets = alvo.presets
  await api(`folgas_categorias?id=eq.${alvo.id}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch),
  })

  // Limpa por grafia exata: é o filtro que o PostgREST entende sem trazer os
  // dias para cá um a um.
  const grafias = [...new Set(dias
    .map(d => String(d.detalhe || '').trim())
    .filter(v => v && alvo.repete.test(v)))]
  for (const g of grafias) {
    await api(`folgas_dias?categoria_id=eq.${alvo.id}&detalhe=eq.${encodeURIComponent(g)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ detalhe: null }),
    })
  }
  console.log(`  gravado · ${grafias.length} grafia(s) limpa(s): ${grafias.join(', ')}`)
}

if (!gravar) {
  console.log('\nSIMULAÇÃO — nada gravado. Rode com --gravar para valer.')
} else {
  console.log('\n══ CONFERÊNCIA ══')
  for (const alvo of PLANO) {
    const [cat] = await api(`folgas_categorias?id=eq.${alvo.id}&select=nome,curto,presets`)
    const dias = []
    for (let de = 0; de < 40000; de += 1000) {
      const p = await api(`folgas_dias?categoria_id=eq.${alvo.id}&select=detalhe&order=pessoa_id,dia&offset=${de}&limit=1000`)
      dias.push(...p); if (p.length < 1000) break
    }
    const sobrou = dias.filter(d => alvo.repete.test(String(d.detalhe || '').trim())).length
    console.log(`  ${cat.nome.padEnd(14)} redundantes sobrando: ${sobrou} · com descritivo: ${dias.filter(d => d.detalhe).length} de ${dias.length}`)
  }
}
