// ─── REGRAS DE FORNECEDOR/PRESTADOR ──────────────────────────────────────────
// Que coluna do Portal casa com que função da base, e como se compara um nome.
// Vive separado do hook porque é REGRA, não acesso a dado: assim a tela
// Escalar e os scripts de conferência usam as mesmas regras sem arrastar a
// conexão com o banco atrás.

// Mapeia coluna do Portal → predicado sobre `funcao` do fornecedor no Hub.
// Cada fornecedor tem `funcao` em texto livre (pode ser composto: "UM, SNG").
export const MATCH = {
  um:               f => /\bUM\b/i.test(f.funcao),
  sng_premiere:     f => /\bSNG\b/i.test(f.funcao),
  sng_host:         f => /\bSNG\b/i.test(f.funcao),
  gerador:          f => /\bSNG\b|\bgerador/i.test(f.funcao),
  supervisores_1:   f => /supervisor/i.test(f.funcao),
  supervisores_2:   f => /supervisor/i.test(f.funcao),
  liveu_1:          f => /liveu|supervisor/i.test(f.funcao),
  liveu_2:          f => /liveu|supervisor/i.test(f.funcao),
  dtv:              f => /\bDTV\b/i.test(f.funcao),
  op_vmix:          f => /v[ ]?mix/i.test(f.funcao),
  op_audio:         f => /(?:áudio|audio)/i.test(f.funcao),
  teleporto:        f => /teleporto/i.test(f.funcao),
  satelite:         f => /sat[ée]lite/i.test(f.funcao),
  satelite_globo:   f => /sat[ée]lite/i.test(f.funcao),
  fornecedor_drone:        f => /\bDrone\b/i.test(f.funcao),
  fornecedor_minidrone:    f => /mini[ ]?drone/i.test(f.funcao),
  fornecedor_dslr:         f => /\bDSLR\b/i.test(f.funcao),
  fornecedor_grua:         f => /\bGrua\b/i.test(f.funcao),
  fornecedor_goalcam:      f => /goal[ ]?cam/i.test(f.funcao),
  fornecedor_trilho:       f => /trilho|especial/i.test(f.funcao),
  fornecedor_carrinho:     f => /carrinho/i.test(f.funcao),
  fornecedor_clipcam:      f => /clip[ ]?cam|especial/i.test(f.funcao),
  // Controle do Paulistão F (colunas próprias)
  sng:                     f => /\bSNG\b/i.test(f.funcao),
  supervisor_um_host:      f => /supervisor/i.test(f.funcao),
  coordenador:             f => /coordenador/i.test(f.funcao),
  dslr:                    f => /\bDSLR\b/i.test(f.funcao),
  refcam:                  f => /ref[ ]?cam/i.test(f.funcao),
  drone:                   f => /\bDrone\b/i.test(f.funcao),
  minidrone:               f => /mini[ ]?drone/i.test(f.funcao),
  grua:                    f => /\bGrua\b/i.test(f.funcao),
  // Paulistão A1 (colunas próprias). As funções cadastradas na base não usam
  // os nomes novos de câmera ("EarCam", "UltraCam"), então cada predicado
  // também aceita o termo genérico com que essa gente FOI cadastrada
  // ("Microcamera", "Especial", "Áudio") — sem isso a lista viria vazia.
  sup_virtual:             f => /virtual|supervisor/i.test(f.funcao),
  liveu:                   f => /liveu|supervisor/i.test(f.funcao),
  fornecedor_earcam:       f => /ear[ ]?cam|microc[âa]mera|microcamera|especial/i.test(f.funcao),
  fornecedor_ultracam:     f => /ultra[ ]?cam|microc[âa]mera|microcamera|especial/i.test(f.funcao),
  fornecedor_klover:       f => /klover|[áa]udio|micro/i.test(f.funcao),
  fornecedor_micros_especiais: f => /micro|[áa]udio|especial/i.test(f.funcao),
  fornecedor_internet_led: f => /internet|led/i.test(f.funcao),
  fornecedor_cadeirao:     f => /cadeir|pratic[áa]vel|loca[çc][ãa]o/i.test(f.funcao),
  // Escala Geral (funções de UM/produção)
  producao_executiva:      f => /produ[çc][ãa]o executiva|executiv/i.test(f.funcao),
  coordenador_um:          f => /coordenador/i.test(f.funcao),
  produtor_um:             f => /produtor/i.test(f.funcao),
  produtor_campo:          f => /produtor/i.test(f.funcao),
  monitoracao:             f => /monitora/i.test(f.funcao),
}

// Retorna apelidos de fornecedores que casam com a coluna do Portal.
export function getApelidosForColumn(colKey, fornecedores) {
  const pred = MATCH[colKey]
  if (!pred) return []
  return fornecedores
    .filter(f => f.apelido && pred(f))
    .map(f => f.apelido)
    .sort((a, b) => a.localeCompare(b))
}

// Retorna o predicado de match para uma coluna (para usar com FornecedorAutocomplete).
export function getColumnPredicate(colKey) {
  return MATCH[colKey] || null
}

// Vocabulário de função sugerido por coluna (pré-preenche o cadastro rápido)
export const FUNCAO_DA_COLUNA = {
  um: 'UM', sng_premiere: 'SNG', sng_host: 'SNG', sng: 'SNG', gerador: 'Gerador',
  supervisores_1: 'Supervisor', supervisores_2: 'Supervisor', supervisor_um_host: 'Supervisor',
  liveu_1: 'LiveU', liveu_2: 'LiveU', dtv: 'DTV', op_vmix: 'Vmix', op_audio: 'Áudio',
  teleporto: 'Teleporto', coordenador: 'Coordenador', coordenador_um: 'Coordenador UM',
  produtor_um: 'Produtor UM', produtor_campo: 'Produtor de Campo', monitoracao: 'Monitoração',
  producao_executiva: 'Produção Executiva',
  fornecedor_drone: 'Drone', drone: 'Drone', fornecedor_minidrone: 'Minidrone', minidrone: 'Minidrone',
  fornecedor_dslr: 'DSLR', dslr: 'DSLR', fornecedor_grua: 'Grua', grua: 'Grua',
  fornecedor_goalcam: 'Goalcam', fornecedor_trilho: 'Trilho', fornecedor_carrinho: 'Carrinho',
  fornecedor_clipcam: 'ClipCam', refcam: 'RefCam',
  sup_virtual: 'Supervisor Virtual', liveu: 'LiveU',
  fornecedor_earcam: 'EarCam', fornecedor_ultracam: 'UltraCam',
  fornecedor_klover: 'Klover', fornecedor_micros_especiais: 'Micros Especiais',
  fornecedor_internet_led: 'Internet LED', fornecedor_cadeirao: 'Cadeirão',
}

const normNome = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

// Muita célula guarda o telefone junto do nome — "Anderson Fernandes / 71
// 8805-2446", "Fábio Madergan 11 94187 6014". O telefone não é um nome: se
// entrasse na comparação, gente que ESTÁ cadastrada apareceria como fora da
// base (eram 100+ das 580 divergências em 17/09/2026).
const SO_TELEFONE = /^[\s()+\-./\d]{8,}$/
const TELEFONE_NO_FIM = /[\s/-]*(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}\s*$/

// Este pedaço é um telefone, não um nome? A tela Escalar usa para não mostrar
// "Fulano / 11 99999-9999" como se fossem duas pessoas.
export const ehTelefone = s => SO_TELEFONE.test(String(s || '').trim())

// Acha o cadastro de uma pessoa pelo nome escrito na célula (mesma
// normalização e mesmas limpezas que `estaCadastrado` usa).
export function acharCadastro(nome, fornecedores) {
  const alvo = normNome(String(nome || '').replace(TELEFONE_NO_FIM, ''))
  if (!alvo) return null
  return (fornecedores || []).find(f => normNome(f.apelido) === alvo) || null
}

// Link de WhatsApp a partir do telefone do CADASTRO. O Hub grava só dígitos com
// DDI ("5511983361535"), que é o formato que o wa.me quer.
//
// Alguns cadastros antigos estão truncados em 9 dígitos ("551185400"): abrir
// uma conversa com um número incompleto é pior que não oferecer o link, então
// só sai link quando o número está inteiro.
export function whatsappDe(telefone) {
  const d = String(telefone || '').replace(/\D/g, '')
  if (d.length < 12 || d.length > 13) return null
  return `https://wa.me/${d}`
}

// O nome está cadastrado na base? (aceita "A / B" — checa cada segmento)
// O NOME, sem os apêndices que a planilha gruda nele: "(H)", "- Record",
// "cobre", telefone no fim. Vive aqui porque duas coisas precisam limpar do
// mesmo jeito — conferir contra a base de fornecedores e casar a pessoa do time
// com o nome dela na escala dos jogos. Duas limpezas parecidas divergiriam.
export function nomeBase(seg) {
  return String(seg || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[\s-]+(record news|record|youtube|yt|premiere|cazetv|amazon|tnt|hbo)$/i, '')
    .replace(/\s+cobre$/i, '')
    .replace(TELEFONE_NO_FIM, '')
    .trim()
}

// Dois nomes são a mesma pessoa? Ignora acento, caixa e os apêndices acima.
export const mesmoNome = (a, b) => {
  const x = normNome(nomeBase(a))
  return !!x && x === normNome(nomeBase(b))
}

export function estaCadastrado(valor, fornecedores) {
  if (!valor || !String(valor).trim()) return true // vazio não é "não cadastrado"
  const norms = new Set(fornecedores.map(f => normNome(f.apelido)))
  return String(valor).split('/').map(s => s.trim()).filter(Boolean).every(seg => {
    if (/^n[aã]o$|^sim$/i.test(seg)) return true
    if (SO_TELEFONE.test(seg)) return true
    return norms.has(normNome(nomeBase(seg)))
  })
}
