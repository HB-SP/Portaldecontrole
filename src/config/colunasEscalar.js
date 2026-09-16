// ─── COLUNAS LÓGICAS DA TELA "ESCALAR" ───────────────────────────────────────
// A tela é UMA tabela com todos os campeonatos, linha por jogo, no modelo de
// views do Airtable: conjunto único de colunas, e você escolhe quais aparecem.
//
// O problema que este módulo resolve: cada campeonato guarda a mesma coisa com
// nome diferente e em tabela diferente. "Supervisor 1" é `supervisores_1` no
// Brasileirão e `supervisor_um_host` no Paulistão F e no A1. O Coordenador UM
// nem fica no campeonato — vive na escala_geral, que é outra tabela, de outro
// responsável.
//
// Então cada COLUNA LÓGICA sabe, por campeonato, onde ler e onde gravar. Quem
// preenche vê uma coluna; por baixo pode haver três destinos diferentes.
//
// O catálogo é construído a partir das configs dos próprios campeonatos, e não
// escrito à mão: campeonato novo entra sozinho. A lista de SINÔNIMOS abaixo é
// a única parte manual — é onde se declara "estes dois nomes são a mesma
// coisa", que só quem conhece a operação sabe dizer.

import { FUNCOES_ESCALA } from '../lib/escalaLink'
import { equipamentosDaConfig } from './equipamentos'

// Chaves diferentes que significam a mesma coisa -> identidade lógica.
// Confirmado com a equipe em 16/09/2026.
const SINONIMOS = {
  supervisores_1: 'supervisor_1',
  supervisor_um_host: 'supervisor_1',
  supervisores_2: 'supervisor_2',
  // golcam já virou goalcam no banco (uniformizar_colunas.mjs); fica aqui
  // como rede, caso uma reimportação antiga reintroduza a grafia.
  // BR e PF usam 'qtde'; o A1 usa 'qtde_dslr'. Mesma coisa (equipe, 16/09).
  // Resolvido por sinonimo em vez de renomear: a derivacao de equipamento no
  // dinamico procura 'qtde_<chave>', entao renomear quebraria o par do DSLR.
  qtde: 'qtde_dslr',
  golcam: 'goalcam',
  fornecedor_golcam: 'fornecedor_goalcam',
}
const idLogico = chave => SINONIMOS[chave] || chave

// Rótulo preferido quando os campeonatos discordam. Sem isso o rótulo seria o
// do primeiro campeonato que declarou a coluna, que é arbitrário.
const ROTULOS = {
  supervisor_1: 'Supervisor 1',
  supervisor_2: 'Supervisor 2',
  qtde_dslr: 'Qtde DSLR',
  goalcam: 'GoalCam',
  fornecedor_goalcam: 'Forn. GoalCam',
}

// Campos que já identificam o jogo no cabeçalho da linha — não viram coluna
// de escala.
const DO_CABECALHO = new Set([
  'eu', 'rod', 'dia', 'data', 'hora_brt', 'mandante', 'visitante',
  'cidade', 'padrao', 'detentor', 'estadio', 'hub_jogo_id',
])

export const GRUPOS = ['Pessoal', 'Operações', 'Periféricos']

// Monta o catálogo a partir das competições carregadas pelo useCompetitions.
// Cada item:
//   { id, label, grupo, tipo, opcoes, fonte, chavePorComp: { [compId]: chave } }
// `fonte` diz em QUE tabela gravar: 'escala' (escala_geral), 'controle' ou
// 'periferico'.
export function montarCatalogo(competitions) {
  const porId = new Map()

  const registrar = ({ chave, label, grupo, tipo, opcoes, fonte, compId }) => {
    const id = idLogico(chave)
    if (!porId.has(id)) {
      porId.set(id, {
        id,
        label: ROTULOS[id] || label || id,
        grupo, tipo: tipo || 'text', opcoes: opcoes || [],
        fonte,
        chavePorComp: {},
      })
    }
    const col = porId.get(id)
    if (ROTULOS[id]) col.label = ROTULOS[id]
    // Uma coluna só pode ter uma fonte: se dois campeonatos discordarem, o
    // primeiro manda e o aviso aparece no console em vez de gravar no lugar
    // errado silenciosamente.
    if (col.fonte !== fonte) {
      console.warn(`[colunasEscalar] "${id}" aparece como ${col.fonte} e como ${fonte}; mantendo ${col.fonte}`)
    }
    if (compId) col.chavePorComp[compId] = chave
    return col
  }

  // ── As 4 funções de produção, que vivem na escala_geral e valem para todos ──
  for (const fn of FUNCOES_ESCALA) {
    registrar({ chave: fn.key, label: fn.label, grupo: 'Pessoal', tipo: 'text', fonte: 'escala' })
  }

  for (const comp of competitions || []) {
    const secControle = comp.sections?.find(s => !s.isOverview && !s.isDashboard && s.config?.sectionKind !== 'periferico')
    const secPerif = comp.sections?.find(s => s.config?.sectionKind === 'periferico')

    // ── Pessoal e Operações: colunas do Controle ──
    for (const c of secControle?.config?.columns || []) {
      if (DO_CABECALHO.has(c.key)) continue
      if (c.group !== 'Pessoal' && c.group !== 'Operações') continue
      registrar({
        chave: c.key, label: c.label, grupo: c.group,
        tipo: c.type, opcoes: c.options, fonte: 'controle', compId: comp.id,
      })
    }

    // ── Periféricos: equipamento + fornecedor, da seção irmã ──
    for (const eq of equipamentosDaConfig(secPerif?.config)) {
      if (!secPerif) break
      registrar({
        chave: eq.key, label: eq.label, grupo: 'Periféricos',
        tipo: 'simnao', opcoes: ['Sim', 'Não'], fonte: 'periferico', compId: comp.id,
      })
      if (eq.fornecedor) {
        registrar({
          chave: eq.fornecedor, label: `Forn. ${eq.label}`, grupo: 'Periféricos',
          tipo: 'text', fonte: 'periferico', compId: comp.id,
        })
      }
      if (eq.qtde) {
        registrar({
          chave: eq.qtde, label: `Qtde ${eq.label}`, grupo: 'Periféricos',
          tipo: 'text', fonte: 'periferico', compId: comp.id,
        })
      }
    }
  }

  // Ordem dos grupos primeiro; dentro do grupo, a ordem em que apareceram
  const todas = [...porId.values()]
  return GRUPOS.flatMap(g => todas.filter(c => c.grupo === g))
}

// Em quantos campeonatos a coluna existe — usado para marcar as "comuns a
// todos", que são as que fazem sentido deixar visíveis na visão global.
export function ehComumATodos(col, competitions) {
  if (col.fonte === 'escala') return true   // as 4 valem para todos
  return (competitions || []).every(c => col.chavePorComp[c.id])
}

// A chave física desta coluna neste campeonato — null se o campeonato não tem
// essa coluna (a célula fica travada, não em branco editável).
export function chaveDe(col, compId) {
  if (col.fonte === 'escala') return col.id
  return col.chavePorComp[compId] || null
}
