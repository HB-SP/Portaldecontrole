// ─── EQUIPAMENTOS DOS PERIFÉRICOS ────────────────────────────────────────────
// Esta lista estava HARDCODED e DUPLICADA em PerifericosCards.jsx e
// PerifericoModal.jsx. Consequência: um campeonato dinâmico com outros
// equipamentos gravava os dados no banco e a tela não os mostrava — foi o que
// apareceu no Paulistão A1 26, que usa Internet LED, EarCam, UltraCam, Klover,
// Micros Especiais, Cadeirão e Assinatura Craque (7 tipos que o Brasileirão
// não tem).
//
// Legado continua com a lista fixa, byte por byte igual à de antes: as tabelas
// físicas do Brasileirão e do Paulistão Feminino têm exatamente estas colunas
// e nada muda para elas.

export const EQUIPAMENTOS_LEGADO = [
  { key: 'drone', label: 'Drone', fornecedor: 'fornecedor_drone' },
  { key: 'minidrone', label: 'MiniDrone', fornecedor: 'fornecedor_minidrone' },
  { key: 'dslr', label: 'DSLR', fornecedor: 'fornecedor_dslr', qtde: 'qtde' },
  { key: 'grua', label: 'Grua', fornecedor: 'fornecedor_grua' },
  { key: 'goalcam', label: 'GoalCam', fornecedor: 'fornecedor_goalcam' },
  { key: 'trilho', label: 'Trilho', fornecedor: 'fornecedor_trilho' },
  { key: 'carrinho', label: 'Carrinho', fornecedor: 'fornecedor_carrinho' },
  { key: 'clipcam', label: 'ClipCam', fornecedor: 'fornecedor_clipcam' },
]

// Campeonato dinâmico: equipamento é toda coluna do tipo 'simnao'. O par vem
// por convenção de nome — `fornecedor_<chave>` e `qtde_<chave>` — e é opcional:
// "Assinatura Craque" é Sim/Não sem fornecedor nenhum.
export function equipamentosDaConfig(config) {
  if (config?.isLegacy !== false) return EQUIPAMENTOS_LEGADO
  const cols = config.columns || []
  const chaves = new Set(cols.map(c => c.key))
  return cols
    .filter(c => c.type === 'simnao')
    .map(c => ({
      key: c.key,
      label: c.label || c.key,
      fornecedor: chaves.has(`fornecedor_${c.key}`) ? `fornecedor_${c.key}` : null,
      qtde: chaves.has(`qtde_${c.key}`) ? `qtde_${c.key}` : null,
    }))
}

// Um equipamento sem coluna de fornecedor está completo só com o "Sim" —
// senão ele apareceria eternamente como pendência.
export function equipamentoOk(row, eq) {
  if (row?.[eq.key] !== 'Sim') return false
  if (!eq.fornecedor) return true
  const v = row[eq.fornecedor]
  return !!(v && String(v).trim())
}
