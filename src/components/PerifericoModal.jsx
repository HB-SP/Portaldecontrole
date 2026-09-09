import { useEffect, useState } from 'react'
import { getEscudoUrl } from '../lib/escudos'
import { useHubFornecedores, getColumnPredicate } from '../hooks/useHubFornecedores'
import FornecedorPicker from './FornecedorPicker'
import { equipamentosDaConfig } from '../config/equipamentos'

// A lista vinha HARDCODED aqui e — igual — no PerifericosCards. Agora vem de
// ../config/equipamentos, derivada das colunas quando o campeonato é dinâmico.

export default function PerifericoModal({ row, mode, config, accentColor, onClose, onSave }) {
  const [data, setData] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { fornecedores: hubFornecedores } = useHubFornecedores()
  // Sem config (chamada antiga) cai na lista fixa do legado.
  const EQUIPAMENTOS = equipamentosDaConfig(config)

  useEffect(() => {
    setData(mode === 'edit' && row ? { ...row } : {})
    setError('')
  }, [row, mode])

  function set(key, value) { setData(prev => ({ ...prev, [key]: value })) }

  function toggleEquip(eq, valor) {
    setData(prev => {
      const next = { ...prev, [eq.key]: valor }
      // Limpa fornecedor/qtde se desmarcou
      if (valor === 'Não') {
        if (eq.fornecedor) next[eq.fornecedor] = ''
        if (eq.qtde) next[eq.qtde] = ''
      }
      return next
    })
  }

  async function handleSave() {
    setSaving(true); setError('')
    try { await onSave(data); onClose() }
    catch (e) { setError(e.message || 'Erro ao salvar.') }
    finally { setSaving(false) }
  }

  const ativos = EQUIPAMENTOS.filter(eq => data[eq.key] === 'Sim').length

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel periferico-modal" onClick={e => e.stopPropagation()}>

        {/* Header — info do Hub */}
        <div className="periferico-modal-header" style={{ borderTopColor: accentColor }}>
          <div className="pm-header-top">
            <div>
              <span className="pm-rodada" style={{ background: accentColor }}>R{data.rod || '?'}</span>
              {data.padrao && <span className={`card-padrao p-${String(data.padrao).toLowerCase()}`}>{data.padrao}</span>}
              {data.detentor && <span className="card-detentor">{data.detentor}</span>}
            </div>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
          <div className="pm-teams">
            <div className="pm-team-side home">
              {getEscudoUrl(data.mandante) && <img className="pm-team-logo" src={getEscudoUrl(data.mandante)} alt={data.mandante} />}
              <span className="team">{data.mandante || '—'}</span>
            </div>
            <span className="team-vs">×</span>
            <div className="pm-team-side away">
              {getEscudoUrl(data.visitante) && <img className="pm-team-logo" src={getEscudoUrl(data.visitante)} alt={data.visitante} />}
              <span className="team">{data.visitante || '—'}</span>
            </div>
          </div>
          <div className="pm-meta">
            {data.data && <span>{data.data}</span>}
            {data.hora_brt && <span>{data.hora_brt}</span>}
            {data.cidade && <span>{data.cidade}</span>}
            {data.estadio && <span style={{ fontStyle: 'italic' }}>{data.estadio}</span>}
          </div>
        </div>

        <div className="periferico-modal-body">
          {/* Credenciamento */}
          <div className="pm-section">
            <label className="pm-section-title">Credenciamento</label>
            <input
              className="form-input"
              type="text"
              value={data.credenciamento || ''}
              onChange={e => set('credenciamento', e.target.value)}
              placeholder="Status do credenciamento..."
            />
          </div>

          {/* Equipamentos */}
          <div className="pm-section">
            <div className="pm-section-row">
              <label className="pm-section-title">Equipamentos</label>
              <span className="pm-counter" style={{ color: accentColor }}>{ativos} ativo{ativos === 1 ? '' : 's'}</span>
            </div>

            <div className="pm-equip-list">
              {EQUIPAMENTOS.map(eq => {
                const valor = data[eq.key]
                const isSim = valor === 'Sim'
                const isNao = valor === 'Não' || valor === 'Nao'
                return (
                  <div key={eq.key} className={`pm-equip-row${isSim ? ' active' : ''}`}>
                    <div className="pm-equip-toggle">
                      <span className="pm-equip-name">{eq.label}</span>
                      <div className="simnao-picker">
                        <button
                          type="button"
                          className={`simnao-btn${isSim ? ' active sim' : ''}`}
                          onClick={() => toggleEquip(eq, 'Sim')}
                        ><span className="simnao-icon">✓</span>Sim</button>
                        <button
                          type="button"
                          className={`simnao-btn${isNao ? ' active nao' : ''}`}
                          onClick={() => toggleEquip(eq, 'Não')}
                        ><span className="simnao-icon">✕</span>Não</button>
                      </div>
                    </div>

                    {isSim && (
                      <div className="pm-equip-extras">
                        {eq.qtde && (
                          <input
                            className="form-input pm-qtde"
                            type="text"
                            value={data[eq.qtde] || ''}
                            onChange={e => set(eq.qtde, e.target.value)}
                            placeholder="Qtde."
                          />
                        )}
                        {eq.fornecedor && (
                          <div className="pm-forn">
                            <FornecedorPicker
                              value={data[eq.fornecedor] || ''}
                              onChange={v => set(eq.fornecedor, v)}
                              colKey={eq.fornecedor}
                              fornecedores={hubFornecedores}
                              placeholder="Fornecedor"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {error && <div className="save-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
          <button
            className="btn-save"
            style={{ backgroundColor: accentColor }}
            onClick={handleSave}
            disabled={saving}
          >{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}
