// ─── PREPARA UMA LOGO PARA O CARD DO CAMPEONATO ──────────────────────────────
// Logo oficial vem como veio: JPG de 6000px com fundo branco, PNG com meio
// metro de margem vazia, versão branca feita para fundo escuro. Nenhuma delas
// serve crua num quadrado de 42px. Este script faz as três coisas que sempre
// precisam ser feitas:
//
//   1. tira o fundo branco (de JPG, que não tem transparência);
//   2. corta a margem vazia em volta — é ela que faz a logo aparecer minúscula
//      no meio de um quadrado grande;
//   3. reduz para um tamanho de tela.
//
// E uma quarta, só quando preciso: assentar a logo numa PLACA escura. Logo
// "versão branca" é branca de verdade — no card claro do portal ela some. A
// placa devolve a ela o fundo para o qual foi desenhada. O arredondamento dos
// cantos é do CSS (.hv-camp-logo), então aqui a placa é um retângulo simples.
//
// Uso:
//   node scripts/preparar_logo.mjs entrada.png saida.png
//   node scripts/preparar_logo.mjs entrada.jpg saida.png --tirar-fundo
//   node scripts/preparar_logo.mjs entrada.png saida.png --placa 161616
//   node scripts/preparar_logo.mjs entrada.png saida.png --pintar A104F0
//
// --pintar é a alternativa à placa, e quase sempre a melhor: em vez de pôr um
// retângulo colorido ATRÁS da logo branca, pinta a própria logo. A placa vira
// um tijolo no meio de marcas soltas; a logo pintada fica com o mesmo peso das
// outras (equipe, 25/09/2026). Só o que é branco muda de cor — detalhe
// colorido e antisserrilhado ficam como estão.
//
// Opções: --altura 128 (padrão) · --margem 8 (% de respiro) · --limite 240
//         (a partir de que claridade o pixel conta como fundo branco)

import { Jimp } from 'jimp'
import { readFileSync, writeFileSync } from 'node:fs'
import jpeg from 'jpeg-js'

const args = process.argv.slice(2)
const [entrada, saida] = args.filter(a => !a.startsWith('--'))
const opcao = (nome, padrao) => {
  const i = args.indexOf('--' + nome)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : padrao
}
const tem = nome => args.includes('--' + nome)

if (!entrada || !saida) {
  console.error('Uso: node scripts/preparar_logo.mjs <entrada> <saida.png> [--tirar-fundo] [--placa RRGGBB]')
  process.exit(1)
}

const ALTURA = parseInt(opcao('altura', '128'), 10)
const MARGEM = parseFloat(opcao('margem', '8'))
const LIMITE = parseInt(opcao('limite', '240'), 10)
const PLACA = opcao('placa', null)
const PINTAR = opcao('pintar', null)
const FUNDO = opcao('fundo', null)      // cor de fundo a remover, quando não é branco
const TOL = parseInt(opcao('tol', '40'), 10)
const RECORTE = opcao('recorte', null)  // x,y,w,h antes de tudo

// O decodificador de JPEG do Jimp tem um teto de memória baixo, e logo oficial
// costuma passar dele com folga (a do Brasileirão tem 6250x6686). Decodificar à
// mão com o teto levantado é mais simples que pedir à pessoa para diminuir o
// arquivo antes.
async function abrir(caminho) {
  const buf = readFileSync(caminho)
  if (/\.jpe?g$/i.test(caminho)) {
    const cru = jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 1024 })
    const img = new Jimp({ width: cru.width, height: cru.height })
    img.bitmap.data.set(cru.data)
    return img
  }
  return Jimp.read(buf)
}

const img = await abrir(entrada)
const orig = `${img.bitmap.width}x${img.bitmap.height}`

// 0. recorte, quando o arquivo traz mais coisa que a logo — a da Livemode vem
// com uma barrinha solta embaixo que não faz parte da marca.
if (RECORTE) {
  const [x, y, w, h] = RECORTE.split(',').map(n => parseInt(n, 10))
  img.crop({ x, y, w, h })
}

// 0b. fundo de cor (não branco) vira transparente. Logo costuma vir assentada
// numa placa da cor da marca; sem tirar, ela entra no portal como um bloco.
if (FUNDO) {
  const alvo = parseInt(FUNDO.replace('#', ''), 16)
  const [fr, fg, fb] = [(alvo >> 16) & 255, (alvo >> 8) & 255, alvo & 255]
  const d = img.bitmap.data
  for (let i = 0; i < d.length; i += 4) {
    const dist = Math.abs(d[i] - fr) + Math.abs(d[i + 1] - fg) + Math.abs(d[i + 2] - fb)
    if (dist <= TOL) d[i + 3] = 0
  }
}

// 1. fundo branco vira transparente
if (tem('tirar-fundo')) {
  const d = img.bitmap.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] >= LIMITE && d[i + 1] >= LIMITE && d[i + 2] >= LIMITE) d[i + 3] = 0
  }
}

// 1b. o branco da logo vira a cor pedida
//
// Só o branco: o detalhe colorido da marca fica como é. E a transparência de
// cada pixel é mantida, senão a borda antisserrilhada viraria uma serra.
if (PINTAR) {
  const alvo = parseInt(PINTAR.replace('#', ''), 16)
  const [pr, pg, pb] = [(alvo >> 16) & 255, (alvo >> 8) & 255, alvo & 255]
  const d = img.bitmap.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    if (lum < 190) continue
    d[i] = pr; d[i + 1] = pg; d[i + 2] = pb
  }
}

// 2. corta a moldura transparente
const { width: W, height: H, data } = img.bitmap
let x0 = W, y0 = H, x1 = -1, y1 = -1
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] > 24) {
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
}
if (x1 < 0) { console.error('A imagem ficou vazia — o limite de fundo pode estar alto demais.'); process.exit(1) }
img.crop({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 })
const cortado = `${img.bitmap.width}x${img.bitmap.height}`

// 3. reduz pela altura, mantendo a proporção
if (img.bitmap.height > ALTURA) {
  img.resize({ h: ALTURA })
}

// 4. respiro e, se pedido, a placa escura por baixo
const respiro = Math.round(img.bitmap.height * (MARGEM / 100))
const larguraFinal = img.bitmap.width + respiro * 2
const alturaFinal = img.bitmap.height + respiro * 2
const fundo = PLACA ? parseInt(PLACA.replace('#', ''), 16) * 256 + 255 : 0x00000000
const placa = new Jimp({ width: larguraFinal, height: alturaFinal, color: fundo })
placa.composite(img, respiro, respiro)

writeFileSync(saida, await placa.getBuffer('image/png'))
console.log(`${entrada}
  ${orig} → cortada ${cortado} → ${placa.bitmap.width}x${placa.bitmap.height}${PLACA ? ` sobre placa #${PLACA}` : ' transparente'}
  salva em ${saida}`)
