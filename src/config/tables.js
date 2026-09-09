export const STATUS_OPTIONS = ['Confirmado', 'Reservado', 'Pendente', 'Cancelado', 'Em andamento', 'Aguardando', 'Alteração']

// Estados do credenciamento (vive nas tabelas de periféricos; a aba Controle
// espelha e edita via linha irmã ligada pelo hub_jogo_id)
export const CRED_OPTIONS = ['Enviado', 'Pendente', 'Alteração']
export function getCredClass(v) {
  const map = { 'Enviado': 'status-confirmado', 'Pendente': 'status-pendente', 'Alteração': 'status-em-andamento' }
  return map[v] || 'status-pendente'
}

// Controle → tabela de periféricos irmã (mesma partida, ligada por hub_jogo_id)
export const PAR_PERIFERICO = {
  brasileirao_jogos:        { tabela: 'perifericos_brasileirao',  rodadaDe: 'eu',  rodadaPara: 'rod' },
  paulistao_feminino_jogos: { tabela: 'perifericos_paulistao',    rodadaDe: 'rod', rodadaPara: 'rod' },
}

export function getStatusClass(s) {
  const map = {
    'Confirmado': 'status-confirmado',
    'Reservado': 'status-confirmado',
    'Pendente': 'status-pendente',
    'Cancelado': 'status-cancelado',
    'Em andamento': 'status-em-andamento',
    'Aguardando': 'status-aguardando',
    'Alteração': 'status-em-andamento',
  }
  return map[s] || 'status-default'
}

// ─── AGRUPAMENTO DOS PAINÉIS ─────────────────────────────────────────────────
// Os grupos das colunas são o que a Visão Geral transforma em painel. O padrão
// pedido separa PESSOAL (quem) de OPERAÇÕES (o que), com TRANSMISSÃO levando
// satélite, horários e o bloco técnico. Os PERIFÉRICOS entram como coluna
// própria, vinda da seção irmã (ver usePerifericoIrmao) — não saem daqui.
//
// aplicarPlano só REAGRUPA e REORDENA: cada coluna mantém tipo, opções,
// largura, sticky e linkedTo exatamente como definida abaixo. Assim o padrão
// dos painéis muda sem risco de mexer no comportamento de nenhum campo.
//
// Coluna fora do plano continua funcionando (mantém o grupo original e vai
// para o fim) e avisa no console. De propósito não lança erro: isto roda no
// import do módulo, e uma exceção aqui daria tela branca antes de o
// ErrorBoundary existir. O script scripts/conferir_planos_colunas.mjs falha
// se sobrar alguma.
function aplicarPlano(columns, plano, nome) {
  const porChave = new Map(columns.map(c => [c.key, c]))
  const out = []
  for (const [grupo, chaves] of plano) {
    for (const k of chaves) {
      const c = porChave.get(k)
      if (!c) { console.warn(`[tables:${nome}] plano cita coluna inexistente: ${k}`); continue }
      out.push({ ...c, group: grupo })
      porChave.delete(k)
    }
  }
  if (porChave.size) {
    console.warn(`[tables:${nome}] colunas fora do plano (grupo original mantido): ${[...porChave.keys()].join(', ')}`)
    out.push(...porChave.values())
  }
  return out
}

// Helper to compute stickyLeft offsets for sticky columns
function computeStickyOffsets(columns) {
  let offset = 0
  return columns.map(col => {
    if (col.sticky) {
      const updated = { ...col, stickyLeft: offset }
      offset += col.width
      return updated
    }
    return col
  })
}

// ============================================================
// SHARED OPTION LISTS (from real spreadsheet data)
// ============================================================
const ESTADIOS_BR = [
  'Maracanã', 'Nilton Santos', 'São Januário', 'Beira Rio',
  'Neo Química Arena', 'Arena da Baixada', 'Couto Pereira',
  'Mineirão', 'Arena Condá', 'Campos Maia', 'Allianz Parque',
  'Arena MRV', 'Castelão', 'Ligga Arena', 'Mané Garrincha',
]

const PADROES = ['B1', 'B2']

const DETENTORES = ['CazeTV/Record', 'AmazonPrime', 'Globo', 'SporTV', 'Band', 'DAZN']

const SATELITE_OPTIONS = ['Amz3', 'SES-6', 'Star One C2', 'Intelsat']

// ============================================================
// BRASILEIRAO CONFIG
// ============================================================
const brasileiraoRawColumns = [
  // Group: Jogo
  { key: 'eu', label: 'Rodada', type: 'text', width: 70, sticky: true, group: 'Jogo' },
  { key: 'dia', label: 'Dia', type: 'select', options: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'], width: 90, sticky: true, group: 'Jogo' },
  { key: 'data', label: 'Data', type: 'text', width: 110, sticky: true, group: 'Jogo' },
  { key: 'hora_brt', label: 'Hora (BRT)', type: 'text', width: 95, group: 'Jogo' },
  { key: 'mandante', label: 'Mandante', type: 'text', width: 140, group: 'Jogo' },
  { key: 'visitante', label: 'Visitante', type: 'text', width: 140, group: 'Jogo' },
  { key: 'estadio', label: 'Estádio', type: 'select', options: ESTADIOS_BR, width: 160, group: 'Jogo' },
  { key: 'cidade', label: 'Cidade', type: 'text', width: 120, group: 'Jogo' },
  { key: 'padrao', label: 'Padrão', type: 'select', options: PADROES, width: 100, group: 'Jogo' },
  { key: 'detentor', label: 'Detentor', type: 'select', options: DETENTORES, width: 140, group: 'Jogo' },

  // Group: Equipe Técnica
  { key: 'ppv', label: 'PPV', type: 'text', width: 80, group: 'Equipe Técnica' },
  { key: 'um', label: 'UM', type: 'text', width: 150, group: 'Equipe Técnica' },
  { key: 'nome_numero', label: 'Nome/N°', type: 'text', width: 130, group: 'Equipe Técnica' },
  { key: 'sng_premiere', label: 'SNG Premiere', type: 'text', width: 150, group: 'Equipe Técnica' },
  { key: 'sng_host', label: 'SNG Host', type: 'text', width: 145, group: 'Equipe Técnica' },
  { key: 'gerador', label: 'Gerador', type: 'text', width: 130, group: 'Equipe Técnica' },
  { key: 'supervisores_1', label: 'Supervisores 1', type: 'text', width: 220, group: 'Equipe Técnica' },
  { key: 'liveu_1', label: 'LiveU 1', type: 'text', width: 130, group: 'Equipe Técnica' },
  { key: 'supervisores_2', label: 'Supervisores 2', type: 'text', width: 220, group: 'Equipe Técnica' },
  { key: 'liveu_2', label: 'LiveU 2', type: 'text', width: 220, group: 'Equipe Técnica' },
  { key: 'dtv', label: 'DTV', type: 'text', width: 140, group: 'Equipe Técnica' },
  { key: 'op_vmix', label: 'Op Vmix', type: 'text', width: 160, group: 'Equipe Técnica' },
  { key: 'op_audio', label: 'Op Audio', type: 'text', width: 160, group: 'Equipe Técnica' },

  // Group: Transmissão
  { key: 'teleporto', label: 'Teleporto', type: 'text', width: 140, group: 'Transmissão' },
  { key: 'satelite', label: 'Satélite', type: 'select', options: SATELITE_OPTIONS, width: 140, group: 'Transmissão' },
  { key: 'service_start_gmt', label: 'Service Start (GMT)', type: 'text', width: 170, group: 'Transmissão' },
  { key: 'abertura_brt', label: 'Abertura (BRT)', type: 'text', width: 145, group: 'Transmissão' },
  { key: 'service_end_gmt', label: 'Service End (GMT)', type: 'text', width: 160, group: 'Transmissão' },
  { key: 'fechamento_brt', label: 'Fechamento (BRT)', type: 'text', width: 155, group: 'Transmissão' },
  { key: 'total_horas', label: 'Total de Horas', type: 'text', width: 135, group: 'Transmissão' },
  { key: 'banda', label: 'Banda', type: 'text', width: 100, group: 'Transmissão' },
  { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, width: 135, statusColor: true, group: 'Transmissão' },
  { key: 'reserva', label: 'Reserva', type: 'text', width: 100, group: 'Transmissão' },
  { key: 'transponder', label: 'Transponder', type: 'text', width: 130, group: 'Transmissão' },
  { key: 'uplink', label: 'Uplink', type: 'text', width: 100, group: 'Transmissão' },
  { key: 'downlink', label: 'Downlink', type: 'text', width: 100, group: 'Transmissão' },

  // Group: Globo
  { key: 'satelite_globo', label: 'Satélite Globo', type: 'select', options: SATELITE_OPTIONS, width: 160, group: 'Globo' },
  { key: 'status_g', label: 'Status G', type: 'select', options: STATUS_OPTIONS, width: 130, statusColor: true, group: 'Globo' },
  { key: 'reserva_g', label: 'Reserva G', type: 'text', width: 105, group: 'Globo' },
  { key: 'transponder_g', label: 'Transponder G', type: 'text', width: 135, group: 'Globo' },
  { key: 'uplink_g', label: 'Uplink G', type: 'text', width: 105, group: 'Globo' },
  { key: 'downlink_g', label: 'Downlink G', type: 'text', width: 105, group: 'Globo' },

  // Group: Técnico
  { key: 'aspecto', label: 'Aspecto', type: 'text', width: 100, group: 'Técnico' },
  { key: 'compressao', label: 'Compressão', type: 'text', width: 120, group: 'Técnico' },
  { key: 'transmissao', label: 'Transmissão', type: 'text', width: 120, group: 'Técnico' },
  { key: 'modulacao', label: 'Modulação', type: 'text', width: 115, group: 'Técnico' },
  { key: 'sr', label: 'SR', type: 'text', width: 80, group: 'Técnico' },
  { key: 'fec', label: 'FEC', type: 'text', width: 80, group: 'Técnico' },
  { key: 'biss_code', label: 'BISS CODE', type: 'text', width: 135, group: 'Técnico' },
  { key: 'ficha_jogo', label: 'FICHA_JOGO', type: 'url', width: 130, group: 'Técnico' },
]

// Supervisores, LiveU, DTV, Vmix e Áudio guardam NOMES de gente (ver os
// valores em dropdown_options: "Rafael Gusmão / 21 98038-6887") — por isso vão
// para Pessoal. UM, SNG e Gerador guardam empresa/equipamento: Operações.
// PPV ("Premiere") é o produto da transmissão, não pessoa nem equipamento.
const BRASILEIRAO_PLANO = [
  ['Jogo', ['eu', 'dia', 'data', 'hora_brt', 'mandante', 'visitante', 'estadio', 'cidade', 'padrao', 'detentor']],
  ['Pessoal', ['supervisores_1', 'liveu_1', 'supervisores_2', 'liveu_2', 'dtv', 'op_vmix', 'op_audio']],
  ['Operações', ['um', 'nome_numero', 'sng_premiere', 'sng_host', 'gerador']],
  ['Transmissão', [
    'ppv', 'teleporto', 'satelite', 'banda', 'status', 'reserva', 'transponder', 'uplink', 'downlink',
    'service_start_gmt', 'abertura_brt', 'service_end_gmt', 'fechamento_brt', 'total_horas',
    'satelite_globo', 'status_g', 'reserva_g', 'transponder_g', 'uplink_g', 'downlink_g',
    'aspecto', 'compressao', 'transmissao', 'modulacao', 'sr', 'fec', 'biss_code', 'ficha_jogo',
  ]],
]

export const BRASILEIRAO_CONFIG = {
  id: 'brasileirao',
  tableName: 'brasileirao_jogos',
  label: 'Brasileirão 26',
  accentColor: '#65B32E',
  accentBg: '#0d1a06',
  columns: computeStickyOffsets(aplicarPlano(brasileiraoRawColumns, BRASILEIRAO_PLANO, 'brasileirao')),
}

// ============================================================
// PERIFERICO BR CONFIG
// ============================================================
const perifericoBrRawColumns = [
  // Group: Jogo
  { key: 'rod', label: 'Rod', type: 'text', width: 60, sticky: true, group: 'Jogo' },
  { key: 'dia', label: 'Dia', type: 'select', options: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'], width: 90, sticky: true, group: 'Jogo' },
  { key: 'data', label: 'Data', type: 'text', width: 110, sticky: true, group: 'Jogo' },
  { key: 'hora_brt', label: 'Hora (BRT)', type: 'text', width: 95, group: 'Jogo' },
  { key: 'mandante', label: 'Mandante', type: 'text', width: 140, group: 'Jogo' },
  { key: 'visitante', label: 'Visitante', type: 'text', width: 140, group: 'Jogo' },
  { key: 'estadio', label: 'Estádio', type: 'select', options: ESTADIOS_BR, width: 160, group: 'Jogo' },
  { key: 'cidade', label: 'Cidade', type: 'text', width: 120, group: 'Jogo' },
  { key: 'padrao', label: 'Padrão', type: 'select', options: PADROES, width: 100, group: 'Jogo' },
  { key: 'detentor', label: 'Detentor', type: 'select', options: DETENTORES, width: 140, group: 'Jogo' },
  { key: 'credenciamento', label: 'Credenciamento', type: 'select', options: CRED_OPTIONS, width: 150, group: 'Jogo' },

  // Group: Equipamentos (simnao + fornecedor condicional)
  { key: 'drone', label: 'Drone', type: 'simnao', linkedFields: ['fornecedor_drone'], width: 100, group: 'Equipamentos' },
  { key: 'fornecedor_drone', label: 'Forn. Drone', type: 'text', linkedTo: 'drone', width: 140, group: 'Equipamentos' },
  { key: 'minidrone', label: 'MiniDrone', type: 'simnao', linkedFields: ['fornecedor_minidrone'], width: 110, group: 'Equipamentos' },
  { key: 'fornecedor_minidrone', label: 'Forn. Minidrone', type: 'text', linkedTo: 'minidrone', width: 150, group: 'Equipamentos' },
  { key: 'dslr', label: 'DSLR', type: 'simnao', linkedFields: ['qtde', 'fornecedor_dslr'], width: 100, group: 'Equipamentos' },
  { key: 'qtde', label: 'Qtde.', type: 'text', linkedTo: 'dslr', width: 80, group: 'Equipamentos' },
  { key: 'fornecedor_dslr', label: 'Forn. DSLR', type: 'text', linkedTo: 'dslr', width: 140, group: 'Equipamentos' },
  { key: 'grua', label: 'Grua', type: 'simnao', linkedFields: ['fornecedor_grua'], width: 100, group: 'Equipamentos' },
  { key: 'fornecedor_grua', label: 'Forn. Grua', type: 'text', linkedTo: 'grua', width: 140, group: 'Equipamentos' },
  { key: 'goalcam', label: 'GoalCam', type: 'simnao', linkedFields: ['fornecedor_goalcam'], width: 110, group: 'Equipamentos' },
  { key: 'fornecedor_goalcam', label: 'Forn. GoalCam', type: 'text', linkedTo: 'goalcam', width: 150, group: 'Equipamentos' },
  { key: 'trilho', label: 'Trilho', type: 'simnao', linkedFields: ['fornecedor_trilho'], width: 100, group: 'Equipamentos' },
  { key: 'fornecedor_trilho', label: 'Forn. Trilho', type: 'text', linkedTo: 'trilho', width: 140, group: 'Equipamentos' },
  { key: 'carrinho', label: 'Carrinho', type: 'simnao', linkedFields: ['fornecedor_carrinho'], width: 100, group: 'Equipamentos' },
  { key: 'fornecedor_carrinho', label: 'Forn. Carrinho', type: 'text', linkedTo: 'carrinho', width: 150, group: 'Equipamentos' },
  { key: 'clipcam', label: 'ClipCam', type: 'simnao', linkedFields: ['fornecedor_clipcam'], width: 110, group: 'Equipamentos' },
  { key: 'fornecedor_clipcam', label: 'Forn. ClipCam', type: 'text', linkedTo: 'clipcam', width: 150, group: 'Equipamentos' },
]

export const PERIFERICO_BR_CONFIG = {
  id: 'periferico-br',
  tableName: 'perifericos_brasileirao',
  label: 'Periférico BR26',
  accentColor: '#4d8922',
  accentBg: '#0a1505',
  columns: computeStickyOffsets(perifericoBrRawColumns),
}

// ============================================================
// PAULISTAO FEMININO CONFIG
// ============================================================
const paulistaoFemRawColumns = [
  // Group: Jogo
  { key: 'rod', label: 'Rod', type: 'text', width: 60, sticky: true, group: 'Jogo' },
  { key: 'dia', label: 'Dia', type: 'select', options: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'], width: 90, sticky: true, group: 'Jogo' },
  { key: 'data', label: 'Data', type: 'text', width: 110, sticky: true, group: 'Jogo' },
  { key: 'hora_brt', label: 'Hora (BRT)', type: 'text', width: 95, group: 'Jogo' },
  { key: 'mandante', label: 'Mandante', type: 'text', width: 140, group: 'Jogo' },
  { key: 'visitante', label: 'Visitante', type: 'text', width: 140, group: 'Jogo' },
  { key: 'cidade', label: 'Cidade', type: 'text', width: 120, group: 'Jogo' },
  { key: 'estadio', label: 'Estádio', type: 'select', options: ESTADIOS_BR, width: 160, group: 'Jogo' },
  { key: 'padrao', label: 'Padrão', type: 'select', options: PADROES, width: 100, group: 'Jogo' },
  { key: 'detentor', label: 'Detentor', type: 'select', options: DETENTORES, width: 140, group: 'Jogo' },

  // Group: Equipe Técnica
  { key: 'um', label: 'UM', type: 'text', width: 150, group: 'Equipe Técnica' },
  { key: 'gerador', label: 'Gerador', type: 'text', width: 130, group: 'Equipe Técnica' },
  { key: 'sng', label: 'SNG', type: 'text', width: 140, group: 'Equipe Técnica' },
  { key: 'dslr', label: 'DSLR', type: 'text', width: 100, group: 'Equipe Técnica' },
  { key: 'refcam', label: 'RefCam', type: 'text', width: 100, group: 'Equipe Técnica' },
  { key: 'drone', label: 'Drone', type: 'text', width: 100, group: 'Equipe Técnica' },
  { key: 'minidrone', label: 'MiniDrone', type: 'text', width: 110, group: 'Equipe Técnica' },
  { key: 'supervisor_um_host', label: 'Supervisor UM Host', type: 'text', width: 180, group: 'Equipe Técnica' },
  { key: 'grua', label: 'Grua', type: 'text', width: 100, group: 'Equipe Técnica' },
  { key: 'coordenador', label: 'Coordenador', type: 'text', width: 130, group: 'Equipe Técnica' },
  { key: 'dtv', label: 'DTV', type: 'text', width: 140, group: 'Equipe Técnica' },
  { key: 'op_vmix', label: 'Op. Vmix', type: 'text', width: 160, group: 'Equipe Técnica' },

  // Group: Transmissão
  { key: 'teleporto', label: 'Teleporto', type: 'text', width: 140, group: 'Transmissão' },
  { key: 'satelite', label: 'Satélite', type: 'select', options: SATELITE_OPTIONS, width: 140, group: 'Transmissão' },
  { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, width: 135, statusColor: true, group: 'Transmissão' },
  { key: 'reserva', label: 'Reserva', type: 'text', width: 100, group: 'Transmissão' },
  { key: 'transponder', label: 'Transponder', type: 'text', width: 130, group: 'Transmissão' },
  { key: 'uplink', label: 'Uplink', type: 'text', width: 100, group: 'Transmissão' },
  { key: 'downlink', label: 'Downlink', type: 'text', width: 100, group: 'Transmissão' },
  { key: 'banda', label: 'Banda', type: 'text', width: 100, group: 'Transmissão' },

  // Group: Técnico
  { key: 'aspecto', label: 'Aspecto', type: 'text', width: 100, group: 'Técnico' },
  { key: 'compressao', label: 'Compressão', type: 'text', width: 120, group: 'Técnico' },
  { key: 'transmissao', label: 'Transmissão', type: 'text', width: 120, group: 'Técnico' },
  { key: 'modulacao', label: 'Modulação', type: 'text', width: 115, group: 'Técnico' },
  { key: 'sr', label: 'SR', type: 'text', width: 80, group: 'Técnico' },
  { key: 'fec', label: 'FEC', type: 'text', width: 80, group: 'Técnico' },
  { key: 'audio_1_2', label: 'Audio 1/2', type: 'text', width: 110, group: 'Técnico' },
  { key: 'audio_3_4', label: 'Audio 3/4', type: 'text', width: 110, group: 'Técnico' },
  { key: 'biss_code', label: 'BISS CODE', type: 'text', width: 135, group: 'Técnico' },

  // Group: Horários
  { key: 'service_start_gmt', label: 'Service Start (GMT)', type: 'text', width: 170, group: 'Horários' },
  { key: 'abertura_brt', label: 'Abertura (BRT)', type: 'text', width: 145, group: 'Horários' },
  { key: 'service_end_gmt', label: 'Service End (GMT)', type: 'text', width: 160, group: 'Horários' },
  { key: 'fechamento_brt', label: 'Fechamento (BRT)', type: 'text', width: 155, group: 'Horários' },
  { key: 'total_horas', label: 'Total de Horas', type: 'text', width: 135, group: 'Horários' },
]

// Este Controle já traz equipamento nas colunas próprias (dslr, refcam, drone,
// minidrone, grua) — vão para Operações. São campos DESTA tabela, distintos da
// aba Periférico, que continua sendo seção à parte e aparece em coluna própria.
const PAULISTAO_FEM_PLANO = [
  ['Jogo', ['rod', 'dia', 'data', 'hora_brt', 'mandante', 'visitante', 'cidade', 'estadio', 'padrao', 'detentor']],
  ['Pessoal', ['coordenador', 'supervisor_um_host', 'dtv', 'op_vmix']],
  ['Operações', ['um', 'sng', 'gerador', 'dslr', 'refcam', 'drone', 'minidrone', 'grua']],
  ['Transmissão', [
    'teleporto', 'satelite', 'banda', 'status', 'reserva', 'transponder', 'uplink', 'downlink',
    'service_start_gmt', 'abertura_brt', 'service_end_gmt', 'fechamento_brt', 'total_horas',
    'aspecto', 'compressao', 'transmissao', 'modulacao', 'sr', 'fec', 'audio_1_2', 'audio_3_4', 'biss_code',
  ]],
]

export const PAULISTAO_FEM_CONFIG = {
  id: 'paulistao-fem',
  tableName: 'paulistao_feminino_jogos',
  label: 'Paulistão Fem. 26',
  accentColor: '#ec4899',
  accentBg: '#1a0a14',
  columns: computeStickyOffsets(aplicarPlano(paulistaoFemRawColumns, PAULISTAO_FEM_PLANO, 'paulistao-fem')),
}

// ============================================================
// PERIFERICO PF CONFIG
// ============================================================
const perifericoPfRawColumns = perifericoBrRawColumns.map(col => ({ ...col }))

export const PERIFERICO_PF_CONFIG = {
  id: 'periferico-pf',
  tableName: 'perifericos_paulistao',
  label: 'Periférico PF26',
  accentColor: '#be185d',
  accentBg: '#500724',
  columns: computeStickyOffsets(perifericoPfRawColumns),
}

// ============================================================
// SECTIONS
// ============================================================
export const SECTIONS = [
  BRASILEIRAO_CONFIG,
  PERIFERICO_BR_CONFIG,
  PAULISTAO_FEM_CONFIG,
  PERIFERICO_PF_CONFIG,
]
