import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// ─── HISTÓRICO DE ALTERAÇÕES (auditoria) ─────────────────────────────────────
// Vive dentro do menu ☰ — é ferramenta de auditoria, não de consulta diária.
// Só busca os dados QUANDO aberto (nenhuma assinatura permanente de fundo).

const CORES = ['#65B32E', '#2563EB', '#D97706', '#DC2626', '#7C3AED', '#0D9488', '#DB2777', '#B45309']
const corDe = s => { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return CORES[h % CORES.length] }
const iniciais = nome => String(nome || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()

const NOME_TABELA = {
  brasileirao_jogos: 'Controle BR', perifericos_brasileirao: 'Periféricos BR',
  paulistao_feminino_jogos: 'Controle PF', perifericos_paulistao: 'Periféricos PF',
  escala_geral: 'Escala Geral', escala_confirmacoes: 'Confirmação de presença',
  prestador_links: 'Links externos',
  folgas_dias: 'Escala interna', folgas_pessoas: 'Escala interna · pessoas',
  folgas_categorias: 'Escala interna · categorias', folgas_feriados: 'Feriados',
  folgas_ajustes: 'Escala interna · saldo',
}
const NOME_CAMPO = {
  um: 'UM', sng: 'SNG', sng_premiere: 'SNG Premiere', sng_host: 'SNG Host', gerador: 'Gerador',
  supervisores_1: 'Supervisor 1', supervisores_2: 'Supervisor 2', supervisor_um_host: 'Supervisor 1',
  dtv: 'DTV', op_vmix: 'vMix', op_audio: 'Áudio', teleporto: 'Teleporto', satelite: 'Satélite',
  coordenador_um: 'Coordenador UM', produtor_um: 'Produtor UM', produtor_campo: 'Produtor Campo',
  monitoracao: 'Monitoração', escala_publicada: 'publicação da escala', credenciamento: 'Credenciamento',
  status: 'Status', obs: 'Observações', hub_jogo_id: 'vínculo com o Hub',
  categoria_id: 'o que a pessoa fez no dia', detalhe: 'descritivo do dia',
  campeonato: 'campeonato', jogo_mandante: 'jogo apontado', jogo_visitante: 'jogo apontado',
  jogo_camp: 'campeonato do jogo', jogo_comp_id: 'jogo apontado', jogo_data: 'data do jogo',
  delta: 'saldo trazido de antes', vale_de: 'a partir de quando vale', motivo: 'motivo',
  nomes_escala: 'nomes na escala dos jogos', ativo: 'ativa/inativa',
  conta_folga: 'consome folga', curto: 'sigla', cor: 'cor', ordem: 'posição na lista',
}
const nomeCampo = c => NOME_CAMPO[c] || c.replace(/^fornecedor_/, '').replace(/_/g, ' ')

function tempoAtras(ts) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 60) return 'agora'
  if (s < 3600) return `${Math.floor(s / 60)} min`
  if (s < 86400) return `${Math.floor(s / 3600)} h`
  return new Date(ts).toLocaleDateString('pt-BR')
}

// Agrupa: edições da MESMA pessoa no MESMO jogo em sequência (15 min) = 1 card
function agruparFeed(feed) {
  const grupos = []
  for (const a of feed) {
    const ult = grupos[grupos.length - 1]
    const mesmoGrupo = ult && ult.usuario === a.usuario && ult.tabela === a.tabela
      && ult.rotulo === a.rotulo && ult.acao === a.acao
      && (new Date(ult.quando) - new Date(a.created_at)) < 15 * 60 * 1000
    if (mesmoGrupo) ult.itens.push(a)
    else grupos.push({ usuario: a.usuario, tabela: a.tabela, rotulo: a.rotulo, acao: a.acao, quando: a.created_at, itens: [a] })
  }
  return grupos
}

// Efeito líquido por campo; troca-e-volta vira "alterado e revertido"
function mudancasDoGrupo(grupo) {
  const porCampo = {}
  for (const item of [...grupo.itens].reverse()) {
    if (!item.mudancas) continue
    for (const [campo, m] of Object.entries(item.mudancas)) {
      if (!porCampo[campo]) porCampo[campo] = { de: m.de, para: m.para, passouPor: [m.para] }
      else { porCampo[campo].para = m.para; porCampo[campo].passouPor.push(m.para) }
    }
  }
  return Object.entries(porCampo).map(([campo, m]) => [campo, { ...m, revertido: m.de === m.para }])
}

export default function HistoricoAlteracoes({ onClose }) {
  const [feed, setFeed] = useState(null)
  const [busca, setBusca] = useState('')
  const [expandidos, setExpandidos] = useState(new Set())
  const ref = useRef(null)

  useEffect(() => {
    let cancelado = false
    supabase.from('portal_atividades').select('*').order('created_at', { ascending: false }).limit(300)
      .then(({ data }) => { if (!cancelado) setFeed(data || []) })
    return () => { cancelado = true }
  }, [])

  useEffect(() => {
    const fechar = e => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [onClose])

  const q = busca.trim().toLowerCase()
  const grupos = feed === null ? [] : agruparFeed(feed).filter(g => {
    if (!q) return true
    const alvo = [g.usuario, g.rotulo, NOME_TABELA[g.tabela],
      ...g.itens.flatMap(i => (i.campos || []).map(nomeCampo)),
      ...g.itens.flatMap(i => i.mudancas ? Object.values(i.mudancas).flatMap(m => [m.de, m.para]) : []),
    ].join(' ').toLowerCase()
    return alvo.includes(q)
  })

  return (
    <div className="pb-painel hd-historico" ref={ref}>
      <p className="pb-painel-titulo">Histórico de alterações</p>
      <input className="pb-busca" autoFocus placeholder="🔍 Filtrar por jogo, pessoa, campo ou valor..."
        value={busca} onChange={e => setBusca(e.target.value)} />
      {feed === null && <p className="pb-vazio">Carregando...</p>}
      {feed !== null && grupos.length === 0 && <p className="pb-vazio">{q ? 'Nada encontrado com esse filtro.' : 'Nenhuma alteração registrada ainda.'}</p>}
      {grupos.slice(0, 60).map(g => {
        const gid = `${g.usuario}|${g.rotulo}|${g.quando}`
        const mudancas = mudancasDoGrupo(g)
        const expandido = expandidos.has(gid)
        const podeExpandir = mudancas.length > 0
        return (
          <div key={gid} className="pb-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
            <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', cursor: podeExpandir ? 'pointer' : 'default' }}
              onClick={() => podeExpandir && setExpandidos(prev => {
                const n = new Set(prev); n.has(gid) ? n.delete(gid) : n.add(gid); return n
              })}>
              <span className="pb-avatar" style={{ background: corDe(g.usuario), flexShrink: 0 }}>{iniciais(g.usuario)}</span>
              <div className="pb-item-corpo" style={{ flex: 1 }}>
                <p>
                  <strong>{g.usuario || '?'}</strong> {g.acao}{' '}
                  {g.rotulo ? <strong>{g.rotulo}</strong> : NOME_TABELA[g.tabela] || g.tabela}
                  {mudancas.length > 0 && <span className="pb-campos"> · {mudancas.length} {mudancas.length === 1 ? 'campo' : 'campos'}</span>}
                </p>
                <span className="pb-quando">{NOME_TABELA[g.tabela] || g.tabela} · {tempoAtras(g.quando)}</span>
              </div>
              {podeExpandir && <span className="pb-seta">{expandido ? '▴' : '▾'}</span>}
            </div>
            {expandido && (
              <div className="pb-difs">
                {mudancas.map(([campo, m]) => (
                  <div key={campo} className="pb-dif">
                    <span className="pb-dif-campo">{nomeCampo(campo)}</span>
                    {m.revertido ? (
                      <span className="pb-dif-rev" title={`Passou por: ${m.passouPor.map(v => v || '(vazio)').join(' → ')}`}>
                        ↩ alterado e revertido (segue "{m.de || '(vazio)'}")
                      </span>
                    ) : (<>
                      <span className="pb-dif-de">{m.de || '(vazio)'}</span>
                      <span className="pb-dif-seta">→</span>
                      <span className="pb-dif-para">{m.para || '(vazio)'}</span>
                    </>)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
