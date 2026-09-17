// Testa as funções DE VERDADE: recorta o trecho do próprio EscalarView.jsx e
// executa. Copiar as funções para cá daria um teste que passa enquanto a tela
// quebra.
import { readFileSync } from 'node:fs'
const src = readFileSync('src/components/EscalarView.jsx', 'utf8')
const ini = src.indexOf('const partesDe =')
const fim = src.indexOf('// ── Uma célula')
if (ini < 0 || fim < 0) { console.error('não achei o trecho'); process.exit(1) }
const trecho = src.slice(ini, fim)
const mod = await import('data:text/javascript,' + encodeURIComponent(
  trecho + '\nexport { partesDe, juntar, arrumar, sugestoesDaDupla }'
))
const { partesDe, arrumar, sugestoesDaDupla } = mod

let falhas = 0
const eq = (nome, a, b) => {
  const ok = JSON.stringify(a) === JSON.stringify(b)
  if (!ok) falhas++
  console.log(`${ok ? '  ok  ' : ' FALHA'} ${nome}  →  ${JSON.stringify(a)}${ok ? '' : `   (esperado ${JSON.stringify(b)})`}`)
}

console.log('arrumar:')
eq('vazio',            arrumar(''), '')
eq('só espaços',       arrumar('   '), '')
eq('um nome',          arrumar('  Fulano  '), 'Fulano')
eq('barra solta',      arrumar('Fulano / '), 'Fulano')
eq('sem espaços',      arrumar('Fulano/Ciclano'), 'Fulano / Ciclano')
eq('já certo',         arrumar('Fulano / Ciclano'), 'Fulano / Ciclano')
eq('três',             arrumar('A/B/C'), 'A / B / C')
eq('barra no começo',  arrumar('/ Ciclano'), 'Ciclano')
eq('telefone junto',   arrumar('Anderson / 71 8805-2446'), 'Anderson / 71 8805-2446')

console.log('\npartesDe:')
eq('dupla',            partesDe('Fulano / Ciclano'), ['Fulano', 'Ciclano'])
eq('um só',            partesDe('Fulano'), ['Fulano'])
eq('vazio',            partesDe(''), [])

const pessoas = [
  { id: 1, apelido: 'Ana Souza',  funcao: 'Produtor UM' },
  { id: 2, apelido: 'Bruno Lima', funcao: 'Produtor de Campo' },
]
console.log('\nsugestoesDaDupla (o texto é o que o navegador vai completar):')
eq('campo vazio',   sugestoesDaDupla('', pessoas).map(f => f.texto), ['Ana Souza', 'Bruno Lima'])
eq('1º digitado',   sugestoesDaDupla('Ana Souza / ', pessoas).map(f => f.texto), ['Ana Souza / Bruno Lima'])
eq('2º começado',   sugestoesDaDupla('Ana Souza / Bru', pessoas).map(f => f.texto), ['Ana Souza / Bruno Lima'])
eq('só a barra',    sugestoesDaDupla(' / ', pessoas).map(f => f.texto), ['Ana Souza', 'Bruno Lima'])
eq('sem barra',     sugestoesDaDupla('Ana', pessoas).map(f => f.texto), ['Ana Souza', 'Bruno Lima'])

console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntudo certo')
process.exit(falhas ? 1 : 0)
