// ─── O SALDO DE FOLGAS, CONFERIDO FORA DO NAVEGADOR ──────────────────────────
// Roda a MESMA conta da tela (src/lib/folgas.js) sobre os dados do banco e
// imprime pessoa por pessoa. Serve para responder "esse número está certo?"
// sem depender de olhar a tela.
//
// Mostra também quantas folgas estão marcadas para DEPOIS de hoje: elas não
// entram no saldo (o direito delas também ainda não foi gerado), e é bom saber
// que existem ao comparar com a planilha antiga, que somava tudo.
//
// Uso: node --import ./scripts/resolver_ext.mjs scripts/conferir_saldo_folgas.mjs [ano]

import { readFileSync } from 'node:fs'
import { saldoDoAno, saldoDoMes, hojeIso } from '../src/lib/folgas.js'

const BASE = 'https://buubjnddzsadzcumrvdt.supabase.co'
const KEY = (readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .find(l => /^SUPABASE_SERVICE_KEY=/.test(l)) || '').split('=').slice(1).join('=').trim()
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }
const api = async c => {
  const r = await fetch(`${BASE}/rest/v1/${c}`, { headers: H })
  if (!r.ok) throw new Error(`${r.status} ${c} :: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

const ANO = Number(process.argv.find(a => /^\d{4}$/.test(a)) || new Date().getFullYear())
const hoje = hojeIso()

const pessoas = (await api('folgas_pessoas?select=id,nome,time_id,ativo&order=ordem')).filter(p => p.ativo)
const cats = await api('folgas_categorias?select=id,conta_folga,eh_deslocamento')
const ehFolga = id => !!cats.find(c => c.id === id)?.conta_folga
const ehDesloc = id => !!cats.find(c => c.id === id)?.eh_deslocamento
const feriados = new Set((await api('folgas_feriados?select=dia')).map(f => f.dia))
const ajustes = await api('folgas_ajustes?select=pessoa_id,vale_de,delta')

const ids = pessoas.map(p => `"${p.id}"`).join(',')
const todas = []
for (let de = 0; de < 40000; de += 1000) {
  const p = await api(`folgas_dias?pessoa_id=in.(${ids})&dia=gte.${ANO}-01-01&dia=lte.${ANO}-12-31&select=pessoa_id,dia,categoria_id&order=pessoa_id,dia&offset=${de}&limit=1000`)
  todas.push(...p); if (p.length < 1000) break
}
const por = new Map(pessoas.map(p => [p.id, new Map()]))
todas.forEach(l => por.get(l.pessoa_id)?.set(l.dia, { ...l, eh_deslocamento: ehDesloc(l.categoria_id) }))

const mesAtual = Number(hoje.slice(5, 7)) - 1
console.log(`ANO ${ANO} · hoje ${hoje}\n`)
console.log(`${'PESSOA'.padEnd(12)} ${'DIREITO'.padStart(8)} ${'USADAS'.padStart(7)} ${'A TIRAR'.padStart(8)}   ${'(mês)'.padStart(8)}   ${'FUTURAS'.padStart(8)}`)
console.log('─'.repeat(64))

let somaTirar = 0, somaFuturas = 0
for (const p of pessoas) {
  const meus = por.get(p.id)
  const meusAj = ajustes.filter(a => a.pessoa_id === p.id)
  const ano = saldoDoAno({ dias: meus, feriados, ehFolga, ajustes: meusAj, ano: ANO, hoje })
  const mes = saldoDoMes({ dias: meus, feriados, ehFolga, ajustes: meusAj, ano: ANO, mes: mesAtual, hoje })
  const futuras = [...meus.values()].filter(d => d.dia > hoje && ehFolga(d.categoria_id)).length
  somaTirar += Math.max(0, -ano.aTirar); somaFuturas += futuras
  const palavra = ano.aTirar < 0 ? `${-ano.aTirar} a tirar` : ano.aTirar > 0 ? `${ano.aTirar} adiant.` : 'em dia'
  console.log(
    `${p.nome.padEnd(12)} ${String(ano.direito).padStart(8)} ${String(ano.usadas).padStart(7)} ${palavra.padStart(11)}   ` +
    `${String(mes.aTirar).padStart(8)}   ${String(futuras || '').padStart(8)}`
  )
}
console.log('─'.repeat(64))
console.log(`${'SOMA'.padEnd(12)} ${''.padStart(8)} ${''.padStart(7)} ${String(somaTirar).padStart(8)}   ${''.padStart(8)}   ${String(somaFuturas).padStart(8)}`)
console.log(`\n"FUTURAS" são folgas já marcadas depois de hoje. Elas NÃO entram no saldo:`)
console.log(`o direito dos fins de semana que ainda vêm também não entrou. Os dois lados`)
console.log(`param no mesmo dia — se só as folgas contassem, o saldo apareceria menor.`)
