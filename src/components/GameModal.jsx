import { useState, useEffect, useRef } from 'react'
import { getStatusClass, STATUS_OPTIONS } from '../config/tables'
import { getCustomOptions, addCustomOption } from '../hooks/useCustomOptions'
import { useHubFornecedores, getApelidosForColumn, getColumnPredicate } from '../hooks/useHubFornecedores'
import FornecedorPicker from './FornecedorPicker'

const EXCLUDED = new Set(['id', 'created_at', 'updated_at'])

const SECTION_META = {
  'Jogo':           { icon: '01', color: '#5e85d6', defaultOpen: true },
  'Equipe Tecnica': { icon: '02', color: '#65B32E', defaultOpen: false },
  'Equipamentos':   { icon: '02', color: '#65B32E', defaultOpen: false },
  'Credenciamento': { icon: '03', color: '#d97a3a', defaultOpen: false },
  'Transmissao':    { icon: '04', color: '#d49a3a', defaultOpen: false },
  'Globo':          { icon: '05', color: '#9a8ad6', defaultOpen: false },
  'Tecnico':        { icon: '06', color: '#9a8ad6', defaultOpen: false },
  'Horarios':       { icon: '07', color: '#4fa3b8', defaultOpen: false },
  'Funções':        { icon: '02', color: '#65B32E', defaultOpen: true },
}
const DEFAULT_COLOR = '#5e6373'

function getUniqueGroups(columns) {
  const seen = new Set(); const groups = []
  for (const col of columns) {
    if (col.group && !seen.has(col.group)) { seen.add(col.group); groups.push(col.group) }
  }
  return groups
}

function countFilled(cols, formData) {
  return cols.filter(c => {
    const v = formData[c.key]
    return v !== undefined && v !== null && String(v).trim() !== ''
  }).length
}

function getSmartPlaceholder(col) {
  const hints = {
    'data': 'dd/mm/aaaa',
    'hora_brt': '16:00',
    'mandante': 'Ex: Flamengo',
    'visitante': 'Ex: Palmeiras',
    'estadio': 'Ex: Maracana',
    'cidade': 'Ex: Rio de Janeiro',
    'eu': '1',
    'rod': '1',
    'banda': 'Ex: 18 MHz',
    'sr': 'Ex: 27500',
    'fec': 'Ex: 3/4',
    'aspecto': 'Ex: 16:9',
    'compressao': 'Ex: MPEG-4',
    'transmissao': 'Ex: DVB-S2',
    'modulacao': 'Ex: QPSK',
    'biss_code': 'Ex: 1A2B3C4D...',
    'service_start_gmt': 'Ex: 18:00',
    'service_end_gmt': 'Ex: 21:00',
    'abertura_brt': 'Ex: 15:00',
    'fechamento_brt': 'Ex: 18:00',
    'total_horas': 'Ex: 3:00',
  }
  return hints[col.key] || ''
}

function SelectWithAdd({ col, value, onSet, accentColor, hubFornecedores }) {
  const [adding, setAdding] = useState(false)
  const [newValue, setNewValue] = useState('')
  const [customOpts, setCustomOpts] = useState(() => getCustomOptions(col.key))
  const inputRef = useRef(null)

  const hubApelidos = getApelidosForColumn(col.key, hubFornecedores || [])
  const merged = [...(col.options || []), ...hubApelidos, ...customOpts]
  const allOptions = Array.from(new Set(merged))

  function handleAdd() {
    const trimmed = newValue.trim()
    if (trimmed && !allOptions.includes(trimmed)) {
      addCustomOption(col.key, trimmed)
      setCustomOpts(prev => [...prev, trimmed])
      onSet(col.key, trimmed)
    }
    setNewValue('')
    setAdding(false)
  }

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus()
  }, [adding])

  return (
    <div className="select-with-add">
      <select className="form-select" value={value}
        onChange={e => onSet(col.key, e.target.value)}
        onFocus={e => e.target.style.borderColor = accentColor}
        onBlur={e => e.target.style.borderColor = ''}>
        <option value="">-- Selecione --</option>
        {allOptions.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {adding ? (
        <div className="add-option-row">
          <input
            ref={inputRef}
            className="form-input add-option-input"
            type="text"
            placeholder="Novo valor..."
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd()
              if (e.key === 'Escape') { setAdding(false); setNewValue('') }
            }}
          />
          <button type="button" className="btn-add-option" style={{ background: accentColor }} onClick={handleAdd}>+</button>
          <button type="button" className="btn-cancel-option" onClick={() => { setAdding(false); setNewValue('') }}>x</button>
        </div>
      ) : (
        <button type="button" className="btn-new-option" onClick={() => setAdding(true)} title="Cadastrar nova opcao">
          +
        </button>
      )}
    </div>
  )
}

function FormSection({ group, cols, formData, onSet, accentColor, hubFornecedores }) {
  const metaKey = Object.keys(SECTION_META).find(k =>
    k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') ===
    group.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  )
  const meta = (metaKey && SECTION_META[metaKey]) || { icon: '·', color: DEFAULT_COLOR, defaultOpen: false }
  const [open, setOpen] = useState(meta.defaultOpen)
  const filled = countFilled(cols, formData)

  return (
    <div className="form-section">
      <button
        type="button"
        className={`form-section-header${open ? ' open' : ''}`}
        style={{ '--section-color': meta.color }}
        onClick={() => setOpen(o => !o)}
      >
        <span className="form-section-icon">{meta.icon}</span>
        <span className="form-section-label">{group}</span>
        <span className="form-section-count" style={{ color: filled > 0 ? meta.color : undefined }}>
          {filled}/{cols.length}
        </span>
        <span className="form-section-arrow">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="modal-form-grid form-section-body">
          {cols.filter(col => !col.linkedTo || formData[col.linkedTo] === 'Sim').map(col => {
            const value = formData[col.key] ?? ''
            const isStatus = col.statusColor

            return (
              <div key={col.key} className="form-field"
                style={isStatus ? { gridColumn: '1 / -1' } : {}}>
                <label className="form-label">{col.label}</label>

                {isStatus ? (
                  <div className="status-picker">
                    {STATUS_OPTIONS.map(opt => (
                      <button
                        key={opt} type="button"
                        className={`status-picker-btn status-badge ${getStatusClass(opt)}${value === opt ? ' selected' : ''}`}
                        onClick={() => onSet(col.key, opt)}
                      >
                        {value === opt ? '+ ' : ''}{opt}
                      </button>
                    ))}
                  </div>
                ) : col.type === 'simnao' ? (
                  <div className="simnao-picker">
                    <button
                      type="button"
                      className={`simnao-btn${value === 'Sim' ? ' active sim' : ''}`}
                      onClick={() => onSet(col.key, 'Sim')}
                    ><span className="simnao-icon">✓</span>Sim</button>
                    <button
                      type="button"
                      className={`simnao-btn${(value === 'Não' || value === 'Nao') ? ' active nao' : ''}`}
                      onClick={() => onSet(col.key, 'Não')}
                    ><span className="simnao-icon">✕</span>Não</button>
                  </div>
                ) : getColumnPredicate(col.key) ? (
                  // Coluna de fornecedor/prestador: picker da base compartilhada
                  <FornecedorPicker
                    value={value}
                    onChange={v => onSet(col.key, v)}
                    colKey={col.key}
                    fornecedores={hubFornecedores}
                    placeholder={`${col.label}...`}
                  />
                ) : col.type === 'select' ? (
                  <SelectWithAdd col={col} value={value} onSet={onSet} accentColor={accentColor} hubFornecedores={hubFornecedores} />
                ) : col.type === 'url' ? (
                  <input className="form-input" type="url" value={value}
                    placeholder="https://"
                    onChange={e => onSet(col.key, e.target.value)}
                    onFocus={e => e.target.style.borderColor = accentColor}
                    onBlur={e => e.target.style.borderColor = ''} />
                ) : col.type === 'textarea' ? (
                  <textarea className="form-textarea" rows={2} value={value}
                    onChange={e => onSet(col.key, e.target.value)}
                    onFocus={e => e.target.style.borderColor = accentColor}
                    onBlur={e => e.target.style.borderColor = ''} />
                ) : (
                  <input className="form-input" type="text" value={value}
                    placeholder={getSmartPlaceholder(col)}
                    onChange={e => onSet(col.key, e.target.value)}
                    onFocus={e => e.target.style.borderColor = accentColor}
                    onBlur={e => e.target.style.borderColor = ''} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function GameModal({ mode, row, config, onClose, onSave, accentColor }) {
  const groups = getUniqueGroups(config.columns)
  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const { fornecedores: hubFornecedores } = useHubFornecedores()

  useEffect(() => {
    // No modo EDITAR, `row` é o jogo. No modo NOVO, é o padrão técnico do
    // campeonato — banda, aspecto, compressão, FEC: campos iguais em todos os
    // jogos, que antes eram digitados um a um a cada cadastro. Nos dois casos o
    // formulário começa com o que veio; a diferença é só de onde veio.
    setFormData(row ? { ...row } : {})
    setSaveError('')
  }, [row, mode])

  function set(key, value) {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true); setSaveError('')
    try { await onSave(formData); onClose() }
    catch (err) { setSaveError(err.message || 'Erro ao salvar.') }
    finally { setSaving(false) }
  }

  const allCols = config.columns.filter(c => !EXCLUDED.has(c.key))
  const totalFilled = countFilled(allCols, formData)
  const fillPct = allCols.length > 0 ? Math.round((totalFilled / allCols.length) * 100) : 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-header-accent" style={{ background: accentColor }} />
            <div>
              <div className="modal-title">{mode === 'add' ? '+ Novo Jogo' : 'Editar Jogo'}</div>
              <div className="modal-subtitle">{config.label}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <button className="modal-close" onClick={onClose}>x</button>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {totalFilled}/{allCols.length} campos -- {fillPct}%
            </span>
          </div>
        </div>

        <div style={{ height: 3, background: 'var(--border)' }}>
          <div style={{
            height: '100%', background: accentColor, borderRadius: 0,
            width: fillPct + '%', transition: 'width 0.3s ease'
          }} />
        </div>

        <div className="modal-hint-bar">
          <span>Clique em cada secao para expandir e preencher os campos</span>
          <span style={{ color: 'var(--text-dim)' }}>Tab para avancar entre campos | Ctrl+Enter para salvar</span>
        </div>

        <div className="modal-body" onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave() }}>
          {groups.map(group => {
            const cols = config.columns.filter(c => c.group === group && !EXCLUDED.has(c.key))
            if (!cols.length) return null
            return (
              <FormSection
                key={group}
                group={group}
                cols={cols}
                formData={formData}
                onSet={set}
                accentColor={accentColor}
                hubFornecedores={hubFornecedores}
              />
            )
          })}

          {saveError && <div className="save-error">{saveError}</div>}
        </div>

        <div className="modal-footer">
          <span className="modal-save-hint">Ctrl+Enter para salvar rapidamente</span>
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="btn-save" style={{ backgroundColor: accentColor }}
            onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
