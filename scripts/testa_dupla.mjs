// Testa as funções DE VERDADE: recorta o trecho do próprio EscalarView.jsx e
// executa. Copiar as funções para cá daria um teste que passa enquanto a tela
// quebra.
import { readFileSync } from 'node:fs'
const src = readFileSync('src/components/EscalarView.jsx', 'utf8')
const ini = src.indexOf('const partesDe =')
const fim = src.indexOf('// ── QUEM ESTÁ NA CÉLULA')
if (ini < 0 || fim < 0) { console.error('não achei o trecho de funções puras'); process.exit(1) }
const trecho = src.slice(ini, fim)
// Guarda: se um componente entrar no trecho, o import abaixo quebra com um erro
// de sintaxe que não diz nada. Melhor falhar explicando.
if (/<[A-Za-z]/.test(trecho)) { console.error('o trecho recortado tem JSX — mova o marcador de fim'); process.exit(1) }
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

// ── contato: o telefone vem do CADASTRO, não da célula ──
const { acharCadastro, whatsappDe, ehTelefone } = await import('../src/config/funcoesFornecedor.js')
const base = [
  { id: 1, apelido: 'Alexandre Dumas',  telefone: '551185400' },     // truncado no Hub
  { id: 2, apelido: 'Marcos Paulo',     telefone: '5511954401888' }, // completo
  { id: 3, apelido: 'Cibele Lorenzoni', telefone: '' },
]
console.log('\nacharCadastro / whatsappDe:')
eq('acha sem acento',        acharCadastro('alexandre dumas', base)?.id, 1)
eq('acha com tel. junto',    acharCadastro('Marcos Paulo 11 95440-1888', base)?.id, 2)
eq('não inventa',            acharCadastro('Fulano', base), null)
eq('link do completo',       whatsappDe('5511954401888'), 'https://wa.me/5511954401888')
eq('sem DDI não dá link',    whatsappDe('(11) 95440-1888'), null)
eq('truncado não dá link',   whatsappDe('551185400'), null)
eq('vazio não dá link',      whatsappDe(''), null)

console.log('\nehTelefone:')
eq('é telefone',       ehTelefone('11 99181-1449'), true)
eq('é telefone (DDI)', ehTelefone('5511954401888'), true)
eq('nome não é',       ehTelefone('Rafael Rúbio'), false)
eq('nome com número',  ehTelefone('F21 Glauber'), false)

console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntudo certo')
process.exit(falhas ? 1 : 0)
