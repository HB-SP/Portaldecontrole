import { useState, useMemo, useEffect } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { useTableData } from '../hooks/useTableData'
import { useCompetitionEvents } from '../hooks/useCompetitionEvents'
import StatsCards from './StatsCards'
import Filters from './Filters'
import DataTable from './DataTable'
import GameModal from './GameModal'
import ConfirmDialog from './ConfirmDialog'
import PerifericosCards from './PerifericosCards'
import EscalaView, { funcoesDaConfig } from './EscalaView'
import { PAR_PERIFERICO } from '../config/tables'
import { parseData } from '../lib/datas'

const DEFAULT_FILTERS = { search: '', status: '', dateFrom: '', dateTo: '', rodada: '', detentor: '', estadio: '', um: '' }

// Um jogo criado no Controle vira uma linha também nos Periféricos (mesma
// partida, escala de equipamentos vazia) e na ESCALA GERAL (funções de UM/
// produção) — sem isso as abas divergem, cada uma com um conjunto de jogos.
const CAMPOS_JOGO = ['dia', 'data', 'hora_brt', 'mandante', 'visitante', 'estadio', 'cidade', 'padrao', 'detentor']
const CAMP_ESCALA_GERAL = {
  brasileirao_jogos: 'Brasileirão 26',
  paulistao_feminino_jogos: 'Paulistão F 26',
}

// Campeonato dinâmico: a irmã do jogo vai para os competition_events do filho
// periférico (mesma paridade que o legacy tem via PAR_PERIFERICO).
async function acharFilhoPeriferico(config) {
  const { data } = await supabase
    .from('competitions')
    .select('id')
    .eq('parent_competition_id', config.competitionId)
    .eq('section_kind', 'periferico')
    .maybeSingle()
  return data?.id || null
}

async function replicarParaPerifericos(config, formData) {
  if (!isConfigured || !formData?.mandante) return
  if (!config.isLegacy) {
    try {
      const filhoId = await acharFilhoPeriferico(config)
      if (!filhoId) return
      const desc = { rod: formData.eu || formData.rod || '' }
      CAMPOS_JOGO.forEach(c => { if (formData[c] != null) desc[c] = formData[c] })
      const { error } = await supabase.from('competition_events')
        .insert([{ competition_id: filhoId, data: desc, status: 'Pendente' }])
      if (error) console.warn('[TablePage] Jogo criado, mas falhou a réplica em periféricos (dinâmico):', error.message)
    } catch (err) {
      console.warn('[TablePage] Jogo criado, mas falhou a réplica em periféricos (dinâmico):', err)
    }
    return
  }
  const par = PAR_PERIFERICO[config.tableName]
  if (!par) return
  try {
    const desc = { [par.rodadaPara]: formData[par.rodadaDe] || '', updated_at: new Date().toISOString() }
    CAMPOS_JOGO.forEach(c => { if (formData[c] != null) desc[c] = formData[c] })
    // Sem o hub_jogo_id a irmã vira órfã: a exclusão do jogo (que filtra por
    // hub_jogo_id) não a alcança e ela sobra como jogo fantasma nos Periféricos.
    if (formData.hub_jogo_id) desc.hub_jogo_id = String(formData.hub_jogo_id)
    const { error } = await supabase.from(par.tabela).insert([desc])
    if (error) console.warn('[TablePage] Jogo criado, mas falhou a réplica em periféricos:', error.message)
  } catch (err) {
    console.warn('[TablePage] Jogo criado, mas falhou a réplica em periféricos:', err)
  }
  // Escala Geral: mesma partida, funções vazias (integração Fase 4)
  const camp = CAMP_ESCALA_GERAL[config.tableName]
  if (!camp) return
  try {
    const eg = {
      campeonato: camp,
      fase_rodada: formData[par.rodadaDe] ? `Rodada ${formData[par.rodadaDe]}` : '',
      dia: formData.dia || '', data: formData.data || '', horario: formData.hora_brt || '',
      cidade: formData.cidade || '', estadio: formData.estadio || '',
      mandante: formData.mandante || '', visitante: formData.visitante || '',
      transmissao: formData.detentor || '',
      updated_at: new Date().toISOString(),
    }
    if (formData.hub_jogo_id) eg.hub_jogo_id = String(formData.hub_jogo_id)
    const { error } = await supabase.from('escala_geral').insert([eg])
    if (error) console.warn('[TablePage] Jogo criado, mas falhou a réplica na Escala Geral:', error.message)
  } catch (err) {
    console.warn('[TablePage] Jogo criado, mas falhou a réplica na Escala Geral:', err)
  }
}

// Só escolhe a tela — sem hooks nenhum, para que a escolha possa mudar sem
// quebrar a ordem dos hooks. Cada tela abaixo tem os seus e monta/desmonta
// inteira quando a seção troca.
export default function TablePage({ config, novoJogoPedido = false, onNovoJogoConsumido = () => {} }) {
  // section_kind cobre os campeonatos dinâmicos (slug filho é "<x>-periferico",
  // que não passa no startsWith); o startsWith fica pelo fallback hardcoded.
  if (config.sectionKind === 'periferico' || config.id?.startsWith('periferico')) {
    return <PerifericosCards config={config} novoJogoPedido={novoJogoPedido} onNovoJogoConsumido={onNovoJogoConsumido} />
  }
  return <ControlePage config={config} novoJogoPedido={novoJogoPedido} onNovoJogoConsumido={onNovoJogoConsumido} />
}

// Isto era o corpo do próprio TablePage, logo DEPOIS do return condicional
// acima — ou seja, os hooks ficavam abaixo de um return, o que o React proíbe.
// Não quebrava porque o App passa key={section.id} e remonta o componente a
// cada troca de aba; bastava mexer nessa key para virar tela branca.
function ControlePage({ config, novoJogoPedido, onNovoJogoConsumido }) {
  const legacy = useTableData(config.isLegacy ? config.tableName : null)
  const dynamic = useCompetitionEvents(config.isLegacy ? null : config.competitionId)
  const { data, loading, error, addRow, updateRow, deleteRow } = config.isLegacy ? legacy : dynamic

  async function handleStatusChange(id, field, value) {
    await updateRow(id, { [field]: value })
  }

  async function handleCopy(row) {
    const { id, created_at, updated_at, hub_jogo_id, ...rowData } = row
    await addRow(rowData)
  }
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [modal, setModal] = useState({ open: false, mode: 'add', row: null })
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Visão Escala (cards interativos) x Planilha (tabela clássica).
  // Só nas tabelas de controle com escala (grupo "Equipe Técnica").
  const temEscala = config.isLegacy && funcoesDaConfig(config).length > 0
  const viewKey = `viewmode_${config.id || config.tableName}`
  const [view, setViewRaw] = useState(() => {
    if (!temEscala) return 'planilha'
    try { return localStorage.getItem(viewKey) || 'escala' } catch { return 'escala' }
  })
  const setView = v => { setViewRaw(v); try { localStorage.setItem(viewKey, v) } catch { /* sem storage */ } }

  async function handleSaveCampo(id, campo, valor) {
    await updateRow(id, { [campo]: valor })
  }

  const filteredData = useMemo(() => {
    let result = data

    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(r =>
        (r.mandante || '').toLowerCase().includes(q) ||
        (r.visitante || '').toLowerCase().includes(q)
      )
    }

    if (filters.status) {
      result = result.filter(r => r.status === filters.status)
    }

    if (filters.detentor) {
      result = result.filter(r => r.detentor === filters.detentor)
    }

    if (filters.estadio) {
      result = result.filter(r => r.estadio === filters.estadio)
    }

    if (filters.um) {
      result = result.filter(r => r.um === filters.um)
    }

    // Datas são texto livre ("22/08", "06/05/2026"): comparação cronológica
    // via parseData — comparar as strings direto ordenaria por dia, não por data.
    if (filters.dateFrom) {
      const de = parseData(filters.dateFrom)
      if (de) result = result.filter(r => { const d = parseData(r.data); return d && d >= de })
    }

    if (filters.dateTo) {
      const ate = parseData(filters.dateTo)
      if (ate) result = result.filter(r => { const d = parseData(r.data); return d && d <= ate })
    }

    if (filters.rodada) {
      const q = filters.rodada.toLowerCase()
      result = result.filter(r =>
        (r.eu || '').toLowerCase().includes(q) ||
        (r.rod || '').toLowerCase().includes(q)
      )
    }

    return result
  }, [data, filters])

  function openAddModal() {
    // Jogo novo NASCE com o padrão do campeonato: banda, aspecto, compressão,
    // FEC e companhia são iguais em todos os jogos, e digitá-los de novo a
    // cada cadastro era trabalho que a planilha nunca pediu (equipe,
    // 24/09/2026). Quem fugir do padrão é só editar o campo.
    setModal({ open: true, mode: 'add', row: config.padraoTecnico || null })
  }

  function openEditModal(row) {
    setModal({ open: true, mode: 'edit', row })
  }

  function closeModal() {
    setModal({ open: false, mode: 'add', row: null })
  }

  async function handleSave(formData) {
    if (modal.mode === 'add') {
      await addRow(formData)
      await replicarParaPerifericos(config, formData)
    } else {
      // Grava só o que mudou em relação ao snapshot da abertura do modal:
      // mandar a linha inteira sobrescreveria edições concorrentes (outro
      // usuário, ou a visão Escala) feitas enquanto o modal estava aberto.
      const patch = {}
      for (const [k, v] of Object.entries(formData)) {
        if (v !== modal.row[k]) patch[k] = v
      }
      if (Object.keys(patch).length > 0) await updateRow(modal.row.id, patch)
    }
  }

  // Botão "Novo Jogo" do header aponta para cá; consumir o pedido evita
  // reabrir o modal ao navegar de volta para a aba.
  useEffect(() => {
    if (novoJogoPedido) { openAddModal(); onNovoJogoConsumido() }
  }, [novoJogoPedido]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete() {
    if (!confirmDelete) return
    await deleteRow(confirmDelete.id)
    // Apaga também a linha irmã nos Periféricos (mesma partida) — sem isso o
    // jogo excluído do Controle continuaria aparecendo na outra aba.
    const par = config.isLegacy && PAR_PERIFERICO[config.tableName]
    if (par && isConfigured) {
      try {
        if (confirmDelete.hub_jogo_id) {
          await supabase.from(par.tabela).delete().eq('hub_jogo_id', String(confirmDelete.hub_jogo_id))
        } else if (confirmDelete.mandante && confirmDelete.visitante && confirmDelete.data) {
          // Irmã criada sem hub_jogo_id (réplicas antigas): casa pela partida
          await supabase.from(par.tabela).delete()
            .is('hub_jogo_id', null)
            .eq('mandante', confirmDelete.mandante)
            .eq('visitante', confirmDelete.visitante)
            .eq('data', confirmDelete.data)
        }
      } catch (err) {
        console.warn('[TablePage] Jogo excluído, mas falhou ao excluir a linha de periféricos:', err)
      }
    } else if (!config.isLegacy && isConfigured && confirmDelete.mandante && confirmDelete.visitante) {
      // Dinâmico: apaga a irmã nos events do filho periférico, casando a partida
      try {
        const filhoId = await acharFilhoPeriferico(config)
        if (filhoId) {
          await supabase.from('competition_events').delete()
            .eq('competition_id', filhoId)
            .eq('data->>mandante', confirmDelete.mandante)
            .eq('data->>visitante', confirmDelete.visitante)
            .eq('data->>data', confirmDelete.data || '')
        }
      } catch (err) {
        console.warn('[TablePage] Jogo excluído, mas falhou ao excluir a irmã de periféricos (dinâmico):', err)
      }
    }
    setConfirmDelete(null)
  }

  const deleteMessage = confirmDelete
    ? (confirmDelete.mandante && confirmDelete.visitante
      ? `Excluir o jogo "${confirmDelete.mandante} x ${confirmDelete.visitante}"? A linha correspondente nos Periféricos sai junto. (O jogo NÃO é removido do Hub Financeiro.)`
      : 'Excluir este registro?')
    : ''

  if (error) {
    const isConfig = error.includes('Supabase nao configurado') || error.includes('Supabase não configurado')
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{isConfig ? '⚙️' : '⚠️'}</div>
        <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          {isConfig ? 'Banco de dados nao configurado' : 'Erro ao carregar dados'}
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 480, margin: '0 auto 16px' }}>
          {isConfig
            ? 'Crie o arquivo .env na raiz do projeto com as credenciais do Supabase:'
            : error}
        </p>
        {isConfig && (
          <pre style={{
            display: 'inline-block', textAlign: 'left', background: 'var(--bg-surface)',
            border: '1px solid var(--border)', borderRadius: 8, padding: '12px 20px',
            fontSize: 13, color: 'var(--green)', fontFamily: 'monospace'
          }}>
{`VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...`}
          </pre>
        )}
      </div>
    )
  }

  return (
    <div className="table-page">
      <StatsCards data={data} config={config} />

      {temEscala && (
        <div className="view-switch">
          {[['escala', '🗂 Escala'], ['planilha', '▤ Planilha']].map(([v, l]) => (
            <button key={v} className={`view-switch-btn ${view === v ? 'is-active' : ''}`}
              style={view === v ? { borderColor: config.accentColor, color: config.accentColor } : undefined}
              onClick={() => setView(v)}>
              {l}
            </button>
          ))}
        </div>
      )}

      {view === 'escala' && temEscala ? (
        <EscalaView
          data={data}
          config={config}
          onEdit={openEditModal}
          onDelete={setConfirmDelete}
          onStatusChange={handleStatusChange}
          onSaveCampo={handleSaveCampo}
        />
      ) : (<>
        <Filters
          filters={filters}
          onChange={setFilters}
          config={config}
          onAdd={openAddModal}
          data={data}
        />

        <DataTable
          data={filteredData}
          columns={config.columns}
          loading={loading}
          accentColor={config.accentColor}
          onEdit={openEditModal}
          onDelete={setConfirmDelete}
          onStatusChange={handleStatusChange}
          onCopy={handleCopy}
        />
      </>)}

      {modal.open && (
        <GameModal
          mode={modal.mode}
          row={modal.row}
          config={config}
          accentColor={config.accentColor}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={deleteMessage}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
