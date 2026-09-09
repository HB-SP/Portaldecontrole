import { useState, useEffect } from 'react'
import { getStatusClass, STATUS_OPTIONS } from '../config/tables'

const GROUP_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#a78bfa', '#06b6d4']
function getGroupColor(i) { return GROUP_COLORS[i % GROUP_COLORS.length] }

function buildGroupHeaders(columns) {
  const groups = []; let cur = null; let span = 0; let idx = 0
  for (const col of columns) {
    const g = col.group || ''
    if (g !== cur) {
      if (cur !== null) groups.push({ label: cur, colspan: span, colorIndex: idx++ })
      cur = g; span = 1
    } else span++
  }
  if (cur !== null) groups.push({ label: cur, colspan: span, colorIndex: idx })
  return groups
}

function getRowClass(row) {
  const map = { 'Confirmado': 'row-confirmado', 'Pendente': 'row-pendente', 'Cancelado': 'row-cancelado', 'Em andamento': 'row-em-andamento', 'Aguardando': 'row-aguardando' }
  return map[row.status] || ''
}

export default function DataTable({ data, columns, loading, accentColor, onEdit, onDelete, onStatusChange, onCopy }) {
  const [hoveredRow, setHoveredRow] = useState(null)
  const [statusMenu, setStatusMenu] = useState(null) // { rowId, field, x, y }
  const groupHeaders = buildGroupHeaders(columns)
  const stickyColumns = columns.filter(c => c.sticky)
  const lastStickyKey = stickyColumns.length > 0 ? stickyColumns[stickyColumns.length - 1].key : null
  const hasStatusCol = !!columns.find(c => c.statusColor)

  // Close status menu on outside click
  useEffect(() => {
    if (!statusMenu) return
    const close = () => setStatusMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [statusMenu])

  function handleStatusClick(e, row, field) {
    e.stopPropagation()
    if (statusMenu?.rowId === row.id && statusMenu?.field === field) {
      setStatusMenu(null)
    } else {
      setStatusMenu({ rowId: row.id, field })
    }
  }

  const theadRows = (
    <thead>
      <tr>
        {groupHeaders.map((g, i) => (
          <th key={i} colSpan={g.colspan} className="group-header-cell"
            style={{ borderLeftColor: getGroupColor(g.colorIndex) }}>
            {g.label}
          </th>
        ))}
        <th className="group-header-cell" style={{ borderLeftColor: 'transparent' }} />
      </tr>
      <tr>
        {columns.map(col => (
          <th key={col.key} style={{
            minWidth: col.width + 'px',
            ...(col.sticky ? {
              position: 'sticky', left: col.stickyLeft + 'px', zIndex: 3,
              background: 'var(--bg-surface)',
              ...(col.key === lastStickyKey ? { boxShadow: '3px 0 8px rgba(0,0,0,0.4)' } : {}),
            } : {}),
          }}>
            {col.label}
          </th>
        ))}
        <th style={{ minWidth: '110px', position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-surface)' }}>
          Ações
        </th>
      </tr>
    </thead>
  )

  if (loading) {
    return (
      <div className="table-container">
        <table className="data-table">{theadRows}
          <tbody>
            {[0, 1, 2, 3].map(i => (
              <tr key={i} className="skeleton-row">
                {columns.map(col => <td key={col.key}><div className="skeleton-cell" /></td>)}
                <td><div className="skeleton-cell" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="table-container">
        <div className="empty-state">
          <div style={{ fontSize: 44, marginBottom: 12 }}>📋</div>
          <p style={{ fontWeight: 700, marginBottom: 6 }}>Nenhum jogo encontrado</p>
          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            Clique em <strong style={{ color: accentColor }}>+ Novo Jogo</strong> para adicionar o primeiro registro.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="table-container">
      <table className="data-table">
        {theadRows}
        <tbody>
          {data.map(row => {
            const isHovered = hoveredRow === row.id
            return (
              <tr
                key={row.id}
                className={getRowClass(row)}
                onMouseEnter={() => setHoveredRow(row.id)}
                onMouseLeave={() => setHoveredRow(null)}
                onClick={() => onEdit(row)}
              >
                {columns.map(col => {
                  const value = row[col.key]
                  const isLastSticky = col.key === lastStickyKey
                  const stickyStyle = col.sticky ? {
                    position: 'sticky', left: col.stickyLeft + 'px', zIndex: 2,
                    background: isHovered ? 'var(--bg-hover)' : 'var(--bg-card)',
                    ...(isLastSticky ? { boxShadow: '3px 0 8px rgba(0,0,0,0.4)' } : {}),
                  } : {}

                  let content

                  if (col.statusColor) {
                    // Inline status editor — click to change without opening modal
                    const isMenuOpen = statusMenu?.rowId === row.id && statusMenu?.field === col.key
                    content = (
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <span
                          className={`status-badge ${getStatusClass(value)} status-clickable`}
                          title="Clique para alterar status"
                          onClick={e => handleStatusClick(e, row, col.key)}
                        >
                          {value || '— Status'}
                        </span>
                        {isMenuOpen && (
                          <div className="status-inline-menu" onClick={e => e.stopPropagation()}>
                            <div className="status-inline-title">Alterar status</div>
                            {STATUS_OPTIONS.map(opt => (
                              <button
                                key={opt}
                                className={`status-inline-opt status-badge ${getStatusClass(opt)}${value === opt ? ' current' : ''}`}
                                onClick={e => {
                                  e.stopPropagation()
                                  onStatusChange && onStatusChange(row.id, col.key, opt)
                                  setStatusMenu(null)
                                }}
                              >
                                {value === opt ? '✓ ' : ''}{opt}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  } else if (col.type === 'url' && value?.trim()) {
                    content = (
                      <a href={value} target="_blank" rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ color: accentColor, textDecoration: 'none', fontSize: 12 }}>
                        🔗 Abrir
                      </a>
                    )
                  } else if (col.type === 'simnao') {
                    const isSim = value === 'Sim'
                    const isNao = value === 'Não' || value === 'Nao'
                    // Valor que não é Sim nem Não (importação trouxe "Aguardando
                    // OK", "Parcial"...) ficava INVISÍVEL: nenhum botão acendia e
                    // o texto não era mostrado em lugar nenhum. Agora aparece do
                    // lado, e o clique nos botões segue trocando.
                    const outro = value && String(value).trim() && !isSim && !isNao
                      ? String(value).trim() : null
                    content = (
                      <div className="simnao-cell" onClick={e => e.stopPropagation()}>
                        {outro && (
                          <span className="simnao-outro" title={`Valor gravado: ${outro}`}>{outro}</span>
                        )}
                        <button
                          type="button"
                          className={`simnao-btn${isSim ? ' active sim' : ''}`}
                          title="Sim"
                          onClick={() => onStatusChange?.(row.id, col.key, 'Sim')}
                        ><span className="simnao-icon">✓</span>Sim</button>
                        <button
                          type="button"
                          className={`simnao-btn${isNao ? ' active nao' : ''}`}
                          title="Não"
                          onClick={() => onStatusChange?.(row.id, col.key, 'Não')}
                        ><span className="simnao-icon">✕</span>Não</button>
                      </div>
                    )
                  } else if (col.linkedTo) {
                    const enabled = row[col.linkedTo] === 'Sim'
                    content = enabled
                      ? (value || <span style={{ color: 'var(--text-dim)' }}>—</span>)
                      : <span className="linked-disabled" title={`Habilitar ${col.linkedTo} para preencher`}>n/a</span>
                  } else {
                    content = value || <span style={{ color: 'var(--text-dim)' }}>—</span>
                  }

                  return <td key={col.key} style={stickyStyle}>{content}</td>
                })}

                {/* Actions */}
                <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: 3 }}>
                    <button className="btn-edit" title="Editar todos os campos"
                      onClick={e => { e.stopPropagation(); onEdit(row) }}>✏️</button>
                    {onCopy && (
                      <button className="btn-copy" title="Duplicar linha"
                        onClick={e => { e.stopPropagation(); onCopy(row) }}>📋</button>
                    )}
                    <button className="btn-delete" title="Excluir"
                      onClick={e => { e.stopPropagation(); onDelete(row) }}>🗑️</button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
