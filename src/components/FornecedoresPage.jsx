import { useState, useMemo, useEffect } from 'react'
import { useHubFornecedores } from '../hooks/useHubFornecedores'
import { supabase, isConfigured } from '../lib/supabase'

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const TIPO_COLORS = {
  'PJ':      { bg: '#EDF7E5', color: '#3a7a12' },
  'PF':      { bg: '#E8F0FD', color: '#2d5eac' },
  'Empresa': { bg: '#FDF3E8', color: '#8a4a0a' },
}

function TipoBadge({ tipo }) {
  const style = TIPO_COLORS[tipo] || { bg: '#F0F0F0', color: '#585455' }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 0.3,
      background: style.bg,
      color: style.color,
    }}>
      {tipo || '—'}
    </span>
  )
}

// Normalização para casar apelido ↔ nomes gravados nas escalas
const normEmUso = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

// Conta em quantos JOGOS cada nome aparece nas escalas do Portal (uma consulta
// leve por tabela ao abrir a página; nada roda de fundo).
const FONTES_USO = [
  ['brasileirao_jogos', ['um', 'sng_premiere', 'sng_host', 'gerador', 'supervisores_1', 'supervisores_2', 'liveu_1', 'liveu_2', 'dtv', 'op_vmix', 'op_audio', 'teleporto']],
  ['paulistao_feminino_jogos', ['um', 'sng', 'gerador', 'supervisor_um_host', 'dtv', 'op_vmix', 'teleporto', 'refcam']],
  ['perifericos_brasileirao', ['fornecedor_drone', 'fornecedor_minidrone', 'fornecedor_dslr', 'fornecedor_grua', 'fornecedor_goalcam', 'fornecedor_trilho', 'fornecedor_carrinho', 'fornecedor_clipcam']],
  ['perifericos_paulistao', ['fornecedor_drone', 'fornecedor_minidrone', 'fornecedor_dslr', 'fornecedor_grua', 'fornecedor_goalcam', 'fornecedor_trilho', 'fornecedor_carrinho', 'fornecedor_clipcam']],
  ['escala_geral', ['coordenador_um', 'produtor_um', 'produtor_campo', 'monitoracao']],
]

export default function FornecedoresPage() {
  const { fornecedores, loading } = useHubFornecedores()
  const [search, setSearch] = useState('')
  const [filterFuncao, setFilterFuncao] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [usosPorNome, setUsosPorNome] = useState(new Map())

  useEffect(() => {
    if (!isConfigured) return
    let cancelado = false
    async function contar() {
      const mapa = new Map()
      for (const [tabela, cols] of FONTES_USO) {
        const { data } = await supabase.from(tabela).select(cols.join(','))
        if (cancelado || !data) return
        for (const row of data) {
          const nomesDoJogo = new Set()
          for (const col of cols) {
            const v = row[col]
            if (!v) continue
            String(v).split('/').forEach(seg => {
              const base = seg.replace(/\s*\([^)]*\)\s*/g, ' ')
                .replace(/[\s-]+(record news|record|youtube|yt|premiere|cazetv|amazon|tnt|hbo)$/i, '')
                .replace(/\s+cobre$/i, '')
              const k = normEmUso(base)
              if (k && !/^(nao|sim)$/.test(k)) nomesDoJogo.add(k)
            })
          }
          nomesDoJogo.forEach(k => mapa.set(k, (mapa.get(k) || 0) + 1))
        }
      }
      if (!cancelado) setUsosPorNome(mapa)
    }
    contar()
    return () => { cancelado = true }
  }, [])

  const funcoes = useMemo(() => {
    const set = new Set(fornecedores.map(f => f.funcao).filter(Boolean))
    return [...set].sort()
  }, [fornecedores])

  const tipos = useMemo(() => {
    const set = new Set(fornecedores.map(f => f.tipo).filter(Boolean))
    return [...set].sort()
  }, [fornecedores])

  const filtered = useMemo(() => {
    const q = norm(search)
    return fornecedores.filter(f => {
      if (filterFuncao && f.funcao !== filterFuncao) return false
      if (filterTipo && f.tipo !== filterTipo) return false
      if (q) {
        return norm(f.apelido).includes(q) ||
               norm(f.razaoSocial).includes(q) ||
               norm(f.funcao).includes(q)
      }
      return true
    })
  }, [fornecedores, search, filterFuncao, filterTipo])

  const stats = useMemo(() => {
    const byTipo = {}
    fornecedores.forEach(f => {
      const t = f.tipo || 'Sem tipo'
      byTipo[t] = (byTipo[t] || 0) + 1
    })
    return byTipo
  }, [fornecedores])

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div className="skeleton-cell" style={{ width: 200, height: 20, margin: '0 auto 16px' }} />
        <div className="skeleton-cell" style={{ width: 300, height: 14, margin: '0 auto' }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '12px 20px', minWidth: 120,
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{fornecedores.length}</div>
        </div>
        {Object.entries(stats).map(([tipo, count]) => (
          <div key={tipo} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '12px 20px', minWidth: 100,
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{tipo}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{count}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 340 }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}
            viewBox="0 0 16 16" fill="none" width="14" height="14">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por apelido, razão social..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', height: 34, paddingLeft: 32, paddingRight: 10,
              border: '1px solid var(--border)', borderRadius: 6,
              background: 'var(--bg-card)', color: 'var(--text)',
              fontSize: 13, fontFamily: 'inherit', outline: 'none',
            }}
          />
        </div>

        <select
          value={filterFuncao}
          onChange={e => setFilterFuncao(e.target.value)}
          style={{
            height: 34, padding: '0 10px', border: '1px solid var(--border)',
            borderRadius: 6, background: 'var(--bg-card)', color: filterFuncao ? 'var(--text)' : 'var(--text-dim)',
            fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="">Todas as funções</option>
          {funcoes.map(f => <option key={f} value={f}>{f}</option>)}
        </select>

        <select
          value={filterTipo}
          onChange={e => setFilterTipo(e.target.value)}
          style={{
            height: 34, padding: '0 10px', border: '1px solid var(--border)',
            borderRadius: 6, background: 'var(--bg-card)', color: filterTipo ? 'var(--text)' : 'var(--text-dim)',
            fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="">Todos os tipos</option>
          {tipos.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {(search || filterFuncao || filterTipo) && (
          <button
            onClick={() => { setSearch(''); setFilterFuncao(''); setFilterTipo('') }}
            style={{
              height: 34, padding: '0 12px', border: '1px solid var(--border)',
              borderRadius: 6, background: 'transparent', color: 'var(--text-muted)',
              fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            Limpar
          </button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-dim)' }}>
          {filtered.length} fornecedor{filtered.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* Tabela */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 8, overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
              {['Apelido', 'Tipo', 'Função', 'Razão Social', 'Em uso na escala'].map(h => (
                <th key={h} style={{
                  padding: '10px 16px', textAlign: 'left',
                  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
                  Nenhum fornecedor encontrado
                </td>
              </tr>
            ) : (
              filtered.map((f, i) => (
                <tr
                  key={f.id || i}
                  style={{
                    borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text)' }}>
                    {f.apelido || '—'}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <TipoBadge tipo={f.tipo} />
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>
                    {f.funcao || '—'}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-dim)', fontSize: 12 }}>
                    {f.razaoSocial || '—'}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                    {usosPorNome.get(normEmUso(f.apelido)) > 0
                      ? <span style={{ fontWeight: 700, color: 'var(--text)' }}>{usosPorNome.get(normEmUso(f.apelido))} jogo{usosPorNome.get(normEmUso(f.apelido)) !== 1 ? 's' : ''}</span>
                      : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'right' }}>
        Dados sincronizados do Hub Financeiro · somente leitura
      </div>
    </div>
  )
}
